import type { ShowdownLegalitySnapshot } from "../../api/showdownLegality";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  TeamMember,
} from "../../types";
import {
  createCopilotAnalysisRequest,
  getCopilotRequestFingerprint,
  type CopilotAnalysisRequest,
} from "../../utils/copilotAnalysis";
import {
  validateCopilotModelOutput,
  type CopilotModelOutput,
} from "../../utils/copilotModelContract";
import {
  buildImportedShowdownSnapshot,
  type ShowdownImportServices,
} from "../../utils/showdownImport";
import { createTeamAnalysisContext } from "../../utils/teamAnalysisContext";
import type {
  AiTeamFixture,
  AiTeamFixtureExpectations,
  AiTeamFixtureSource,
} from "../fixtures/aiTeamFixtureTypes";

export type AiTeamEvaluationCase = {
  schemaVersion: 1;
  fixtureId: string;
  title: string;
  request: CopilotAnalysisRequest;
  requestFingerprint: string;
  evaluatorContext: {
    source: AiTeamFixtureSource;
    expectations: AiTeamFixtureExpectations;
  };
};

export type AiEvaluationUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type AiEvaluationResponseMetadata = {
  responseId?: string;
  serviceTier?: string;
  reasoningEffort?: string;
  promptVersion?: number;
};

export type AiEvaluationAdapterResult = {
  output: unknown;
  usage?: Partial<AiEvaluationUsage>;
  responseMetadata?: AiEvaluationResponseMetadata;
};

export type AiEvaluationModelAdapter = {
  modelId: string;
  analyze: (
    request: Readonly<CopilotAnalysisRequest>,
  ) => Promise<AiEvaluationAdapterResult>;
};

export type AiEvaluationRunResult = {
  schemaVersion: 1;
  fixtureId: string;
  modelId: string;
  requestFingerprint: string;
  status: "complete" | "invalid-output" | "request-error";
  output: CopilotModelOutput | null;
  validationErrors: string[];
  error: string | null;
  latencyMs: number;
  usage: AiEvaluationUsage;
  responseMetadata: AiEvaluationResponseMetadata;
};

type CreateAiTeamEvaluationCaseOptions = {
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  legality: ShowdownLegalitySnapshot | null;
  services?: ShowdownImportServices;
};

export async function createAiTeamEvaluationCase(
  fixture: AiTeamFixture,
  {
    pokemonIndex,
    itemIndex,
    legality,
    services,
  }: CreateAiTeamEvaluationCaseOptions,
): Promise<AiTeamEvaluationCase> {
  const imported = await buildImportedShowdownSnapshot(fixture.showdownText, {
    pokemonIndex,
    ...(services ? { services } : {}),
  });
  const moveSources = imported.members.filter(
    (member): member is TeamMember => Boolean(member),
  );
  const { diagnostics, validity } = createTeamAnalysisContext({
    team: imported.members,
    buildState: imported.buildState,
    moveSources,
    legality,
    pokemonIndex,
    itemIndex,
  });
  const selectedSlot = Math.max(
    0,
    imported.members.findIndex((member) => Boolean(member)),
  );
  const request = createCopilotAnalysisRequest({
    scope: "team",
    battleFormat: fixture.battleFormat,
    teamName: fixture.title,
    team: imported.members,
    pokemonIndex,
    selectedSlot,
    buildState: imported.buildState,
    diagnostics,
    validity,
  });

  return {
    schemaVersion: 1,
    fixtureId: fixture.id,
    title: fixture.title,
    request,
    requestFingerprint: getCopilotRequestFingerprint(request),
    evaluatorContext: {
      source: { ...fixture.source },
      expectations: {
        teamIdentities: [...fixture.expectations.teamIdentities],
        criticalObservations: [...fixture.expectations.criticalObservations],
        forbiddenConclusions: [...fixture.expectations.forbiddenConclusions],
      },
    },
  };
}

export function createAiEvaluationModelInput(
  evaluationCase: AiTeamEvaluationCase,
): CopilotAnalysisRequest {
  return JSON.parse(
    JSON.stringify(evaluationCase.request),
  ) as CopilotAnalysisRequest;
}

function normalizeUsage(
  usage: Partial<AiEvaluationUsage> | undefined,
): AiEvaluationUsage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    reasoningTokens: usage?.reasoningTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    costUsd: usage?.costUsd ?? 0,
  };
}

export async function runAiTeamEvaluationCase(
  evaluationCase: AiTeamEvaluationCase,
  adapter: AiEvaluationModelAdapter,
): Promise<AiEvaluationRunResult> {
  const startedAt = performance.now();

  try {
    const adapterResult = await adapter.analyze(
      createAiEvaluationModelInput(evaluationCase),
    );
    const validation = validateCopilotModelOutput(adapterResult.output);

    return {
      schemaVersion: 1,
      fixtureId: evaluationCase.fixtureId,
      modelId: adapter.modelId,
      requestFingerprint: evaluationCase.requestFingerprint,
      status: validation.success ? "complete" : "invalid-output",
      output: validation.data,
      validationErrors: validation.errors,
      error: null,
      latencyMs: performance.now() - startedAt,
      usage: normalizeUsage(adapterResult.usage),
      responseMetadata: { ...adapterResult.responseMetadata },
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      fixtureId: evaluationCase.fixtureId,
      modelId: adapter.modelId,
      requestFingerprint: evaluationCase.requestFingerprint,
      status: "request-error",
      output: null,
      validationErrors: [],
      error: error instanceof Error ? error.message : "Unknown model request error.",
      latencyMs: performance.now() - startedAt,
      usage: normalizeUsage(undefined),
      responseMetadata: {},
    };
  }
}

export async function runAiTeamEvaluationSuite(
  evaluationCases: AiTeamEvaluationCase[],
  adapter: AiEvaluationModelAdapter,
) {
  const results: AiEvaluationRunResult[] = [];

  for (const evaluationCase of evaluationCases) {
    results.push(await runAiTeamEvaluationCase(evaluationCase, adapter));
  }

  return results;
}
