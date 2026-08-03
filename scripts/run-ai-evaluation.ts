import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPokemon } from "../src/api/pokeApi";
import { fetchPokemonIndex } from "../src/api/pokemonIndex";
import {
  fetchAbilityIndex,
  fetchItem,
  fetchItemIndex,
} from "../src/api/showdownCatalog";
import { loadShowdownLegality } from "../src/api/showdownLegality";
import {
  createAiEvaluationReport,
  formatAiEvaluationReportMarkdown,
} from "../src/test/evaluation/aiEvaluationReporter";
import {
  createAiPokemonEvaluationCase,
  createAiTeamEvaluationCase,
  runAiTeamEvaluationSuite,
} from "../src/test/evaluation/aiModelEvaluation";
import {
  createOpenAiLunaAdapter,
  type LunaReasoningEffort,
} from "../src/test/evaluation/openAiLunaAdapter";
import { resolveOpenAiApiKey } from "../server/openAiEnvironment";
import { POKEPILOT_AI_DEFAULT_REASONING_EFFORT } from "../server/openAiLuna";
import {
  aiTeamDoublesFixtures,
  aiTeamFixtures,
  aiTeamSinglesFixtures,
  aiTeamStrategyFixtures,
} from "../src/test/fixtures/aiTeamFixtures";
import type { AiTeamFixture } from "../src/test/fixtures/aiTeamFixtureTypes";
import { aiPokemonAnalysisFixtures } from "../src/test/fixtures/aiPokemonAnalysisFixtures";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

type CliOptions = {
  fixtures: AiTeamFixture[];
  reasoningEffort: LunaReasoningEffort;
  outputDirectory: string;
  scope: "team" | "pokemon";
  selectedSlot: number;
  pokemonRegressions: boolean;
};

async function loadOpenAiApiKey() {
  const apiKey = resolveOpenAiApiKey(projectRoot);

  if (apiKey) {
    return apiKey;
  }

  throw new Error(
    "OPENAI_API_KEY is unavailable. Set it in the process environment or " +
      "in the ignored project file .env.local, then rerun the command.",
  );
}

function readOptionValue(args: string[], option: string) {
  const inlineValue = args.find((arg) => arg.startsWith(`${option}=`));

  if (inlineValue) {
    return inlineValue.slice(option.length + 1);
  }

  const optionIndex = args.indexOf(option);
  return optionIndex >= 0 ? args[optionIndex + 1] : undefined;
}

function getFixtureSelection(args: string[]) {
  if (args.includes("--all")) {
    return aiTeamFixtures;
  }

  if (args.includes("--strategy")) {
    return aiTeamStrategyFixtures;
  }

  const fixtureIds = args
    .flatMap((arg, index) => {
      if (arg.startsWith("--fixture=")) {
        return [arg.slice("--fixture=".length)];
      }

      return arg === "--fixture" && args[index + 1] ? [args[index + 1]] : [];
    })
    .filter(Boolean);

  if (fixtureIds.length > 0) {
    const selected = fixtureIds.map((fixtureId) => {
      const fixture = aiTeamFixtures.find((entry) => entry.id === fixtureId);

      if (!fixture) {
        throw new Error(`Unknown AI fixture "${fixtureId}".`);
      }

      return fixture;
    });

    return [...new Map(selected.map((fixture) => [fixture.id, fixture])).values()];
  }

  return [aiTeamSinglesFixtures[0], aiTeamDoublesFixtures[0]];
}

function parseCliOptions(args: string[]): CliOptions {
  const effortValue =
    readOptionValue(args, "--effort") ??
    POKEPILOT_AI_DEFAULT_REASONING_EFFORT;

  if (
    effortValue !== "none" &&
    effortValue !== "low" &&
    effortValue !== "medium"
  ) {
    throw new Error("--effort must be none, low, or medium.");
  }

  const pokemonRegressions = args.includes("--pokemon-regressions");
  const requestedScope = readOptionValue(args, "--scope");
  const scope = requestedScope ?? (pokemonRegressions ? "pokemon" : "team");
  if (scope !== "team" && scope !== "pokemon") {
    throw new Error("--scope must be team or pokemon.");
  }

  const selectedSlot = Number(readOptionValue(args, "--slot") ?? 0);
  if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 5) {
    throw new Error("--slot must be an integer from 0 through 5.");
  }

  if (pokemonRegressions && scope !== "pokemon") {
    throw new Error("--pokemon-regressions requires Pokemon scope.");
  }

  return {
    fixtures: getFixtureSelection(args),
    reasoningEffort: effortValue,
    scope,
    selectedSlot,
    pokemonRegressions,
    outputDirectory: resolve(
      projectRoot,
      readOptionValue(args, "--output") ?? "artifacts/ai-evaluation",
    ),
  };
}

function printHelp() {
  console.log(`PokePilot Luna fixture evaluation

Usage:
  npm run eval:ai
  npm run eval:ai -- --all
  npm run eval:ai -- --strategy
  npm run eval:ai -- --pokemon-regressions
  npm run eval:ai -- --fixture <fixture-id>
  npm run eval:ai -- --fixture <fixture-id> --scope pokemon --slot 0
  npm run eval:ai -- --effort none|low|medium

The default run is a two-case smoke test with one Singles and one Doubles
fixture at low reasoning. --strategy runs the focused interaction and ace-funnel
regressions. Calls always use GPT-5.6 Luna with Standard service tier.`);
}

function createReportFileStem(
  startedAt: string,
  reasoningEffort: LunaReasoningEffort,
  fixtureCount: number,
) {
  const timestamp = startedAt.replace(/[:.]/g, "-");
  const scope = fixtureCount === aiTeamFixtures.length ? "full" : `${fixtureCount}-case`;
  return `luna-${reasoningEffort}-${scope}-${timestamp}`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const apiKey = await loadOpenAiApiKey();

  const options = parseCliOptions(args);
  const startedAt = new Date().toISOString();
  const restoreRuntime = installAiEvaluationRuntime(projectRoot);

  try {
    console.log("Loading production Pokemon, item, and Regulation M-B data...");
    const [pokemonIndex, itemIndex, abilityIndex, legality] = await Promise.all([
      fetchPokemonIndex(),
      fetchItemIndex(),
      fetchAbilityIndex(),
      loadShowdownLegality(),
    ]);
    const evaluationCases = [];
    const evaluationTargets = options.pokemonRegressions
      ? aiPokemonAnalysisFixtures.map((pokemonFixture) => {
          const fixture = aiTeamFixtures.find(
            (candidate) => candidate.id === pokemonFixture.teamFixtureId,
          );

          if (!fixture) {
            throw new Error(
              `Unknown team fixture "${pokemonFixture.teamFixtureId}" for ${pokemonFixture.id}.`,
            );
          }

          return {
            fixture,
            selectedSlot: pokemonFixture.selectedSlot,
            metadata: {
              fixtureId: pokemonFixture.id,
              title: `${fixture.title} - ${pokemonFixture.expectedPokemonName}`,
              expectations: pokemonFixture.expectations,
            },
          };
        })
      : options.fixtures.map((fixture) => ({
          fixture,
          selectedSlot: options.selectedSlot,
          metadata: undefined,
        }));

    for (const [index, target] of evaluationTargets.entries()) {
      const { fixture } = target;
      console.log(
        `Preparing ${index + 1}/${evaluationTargets.length}: ${fixture.id}`,
      );
      const caseOptions = {
        pokemonIndex,
        itemIndex,
        abilityIndex,
        legality,
        services: {
          fetchPokemon,
          fetchItem,
        },
      };
      evaluationCases.push(
        options.scope === "pokemon"
          ? await createAiPokemonEvaluationCase(
              fixture,
              target.selectedSlot,
              caseOptions,
              target.metadata,
            )
          : await createAiTeamEvaluationCase(fixture, caseOptions),
      );
    }

    const adapter = createOpenAiLunaAdapter({
      apiKey,
      reasoningEffort: options.reasoningEffort,
    });

    console.log(
      `Calling ${adapter.modelId} with Standard service tier (${options.reasoningEffort} reasoning)...`,
    );
    const results = await runAiTeamEvaluationSuite(evaluationCases, {
      ...adapter,
      analyze: async (request) => {
        const setNames = request.sets
          .map((pokemonSet) => pokemonSet.pokemonName)
          .join(", ");
        console.log(`Analyzing: ${request.teamName} [${setNames}]`);
        return adapter.analyze(request);
      },
    });
    const completedAt = new Date().toISOString();
    const report = createAiEvaluationReport({
      startedAt,
      completedAt,
      evaluationCases,
      results,
    });
    const fileStem = createReportFileStem(
      startedAt,
      options.reasoningEffort,
      evaluationTargets.length,
    );
    const jsonPath = resolve(options.outputDirectory, `${fileStem}.json`);
    const markdownPath = resolve(options.outputDirectory, `${fileStem}.md`);

    await mkdir(options.outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
      writeFile(
        markdownPath,
        formatAiEvaluationReportMarkdown(report),
        "utf8",
      ),
    ]);

    console.log("");
    console.log(
      `Complete: ${report.summary.completeCount}/${report.run.caseCount}`,
    );
    console.log(`Total tokens: ${report.summary.usage.totalTokens}`);
    console.log(
      `Estimated Standard cost: $${report.summary.usage.costUsd.toFixed(6)}`,
    );
    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${markdownPath}`);

    if (
      report.summary.invalidOutputCount > 0 ||
      report.summary.requestErrorCount > 0
    ) {
      process.exitCode = 1;
    }
  } finally {
    restoreRuntime();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
