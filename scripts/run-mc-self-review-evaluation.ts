import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';
import { analyzeWithOpenAiLuna, LunaStructuredOutputError, type LunaAnalysisResult } from '../server/openAiLuna';
import { resolveOpenAiEvaluationApiKey } from '../server/openAiEnvironment';
import { reviewHostedCopilotAnalysis } from '../server/pokepilotAnalysisValidation';
import { POKEPILOT_AI_PROMPT_VERSION, pokepilotCommonInstructions } from '../server/pokepilotPrompts';
import type { CopilotAnalysisRequest } from '../src/utils/copilotContracts';

const cases = [
  'mc-mugepome-team', 'mc-ddee-team', 'mc-lloyd-team',
  'mc-nautilasu-pokemon', 'mc-mugepome-pokemon', 'mc-liuzzo-pokemon',
  'mc-danjinesu-recommendation', 'mc-ddee-recommendation', 'mc-lloyd-recommendation',
  'mc-tagerau-optimization', 'mc-lloyd-optimization', 'mc-kiran-optimization',
];
const argument = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dir = argument('output', '.tmp/mc-self-review');
const baselinePath = `${dir}/baseline.json`;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
mkdirSync(dir, { recursive: true });

if (process.argv.includes('--capture-baseline')) {
  writeFileSync(baselinePath, JSON.stringify({ promptVersion: POKEPILOT_AI_PROMPT_VERSION,
    instructions: pokepilotCommonInstructions }, null, 2), { flag: 'wx' });
  console.log('Captured baseline prompt', POKEPILOT_AI_PROMPT_VERSION);
} else {
  type PromptSnapshot = { promptVersion: number; instructions: string };
  const comparisonPath = argument('comparison', '');
  const savedComparison = comparisonPath ? JSON.parse(readFileSync(comparisonPath, 'utf8')) as {
    manifest: { arms: Record<'before' | 'after', PromptSnapshot>;
      cases: Array<{ id: string; requestHash: string; beforeMessagesHash: string; afterMessagesHash: string }> };
  } : null;
  const baseline = savedComparison?.manifest.arms.before
    ?? JSON.parse(readFileSync(baselinePath, 'utf8')) as PromptSnapshot;
  const requests = JSON.parse(readFileSync(argument('requests', '.tmp/mc-final/requests-v99.json'), 'utf8')) as Record<string, CopilotAnalysisRequest>;
  const arms = savedComparison?.manifest.arms ?? {
    before: baseline,
    after: { promptVersion: POKEPILOT_AI_PROMPT_VERSION, instructions: pokepilotCommonInstructions },
  };
  if (arms.before.instructions === arms.after.instructions) throw new Error('Candidate prompt is unchanged');
  type Arm = keyof typeof arms;
  const prepared: Record<string, Record<Arm, OpenAI.Responses.ResponseCreateParamsNonStreaming>> = {};
  for (const id of cases) {
    const request = requests[id];
    if (!request) throw new Error(`Missing request ${id}`);
    prepared[id] = {} as Record<Arm, OpenAI.Responses.ResponseCreateParamsNonStreaming>;
    for (const arm of ['before', 'after'] as const) {
      const client = { responses: { create: async (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => {
        if (!Array.isArray(params.input)) throw new Error('Expected message input');
        const input = [...params.input];
        input[0] = { type: 'message', role: 'developer', content: [{ type: 'input_text',
          text: arms[arm].instructions, prompt_cache_breakpoint: { mode: 'explicit' } }] };
        prepared[id][arm] = { ...params, input, prompt_cache_key: `pokepilot-evaluation-self-review-${arm}-v${arms[arm].promptVersion}` };
        return { output_text: '{}' };
      } } } as unknown as Pick<OpenAI, 'responses'>;
      await analyzeWithOpenAiLuna(request, { client, reasoningEffort: 'low', maxOutputTokens: 8000,
        maxRetries: 0, cacheNamespace: 'evaluation' });
    }
    const before = prepared[id].before.input as unknown[];
    const after = prepared[id].after.input as unknown[];
    if (hash(before.slice(1)) !== hash(after.slice(1))) throw new Error(`Non-common messages differ: ${id}`);
    if (savedComparison) {
      const saved = savedComparison.manifest.cases.find(entry => entry.id === id);
      if (!saved || saved.requestHash !== hash(request) || saved.beforeMessagesHash !== hash(before)
        || saved.afterMessagesHash !== hash(after)) throw new Error(`Historical request or messages changed: ${id}`);
    }
  }
  const manifest = {
    model: 'gpt-6-luna', effort: 'low', maxOutputTokens: 8000, repetitions: 2, arms,
    cases: cases.map(id => ({ id, requestHash: hash(requests[id]),
      beforeMessagesHash: hash(prepared[id].before.input), afterMessagesHash: hash(prepared[id].after.input),
      unchangedMessagesHash: hash((prepared[id].before.input as unknown[]).slice(1)) })),
  };
  const manifestPath = `${dir}/manifest.json`;
  if (existsSync(manifestPath)) {
    if (hash(JSON.parse(readFileSync(manifestPath, 'utf8'))) !== hash(manifest)) {
      throw new Error('Manifest changed; use a fresh output directory');
    }
  } else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log('Verified identical input, scope/locale instructions and settings for', cases.length, 'cases.');

  if (process.argv.includes('--run')) {
    const api = new OpenAI({ apiKey: resolveOpenAiEvaluationApiKey(process.cwd()), maxRetries: 0, timeout: 180000 });
    for (let repetition = 1; repetition <= 2; repetition++) {
      for (const [index, id] of cases.entries()) {
        const order: Arm[] = (index + repetition) % 2 === 0 ? ['before', 'after'] : ['after', 'before'];
        for (const arm of order) {
          const key = `${id}-${arm}-r${repetition}`;
          const path = `${dir}/${key}.json`;
          if (existsSync(path)) continue;
          const started = Date.now();
          console.log('Calling', key);
          const client = { responses: { create: async () => api.responses.create(prepared[id][arm]) } } as unknown as Pick<OpenAI, 'responses'>;
          let result: LunaAnalysisResult | undefined;
          try {
            result = await analyzeWithOpenAiLuna(requests[id], { client, reasoningEffort: 'low',
              maxOutputTokens: 8000, maxRetries: 0, cacheNamespace: 'evaluation' });
            result.responseMetadata.promptVersion = arms[arm].promptVersion;
            const durationMs = Date.now() - started;
            const reviewed = reviewHostedCopilotAnalysis(result.output, requests[id]);
            writeFileSync(path, JSON.stringify({ key, id, arm, repetition, durationMs,
              requestHash: hash(requests[id]), messagesHash: hash(prepared[id][arm].input), result, reviewed }, null, 2), { flag: 'wx' });
            console.log('Saved', key, durationMs, result.usage.costUsd);
          } catch (error) {
            writeFileSync(path, JSON.stringify({ key, id, arm, repetition, durationMs: Date.now() - started,
              error: error instanceof Error ? error.message : 'Evaluation failed',
              ...(result ? { result, usage: result.usage }
                : error instanceof LunaStructuredOutputError ? { usage: error.usage } : {}) }, null, 2), { flag: 'wx' });
            console.log('Failed', key);
          }
        }
      }
    }
  }
}
