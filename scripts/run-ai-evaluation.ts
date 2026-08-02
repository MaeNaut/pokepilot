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
} from "../src/test/fixtures/aiTeamFixtures";
import type { AiTeamFixture } from "../src/test/fixtures/aiTeamFixtureTypes";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

type CliOptions = {
  fixtures: AiTeamFixture[];
  reasoningEffort: LunaReasoningEffort;
  outputDirectory: string;
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

  return {
    fixtures: getFixtureSelection(args),
    reasoningEffort: effortValue,
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
  npm run eval:ai -- --fixture <fixture-id>
  npm run eval:ai -- --effort none|low|medium

The default run is a two-case smoke test with one Singles and one Doubles
fixture at low reasoning. Calls always use GPT-5.6 Luna with Standard
service tier.`);
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

    for (const [index, fixture] of options.fixtures.entries()) {
      console.log(
        `Preparing ${index + 1}/${options.fixtures.length}: ${fixture.id}`,
      );
      evaluationCases.push(
        await createAiTeamEvaluationCase(fixture, {
          pokemonIndex,
          itemIndex,
          abilityIndex,
          legality,
          services: {
            fetchPokemon,
            fetchItem,
          },
        }),
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
      options.fixtures.length,
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
