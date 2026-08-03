import type { ShowdownLegalitySnapshot } from "../../api/showdownLegality";
import { formatIdLabel } from "../../api/showdownIds";
import {
  translateGameName,
  translatePokemonName,
} from "../../i18n/gameTranslations";
import type {
  ItemIndexEntry,
  PokemonAbility,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
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
import { clearBuildStateSlot } from "../../utils/teamBuildState";
import { emptyPokemonCandidateFilters } from "../../utils/pokemonCandidateFilters";
import {
  countTeamMegaOptions,
  createPokemonRecommendationCandidates,
  createPokemonRecommendationOptions,
  getOccupiedPokemonSpeciesKeys,
} from "../../utils/pokemonRecommendations";
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
  debugOutput?: unknown;
  validationErrors?: string[];
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
  debugOutput: unknown | null;
  validationErrors: string[];
  error: string | null;
  latencyMs: number;
  usage: AiEvaluationUsage;
  responseMetadata: AiEvaluationResponseMetadata;
};

export function getMissingExpectedRecommendationIds(
  output: CopilotModelOutput | null,
  expectedCandidateIds: readonly string[],
) {
  if (!output) return [...expectedCandidateIds];

  const recommendationIds = new Set(
    output.recommendations.map((recommendation) => recommendation.id),
  );
  return expectedCandidateIds.filter(
    (candidateId) => !recommendationIds.has(candidateId),
  );
}

export type CreateAiTeamEvaluationCaseOptions = {
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  abilityIndex?: PokemonAbility[];
  legality: ShowdownLegalitySnapshot | null;
  services?: ShowdownImportServices;
  createRecommendationCandidates?: typeof createPokemonRecommendationCandidates;
};

type AiEvaluationCaseMetadata = {
  fixtureId?: string;
  title?: string;
  expectations?: AiTeamFixtureExpectations;
};

async function createAiFixtureAnalysisContext(
  fixture: AiTeamFixture,
  {
    pokemonIndex,
    itemIndex,
    legality,
    services,
  }: CreateAiTeamEvaluationCaseOptions,
  removedSlot?: number,
) {
  const imported = await buildImportedShowdownSnapshot(fixture.showdownText, {
    pokemonIndex,
    ...(services ? { services } : {}),
  });
  const removedMember =
    removedSlot === undefined ? null : imported.members[removedSlot] ?? null;
  const team: TeamSlot[] = [...imported.members];
  const buildState =
    removedSlot === undefined
      ? imported.buildState
      : clearBuildStateSlot(imported.buildState, removedSlot);

  if (removedSlot !== undefined) {
    team[removedSlot] = null;
  }

  const moveSources = team.filter(
    (member): member is TeamMember => Boolean(member),
  );
  const { diagnostics, validity } = createTeamAnalysisContext({
    team,
    buildState,
    moveSources,
    legality,
    pokemonIndex,
    itemIndex,
  });

  return {
    team,
    buildState,
    diagnostics,
    validity,
    removedMember,
  };
}

export async function createAiTeamEvaluationCase(
  fixture: AiTeamFixture,
  {
    pokemonIndex,
    itemIndex,
    abilityIndex = [],
    legality,
    services,
  }: CreateAiTeamEvaluationCaseOptions,
): Promise<AiTeamEvaluationCase> {
  const { team, buildState, diagnostics, validity } =
    await createAiFixtureAnalysisContext(fixture, {
      pokemonIndex,
      itemIndex,
      abilityIndex,
      legality,
      services,
    });
  const selectedSlot = Math.max(
    0,
    team.findIndex((member) => Boolean(member)),
  );
  const request = createCopilotAnalysisRequest({
    scope: "team",
    locale: "ko",
    battleFormat: fixture.battleFormat,
    teamName: fixture.title,
    team,
    pokemonIndex,
    abilityIndex,
    selectedSlot,
    buildState,
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

export async function createAiPokemonEvaluationCase(
  fixture: AiTeamFixture,
  selectedSlot: number,
  options: CreateAiTeamEvaluationCaseOptions,
  metadata?: AiEvaluationCaseMetadata,
): Promise<AiTeamEvaluationCase> {
  const teamCase = await createAiTeamEvaluationCase(fixture, options);
  const selectedSet = teamCase.request.sets.find(
    (set) => set.slotIndex === selectedSlot,
  );

  if (!selectedSet) {
    throw new Error(
      `Fixture "${fixture.id}" has no Pokemon in slot ${selectedSlot}.`,
    );
  }

  const request: CopilotAnalysisRequest = {
    ...teamCase.request,
    scope: "pokemon",
    selectedSlot,
  };

  return {
    ...teamCase,
    fixtureId:
      metadata?.fixtureId ?? `${fixture.id}-pokemon-${selectedSlot}`,
    title: metadata?.title ?? `${fixture.title} - ${selectedSet.displayName}`,
    request,
    requestFingerprint: getCopilotRequestFingerprint(request),
    evaluatorContext: {
      ...teamCase.evaluatorContext,
      expectations: metadata?.expectations
        ? {
            teamIdentities: [...metadata.expectations.teamIdentities],
            criticalObservations: [
              ...metadata.expectations.criticalObservations,
            ],
            forbiddenConclusions: [
              ...metadata.expectations.forbiddenConclusions,
            ],
          }
        : teamCase.evaluatorContext.expectations,
    },
  };
}

export async function createAiPokemonRecommendationEvaluationCase(
  fixture: AiTeamFixture,
  selectedSlot: number,
  options: CreateAiTeamEvaluationCaseOptions,
  metadata?: AiEvaluationCaseMetadata,
): Promise<AiTeamEvaluationCase> {
  const {
    pokemonIndex,
    abilityIndex = [],
    legality,
    createRecommendationCandidates = createPokemonRecommendationCandidates,
  } = options;
  const { team, buildState, diagnostics, validity, removedMember } =
    await createAiFixtureAnalysisContext(fixture, options, selectedSlot);

  if (!removedMember) {
    throw new Error(
      `Fixture "${fixture.id}" has no Pokemon in slot ${selectedSlot}.`,
    );
  }

  const recommendationOptions = createPokemonRecommendationOptions({
    pokemonIndex,
    abilityIndex,
    legality,
    getPokemonDisplayName: (entry, includeForm) =>
      translatePokemonName("ko", {
        id: entry.name,
        speciesId: entry.speciesKey,
        fallback: entry.displayName,
        includeForm,
        formLabel: entry.formLabel,
        formKind: entry.formKind,
      }),
    getTypeDisplayName: (type) =>
      translateGameName("ko", "types", type, formatIdLabel(type)),
    getAbilityDisplayName: (id, fallback) =>
      translateGameName("ko", "abilities", id, fallback),
  });
  const recommendationCandidates = await createRecommendationCandidates({
    options: recommendationOptions,
    filters:
      buildState.candidateFiltersBySlot[selectedSlot] ??
      emptyPokemonCandidateFilters,
    occupiedSpeciesKeys: getOccupiedPokemonSpeciesKeys(team, pokemonIndex),
    diagnostics,
    battleFormat: fixture.battleFormat,
    existingMegaOptionCount: countTeamMegaOptions(
      team,
      buildState.itemBySlot,
      pokemonIndex,
    ),
  });

  if (recommendationCandidates.length === 0) {
    throw new Error(
      `Fixture "${fixture.id}" produced no recommendation candidates for slot ${selectedSlot}.`,
    );
  }

  const request = createCopilotAnalysisRequest({
    scope: "recommendation",
    locale: "ko",
    battleFormat: fixture.battleFormat,
    teamName: fixture.title,
    team,
    pokemonIndex,
    abilityIndex,
    selectedSlot,
    buildState,
    diagnostics,
    validity,
    recommendationCandidates,
  });

  return {
    schemaVersion: 1,
    fixtureId:
      metadata?.fixtureId ?? `${fixture.id}-recommendation-${selectedSlot}`,
    title:
      metadata?.title ?? `${fixture.title} - replace ${removedMember.name}`,
    request,
    requestFingerprint: getCopilotRequestFingerprint(request),
    evaluatorContext: {
      source: { ...fixture.source },
      expectations: metadata?.expectations
        ? {
            teamIdentities: [...metadata.expectations.teamIdentities],
            criticalObservations: [
              ...metadata.expectations.criticalObservations,
            ],
            forbiddenConclusions: [
              ...metadata.expectations.forbiddenConclusions,
            ],
          }
        : {
            teamIdentities: [...fixture.expectations.teamIdentities],
            criticalObservations: [...fixture.expectations.criticalObservations],
            forbiddenConclusions: [
              ...fixture.expectations.forbiddenConclusions,
            ],
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
    const adapterValidationErrors = adapterResult.validationErrors ?? [];
    const validation =
      adapterValidationErrors.length > 0
        ? null
        : validateCopilotModelOutput(adapterResult.output);
    const validationErrors = validation
      ? validation.errors
      : adapterValidationErrors;

    return {
      schemaVersion: 1,
      fixtureId: evaluationCase.fixtureId,
      modelId: adapter.modelId,
      requestFingerprint: evaluationCase.requestFingerprint,
      status: validation?.success ? "complete" : "invalid-output",
      output: validation?.data ?? null,
      debugOutput: adapterResult.debugOutput ?? null,
      validationErrors,
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
      debugOutput: null,
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
