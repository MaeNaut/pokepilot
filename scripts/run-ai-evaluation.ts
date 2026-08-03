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
  createAiPokemonRecommendationEvaluationCase,
  createAiTeamEvaluationCase,
  getMissingExpectedRecommendationIds,
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
import { aiPokemonRecommendationFixtures } from "../src/test/fixtures/aiPokemonRecommendationFixtures";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

type CliOptions = {
  fixtures: AiTeamFixture[];
  reasoningEffort: LunaReasoningEffort;
  outputDirectory: string;
  scope: "team" | "pokemon" | "recommendation";
  selectedSlot: number;
  pokemonRegressions: boolean;
  recommendationRegressions: boolean;
  repeat: number;
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
  const recommendationRegressions = args.includes(
    "--recommendation-regressions",
  );
  if (pokemonRegressions && recommendationRegressions) {
    throw new Error(
      "--pokemon-regressions and --recommendation-regressions are mutually exclusive.",
    );
  }
  const requestedScope = readOptionValue(args, "--scope");
  const scope =
    requestedScope ??
    (pokemonRegressions
      ? "pokemon"
      : recommendationRegressions
        ? "recommendation"
        : "team");
  if (scope !== "team" && scope !== "pokemon" && scope !== "recommendation") {
    throw new Error("--scope must be team, pokemon, or recommendation.");
  }

  const selectedSlot = Number(readOptionValue(args, "--slot") ?? 0);
  if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 5) {
    throw new Error("--slot must be an integer from 0 through 5.");
  }

  if (pokemonRegressions && scope !== "pokemon") {
    throw new Error("--pokemon-regressions requires Pokemon scope.");
  }
  if (recommendationRegressions && scope !== "recommendation") {
    throw new Error(
      "--recommendation-regressions requires recommendation scope.",
    );
  }

  const repeat = Number(readOptionValue(args, "--repeat") ?? 1);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 10) {
    throw new Error("--repeat must be an integer from 1 through 10.");
  }

  return {
    fixtures: getFixtureSelection(args),
    reasoningEffort: effortValue,
    scope,
    selectedSlot,
    pokemonRegressions,
    recommendationRegressions,
    repeat,
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
  npm run eval:ai -- --recommendation-regressions
  npm run eval:ai -- --fixture <fixture-id>
  npm run eval:ai -- --fixture <fixture-id> --scope pokemon --slot 0
  npm run eval:ai -- --fixture <fixture-id> --scope recommendation --slot 0
  npm run eval:ai -- --effort none|low|medium
  npm run eval:ai -- --recommendation-regressions --repeat 3

The default run is a two-case smoke test with one Singles and one Doubles
  fixture at low reasoning. --strategy runs focused team interactions,
  --pokemon-regressions runs selected-set cases, and --recommendation-regressions
  removes one member before building the production candidate shortlist.
  Calls always use GPT-5.6 Luna with Standard service tier.`);
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
    const baseEvaluationTargets = options.pokemonRegressions
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
            expectedCandidateIds: undefined,
            requiredRecommendationIds: undefined,
          };
        })
      : options.recommendationRegressions
        ? aiPokemonRecommendationFixtures.map((recommendationFixture) => {
            const fixture = aiTeamFixtures.find(
              (candidate) =>
                candidate.id === recommendationFixture.teamFixtureId,
            );

            if (!fixture) {
              throw new Error(
                `Unknown team fixture "${recommendationFixture.teamFixtureId}" for ${recommendationFixture.id}.`,
              );
            }

            return {
              fixture,
              selectedSlot: recommendationFixture.removedSlot,
              metadata: {
                fixtureId: recommendationFixture.id,
                title: `${fixture.title} - replace ${recommendationFixture.expectedRemovedPokemonName}`,
                expectations: recommendationFixture.expectations,
              },
              expectedCandidateIds: recommendationFixture.expectedCandidateIds,
              requiredRecommendationIds:
                recommendationFixture.requiredRecommendationIds,
            };
          })
        : options.fixtures.map((fixture) => ({
            fixture,
            selectedSlot: options.selectedSlot,
            metadata: undefined,
            expectedCandidateIds: undefined,
            requiredRecommendationIds: undefined,
          }));
    const evaluationTargets = Array.from(
      { length: options.repeat },
      (_, repeatIndex) =>
        baseEvaluationTargets.map((target) => ({ ...target, repeatIndex })),
    ).flat();

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
      const evaluationCase =
        options.scope === "pokemon"
          ? await createAiPokemonEvaluationCase(
              fixture,
              target.selectedSlot,
              caseOptions,
              target.metadata,
            )
          : options.scope === "recommendation"
            ? await createAiPokemonRecommendationEvaluationCase(
                fixture,
                target.selectedSlot,
                caseOptions,
                target.metadata,
              )
            : await createAiTeamEvaluationCase(fixture, caseOptions);

      if (target.expectedCandidateIds) {
        const candidateIds = new Set(
          evaluationCase.request.recommendationCandidates.map(
            (candidate) => candidate.pokemonId,
          ),
        );
        const missingCandidateIds = target.expectedCandidateIds.filter(
          (candidateId) => !candidateIds.has(candidateId),
        );

        if (missingCandidateIds.length > 0) {
          throw new Error(
            `${target.metadata?.fixtureId ?? fixture.id} is missing expected shortlist candidates: ${missingCandidateIds.join(", ")}. ` +
              `Generated shortlist: ${[...candidateIds].join(", ")}.`,
          );
        }
      }

      evaluationCases.push(
        options.repeat === 1
          ? evaluationCase
          : {
              ...evaluationCase,
              fixtureId: `${evaluationCase.fixtureId}-run-${target.repeatIndex + 1}`,
              title: `${evaluationCase.title} (run ${target.repeatIndex + 1})`,
            },
      );
    }

    const adapter = createOpenAiLunaAdapter({
      apiKey,
      reasoningEffort: options.reasoningEffort,
    });

    console.log(
      `Calling ${adapter.modelId} with Standard service tier (${options.reasoningEffort} reasoning)...`,
    );
    const modelResults = await runAiTeamEvaluationSuite(evaluationCases, {
      ...adapter,
      analyze: async (request) => {
        const setNames = request.sets
          .map((pokemonSet) => pokemonSet.pokemonName)
          .join(", ");
        console.log(`Analyzing: ${request.teamName} [${setNames}]`);
        return adapter.analyze(request);
      },
    });
    const results = modelResults.map((result, index) => {
      const requiredRecommendationIds =
        evaluationTargets[index]?.requiredRecommendationIds;
      if (!requiredRecommendationIds || result.status !== "complete") return result;

      const missingCandidateIds = getMissingExpectedRecommendationIds(
        result.output,
        requiredRecommendationIds,
      );
      if (missingCandidateIds.length === 0) return result;

      return {
        ...result,
        status: "invalid-output" as const,
        output: null,
        debugOutput: result.debugOutput ?? result.output,
        validationErrors: [
          ...result.validationErrors,
          `Missing expected recommendation candidates: ${missingCandidateIds.join(", ")}.`,
        ],
      };
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
