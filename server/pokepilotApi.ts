import type { CopilotModelOutput } from "../src/utils/copilotModelContract";
import { validateCopilotGroundedModelOutput } from "../src/utils/copilotModelContract";
import { getCopilotRequestFingerprint } from "../src/utils/copilotAnalysis";
import type { CopilotAnalysisScope } from "../src/utils/copilotAnalysis";
import { validateCopilotAnalysisRequest } from "../src/utils/copilotRequestContract";
import {
  completeCopilotStrategyAudit,
  validateCopilotStrategyAuditForRequest,
} from "../src/utils/copilotStrategyAudit";
import {
  analyzeWithOpenAiLuna,
  OPENAI_LUNA_MODEL_ID,
  POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
  POKEPILOT_AI_PROMPT_VERSION,
  type LunaAnalysisResult,
} from "./openAiLuna";
import {
  createPokePilotAnalysisCacheKey,
  getPokePilotSafeguardConfig,
  type PokePilotOperations,
  type PokePilotRateLimitReservation,
  type PokePilotRequester,
  type PokePilotSafeguardMode,
} from "./pokepilotOperations";

export const POKEPILOT_API_MAX_BODY_BYTES = 256_000;

export type PokePilotApiErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_REQUEST"
  | "AI_NOT_CONFIGURED"
  | "ANALYSIS_COOLDOWN"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_RESPONSE"
  | "AI_UPSTREAM_ERROR";

export type PokePilotApiResponse =
  | {
      ok: true;
      analysis: CopilotModelOutput;
      metadata: {
        cacheStatus: "hit" | "miss" | "shared";
        model: typeof OPENAI_LUNA_MODEL_ID;
        promptVersion: number;
      };
    }
  | {
      ok: false;
      error: {
        code: PokePilotApiErrorCode;
        message: string;
        retryAfterSeconds?: number;
      };
    };

export type PokePilotApiResult = {
  status: number;
  body: PokePilotApiResponse;
};

type AnalyzeRequest = (
  request: Parameters<typeof analyzeWithOpenAiLuna>[0],
) => Promise<LunaAnalysisResult>;

type HandlePokePilotAnalysisOptions = {
  analyze?: AnalyzeRequest;
  apiKey?: string;
  clock?: () => number;
  onUpstreamError?: (error: unknown) => void;
  onOperationalEvent?: (event: PokePilotOperationalEvent) => void;
  operations?: PokePilotOperations;
  requester?: PokePilotRequester;
  safeguardMode?: PokePilotSafeguardMode;
};

export type PokePilotOperationalEvent =
  | {
      type: "analysis";
      cacheStatus: "hit" | "miss" | "shared";
      cachedInputTokens?: number;
      cacheWriteTokens?: number;
      costUsd?: number;
      durationMs: number;
      inputTokens?: number;
      outputTokens?: number;
      requestKey: string;
      safeguardMode: PokePilotSafeguardMode;
      scope: CopilotAnalysisScope;
      totalTokens?: number;
    }
  | {
      type: "cooldown";
      requestKey: string;
      retryAfterSeconds: number;
      safeguardMode: PokePilotSafeguardMode;
      scope: CopilotAnalysisScope;
      limiter: "client" | "ip";
    };

type HostedAnalysisExecution =
  | {
      kind: "completed";
      analysis: CopilotModelOutput;
      result: LunaAnalysisResult;
    }
  | {
      kind: "cooldown";
      decision: Extract<
        Awaited<ReturnType<NonNullable<PokePilotOperations["reserve"]>>>,
        { allowed: false }
      >;
    };

function errorResult(
  status: number,
  code: PokePilotApiErrorCode,
  message: string,
  retryAfterSeconds?: number,
): PokePilotApiResult {
  return {
    status,
    body: {
      ok: false,
      error: {
        code,
        message,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      },
    },
  };
}

function successResult(
  analysis: CopilotModelOutput,
  cacheStatus: "hit" | "miss" | "shared",
): PokePilotApiResult {
  return {
    status: 200,
    body: {
      ok: true,
      analysis,
      metadata: {
        cacheStatus,
        model: OPENAI_LUNA_MODEL_ID,
        promptVersion: POKEPILOT_AI_PROMPT_VERSION,
      },
    },
  };
}

function getUpstreamStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

function isInvalidResponseError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "AI_INVALID_RESPONSE"
  );
}

export async function handlePokePilotAnalysis(
  value: unknown,
  {
    analyze,
    apiKey,
    clock = Date.now,
    onOperationalEvent,
    onUpstreamError,
    operations,
    requester,
    safeguardMode = "enforced",
  }: HandlePokePilotAnalysisOptions = {},
): Promise<PokePilotApiResult> {
  const requestValidation = validateCopilotAnalysisRequest(value);
  if (!requestValidation.success) {
    return errorResult(
      400,
      "INVALID_REQUEST",
      requestValidation.errors.join(" "),
    );
  }

  if (!analyze && !apiKey) {
    return errorResult(
      503,
      "AI_NOT_CONFIGURED",
      "Hosted analysis is not configured.",
    );
  }

  const requestKey = createPokePilotAnalysisCacheKey(
    {
      fingerprint: getCopilotRequestFingerprint(requestValidation.data),
      locale: requestValidation.data.locale,
    },
    OPENAI_LUNA_MODEL_ID,
    POKEPILOT_AI_PROMPT_VERSION,
    POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
  );
  const publicRequestKey = requestKey.slice(0, 12);
  const operationsKey = `${safeguardMode}:${requestKey}`;
  const safeguardConfig = getPokePilotSafeguardConfig(safeguardMode);
  const startedAt = clock();

  try {
    const cachedAnalysis = safeguardConfig.cacheEnabled
      ? await operations?.getCached<CopilotModelOutput>(
          operationsKey,
          startedAt,
        )
      : null;

    if (cachedAnalysis) {
      onOperationalEvent?.({
        type: "analysis",
        cacheStatus: "hit",
        durationMs: Math.max(0, clock() - startedAt),
        requestKey: publicRequestKey,
        safeguardMode,
        scope: requestValidation.data.scope,
      });
      return successResult(cachedAnalysis, "hit");
    }

    const runAnalysis = async (): Promise<HostedAnalysisExecution> => {
      let reservation: PokePilotRateLimitReservation | undefined;

      try {
        if (operations && requester && safeguardConfig.rateLimitMode) {
          const decision = await operations.reserve(
            requester,
            clock(),
            safeguardConfig.rateLimitMode,
          );
          if (!decision.allowed) {
            return { kind: "cooldown", decision };
          }
          reservation = decision.reservation;
        }

        const result = analyze
          ? await analyze(requestValidation.data)
          : await analyzeWithOpenAiLuna(requestValidation.data, {
              apiKey,
              cacheNamespace: "production",
              reasoningEffort: POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
            });
        const outputValidation = validateCopilotGroundedModelOutput(
          result.output,
        );

        if (
          !outputValidation.success ||
          outputValidation.data.analysis.scope !== requestValidation.data.scope
        ) {
          throw Object.assign(
            new Error("Hosted analysis returned an invalid response."),
            { code: "AI_INVALID_RESPONSE" },
          );
        }

        const groundedOutput = completeCopilotStrategyAudit(
          outputValidation.data,
          requestValidation.data,
        );

        if (requestValidation.data.scope === "recommendation") {
          const candidateIds = new Set(
            requestValidation.data.recommendationCandidates.map(
              (candidate) => candidate.pokemonId,
            ),
          );
          const recommendationIds =
            groundedOutput.analysis.recommendations.map(
              (recommendation) => recommendation.id,
            );
          const expectedMinimum = Math.min(3, candidateIds.size);

          if (
            recommendationIds.length < expectedMinimum ||
            recommendationIds.length > 3 ||
            new Set(recommendationIds).size !== recommendationIds.length ||
            recommendationIds.some((id) => !candidateIds.has(id))
          ) {
            throw Object.assign(
              new Error("Hosted recommendation returned an invalid candidate list."),
              { code: "AI_INVALID_RESPONSE" },
            );
          }
        }

        const strategyAuditErrors = validateCopilotStrategyAuditForRequest(
          groundedOutput,
          requestValidation.data,
        );

        if (strategyAuditErrors.length > 0) {
          throw Object.assign(
            new Error("Hosted analysis returned an invalid response."),
            { code: "AI_INVALID_RESPONSE" },
          );
        }

        const completed = {
          kind: "completed" as const,
          analysis: groundedOutput.analysis,
          result,
        };
        if (safeguardConfig.cacheEnabled) {
          await operations?.setCached(
            operationsKey,
            completed.analysis,
            clock(),
          );
        }
        if (reservation && operations) {
          await operations.completeReservation(reservation, clock());
          reservation = undefined;
        }
        return completed;
      } catch (error) {
        if (reservation && operations) {
          try {
            await operations.cancelReservation(reservation);
          } catch (cleanupError) {
            onUpstreamError?.(cleanupError);
          }
        }

        throw error;
      }
    };
    const execution = operations
      ? await operations.runOnce(operationsKey, runAnalysis, {
          distributed: safeguardConfig.cacheEnabled,
          shouldShare: (value) => value.kind === "completed",
        })
      : { shared: false, value: await runAnalysis() };

    if (execution.value.kind === "cooldown") {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(execution.value.decision.retryAfterMs / 1_000),
      );
      onOperationalEvent?.({
        type: "cooldown",
        limiter: execution.value.decision.scope,
        requestKey: publicRequestKey,
        retryAfterSeconds,
        safeguardMode,
        scope: requestValidation.data.scope,
      });
      return errorResult(
        429,
        "ANALYSIS_COOLDOWN",
        "Analysis cooldown is active.",
        retryAfterSeconds,
      );
    }

    const completed = execution.value;

    if (execution.shared) {
      onOperationalEvent?.({
        type: "analysis",
        cacheStatus: "shared",
        durationMs: Math.max(0, clock() - startedAt),
        requestKey: publicRequestKey,
        safeguardMode,
        scope: requestValidation.data.scope,
      });
      return successResult(completed.analysis, "shared");
    }

    onOperationalEvent?.({
      type: "analysis",
      cacheStatus: "miss",
      cachedInputTokens: completed.result.usage.cachedInputTokens,
      cacheWriteTokens: completed.result.usage.cacheWriteTokens,
      costUsd: completed.result.usage.costUsd,
      durationMs: Math.max(0, clock() - startedAt),
      inputTokens: completed.result.usage.inputTokens,
      outputTokens: completed.result.usage.outputTokens,
      requestKey: publicRequestKey,
      safeguardMode,
      scope: requestValidation.data.scope,
      totalTokens: completed.result.usage.totalTokens,
    });
    return successResult(completed.analysis, "miss");
  } catch (error) {
    onUpstreamError?.(error);

    if (isInvalidResponseError(error)) {
      return errorResult(
        502,
        "AI_INVALID_RESPONSE",
        "Hosted analysis returned an invalid response.",
      );
    }

    if (getUpstreamStatus(error) === 429) {
      return errorResult(
        429,
        "AI_RATE_LIMITED",
        "Hosted analysis is temporarily rate limited.",
      );
    }

    return errorResult(
      502,
      "AI_UPSTREAM_ERROR",
      "Hosted analysis is temporarily unavailable.",
    );
  }
}
