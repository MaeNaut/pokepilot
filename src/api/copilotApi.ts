import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
} from "../utils/copilotAnalysis";
import { validateCopilotModelOutput } from "../utils/copilotModelContract";

type HostedAnalysisEnvelope = {
  ok?: unknown;
  analysis?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    retryAfterSeconds?: unknown;
  };
};

export class CopilotApiError extends Error {
  readonly code: string;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(
    message: string,
    code: string,
    status: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "CopilotApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
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
): Promise<CopilotAnalysisResponse> {
  let response: Response;

  try {
    response = await fetch("/api/pokepilot/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

  return {
    ...validation.data,
    source: "hosted",
  };
}
