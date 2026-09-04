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
  createCopilotTypeLabels,
  type CopilotAnalysisRequest,
} from "../src/utils/copilotAnalysis";
import { createCopilotResponsibilityCounts } from "../src/utils/copilotResponsibilities";
import { createAiTeamEvaluationCase } from "../src/test/evaluation/aiModelEvaluation";
import {
  aiTeamDoublesFixtures,
  aiTeamFixtures,
} from "../src/test/fixtures/aiTeamFixtures";
import { installAiEvaluationRuntime } from "./aiEvaluationRuntime";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const defaultUrl = "https://pokepilot-ai.vercel.app";
const defaultConcurrency = 5;

type CliOptions = {
  allowPaidCall: boolean;
  concurrency: number;
  fixtureId: string;
  url: string;
};

type ApiEnvelope = {
  ok?: boolean;
  error?: { code?: string };
  metadata?: { cacheStatus?: string };
};

type RequestResult = {
  body: ApiEnvelope;
  headers: Headers;
  status: number;
};

function readOptionValue(args: string[], option: string) {
  const inline = args.find((argument) => argument.startsWith(`${option}=`));
  if (inline) return inline.slice(option.length + 1);
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseOptions(args: string[]): CliOptions {
  const url = new URL(readOptionValue(args, "--url") ?? defaultUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("--url must use HTTPS unless it targets localhost.");
  }

  const concurrency = Number(
    readOptionValue(args, "--concurrency") ?? defaultConcurrency,
  );
  if (!Number.isInteger(concurrency) || concurrency < 2 || concurrency > 5) {
    throw new Error("--concurrency must be an integer from 2 through 5.");
  }

  return {
    allowPaidCall: args.includes("--allow-paid-call"),
    concurrency,
    fixtureId:
      readOptionValue(args, "--fixture") ?? aiTeamDoublesFixtures[0].id,
    url: url.toString().replace(/\/$/, ""),
  };
}

function printHelp() {
  console.log(`PokePilot deployment safeguard verification

Usage:
  npm run verify:deployment
  npm run verify:deployment -- --url https://preview.example.vercel.app
  npm run verify:deployment -- --allow-paid-call

The default run checks the HTTP boundary without calling OpenAI. The paid mode
builds one production-parity fixture request, sends up to five identical requests
concurrently, and expects exactly one cache miss plus shared or cached followers.
It then confirms that a follow-up request is served from the canonical cache.`);
}

function createInvalidNestedRequest(): CopilotAnalysisRequest & {
  diagnostics: CopilotAnalysisRequest["diagnostics"] & {
    unexpectedDeploymentField: boolean;
  };
} {
  return {
    version: 14,
    locale: "en",
    scope: "team",
    battleFormat: "doubles",
    teamName: "Deployment boundary test",
    selectedSlot: 0,
    typeLabels: createCopilotTypeLabels("en"),
    sets: [],
    megaOptions: [],
    candidateFilters: [],
    recommendationCandidates: [],
    mechanics: { moves: [], abilities: [], items: [] },
    diagnostics: {
      filledSlots: 0,
      coverageCount: 0,
      coverageGaps: [],
      defensiveMatchups: [],
      alerts: [],
      roleCounts: {
        "physical-attacker": 0,
        "special-attacker": 0,
        "physical-wall": 0,
        "special-wall": 0,
        supporter: 0,
        setter: 0,
      },
      responsibilityCounts: createCopilotResponsibilityCounts([]),
      moveSources: {},
      defensiveProfile: { weakTo: {}, resists: {}, immuneTo: {} },
      offensiveProfile: {
        physicalMoveCount: 0,
        specialMoveCount: 0,
        spreadMoveCount: 0,
        physicalSources: {},
        specialSources: {},
        spreadSources: {},
      },
      concepts: [],
      validity: { status: "valid", errorCount: 0, unavailableCount: 0 },
      unexpectedDeploymentField: true,
    },
  };
}

async function requestApi(
  url: string,
  init: RequestInit,
): Promise<RequestResult> {
  const response = await fetch(`${url}/api/pokepilot/analyze`, init);
  let body: ApiEnvelope = {};
  try {
    body = (await response.json()) as ApiEnvelope;
  } catch {
    throw new Error(`API returned non-JSON content with status ${response.status}.`);
  }
  return { body, headers: response.headers, status: response.status };
}

function assertResponse(
  result: RequestResult,
  expectedStatus: number,
  expectedCode?: string,
) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `Expected HTTP ${expectedStatus}, received ${result.status} (${result.body.error?.code ?? "unknown"}).`,
    );
  }
  if (expectedCode && result.body.error?.code !== expectedCode) {
    throw new Error(
      `Expected ${expectedCode}, received ${result.body.error?.code ?? "no error code"}.`,
    );
  }
  if (result.headers.get("cache-control") !== "no-store") {
    throw new Error("API response is missing Cache-Control: no-store.");
  }
  if (result.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("API response is missing X-Content-Type-Options: nosniff.");
  }
}

async function verifyHttpBoundary(url: string) {
  const methodResult = await requestApi(url, { method: "GET" });
  assertResponse(methodResult, 405, "METHOD_NOT_ALLOWED");

  const crossOriginResult = await requestApi(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.invalid",
    },
    body: JSON.stringify({}),
  });
  assertResponse(crossOriginResult, 403, "INVALID_REQUEST");
  if (crossOriginResult.headers.has("set-cookie")) {
    throw new Error("Cross-origin rejection unexpectedly issued a client cookie.");
  }

  const invalidResult = await requestApi(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: url,
    },
    body: JSON.stringify(createInvalidNestedRequest()),
  });
  assertResponse(invalidResult, 400, "INVALID_REQUEST");
  const setCookie = invalidResult.headers.get("set-cookie") ?? "";
  if (!setCookie.includes("HttpOnly") || !setCookie.includes("SameSite=Lax")) {
    throw new Error("Same-origin request did not receive the signed client cookie.");
  }

  console.log("HTTP boundary: PASS (method, origin, nested contract, headers, cookie)");
  return setCookie.split(";", 1)[0];
}

async function createProductionParityRequest(fixtureId: string) {
  const fixture = aiTeamFixtures.find((candidate) => candidate.id === fixtureId);
  if (!fixture) throw new Error(`Unknown fixture "${fixtureId}".`);

  const [pokemonIndex, itemIndex, abilityIndex, legality] = await Promise.all([
    fetchPokemonIndex(),
    fetchItemIndex(),
    fetchAbilityIndex(),
    loadShowdownLegality(),
  ]);
  const evaluationCase = await createAiTeamEvaluationCase(fixture, {
    pokemonIndex,
    itemIndex,
    abilityIndex,
    legality,
    services: { fetchPokemon, fetchItem },
  });

  return {
    ...evaluationCase.request,
    locale: "en" as const,
    teamName: `Deployment Safety QA ${new Date().toISOString()}`,
    typeLabels: createCopilotTypeLabels("en"),
  };
}

async function verifyConcurrentAnalysis(
  options: CliOptions,
  cookie: string,
) {
  const restoreRuntime = installAiEvaluationRuntime(projectRoot);
  try {
    console.log(`Preparing fixture: ${options.fixtureId}`);
    const request = await createProductionParityRequest(options.fixtureId);
    const send = () =>
      requestApi(options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          origin: options.url,
        },
        body: JSON.stringify(request),
      });
    const results = await Promise.all(
      Array.from({ length: options.concurrency }, send),
    );
    results.forEach((result) => assertResponse(result, 200));

    const statuses = results.map((result) => result.body.metadata?.cacheStatus);
    const misses = statuses.filter((status) => status === "miss").length;
    const followers = statuses.filter(
      (status) => status === "shared" || status === "hit",
    ).length;
    if (misses !== 1 || followers !== options.concurrency - 1) {
      throw new Error(
        `Expected one miss and ${options.concurrency - 1} followers; received ${statuses.join(", ")}.`,
      );
    }

    const cached = await send();
    assertResponse(cached, 200);
    if (cached.body.metadata?.cacheStatus !== "hit") {
      throw new Error(
        `Expected follow-up cache hit, received ${cached.body.metadata?.cacheStatus ?? "missing metadata"}.`,
      );
    }

    console.log(
      `Concurrent analysis: PASS (${statuses.join(", ")}; follow-up hit)`,
    );
  } finally {
    restoreRuntime();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const options = parseOptions(args);
  console.log(`Target: ${options.url}`);
  const cookie = await verifyHttpBoundary(options.url);
  if (!options.allowPaidCall) {
    console.log(
      "Paid concurrency check: SKIPPED (rerun with --allow-paid-call)",
    );
    return;
  }

  await verifyConcurrentAnalysis(options, cookie);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
