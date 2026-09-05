import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
  CopilotAnalysisScope,
} from "../utils/copilotAnalysis";
import {
  copilotModelOutputJsonSchema,
  validateCopilotModelOutput,
} from "../utils/copilotModelContract";

type ChromeLanguageModelAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

type ChromeLanguageModelMonitor = {
  addEventListener: (
    type: "downloadprogress",
    listener: (event: { loaded: number }) => void,
  ) => void;
};

type ChromeLanguageModelSession = {
  readonly contextUsage: number;
  readonly contextWindow: number;
  clone: (options?: { signal?: AbortSignal }) => Promise<ChromeLanguageModelSession>;
  destroy: () => void;
  prompt: (
    input: string,
    options?: {
      signal?: AbortSignal;
      responseConstraint?: object;
    },
  ) => Promise<string>;
};

type ChromeLanguageModelFactory = {
  availability: (options: ChromeLanguageModelOptions) => Promise<string>;
  create: (
    options: ChromeLanguageModelOptions & {
      initialPrompts: Array<{ role: "system"; content: string }>;
      monitor?: (monitor: ChromeLanguageModelMonitor) => void;
      signal?: AbortSignal;
    },
  ) => Promise<ChromeLanguageModelSession>;
};

type ChromeLanguageModelOptions = {
  expectedInputs: Array<{ type: "text"; languages: ["en"] }>;
  expectedOutputs: Array<{ type: "text"; languages: ["en"] }>;
};

export type ChromeLocalAiAvailability =
  | ChromeLanguageModelAvailability
  | "unsupported-browser"
  | "unsupported-language";

export type ChromeLocalAiErrorCode =
  | "BUSY"
  | "CONTEXT_TOO_LARGE"
  | "INVALID_RESPONSE"
  | "MODEL_UNAVAILABLE"
  | "UNSUPPORTED_BROWSER"
  | "UNSUPPORTED_LANGUAGE";

export class ChromeLocalAiError extends Error {
  constructor(
    message: string,
    readonly code: ChromeLocalAiErrorCode,
  ) {
    super(message);
    this.name = "ChromeLocalAiError";
  }
}

type PrepareChromeLocalAiOptions = {
  onDownloadProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

const chromeLanguageOptions: ChromeLanguageModelOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const baseSessions = new Map<
  CopilotAnalysisScope,
  Promise<ChromeLanguageModelSession>
>();
let activeAnalysis = false;

const localCoreInstructions = `You are PokePilot, a concise strategic assistant for Pokemon Champions Regulation M-B.

Use only facts in the supplied request. Never invent or substitute moves, items, abilities, typings, stats, legality, usage, damage, or user intent. Use exact supplied display names in prose. A resistance is not an immunity. Final stats are deterministic. Treat battle format as binding.

Champions uses 32 Stat Points per stat, 66 total Stat Points, Item Clause, and at most one activated Mega Evolution per battle. Multiple distinct Mega Stones on a six-Pokemon roster are legal and can represent matchup-dependent branches; do not call that an inherent flaw.

Return only a JSON object matching the supplied response schema. Keep the summary to two short sentences, strengths and weaknesses to one through three concise entries each, and recommendations to at most three. Recommendation ids must be short ASCII strings. Be explicit about uncertainty when the supplied facts do not establish an interaction.`;

const localScopeInstructions: Record<CopilotAnalysisScope, string> = {
  team: `Analyze the complete roster and infer one practical game plan. For Doubles, test actual two-Pokemon active pairs, move order, ally targeting, shared moves, setup, and legal lead/backline roles before describing an interaction. For Singles, account for three-of-six selection, switching, hazards, priority, and alternate win conditions. Distinguish a central plan, matchup branches, and an endgame without forcing an archetype from one move or one fast or slow Pokemon.`,
  pokemon: `Analyze only the set at selectedSlot, then judge how its exact set fits the supplied team. Separate set coherence from team fit. Use its selected moves, ability, item, nature, final stats, defensive profile, and Mega projection. Do not turn this into a broad team report.`,
  recommendation: `Choose only from recommendationCandidates and copy each chosen pokemonId exactly into that recommendation's id. Rank strategic fit above usage. Each reason must name a concrete candidate element or fit and one real tradeoff. Avoid redundant responsibilities, unsupported speed-mode assumptions, added shared weaknesses, and unnecessary Mega conflicts.`,
};

function getLanguageModelFactory() {
  return (
    globalThis as typeof globalThis & {
      LanguageModel?: ChromeLanguageModelFactory;
    }
  ).LanguageModel;
}

function normalizeAvailability(value: string): ChromeLanguageModelAvailability {
  switch (value) {
    case "available":
    case "readily":
      return "available";
    case "downloadable":
    case "after-download":
      return "downloadable";
    case "downloading":
      return "downloading";
    default:
      return "unavailable";
  }
}

function getTypeDisplayName(
  request: CopilotAnalysisRequest,
  typeId: string,
) {
  return (
    request.typeLabels.find((entry) => entry.id === typeId)?.displayName ??
    typeId
  );
}

function mapTypeRecord(
  request: CopilotAnalysisRequest,
  record: Partial<Record<string, string[]>>,
) {
  return Object.fromEntries(
    Object.entries(record).map(([type, owners]) => [
      getTypeDisplayName(request, type),
      owners,
    ]),
  );
}

export function createChromeLocalPromptPayload(
  request: CopilotAnalysisRequest,
) {
  const recommendations = request.recommendationCandidates.map((candidate) => ({
    pokemonId: candidate.pokemonId,
    name: candidate.displayName,
    types: candidate.typeDisplayNames,
    abilities: candidate.abilities.map(({ id, displayName, effect }) => ({
      id,
      name: displayName,
      ...(effect ? { effect } : {}),
    })),
    baseStats: candidate.baseStats,
    speedTier: candidate.speedTier,
    requiresMegaStone: candidate.requiresMegaStone,
    usageRank: candidate.usageRank,
    commonSet: candidate.commonSet,
    responsibilities: candidate.responsibilityIds,
    fit: {
      weakTo: candidate.fit.weakTo.map((type) =>
        getTypeDisplayName(request, type),
      ),
      resistsTeamThreats: candidate.fit.resistsTeamThreats.map((type) =>
        getTypeDisplayName(request, type),
      ),
      amplifiesTeamThreats: candidate.fit.amplifiesTeamThreats.map((type) =>
        getTypeDisplayName(request, type),
      ),
      addsUnansweredWeaknesses: candidate.fit.addsUnansweredWeaknesses.map(
        (type) => getTypeDisplayName(request, type),
      ),
      coversTypes: candidate.fit.coversTypes.map((type) =>
        getTypeDisplayName(request, type),
      ),
      roleContributions: candidate.fit.roleContributions,
      roleRedundancies: candidate.fit.roleRedundancies,
      conceptSynergies: candidate.fit.conceptSynergies,
      conflicts: candidate.fit.conflicts,
    },
  }));

  return {
    scope: request.scope,
    battleFormat: request.battleFormat,
    teamName: request.teamName,
    selectedSlot: request.selectedSlot,
    sets: request.sets.map((set) => ({
      slotIndex: set.slotIndex,
      pokemonId: set.pokemonId,
      name: set.displayName,
      isMegaForm: set.isMegaForm,
      types: set.typeDisplayNames,
      item: set.itemDisplayName,
      ability: set.abilityDisplayName,
      nature: set.natureDisplayName,
      baseStats: set.baseStats,
      finalStats: set.stats,
      statPoints: set.evs,
      moves: set.moves.map((move) => ({
        id: move.id,
        name: move.displayName,
        type: getTypeDisplayName(request, move.type),
        category: move.category,
        power: move.power,
        spreadTarget: move.spreadTarget,
      })),
      defensiveProfile: set.defensiveProfile,
      megaEvolution: set.megaEvolution
        ? {
            pokemonId: set.megaEvolution.pokemonId,
            name: set.megaEvolution.displayName,
            types: set.megaEvolution.typeDisplayNames,
            ability: set.megaEvolution.abilityDisplayName,
            defensiveProfile: set.megaEvolution.defensiveProfile,
          }
        : null,
      roles: set.roleIds,
      setsUp: set.setterConceptIds,
      benefitsFrom: set.aceConceptIds,
      validity: {
        status: set.validityStatus,
        issues: set.validityIssues.map((issue) => issue.message),
      },
    })),
    megaOptions: request.megaOptions.map((option) => ({
      slotIndex: option.slotIndex,
      pokemonId: option.pokemonId,
      name: option.displayName,
      types: option.typeDisplayNames,
      ability: option.abilityDisplayName,
    })),
    candidateFilters: request.candidateFilters,
    recommendationCandidates: recommendations,
    mechanics: request.mechanics,
    diagnostics: {
      coverageGaps: request.diagnostics.coverageGaps.map((type) =>
        getTypeDisplayName(request, type),
      ),
      alerts: request.diagnostics.alerts,
      roleCounts: request.diagnostics.roleCounts,
      responsibilityCounts: request.diagnostics.responsibilityCounts,
      moveSources: request.diagnostics.moveSources,
      defensiveProfile: {
        weakTo: mapTypeRecord(
          request,
          request.diagnostics.defensiveProfile.weakTo,
        ),
        resists: mapTypeRecord(
          request,
          request.diagnostics.defensiveProfile.resists,
        ),
        immuneTo: mapTypeRecord(
          request,
          request.diagnostics.defensiveProfile.immuneTo,
        ),
      },
      offensiveProfile: request.diagnostics.offensiveProfile,
      concepts: request.diagnostics.concepts,
      validity: request.diagnostics.validity,
    },
  };
}

function createResponseSchema(request: CopilotAnalysisRequest) {
  const schema = JSON.parse(
    JSON.stringify(copilotModelOutputJsonSchema),
  ) as {
    properties: {
      scope: Record<string, unknown>;
      strengths: { maxItems?: number };
      weaknesses: { maxItems?: number };
      recommendations: {
        minItems?: number;
        items: { properties: { id: Record<string, unknown> } };
      };
    };
  };

  schema.properties.scope = { type: "string", const: request.scope };
  schema.properties.strengths.maxItems = 3;
  schema.properties.weaknesses.maxItems = 3;

  if (request.scope === "recommendation") {
    const candidateIds = request.recommendationCandidates.map(
      (candidate) => candidate.pokemonId,
    );
    schema.properties.recommendations.minItems = Math.min(3, candidateIds.length);
    schema.properties.recommendations.items.properties.id = {
      type: "string",
      enum: candidateIds,
    };
  }

  return schema;
}

function validateLocalResponse(
  value: unknown,
  request: CopilotAnalysisRequest,
) {
  const validation = validateCopilotModelOutput(value);

  if (!validation.success || validation.data.scope !== request.scope) {
    return null;
  }

  if (request.scope === "recommendation") {
    const candidateIds = new Set(
      request.recommendationCandidates.map((candidate) => candidate.pokemonId),
    );
    const recommendationIds = validation.data.recommendations.map(
      (recommendation) => recommendation.id,
    );
    const expectedCount = Math.min(3, candidateIds.size);

    if (
      recommendationIds.length !== expectedCount ||
      new Set(recommendationIds).size !== recommendationIds.length ||
      recommendationIds.some((id) => !candidateIds.has(id))
    ) {
      return null;
    }
  }

  return validation.data;
}

function createInitialPrompt(scope: CopilotAnalysisScope) {
  return `${localCoreInstructions}\n\n${localScopeInstructions[scope]}\n\nAll user-facing fields must be concise, natural English. Preserve supplied names exactly.`;
}

function createRequestPrompt(request: CopilotAnalysisRequest, attempt: number) {
  const retryInstruction =
    attempt > 0
      ? "The previous result was invalid. Follow the JSON schema and supplied facts exactly.\n\n"
      : "";

  return `${retryInstruction}Analyze this request and return exactly one concise JSON object with these fields: version, scope, title, summary, playstyle, strengths, weaknesses, recommendations. Set version to 1 and scope to "${request.scope}". Each recommendation must contain id, title, reason, and priority. Do not include Markdown or commentary.\n\n${JSON.stringify(createChromeLocalPromptPayload(request))}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isContextError(error: unknown) {
  return error instanceof DOMException && error.name === "QuotaExceededError";
}

export async function getChromeLocalAiAvailability(
  locale: CopilotAnalysisRequest["locale"],
): Promise<ChromeLocalAiAvailability> {
  if (locale !== "en") {
    return "unsupported-language";
  }

  const factory = getLanguageModelFactory();
  if (!factory) {
    return "unsupported-browser";
  }

  try {
    return normalizeAvailability(
      await factory.availability(chromeLanguageOptions),
    );
  } catch {
    return "unavailable";
  }
}

export function prepareChromeLocalCopilot(
  scope: CopilotAnalysisScope,
  { onDownloadProgress, signal }: PrepareChromeLocalAiOptions = {},
) {
  const existing = baseSessions.get(scope);
  if (existing) {
    return existing;
  }

  const factory = getLanguageModelFactory();
  if (!factory) {
    return Promise.reject(
      new ChromeLocalAiError(
        "Chrome on-device AI is not available in this browser.",
        "UNSUPPORTED_BROWSER",
      ),
    );
  }

  const sessionPromise = factory.create({
    ...chromeLanguageOptions,
    initialPrompts: [{ role: "system", content: createInitialPrompt(scope) }],
    ...(signal ? { signal } : {}),
    ...(onDownloadProgress
      ? {
          monitor(monitor: ChromeLanguageModelMonitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              onDownloadProgress(Math.max(0, Math.min(1, event.loaded)));
            });
          },
        }
      : {}),
  });

  baseSessions.set(scope, sessionPromise);
  void sessionPromise.catch(() => {
    if (baseSessions.get(scope) === sessionPromise) {
      baseSessions.delete(scope);
    }
  });

  return sessionPromise;
}

export async function requestChromeLocalCopilotAnalysis(
  request: CopilotAnalysisRequest,
  signal?: AbortSignal,
): Promise<CopilotAnalysisResponse> {
  if (request.locale !== "en") {
    throw new ChromeLocalAiError(
      "Chrome on-device analysis currently supports English output only.",
      "UNSUPPORTED_LANGUAGE",
    );
  }
  if (activeAnalysis) {
    throw new ChromeLocalAiError(
      "Another on-device analysis is already running.",
      "BUSY",
    );
  }

  activeAnalysis = true;
  try {
    const baseSession = await prepareChromeLocalCopilot(request.scope, {
      signal,
    });
    const responseSchema = createResponseSchema(request);
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let session: ChromeLanguageModelSession | undefined;

      try {
        session = await baseSession.clone(signal ? { signal } : undefined);
        const prompt = createRequestPrompt(request, attempt);
        const outputText = await session.prompt(
          prompt,
          {
            ...(signal ? { signal } : {}),
            responseConstraint: responseSchema,
          },
        );
        const output = JSON.parse(outputText) as unknown;
        const validated = validateLocalResponse(output, request);

        if (validated) {
          return { ...validated, source: "device" };
        }
        lastError = new ChromeLocalAiError(
          "Chrome on-device AI returned invalid product data.",
          "INVALID_RESPONSE",
        );
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        if (isContextError(error)) {
          throw new ChromeLocalAiError(
            "This analysis is too large for the on-device model's context window.",
            "CONTEXT_TOO_LARGE",
          );
        }
        lastError = error;
      } finally {
        session?.destroy();
      }
    }

    if (lastError instanceof ChromeLocalAiError) {
      throw lastError;
    }
    throw new ChromeLocalAiError(
      "Chrome on-device analysis failed after automatic retries.",
      "MODEL_UNAVAILABLE",
    );
  } finally {
    activeAnalysis = false;
  }
}

export async function destroyChromeLocalAiSessions() {
  const sessions = [...baseSessions.values()];
  baseSessions.clear();
  const settled = await Promise.allSettled(sessions);

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      result.value.destroy();
    }
  });
}
