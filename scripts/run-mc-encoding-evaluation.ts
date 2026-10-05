import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import OpenAI from 'openai';
import { analyzeWithOpenAiLuna, LunaStructuredOutputError } from '../server/openAiLuna';
import { resolveOpenAiEvaluationApiKey } from '../server/openAiEnvironment';
import { serializePokePilotModelRequest } from '../server/pokepilotModelInput';
import { getPokePilotLocaleInstructions, POKEPILOT_AI_PROMPT_VERSION } from '../server/pokepilotPrompts';
import { reviewHostedCopilotAnalysis } from '../server/pokepilotAnalysisValidation';
import type { CopilotAnalysisRequest } from '../src/utils/copilotContracts';
import { normalizeShowdownId } from '../src/api/showdownIds';

/** Historical comparison only; production uses compact input at every effort. */
function serializeInlinePokePilotModelRequest(request: CopilotAnalysisRequest) {
  const byId = <T extends { id: string }>(entries: T[]) =>
    new Map(entries.map(entry => [normalizeShowdownId(entry.id), entry]));
  const moves = byId(request.mechanics.moves);
  const abilities = byId(request.mechanics.abilities);
  const items = byId(request.mechanics.items);
  const find = <T>(entries: Map<string, T>, id: string | null | undefined) =>
    entries.get(normalizeShowdownId(id ?? ''));
  return {
    text: JSON.stringify({
      ...request,
      battleRules: {
        activePokemonPerSide: request.battleFormat === 'singles' ? 1 : 2,
        activeAlliesPerPokemon: request.battleFormat === 'singles' ? 0 : 1,
        selectedPokemonPerBattle: request.battleFormat === 'singles' ? 3 : 4,
        maximumActivatedMegas: 1,
      },
      sets: request.sets.map(set => ({
        ...set,
        abilityMechanic: find(abilities, set.ability),
        itemMechanic: find(items, set.item),
        moves: set.moves.map(move => ({ ...move, mechanic: find(moves, move.id) })),
        ...(set.megaEvolution ? {
          megaEvolution: {
            ...set.megaEvolution,
            abilityMechanic: find(abilities, set.megaEvolution.ability),
          },
        } : {}),
      })),
    }),
    instructions: "Inline evidence: each set's abilityMechanic, itemMechanic and move.mechanic repeat the exact canonical mechanics for that owner. megaEvolution.abilityMechanic applies only after that set activates Mega Evolution. These records do not prescribe a strategy. battleRules specifies the active and selected team sizes; raw move targets describe general mechanics, not extra active allies. Missing mechanics remain unknown.",
  };
}

const cases = [
  'mc-mugepome-team', 'mc-ddee-team', 'mc-lloyd-team',
  'mc-nautilasu-pokemon', 'mc-mugepome-pokemon', 'mc-liuzzo-pokemon',
  'mc-danjinesu-recommendation', 'mc-ddee-recommendation', 'mc-lloyd-recommendation',
  'mc-tagerau-optimization', 'mc-lloyd-optimization', 'mc-kiran-optimization',
];
const conditions = [
  { encoding: 'compact', effort: 'low' },
  { encoding: 'inline', effort: 'low' },
  { encoding: 'compact', effort: 'medium' },
  { encoding: 'inline', effort: 'medium' },
] as const;
const argument = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dir = argument('output', '.tmp/mc-encoding');
const requests = JSON.parse(readFileSync(argument('requests', '.tmp/mc-final/requests-v99.json'), 'utf8')) as Record<string, CopilotAnalysisRequest>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const resolveReferences = (value: unknown, table: Record<string, unknown>): unknown => {
  if (Array.isArray(value)) return value.map(item => resolveReferences(item, table));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.dataRef === 'string') {
    if (!(record.dataRef in table)) throw new Error('Missing shared record');
    return resolveReferences(table[record.dataRef], table);
  }
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'sharedData').map(([key, item]) => [key, resolveReferences(item, table)]));
};

mkdirSync(dir, { recursive: true });
const prepared = cases.map(id => {
  const request = requests[id];
  if (!request) throw new Error(`Missing request ${id}`);
  const inline = serializeInlinePokePilotModelRequest(request);
  const expanded = JSON.parse(inline.text);
  const common = { ...request, battleRules: expanded.battleRules };
  const compact = serializePokePilotModelRequest(common);
  const compressed = JSON.parse(compact.text);
  if (!isDeepStrictEqual(resolveReferences(compressed, compressed.sharedData ?? {}), common)) {
    throw new Error(`Compact round trip failed: ${id}`);
  }
  // The only inline additions are exact local copies of canonical mechanics.
  const restored = JSON.parse(inline.text);
  for (const set of restored.sets) {
    delete set.abilityMechanic;
    delete set.itemMechanic;
    for (const move of set.moves) delete move.mechanic;
    if (set.megaEvolution) delete set.megaEvolution.abilityMechanic;
  }
  if (!isDeepStrictEqual(restored, common)) throw new Error(`Inline round trip failed: ${id}`);
  const instructions = [compact.instructions, inline.instructions, getPokePilotLocaleInstructions(request.locale)].filter(Boolean).join('\n\n');
  return { id, request, compact, inline, instructions };
});
writeFileSync(`${dir}/manifest.json`, JSON.stringify({
  promptVersion: POKEPILOT_AI_PROMPT_VERSION,
  maxOutputTokens: 16000, repetitions: 2, conditions,
  cases: prepared.map(p => ({ id: p.id, requestHash: hash(p.request), instructionsHash: hash(p.instructions),
    compactHash: hash(p.compact.text), inlineHash: hash(p.inline.text),
    compactCharacters: p.compact.text.length, inlineCharacters: p.inline.text.length })),
}, null, 2));
console.log('Verified equivalent source facts and fixed instructions for', prepared.length, 'cases.');

if (process.argv.includes('--run')) {
  const api = new OpenAI({ apiKey: resolveOpenAiEvaluationApiKey(process.cwd()), maxRetries: 0, timeout: 240000 });
  for (let repetition = 0; repetition < 2; repetition++) {
    for (const [caseIndex, entry] of prepared.entries()) {
      for (let step = 0; step < conditions.length; step++) {
        const condition = conditions[(caseIndex + repetition * 2 + step) % conditions.length];
        const key = `${entry.id}-${condition.encoding}-${condition.effort}-r${repetition + 1}`;
        const path = `${dir}/${key}.json`;
        if (existsSync(path)) continue;
        let messagesHash = '';
        const client = { responses: { create: async (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => {
          if (!Array.isArray(params.input)) throw new Error('Unexpected provider input');
          const input = [...params.input];
          input[2] = { type: 'message', role: 'developer', content: [{ type: 'input_text', text: entry.instructions }] };
          input[3] = { type: 'message', role: 'user', content: [{ type: 'input_text', text: entry[condition.encoding].text }] };
          messagesHash = hash(input);
          return api.responses.create({ ...params, input, prompt_cache_key: `pokepilot-evaluation-encoding-v${POKEPILOT_AI_PROMPT_VERSION}` });
        } } } as unknown as Pick<OpenAI, 'responses'>;
        console.log('Calling', key);
        const started = Date.now();
        try {
          const result = await analyzeWithOpenAiLuna(entry.request, { client, reasoningEffort: condition.effort,
            maxOutputTokens: 16000, cacheNamespace: 'evaluation', maxRetries: 0 });
          const reviewed = reviewHostedCopilotAnalysis(result.output, entry.request);
          const record = { key, id: entry.id, ...condition, repetition: repetition + 1,
            requestHash: hash(entry.request), messagesHash, durationMs: Date.now() - started,
            result, reviewed };
          writeFileSync(path, JSON.stringify(record, null, 2));
          console.log('Saved', key, record.durationMs, result.usage.costUsd);
        } catch (error) {
          writeFileSync(path, JSON.stringify({ key, id: entry.id, ...condition, repetition: repetition + 1,
            requestHash: hash(entry.request), messagesHash, durationMs: Date.now() - started,
            error: error instanceof Error ? error.message : 'Unknown evaluation failure',
            ...(error instanceof LunaStructuredOutputError ? { usage: error.usage } : {}) }, null, 2));
          console.log('Failed', key);
        }
      }
    }
  }
}
