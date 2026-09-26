import type { CopilotModelOutput } from "../src/utils/copilotModelTypes.js";
import type {
  CopilotAnalysisScope,
  CopilotQualityWarningCode,
} from "../src/utils/copilotContracts.js";
import { getCopilotAnalysisCacheFingerprint } from "../src/utils/copilotRequestFingerprint.js";
import { validateCopilotAnalysisRequest } from "../src/utils/copilotRequestContract.js";
import {
  analyzeWithOpenAiLuna,
  LunaStructuredOutputError,
  OPENAI_LUNA_MODEL_ID,
  POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
  POKEPILOT_AI_PROMPT_VERSION,
  type LunaAnalysisResult,
  type LunaReasoningEffort,
  type LunaUsage,
  type PokePilotEvaluationModel,
} from "./openAiLuna.js";
import {
  createPokePilotAnalysisCacheKey,
  getPokePilotSafeguardConfig,
  POKEPILOT_MAX_SHARED_WAITERS,
  POKEPILOT_MAX_TOTAL_SHARED_WAITERS,
  POKEPILOT_SHARED_WAITER_TIMEOUT_MS,
  PokePilotCapacityError,
  type PokePilotOperations,
  type PokePilotRequester,
  type PokePilotSafeguardMode,
} from "./pokepilotOperations.js";
import {
  reviewHostedCopilotAnalysis,
  type ReviewedHostedCopilotAnalysis,
} from "./pokepilotAnalysisValidation.js";

export const POKEPILOT_API_MAX_BODY_BYTES = 256_000;
export type PokePilotHostedModel = Extract<PokePilotEvaluationModel, "gpt-6-luna" | "gpt-6-sol">;

export type PokePilotApiErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_REQUEST"
  | "AI_NOT_CONFIGURED"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_RESPONSE"
  | "AI_UPSTREAM_ERROR"
  | "PERSONAL_KEY_INVALID"
  | "PERSONAL_KEY_REQUIRED";

export type PokePilotApiResponse =
  | {
      ok: true;
      analysis: CopilotModelOutput;
      metadata: {
        cacheStatus: "hit" | "miss" | "shared";
        model: PokePilotHostedModel;
        promptVersion: number;
      };
    }
  | {
      ok: false;
      error: {
        code: PokePilotApiErrorCode;
        message: string;
        retryAfterSeconds?: number;
        providerAttempted?: false;
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
  reasoningEffort?: Extract<LunaReasoningEffort, "low" | "medium">;
  modelId?: PokePilotHostedModel;
  billingSource?: "site" | "personal";
  billingIdentity?: string;
  clock?: () => number;
  onUpstreamError?: (error: unknown) => void;
  onQualityWarning?: (warnings: CopilotQualityWarningCode[]) => void;
  onOperationalEvent?: (event: PokePilotOperationalEvent) => void;
  operations?: PokePilotOperations;
  requester?: PokePilotRequester;
  safeguardMode?: PokePilotSafeguardMode;
};

export type PokePilotOperationalEvent =
  | {
      type: "analysis";
      billingSource?: "site" | "personal";
      reasoningEffort?: "low" | "medium";
      modelId?: PokePilotHostedModel;
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
      type: "analysis-failure";
      billingSource: "site" | "personal";
      reasoningEffort: "low" | "medium";
      modelId?: PokePilotHostedModel;
      requestKey: string;
      safeguardMode: PokePilotSafeguardMode;
      scope: CopilotAnalysisScope;
      usage: LunaUsage;
    };

type HostedAnalysisExecution =
  | {
      kind: "completed";
      analysis: CopilotModelOutput;
      qualityWarnings: CopilotQualityWarningCode[];
      result: LunaAnalysisResult;
    };

function errorResult(
  status: number,
  code: PokePilotApiErrorCode,
  message: string,
  retryAfterSeconds?: number,
  providerAttempted?: false,
): PokePilotApiResult {
  return {
    status,
    body: {
      ok: false,
      error: {
        code,
        message,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        ...(providerAttempted === undefined ? {} : { providerAttempted }),
      },
    },
  };
}

function successResult(
  analysis: CopilotModelOutput,
  cacheStatus: "hit" | "miss" | "shared",
  modelId: PokePilotHostedModel,
): PokePilotApiResult {
  return {
    status: 200,
    body: {
      ok: true,
      analysis,
      metadata: {
        cacheStatus,
        model: modelId,
        promptVersion: POKEPILOT_AI_PROMPT_VERSION,
      },
    },
  };
}

function addQualityWarning(
  reviewed: ReviewedHostedCopilotAnalysis,
  warning: CopilotQualityWarningCode,
): ReviewedHostedCopilotAnalysis {
  return reviewed.qualityWarnings.includes(warning)
    ? reviewed
    : {
        ...reviewed,
        qualityWarnings: [...reviewed.qualityWarnings, warning],
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
  if (error instanceof LunaStructuredOutputError) return true;
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
    reasoningEffort = POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
    modelId = OPENAI_LUNA_MODEL_ID,
    billingSource = "site",
    billingIdentity,
    clock = Date.now,
    onOperationalEvent,
    onUpstreamError,
    onQualityWarning,
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
      undefined,
      false,
    );
  }

  if (modelId === "gpt-6-sol" && (billingSource !== "personal" || reasoningEffort !== "low")) {
    return errorResult(403, "PERSONAL_KEY_REQUIRED", "Sol low requires a personal API key.", undefined, false);
  }

  if (!analyze && !apiKey) {
    return errorResult(
      503,
      "AI_NOT_CONFIGURED",
      "Hosted analysis is not configured.",
      undefined,
      false,
    );
  }

  const requestKey = createPokePilotAnalysisCacheKey(
    {
      cacheVersion: 3,
      fingerprint: getCopilotAnalysisCacheFingerprint(requestValidation.data),
      locale: requestValidation.data.locale,
    },
    modelId,
    POKEPILOT_AI_PROMPT_VERSION,
    reasoningEffort,
  );
  const publicRequestKey = requestKey.slice(0, 12);
  const operationsKey = `${safeguardMode}:${billingIdentity ?? "site"}:${requestKey}`;
  const safeguardConfig = getPokePilotSafeguardConfig(safeguardMode);
  const startedAt = clock();
  let attemptedUsage: LunaUsage | undefined;

  try {
    if (
      operations &&
      requester &&
      safeguardConfig.requestRateLimitEnabled
    ) {
      const admission = await operations.admitRequest(requester, startedAt);
      if (!admission.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(admission.retryAfterMs / 1_000),
        );
        return errorResult(
          429,
          "AI_RATE_LIMITED",
          "Request rate limit is active.",
          retryAfterSeconds,
          false,
        );
      }
    }

    const cachedAnalysis = safeguardConfig.cacheEnabled
      ? await operations?.getCached<ReviewedHostedCopilotAnalysis>(
          operationsKey,
          startedAt,
        )
      : null;

    if (cachedAnalysis) {
      onOperationalEvent?.({
        type: "analysis",
        billingSource,
        modelId,
        reasoningEffort: reasoningEffort === "medium" ? "medium" : "low",
        cacheStatus: "hit",
        durationMs: Math.max(0, clock() - startedAt),
        requestKey: publicRequestKey,
        safeguardMode,
        scope: requestValidation.data.scope,
      });
      return successResult(cachedAnalysis.analysis, "hit", modelId);
    }

    const runAnalysis = async (): Promise<HostedAnalysisExecution> => {
      const result = analyze
        ? await analyze(requestValidation.data)
        : await analyzeWithOpenAiLuna(requestValidation.data, {
            apiKey, modelId, cacheNamespace: "production", reasoningEffort,
            safetyIdentifier: requester?.clientId,
          });
      attemptedUsage = result.usage;
      let reviewed = reviewHostedCopilotAnalysis(result.output, requestValidation.data);
      if (safeguardConfig.cacheEnabled) {
        try {
          await operations?.setCached(operationsKey, reviewed, clock());
        } catch (error) {
          onUpstreamError?.(error);
          reviewed = addQualityWarning(reviewed, "service-degraded");
        }
      }
      if (reviewed.qualityWarnings.length) {
        try {
          onQualityWarning?.(reviewed.qualityWarnings);
        } catch {
          // Diagnostic logging must not turn a completed analysis into an error.
        }
      }
      return { kind: "completed", analysis: reviewed.analysis, qualityWarnings: reviewed.qualityWarnings, result };
    };
    const execution = operations
      ? await operations.runOnce(operationsKey, runAnalysis, {
          distributed: safeguardConfig.cacheEnabled,
          maxTotalWaiters: POKEPILOT_MAX_TOTAL_SHARED_WAITERS,
          maxWaiters: POKEPILOT_MAX_SHARED_WAITERS,
          shouldShare: (value) => value.kind === "completed",
          waitTimeoutMs: POKEPILOT_SHARED_WAITER_TIMEOUT_MS,
        })
      : { shared: false, value: await runAnalysis() };

    const completed = execution.value;

    if (execution.shared) {
      onOperationalEvent?.({
        type: "analysis",
        billingSource,
        modelId,
        reasoningEffort: reasoningEffort === "medium" ? "medium" : "low",
        cacheStatus: "shared",
        durationMs: Math.max(0, clock() - startedAt),
        requestKey: publicRequestKey,
        safeguardMode,
        scope: requestValidation.data.scope,
      });
      return successResult(completed.analysis, "shared", modelId);
    }

    onOperationalEvent?.({
      type: "analysis",
      billingSource,
      modelId,
      reasoningEffort: reasoningEffort === "medium" ? "medium" : "low",
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
    return successResult(
      completed.analysis,
      "miss",
      modelId,
    );
  } catch (error) {
    const usage = error instanceof LunaStructuredOutputError
      ? error.usage
      : attemptedUsage;
    if (usage) {
      onOperationalEvent?.({
        type: "analysis-failure",
        billingSource,
        modelId,
        reasoningEffort: reasoningEffort === "medium" ? "medium" : "low",
        requestKey: publicRequestKey,
        safeguardMode,
        scope: requestValidation.data.scope,
        usage,
      });
    }
    if (error instanceof PokePilotCapacityError) {
      return errorResult(
        429,
        "AI_RATE_LIMITED",
        "Too many identical analyses are already in progress.",
        5,
      );
    }

    if (billingSource === "site") onUpstreamError?.(error);

    if (isInvalidResponseError(error)) {
      return errorResult(
        502,
        "AI_INVALID_RESPONSE",
        "Hosted analysis returned an invalid response.",
      );
    }

    if (billingSource === "personal" && (getUpstreamStatus(error) === 401 || getUpstreamStatus(error) === 403)) {
      return errorResult(401, "PERSONAL_KEY_INVALID", "Check your personal OpenAI API key and project permissions.");
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
