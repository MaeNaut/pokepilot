import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
  CopilotQualityWarningCode,
} from "../utils/copilotContracts";
import { isCopilotQualityWarningCode } from "../utils/copilotContracts";
import { validateCopilotModelOutput } from "../utils/copilotModelValidation";

type HostedAnalysisEnvelope = {
  ok?: unknown;
  analysis?: unknown;
  metadata?: {
    retryAfterSeconds?: unknown;
    qualityWarnings?: unknown;
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
  retryAfterSeconds?: number;
  qualityWarnings?: CopilotQualityWarningCode[];
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
    return (await response.json()) as HostedAnalysisEnvelope;
  } catch {
    throw new CopilotApiError(
      "Hosted analysis returned an unreadable response.",
      "INVALID_RESPONSE",
      response.status,
    );
  }
}

export async function requestHostedCopilotAnalysis(
  request: CopilotAnalysisRequest,
  signal?: AbortSignal,
  reasoningEffort: "low" | "medium" = "low",
  modelId: "gpt-6-luna" | "gpt-6-sol" = "gpt-6-luna",
): Promise<HostedCopilotAnalysisResult> {
  let response: Response;

  try {
    response = await fetch("/api/pokepilot/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PokePilot-Reasoning-Effort": reasoningEffort,
        "X-PokePilot-Model": modelId,
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

  const retryAfterSeconds =
    typeof envelope.metadata?.retryAfterSeconds === "number"
      ? Math.max(1, Math.ceil(envelope.metadata.retryAfterSeconds))
      : undefined;
  const qualityWarnings = Array.isArray(envelope.metadata?.qualityWarnings)
    ? [...new Set(
        envelope.metadata.qualityWarnings.filter(
          isCopilotQualityWarningCode,
        ),
      )]
    : [];

  return {
    analysis: {
      ...validation.data,
      source: "hosted",
    },
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    ...(qualityWarnings.length === 0 ? {} : { qualityWarnings }),
  };
}
