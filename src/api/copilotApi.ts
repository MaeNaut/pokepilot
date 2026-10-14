import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
  CopilotExecutionInfo,
  CopilotQualityWarningCode,
} from "../utils/copilotContracts";
import { isCopilotQualityWarningCode, normalizeCopilotExecutionInfo } from "../utils/copilotContracts";
import { validateCopilotModelOutput } from "../utils/copilotModelValidation";
import { requestAccountRefresh } from "./accountSessionBoundary";

type HostedAnalysisEnvelope = {
  ok?: unknown;
  analysis?: unknown;
  metadata?: {
    qualityWarnings?: unknown;
    execution?: unknown;
  };
  error?: {
    code?: unknown;
    message?: unknown;
    retryAfterSeconds?: unknown;
    providerAttempted?: unknown;
  };
};

export type HostedCopilotAnalysisResult = {
  analysis: CopilotAnalysisResponse;
  qualityWarnings?: CopilotQualityWarningCode[];
  execution?: CopilotExecutionInfo;
};

export class CopilotApiError extends Error {
  readonly code: string;
  readonly retryAfterSeconds?: number;
  readonly status: number;
  readonly providerAttempted?: false;

  constructor(
    message: string,
    code: string,
    status: number,
    retryAfterSeconds?: number,
    providerAttempted?: false,
  ) {
    super(message);
    this.name = "CopilotApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.providerAttempted = providerAttempted;
  }
}

async function readEnvelope(response: Response) {
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid analysis envelope.");
    return value as HostedAnalysisEnvelope;
  } catch {
    throw new CopilotApiError(
      "Hosted analysis returned an unreadable response.",
      "INVALID_RESPONSE",
      response.status,
    );
  }
}

async function fetchHostedCopilotAnalysis(
  request: CopilotAnalysisRequest,
  signal?: AbortSignal,
  reasoningEffort: "low" | "medium" = "low",
  modelId: "gpt-6-luna" | "gpt-6-sol" = "gpt-6-luna",
  accountId?: string,
): Promise<HostedCopilotAnalysisResult> {
  let response: Response;

  try {
    response = await fetch("/api/pokepilot/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PokePilot-Reasoning-Effort": reasoningEffort,
        "X-PokePilot-Model": modelId,
        ...(accountId ? { "X-PokePilot-Account-Id": accountId } : {}),
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    throw new CopilotApiError(
      "Unable to reach the hosted analysis server.",
      "NETWORK_ERROR",
      0,
    );
  }
  const envelope = await readEnvelope(response);
  if (signal?.aborted) throw new CopilotApiError("Analysis request was cancelled.", "REQUEST_CANCELLED", 0);
  if (envelope.error?.code === "ACCOUNT_SESSION_CHANGED") requestAccountRefresh();

  if (!response.ok || envelope.ok !== true) {
    throw new CopilotApiError(
      typeof envelope.error?.message === "string"
        ? envelope.error.message
        : "Hosted analysis is unavailable.",
      typeof envelope.error?.code === "string"
        ? envelope.error.code
        : "REQUEST_FAILED",
      response.status,
      typeof envelope.error?.retryAfterSeconds === "number"
        ? Math.max(1, Math.ceil(envelope.error.retryAfterSeconds))
        : undefined,
      envelope.error?.providerAttempted === false ? false : undefined,
    );
  }

  const validation = validateCopilotModelOutput(envelope.analysis);
  if (!validation.success || validation.data.scope !== request.scope) {
    throw new CopilotApiError(
      "Hosted analysis returned invalid product data.",
      "INVALID_RESPONSE",
      response.status,
    );
  }
  const qualityWarnings = Array.isArray(envelope.metadata?.qualityWarnings)
    ? [...new Set(
        envelope.metadata.qualityWarnings.filter(
          isCopilotQualityWarningCode,
        ),
      )]
    : [];
  const execution = normalizeCopilotExecutionInfo(envelope.metadata?.execution);

  return {
    analysis: {
      ...validation.data,
      source: "hosted",
    },
    ...(qualityWarnings.length === 0 ? {} : { qualityWarnings }),
    ...(execution ? { execution } : {}),
  };
}

export async function requestHostedCopilotAnalysis(
  request: CopilotAnalysisRequest,
  signal?: AbortSignal,
  reasoningEffort: "low" | "medium" = "low",
  modelId: "gpt-6-luna" | "gpt-6-sol" = "gpt-6-luna",
  accountId?: string,
): Promise<HostedCopilotAnalysisResult> {
  if (signal?.aborted) {
    throw new CopilotApiError("Analysis request was cancelled before sending.", "REQUEST_CANCELLED", 0, undefined, false);
  }
  const controller = new AbortController();
  // Allow the server's one retry plus transport overhead. This covers body reads too.
  const timeoutMs = reasoningEffort === "medium" ? 390_000 : 150_000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new CopilotApiError("Timed out waiting for the analysis response.", "REQUEST_TIMEOUT", 0));
      controller.abort();
    }, timeoutMs);
    cancel = () => {
      reject(new CopilotApiError("Analysis request was cancelled.", "REQUEST_CANCELLED", 0));
      controller.abort();
    };
    signal?.addEventListener("abort", cancel, { once: true });
  });
  try {
    return await Promise.race([
      fetchHostedCopilotAnalysis(request, controller.signal, reasoningEffort, modelId, accountId),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout);
    if (cancel) signal?.removeEventListener("abort", cancel);
  }
}
