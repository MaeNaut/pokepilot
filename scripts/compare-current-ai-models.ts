import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fetchPokemon } from "../src/api/pokeApi";
import { fetchPokemonIndex } from "../src/api/pokemonIndex";
import {
  fetchAbilityIndex,
  fetchItem,
  fetchItemIndex,
} from "../src/api/showdownCatalog";
import { loadShowdownLegality } from "../src/api/showdownLegality";
import { loadShowdownData } from "../src/api/showdownData";
import {
  createAiPokemonEvaluationCase,
  createAiPokemonRecommendationEvaluationCase,
  createAiTeamEvaluationCase,
  runAiTeamEvaluationCase,
  type AiTeamEvaluationCase,
} from "../src/test/evaluation/aiModelEvaluation";
import { createOpenAiLunaAdapter } from "../src/test/evaluation/openAiLunaAdapter";
import { aiPokemonAnalysisFixtures } from "../src/test/fixtures/aiPokemonAnalysisFixtures";
import { aiPokemonRecommendationFixtures } from "../src/test/fixtures/aiPokemonRecommendationFixtures";
import { aiTeamFixtures } from "../src/test/fixtures/aiTeamFixtures";
import {
  POKEPILOT_AI_PROMPT_VERSION,
  type LunaReasoningEffort,
  type PokePilotEvaluationModel,
} from "../server/openAiLuna";
import { resolveOpenAiEvaluationApiKey } from "../server/openAiEnvironment";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

type FrozenCase = {
  fixtureId: string;
  request: { scope: "team" | "pokemon" | "recommendation" };
};

type FrozenManifest = {
  promptVersion: number;
  cases: (FrozenCase & AiTeamEvaluationCase & { inputSha256: string })[];
};

type Configuration = {
  modelId: PokePilotEvaluationModel;
  effort: LunaReasoningEffort;
};

type RecordEntry = {
  configuration: Configuration;
  repeat: number;
  result: Awaited<ReturnType<typeof runAiTeamEvaluationCase>>;
};

const root = process.cwd();
const args = process.argv.slice(2);
const sources = args.filter((arg) => !arg.startsWith("--"));
const prepareOnly = args.includes("--prepare-only");
const useFrozenInputs = args.includes("--frozen-inputs");
const reuseDirectory = args.find((arg) => arg.startsWith("--reuse-results="))?.slice("--reuse-results=".length);
const configurations: Configuration[] = args.includes("--luna6-low-medium")
  ? [
      { modelId: "gpt-6-luna", effort: "low" },
      { modelId: "gpt-6-luna", effort: "medium" },
    ]
  : args.includes("--luna6")
  ? [
      { modelId: "gpt-6-luna", effort: "low" },
      { modelId: "gpt-6-luna", effort: "medium" },
      { modelId: "gpt-6-luna", effort: "high" },
    ]
  : args.includes("--luna-low-medium")
  ? [
      { modelId: "gpt-5.6-luna", effort: "low" },
      { modelId: "gpt-5.6-luna", effort: "medium" },
    ]
  : [
      { modelId: "gpt-5.6-luna", effort: "low" },
      { modelId: "gpt-5.6-luna", effort: "medium" },
      { modelId: "gpt-5.6-luna", effort: "high" },
      { modelId: "gpt-5.6-terra", effort: "low" },
      { modelId: "gpt-5.6-terra", effort: "medium" },
    ];

if (sources.length !== 1) {
  throw new Error("Supply exactly one prior comparison manifest path.");
}

function getPokemonMetadata(fixtureId: string) {
  const pokemonFixture = aiPokemonAnalysisFixtures.find(
    (fixture) => fixture.id === fixtureId,
  );
  if (!pokemonFixture) {
    throw new Error(`Unknown Pokemon evaluation fixture "${fixtureId}".`);
  }

  return {
    fixture: pokemonFixture,
    metadata: {
      fixtureId: pokemonFixture.id,
      title: `${pokemonFixture.teamFixtureId} - ${pokemonFixture.expectedPokemonName}`,
      expectations: pokemonFixture.expectations,
    },
  };
}

function getRecommendationMetadata(fixtureId: string) {
  const recommendationFixture = aiPokemonRecommendationFixtures.find(
    (fixture) => fixture.id === fixtureId,
  );
  if (!recommendationFixture) {
    throw new Error(`Unknown recommendation evaluation fixture "${fixtureId}".`);
  }

  return {
    fixture: recommendationFixture,
    metadata: {
      fixtureId: recommendationFixture.id,
      title: `${recommendationFixture.teamFixtureId} - replace ${recommendationFixture.expectedRemovedPokemonName}`,
      expectations: recommendationFixture.expectations,
    },
  };
}

async function buildCurrentCases(frozenCases: FrozenCase[]) {
  const restoreRuntime = installAiEvaluationRuntime(root);

  try {
    const [pokemonIndex, itemIndex, abilityIndex, legality, showdownData] = await Promise.all([
      fetchPokemonIndex(),
      fetchItemIndex(),
      fetchAbilityIndex(),
      loadShowdownLegality(),
      loadShowdownData(),
    ]);
    const caseOptions = {
      pokemonIndex,
      itemIndex,
      abilityIndex,
      showdownData,
      legality,
      services: { fetchPokemon, fetchItem },
    };
    const cases: AiTeamEvaluationCase[] = [];

    for (const frozenCase of frozenCases) {
      if (frozenCase.request.scope === "team") {
        const fixture = aiTeamFixtures.find(
          (candidate) => candidate.id === frozenCase.fixtureId,
        );
        if (!fixture) throw new Error(`Unknown team fixture "${frozenCase.fixtureId}".`);
        cases.push(await createAiTeamEvaluationCase(fixture, caseOptions));
        continue;
      }

      if (frozenCase.request.scope === "pokemon") {
        const { fixture: pokemonFixture, metadata } = getPokemonMetadata(frozenCase.fixtureId);
        const teamFixture = aiTeamFixtures.find(
          (candidate) => candidate.id === pokemonFixture.teamFixtureId,
        );
        if (!teamFixture) throw new Error(`Unknown team fixture "${pokemonFixture.teamFixtureId}".`);
        cases.push(
          await createAiPokemonEvaluationCase(
            teamFixture,
            pokemonFixture.selectedSlot,
            caseOptions,
            metadata,
          ),
        );
        continue;
      }

      const { fixture: recommendationFixture, metadata } = getRecommendationMetadata(
        frozenCase.fixtureId,
      );
      const teamFixture = aiTeamFixtures.find(
        (candidate) => candidate.id === recommendationFixture.teamFixtureId,
      );
      if (!teamFixture) throw new Error(`Unknown team fixture "${recommendationFixture.teamFixtureId}".`);
      cases.push(
        await createAiPokemonRecommendationEvaluationCase(
          teamFixture,
          recommendationFixture.removedSlot,
          caseOptions,
          metadata,
        ),
      );
    }

    return cases;
  } finally {
    restoreRuntime();
  }
}

const source = resolve(root, sources[0]);
const frozenManifest = JSON.parse(
  await readFile(source, "utf8"),
) as FrozenManifest;
if (useFrozenInputs) {
  if (frozenManifest.promptVersion !== POKEPILOT_AI_PROMPT_VERSION) {
    throw new Error("Frozen comparison requires the same prompt version as its baseline.");
  }
  for (const entry of frozenManifest.cases) {
    const hash = createHash("sha256").update(JSON.stringify(entry.request)).digest("hex");
    if (!entry.inputSha256 || entry.inputSha256 !== hash || !entry.evaluatorContext) {
      throw new Error(`Invalid frozen input for ${entry.fixtureId}.`);
    }
  }
}
const cases = useFrozenInputs ? frozenManifest.cases : await buildCurrentCases(frozenManifest.cases);
const reusedRecords = new Map<string, { record: RecordEntry; sourceFile: string }>();
function recordKey(fixtureId: string, repeat: number, configuration: Configuration) {
  return `${fixtureId}/${repeat}/${configuration.modelId}/${configuration.effort}`;
}
if (reuseDirectory) {
  if (!useFrozenInputs) throw new Error("Reusing results requires frozen inputs.");
  const priorManifest = JSON.parse(await readFile(resolve(reuseDirectory, "manifest.json"), "utf8")) as FrozenManifest & { maxOutputTokens: number };
  if (priorManifest.promptVersion !== POKEPILOT_AI_PROMPT_VERSION || priorManifest.maxOutputTokens !== 16_000) {
    throw new Error("Prior results use different evaluation settings.");
  }
  for (const entry of cases) {
    const previous = priorManifest.cases.find((candidate) => candidate.fixtureId === entry.fixtureId);
    if (!previous || JSON.stringify(previous.request) !== JSON.stringify(entry.request)) {
      throw new Error(`Prior results use a different input for ${entry.fixtureId}.`);
    }
  }
  for (const file of (await readdir(reuseDirectory)).filter((name) => /^\d{3}\.json$/.test(name))) {
    const sourceFile = resolve(reuseDirectory, file);
    const record = JSON.parse(await readFile(sourceFile, "utf8")) as RecordEntry;
    if (record.result.status === "request-error") continue;
    if (!configurations.some((c) => c.modelId === record.configuration.modelId && c.effort === record.configuration.effort)) continue;
    const entry = cases.find((candidate) => candidate.fixtureId === record.result.fixtureId);
    if (!entry || entry.requestFingerprint !== record.result.requestFingerprint) throw new Error("Reused result input mismatch.");
    reusedRecords.set(recordKey(record.result.fixtureId, record.repeat, record.configuration), { record, sourceFile });
  }
}
const apiKey = resolveOpenAiEvaluationApiKey(root);
const startedAt = new Date().toISOString();
const output = resolve(
  root,
  "artifacts/ai-evaluation",
  `current-comparison-${startedAt.replace(/[:.]/g, "-")}`,
);
const maxOutputTokens = 16_000;
const repetitions = 3;
const manifest = {
  startedAt,
  sourceManifest: sources[0],
  inputMode: useFrozenInputs ? "frozen" : "rebuilt",
  reusedResults: [...reusedRecords.values()].map(({ sourceFile }) => sourceFile),
  promptVersion: POKEPILOT_AI_PROMPT_VERSION,
  maxOutputTokens,
  timeoutMs: 180_000,
  maxRetries: 0,
  repetitions,
  concurrency: 3,
  configurations,
  cases: cases.map((entry) => ({
    ...entry,
    inputSha256: createHash("sha256").update(JSON.stringify(entry.request)).digest("hex"),
  })),
};
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2));

if (prepareOnly) {
  console.log(JSON.stringify(cases.map((entry) => ({
    fixtureId: entry.fixtureId,
    requestVersion: entry.request.version,
    allyTargetOpportunities: entry.request.tactics?.allyTargetOpportunities.length ?? 0,
    allyStatChangeInteractions: entry.request.tactics?.allyStatChangeInteractions.length ?? 0,
    sharedMoveSequences: entry.request.tactics?.sharedMoveSequences.length ?? 0,
    fieldSetters: entry.request.tactics?.fieldSetters.length ?? 0,
  })), null, 2));
  process.exit(0);
}

const jobs: { entry: AiTeamEvaluationCase; repeat: number; configuration: Configuration }[] = [];
for (let repeat = 1; repeat <= repetitions; repeat += 1) {
  for (const entry of cases) {
    const rotated = [
      ...configurations.slice(repeat - 1),
      ...configurations.slice(0, repeat - 1),
    ];
    for (const configuration of rotated) jobs.push({ entry, repeat, configuration });
  }
}

console.log(
  `Evaluation credential loaded. ${jobs.length} current-input jobs; output: ${output}`,
);
let cursor = 0;
const results: RecordEntry[] = [];

async function runJob(index: number) {
  const { entry, repeat, configuration } = jobs[index];
  const reused = reusedRecords.get(recordKey(entry.fixtureId, repeat, configuration));
  if (reused) {
    results.push(reused.record);
    await writeFile(resolve(output, `${String(index + 1).padStart(3, "0")}.json`), JSON.stringify(reused.record, null, 2));
    console.log(`${results.length}/${jobs.length} reused ${configuration.effort} ${entry.fixtureId} #${repeat}`);
    return reused.record;
  }
  const adapter = createOpenAiLunaAdapter({
    apiKey,
    modelId: configuration.modelId,
    reasoningEffort: configuration.effort,
    maxOutputTokens,
    timeoutMs: 180_000,
    maxRetries: 0,
  });
  const result = await runAiTeamEvaluationCase(entry, adapter);
  const record = { configuration, repeat, result };
  results.push(record);
  await writeFile(
    resolve(output, `${String(index + 1).padStart(3, "0")}.json`),
    JSON.stringify(record, null, 2),
  );
  console.log(
    `${results.length}/${jobs.length} ${configuration.modelId}/${configuration.effort} ${entry.fixtureId} #${repeat}: ${result.status} (${Math.round(result.latencyMs)}ms)`,
  );
  return record;
}

// Confirm access and API compatibility before issuing the remaining paid jobs.
const firstRecord = await runJob(cursor++);
if (firstRecord.result.status === "request-error") {
  throw new Error("Initial evaluation request failed; stopped. See the first artifact for details.");
}

async function worker() {
  while (cursor < jobs.length) {
    const index = cursor++;
    await runJob(index);
  }
}

await Promise.all(Array.from({ length: 3 }, () => worker()));
const summary = configurations.map((configuration) => {
  const group = results.filter(
    (record) =>
      record.configuration.modelId === configuration.modelId &&
      record.configuration.effort === configuration.effort,
  );
  const latencies = group.map((record) => record.result.latencyMs).sort((left, right) => left - right);
  const middle = Math.floor(latencies.length / 2);
  return {
    ...configuration,
    count: group.length,
    strictPass: group.filter((record) => record.result.status === "complete").length,
    requestErrors: group.filter((record) => record.result.status === "request-error").length,
    medianLatencyMs:
      latencies.length % 2
        ? latencies[middle]
        : (latencies[middle - 1] + latencies[middle]) / 2,
    p95LatencyMs: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)],
    totalTokens: group.reduce((sum, record) => sum + record.result.usage.totalTokens, 0),
    estimatedCostUsd: group.reduce((sum, record) => sum + record.result.usage.costUsd, 0),
  };
});
await writeFile(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
