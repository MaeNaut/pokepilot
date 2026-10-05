import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';
import { analyzeWithOpenAiLuna, LunaStructuredOutputError, type LunaAnalysisResult } from '../server/openAiLuna';
import { resolveOpenAiEvaluationApiKey } from '../server/openAiEnvironment';
import { reviewHostedCopilotAnalysis } from '../server/pokepilotAnalysisValidation';
import type { CopilotAnalysisRequest } from '../src/utils/copilotContracts';

type Params = OpenAI.Responses.ResponseCreateParamsNonStreaming;
const argument = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dir = argument('output', '.tmp/mc-comparison');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const save = (path: string, value: unknown) => {
  if (existsSync(path)) {
    if (hash(JSON.parse(readFileSync(path, 'utf8'))) !== hash(value)) throw new Error(`Changed artifact: ${path}`);
  } else writeFileSync(path, JSON.stringify(value, null, 2), { flag: 'wx' });
};
const examples = `Illustrative comparison examples only; their fictional values and loadouts are not facts about the user's team. Follow the user's output language.
Example 1: A candidate keeps HP unchanged, raises Defense from 110 to 114 (+4), and lowers Special Defense from 150 to 130 (-20). A grounded explanation is: "This spread slightly improves physical bulk but gives up special bulk. It suits a physical switch-in role only if the team can absorb that special-side loss." Do not call all durability better or worse, and do not invent an opponent survival result.
Example 2: The current moves are primary attack, coverage attack, recovery, and protection. Candidate A adds disruption in place of coverage; candidate B adds the same disruption in place of recovery. A grounded explanation for A is: "This version adds disruption while keeping recovery and protection. The cost is losing the coverage attack. Unlike the recovery-replacing alternative, it preserves longevity." Do not transfer B's lost move to A. The preferred candidate depends on the actual team's responsibilities, not these examples.`;
const source = JSON.parse(readFileSync(argument('requests', '.tmp/mc-final/requests-v99.json'), 'utf8')) as Record<string, CopilotAnalysisRequest>;
const requests = Object.fromEntries(Object.entries(source).filter(([id]) => id.endsWith('-optimization')));
if (Object.keys(requests).length !== 10) throw new Error('Expected ten frozen sample cases');
mkdirSync(dir, { recursive: true });

async function capture(request: CopilotAnalysisRequest): Promise<Params> {
  let captured: Params | undefined;
  const client = { responses: { create: async (params: Params) => {
    captured = params;
    return { output_text: '{}' };
  } } } as unknown as Pick<OpenAI, 'responses'>;
  await analyzeWithOpenAiLuna(request, { client, reasoningEffort: 'low', maxOutputTokens: 8000, maxRetries: 0 });
  if (!captured) throw new Error('Missing parameters');
  return captured;
}

const baselinePath = `${dir}/baseline.json`;
if (process.argv.includes('--capture-baseline')) {
  const params: Record<string, Params> = {};
  for (const [id, request] of Object.entries(requests)) params[id] = await capture(request);
  save(baselinePath, { requests, params });
  console.log('Captured ten baseline requests and full model messages.');
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { requests: typeof requests; params: Record<string, Params> };
  if (hash(baseline.requests) !== hash(requests)) throw new Error('Baseline requests changed');
  const arms = ['baseline', 'comparison', 'examples'] as const;
  type Arm = typeof arms[number];
  const replay = process.argv.includes('--replay');
  const prepared: Record<string, Record<Arm, Params>> = replay
    ? JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')).prepared : {};
  for (const [id, request] of replay ? [] : Object.entries(requests)) {
    const comparison = await capture(request);
    if (hash(baseline.params[id].input) === hash(comparison.input)) throw new Error('Input has not changed');
    if (!Array.isArray(comparison.input)) throw new Error('Expected messages');
    const withExamples: Params = { ...comparison, input: [
      ...comparison.input.slice(0, -1),
      { type: 'message', role: 'developer', content: [{ type: 'input_text', text: examples }] },
      ...comparison.input.slice(-1),
    ] };
    prepared[id] = { baseline: baseline.params[id], comparison, examples: withExamples };
    for (const arm of arms) prepared[id][arm].prompt_cache_key = `pokepilot-evaluation-comparison-${arm}`;
  }
  save(`${dir}/manifest.json`, { model: 'gpt-6-luna', effort: 'low', repetitions: 2, maxOutputTokens: 8000,
    examples, requests, prepared });
  console.log('Prepared ten cases, three arms, two repetitions (60 calls).');
  if (process.argv.includes('--run')) {
    const api = new OpenAI({ apiKey: resolveOpenAiEvaluationApiKey(process.cwd()), maxRetries: 0, timeout: 180000 });
    for (let repetition = 1; repetition <= 2; repetition++) {
      for (const [index, [id, request]] of Object.entries(requests).entries()) {
        const offset = (index + repetition) % arms.length;
        for (const arm of [...arms.slice(offset), ...arms.slice(0, offset)]) {
          const key = `${id}-${arm}-r${repetition}`;
          const path = `${dir}/${key}.json`;
          if (existsSync(path)) continue;
          const started = Date.now();
          console.log('Calling', key);
          const client = { responses: { create: async () => api.responses.create(prepared[id][arm]) } } as unknown as Pick<OpenAI, 'responses'>;
          let result: LunaAnalysisResult | undefined;
          try {
            result = await analyzeWithOpenAiLuna(request, { client, reasoningEffort: 'low', maxOutputTokens: 8000, maxRetries: 0 });
            // Experimental labels are in arm; do not mislabel a captured baseline with today's prompt version.
            const { responseId: _responseId, ...responseMetadata } = result.responseMetadata;
            void _responseId;
            save(path, { key, id, arm, repetition, durationMs: Date.now() - started,
              requestHash: hash(request), messagesHash: hash(prepared[id][arm].input),
              result: { ...result, responseMetadata: { ...responseMetadata, promptVersion: arm === 'baseline' ? 100 : 101 } },
              reviewed: reviewHostedCopilotAnalysis(result.output, request) });
            console.log('Saved', key, result.usage.costUsd);
          } catch (error) {
            save(path, { key, id, arm, repetition, durationMs: Date.now() - started,
              error: error instanceof Error ? error.message : 'Evaluation failed',
              ...(result ? { usage: result.usage } : error instanceof LunaStructuredOutputError ? { usage: error.usage } : {}) });
            console.log('Failed', key);
          }
        }
      }
    }
  }
}
