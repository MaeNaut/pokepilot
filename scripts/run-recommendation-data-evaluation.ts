import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import OpenAI from 'openai';
import { analyzeWithOpenAiLuna, LunaStructuredOutputError } from '../server/openAiLuna';
import { resolveOpenAiEvaluationApiKey } from '../server/openAiEnvironment';
import { reviewHostedCopilotAnalysis } from '../server/pokepilotAnalysisValidation';
import { POKEPILOT_AI_PROMPT_VERSION } from '../server/pokepilotPrompts';
import { POKEPILOT_API_MAX_BODY_BYTES } from '../server/pokepilotApi';
import { installAiEvaluationRuntime } from './aiEvaluationRuntime';
import { fetchPokemon } from '../src/api/pokeApi';
import { fetchPokemonIndex } from '../src/api/pokemonIndex';
import { fetchAbilityIndex, fetchItem, fetchItemIndex } from '../src/api/showdownCatalog';
import { loadShowdownData } from '../src/api/showdownData';
import { loadShowdownLegality } from '../src/api/showdownLegality';
import { loadPopularUsageSet } from '../src/api/battleUsage';
import { createAiFixtureAnalysisContext } from '../src/test/evaluation/aiModelEvaluation';
import { createCopilotAnalysisRequest } from '../src/utils/copilotRequestBuilder';
import { validateCopilotAnalysisRequest } from '../src/utils/copilotRequestContract';
import { getMegaEvolutionIndexEntry } from '../src/utils/megaEvolution';
import { normalizeShowdownId } from '../src/api/showdownIds';
import { createGeneralSetOptimizationPlan } from '../src/calculator/setOptimizer/generalPlan';
import { resolveUsageCalculatorItems } from '../src/calculator/calculatorUsageBuild';
import type { GeneralSetOptimizationContext } from '../src/calculator/setOptimizer/types';
import type { AiTeamFixture } from '../src/test/fixtures/aiTeamFixtureTypes';
import type { CopilotAnalysisRequest } from '../src/utils/copilotContracts';

const argument = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dir = argument('output', '.tmp/recommendation-data-ab-2026-10-05');
const sourceRequests = argument('requests', '.tmp/recommendation-expansion-2026-10-05/requests.json');
const read = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const save = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2), { flag: 'wx' });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Arm = 'before' | 'after';
type Pair = Record<Arm, CopilotAnalysisRequest>;
type Params = OpenAI.Responses.ResponseCreateParamsNonStreaming;
const settings = { modelId: 'gpt-6-luna', reasoningEffort: 'low', maxRetries: 0, maxOutputTokens: 8000, cacheNamespace: 'evaluation' } as const;
const cases = [['mc-tagerau', 'ko', 1], ['mc-danjinesu', 'en', 0], ['mc-kiran', 'ko', 0], ['mc-lloyd', 'en', 5]] as const;
mkdirSync(dir, { recursive: true });

// Evaluation-only reconstruction: reverse expansion, retaining all baseline/state fixes.
// Freeze the generated source alongside the requests; never modify the product module.
function freezeBeforeGenerator() {
  let source = readFileSync('src/calculator/setOptimizer/generalPlan.ts', 'utf8').replace(/\r\n/g, '\n');
  const replace = (before: string, after: string) => {
    assert.equal(source.split(before).length, 2, `Baseline anchor changed: ${before.slice(0, 80)}`);
    source = source.replace(before, after);
  };
  replace('import { BATTLE_USAGE_OPTION_LIMITS } from "../../api/battleUsageData";\n', '');
  replace('import { MAX_GENERAL_CANDIDATES } from "./constants";', 'const MAX_GENERAL_CANDIDATES = 12;');
  const coverage = `function selectUsageCoverage<T extends { usagePercent: number }>(values: readonly T[], minimum: number, maximum: number, target: number) {
  const selected: T[] = [];
  let cumulative = 0;
  for (const value of values) {
    if (selected.length >= maximum) break;
    selected.push(value);
    cumulative += value.usagePercent;
    if (selected.length >= minimum && cumulative >= target) break;
  }
  return selected;
}

`;
  replace('function getMoveOptions(', `${coverage}function getMoveOptions(`);
  replace('return raw.slice(0, BATTLE_USAGE_OPTION_LIMITS.moves);', 'const bounded = raw.slice(0, 8);\n  return selectUsageCoverage(bounded, 4, 8, bounded.reduce((sum, option) => sum + option.usagePercent, 0) * 0.85);');
  replace('return raw.slice(0, BATTLE_USAGE_OPTION_LIMITS.spreads);', 'return selectUsageCoverage(raw, 3, 6, 80);');
  replace('return entries.slice(0, BATTLE_USAGE_OPTION_LIMITS.items);', 'return selectUsageCoverage(entries, 2, 4, 80);');
  const start = source.indexOf('  usageSpreads.forEach(');
  const end = source.indexOf('\n  if (baselineEvs && baselineNature)', start);
  assert(start > 0 && end > start);
  source = source.slice(0, start) + `  usageSpreads.forEach((spread, index) => {
    const evs = completeSpread(spread.evs);
    if (!evs) return;
    const natureId = spread.nature.toLowerCase();
    buckets.spread.push(createCandidate(context, \`usage-spread-\${index + 1}\`, natureId, evs,
      context.build.item, currentMoves, createEvidence(context, "usage", "spread", evs, natureId,
        { rank: index + 1, percent: spread.usagePercent })));
  });
` + source.slice(end);
  replace('function selectDiverseCandidates(buckets: CandidateBuckets, context: GeneralSetOptimizationContext)', 'function selectDiverseCandidates(buckets: CandidateBuckets)');
  replace('if (!candidate || selected.length >= MAX_GENERAL_CANDIDATES) return false;', 'if (!candidate) return false;');
  const priorityStart = source.indexOf('  // Keep role-relevant tail spreads');
  const priorityEnd = source.indexOf('  const rotating =', priorityStart);
  assert(priorityStart > 0 && priorityEnd > priorityStart);
  source = source.slice(0, priorityStart) + source.slice(priorityEnd);
  replace('selectDiverseCandidates(createGeneralCandidates(context), context)', 'selectDiverseCandidates(createGeneralCandidates(context))');
  source = source.replace(/from "(\.[^"]+)"/g, (_, path: string) => `from "${pathToFileURL(resolve('src/calculator/setOptimizer', `${path}.ts`)).href}"`);
  const path = resolve(dir, 'generalPlan-before.ts');
  if (existsSync(path)) assert.equal(readFileSync(path, 'utf8'), source);
  else writeFileSync(path, source, { flag: 'wx' });
  return path;
}

const requestsPath = `${dir}/requests.json`;
if (!existsSync(requestsPath)) {
  assert.equal(POKEPILOT_AI_PROMPT_VERSION, 102, 'Use a new, explicitly reviewed experiment after prompt changes');
  const beforePath = freezeBeforeGenerator();
  const beforeModule = await import(pathToFileURL(beforePath).href) as { createGeneralSetOptimizationPlan: typeof createGeneralSetOptimizationPlan };
  const original = read<Record<string, CopilotAnalysisRequest>>(sourceRequests);
  const pairs: Record<string, Pair> = {};
  const restore = installAiEvaluationRuntime(process.cwd());
  try {
    const pokemonIndex = await fetchPokemonIndex(), itemIndex = await fetchItemIndex();
    const abilityIndex = await fetchAbilityIndex(), showdownData = await loadShowdownData(), legality = await loadShowdownLegality();
    const options = { pokemonIndex, itemIndex, abilityIndex, showdownData, legality, services: { fetchPokemon, fetchItem } };
    const fixtures = ['aiMcPublishedTeams.json', 'aiMcExpandedTeams.json'].flatMap(file => read<AiTeamFixture[]>(`src/test/fixtures/${file}`));
    for (const [id, locale, slot] of cases) {
      const recId = `${id}-recommendation-${locale}`;
      const after = structuredClone(original[recId]);
      assert(after && after.recommendationCandidates.length === 30);
      const before = structuredClone(after);
      before.recommendationCandidates.forEach(candidate => { delete candidate.usageOptions; });
      pairs[recId] = { before, after };
      const fixture = fixtures.find(entry => entry.id === id)!;
      const context = await createAiFixtureAnalysisContext(fixture, options);
      const member = context.team[slot]!, b = context.buildState;
      const usagePokemonId = getMegaEvolutionIndexEntry(member.id, b.itemBySlot[slot], pokemonIndex)?.name ?? member.id;
      const usageSet = await loadPopularUsageSet(usagePokemonId, fixture.battleFormat);
      assert(usageSet, `Missing usage: ${id}`);
      const input: GeneralSetOptimizationContext = { selectedSlot: slot, member, usagePokemonId,
        build: { item: b.itemBySlot[slot] ?? null, ability: b.abilityBySlot[slot]!, natureId: b.natureBySlot[slot]!, evs: b.evsBySlot[slot]!, moveIds: b.moveIdsBySlot[slot]! },
        reservedItemIds: context.team.flatMap((entry, i) => entry && i !== slot && b.itemBySlot[i]
          ? [normalizeShowdownId(b.itemBySlot[i]!.showdownId ?? b.itemBySlot[i]!.id)] : []),
        usageSet, usageItems: resolveUsageCalculatorItems(usageSet, itemIndex, 6) };
      const optId = `${id}-optimization-${locale}`;
      save(`${dir}/${id}-context.json`, input);
      const beforeInput = structuredClone(input);
      beforeInput.usageItems = resolveUsageCalculatorItems(usageSet, itemIndex, 4);
      const pair = {} as Pair;
      for (const arm of ['before', 'after'] as const) {
        const plan = arm === 'before' ? beforeModule.createGeneralSetOptimizationPlan(beforeInput) : createGeneralSetOptimizationPlan(input);
        const current = plan.candidates.find(candidate => candidate.id === 'set-current');
        assert.deepEqual(current?.evs, input.build.evs, 'Current points must remain unchanged');
        assert.equal(current?.natureId, input.build.natureId);
        assert(plan.candidates.length <= (arm === 'before' ? 12 : 24));
        for (const candidate of plan.candidates.filter(entry => ['move', 'loadout', 'item'].includes(entry.generalEvidence!.variant))) {
          assert.deepEqual(candidate.evs, input.build.evs);
          assert.equal(candidate.natureId, input.build.natureId);
        }
        pair[arm] = JSON.parse(JSON.stringify(createCopilotAnalysisRequest({ scope: 'optimization', locale,
          battleFormat: fixture.battleFormat, teamName: fixture.title, ...context, pokemonIndex, abilityIndex,
          showdownData, selectedSlot: slot, optimizationPlan: plan }))) as CopilotAnalysisRequest;
      }
      const withoutOptimization = (request: CopilotAnalysisRequest) => {
        const copy = structuredClone(request);
        delete copy.optimization;
        return copy;
      };
      assert.deepEqual(withoutOptimization(pair.before), withoutOptimization(pair.after));
      pairs[optId] = pair;
    }
  } finally { restore(); }
  for (const [id, pair] of Object.entries(pairs)) {
    for (const [arm, request] of Object.entries(pair)) {
      const validated = validateCopilotAnalysisRequest(request);
      assert(validated.success, `${id} ${arm}: ${JSON.stringify(validated.errors)}`);
      assert(Buffer.byteLength(JSON.stringify(request)) <= POKEPILOT_API_MAX_BODY_BYTES);
    }
  }
  save(requestsPath, pairs);
}

const pairs = read<Record<string, Pair>>(requestsPath);
const paramsPath = `${dir}/params.json`;
if (!existsSync(paramsPath)) {
  const prepared: Record<string, Record<Arm, Params>> = {};
  for (const [id, pair] of Object.entries(pairs)) {
    prepared[id] = {} as Record<Arm, Params>;
    for (const arm of ['before', 'after'] as const) {
      const client = { responses: { create: async (params: Params) => {
        prepared[id][arm] = params;
        return { output_text: '{}' };
      } } } as unknown as Pick<OpenAI, 'responses'>;
      await analyzeWithOpenAiLuna(pair[arm], { ...settings, client });
    }
    const nonUser = (params: Params) => ({ ...params, input: (params.input as Array<{ role?: string }>).filter(message => message.role !== 'user') });
    assert.deepEqual(nonUser(prepared[id].before), nonUser(prepared[id].after), `Only data may differ: ${id}`);
  }
  save(paramsPath, prepared);
  save(`${dir}/manifest.json`, { promptVersion: POKEPILOT_AI_PROMPT_VERSION, ...settings, repetitions: 3,
    design: argument('experiment', 'data-expansion') === 'priority-denial'
      ? { pokemon: 'Identical expanded request; production builder changes only priority-denial count and Psychic Surge canonical terrain rules.' }
      : argument('experiment', 'data-expansion') === 'candidate-mega'
      ? { pokemon: 'Same current prompt/schema in both arms; omit/provide candidate megaEvolution only. Focused Y, synthetic X, non-stone control, and full-30-candidate regression. Three repetitions, Luna low.' }
      : argument('experiment', 'data-expansion') === 'selective-usage'
      ? { pokemon: 'Identical 30-candidate shortlist and current input fixes; full usageOptions vs production relevance selector. Same prompt, low reasoning, three repetitions.' }
      : { pokemon: 'Identical 30-candidate shortlist, usageOptions absent/present. Not a historical end-to-end ranking replay.',
        sample: 'Pre-expansion 12-candidate selection vs expanded 24; identical source snapshot and current-build fixes.' },
    requestsHash: hash(pairs), paramsHash: hash(prepared),
    cases: Object.entries(pairs).map(([id, pair]) => ({ id, beforeHash: hash(pair.before), afterHash: hash(pair.after),
      beforeCandidates: pair.before.optimization?.candidates.length ?? pair.before.recommendationCandidates.length,
      afterCandidates: pair.after.optimization?.candidates.length ?? pair.after.recommendationCandidates.length })) });
}
const prepared = read<Record<string, Record<Arm, Params>>>(paramsPath);
const manifest = read<{ requestsHash: string; paramsHash: string }>(`${dir}/manifest.json`);
assert.equal(hash(pairs), manifest.requestsHash);
assert.equal(hash(prepared), manifest.paramsHash);
console.log('Frozen data-only comparison verified:', Object.keys(pairs).length, 'cases.');

if (process.argv.includes('--run')) {
  const api = new OpenAI({ apiKey: resolveOpenAiEvaluationApiKey(process.cwd()), maxRetries: 0, timeout: 180000 });
  for (let repetition = 1; repetition <= 3; repetition++) {
    for (const [index, [id, pair]] of Object.entries(pairs).entries()) {
      const order: Arm[] = (index + repetition) % 2 ? ['after', 'before'] : ['before', 'after'];
      for (const arm of order) {
        const key = `${id}-${arm}-r${repetition}`, path = `${dir}/${key}.json`;
        if (existsSync(path)) continue;
        const started = Date.now();
        try {
          const client = { responses: { create: async () => api.responses.create(prepared[id][arm]) } } as unknown as Pick<OpenAI, 'responses'>;
          const result = await analyzeWithOpenAiLuna(pair[arm], { ...settings, client });
          const reviewed = reviewHostedCopilotAnalysis(result.output, pair[arm]);
          save(path, { key, id, arm, repetition, durationMs: Date.now() - started,
            requestHash: hash(pair[arm]), paramsHash: hash(prepared[id][arm]), result, reviewed });
          console.log(JSON.stringify({ key, durationMs: Date.now() - started, usage: result.usage, auditErrors: reviewed.diagnostics.auditErrors }));
        } catch (error) {
          save(path, { key, id, arm, repetition, durationMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
            ...(error instanceof LunaStructuredOutputError ? { usage: error.usage } : {}) });
          console.log('Failed', key);
        }
      }
    }
  }
}
