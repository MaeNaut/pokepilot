import {
  handlePokePilotAnalysis,
  POKEPILOT_API_MAX_BODY_BYTES,
  type PokePilotApiResponse,
  type PokePilotOperationalEvent,
  type PokePilotHostedModel,
} from "./pokepilotApi.js";
import {
  resolvePokePilotClientSecret,
  resolvePokePilotIdentity,
} from "./pokepilotIdentity.js";
import {
  type PokePilotOperations,
  type PokePilotSafeguardMode,
} from "./pokepilotOperations.js";
import { getDefaultPokePilotOperationsRuntime } from "./pokepilotOperationsRuntime.js";

type WebPokePilotApiOptions = {
  authenticatedAccountId?: string;
  apiKey?: string;
  reasoningEffort?: "low" | "medium";
  modelId?: PokePilotHostedModel;
  billingSource?: "site" | "personal";
  billingIdentity?: string;
  clientSecret?: string;
  clock?: () => number;
  onOperationalEvent?: (event: PokePilotOperationalEvent) => void;
  operations?: PokePilotOperations;
  requesterIp?: string;
  safeguardMode?: PokePilotSafeguardMode;
};

function summarizeUpstreamError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const upstreamError = error as Error & {
    cause?: unknown;
    code?: unknown;
    request_id?: unknown;
    status?: unknown;
    type?: unknown;
  };
  const cause = upstreamError.cause;

  return {
    name: error.name,
    message: error.message,
    status: upstreamError.status,
    code: upstreamError.code,
    type: upstreamError.type,
    requestId: upstreamError.request_id,
    cause:
      cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
            code: (cause as Error & { code?: unknown }).code,
          }
        : cause,
  };
}

function jsonResponse(
  status: number,
  body: PokePilotApiResponse,
  additionalHeaders: HeadersInit = {},
) {
  const headers = new Headers(additionalHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (!body.ok && body.error.retryAfterSeconds) {
    headers.set("Retry-After", String(body.error.retryAfterSeconds));
  }

  return new Response(JSON.stringify(body), { headers, status });
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function hasJsonContentType(request: Request) {
  return (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ===
    "application/json"
  );
}

function logOperationalEvent(event: PokePilotOperationalEvent) {
  if (event.type === "cooldown") {
    console.info("[PokePilot API] Analysis cooldown.", event);
    return;
  }

  console.info("[PokePilot API] Analysis completed.", event);
}

async function readRequestBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > POKEPILOT_API_MAX_BODY_BYTES
  ) {
    throw new RangeError("PAYLOAD_TOO_LARGE");
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return JSON.parse("") as unknown;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > POKEPILOT_API_MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export async function handleWebPokePilotApi(
  request: Request,
  options: WebPokePilotApiOptions = {},
) {
  if (request.method !== "POST") {
    return jsonResponse(
      405,
      {
        ok: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only POST requests are supported.",
          providerAttempted: false,
        },
      },
      { Allow: "POST" },
    );
  }

  if (!isSameOriginRequest(request)) {
    return jsonResponse(403, {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Cross-origin analysis requests are not supported.",
        providerAttempted: false,
      },
    });
  }

  if (!hasJsonContentType(request)) {
    return jsonResponse(415, {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Content-Type must be application/json.",
        providerAttempted: false,
      },
    });
  }

  let body: unknown;
  try {
    body = await readRequestBody(request);
  } catch (error) {
    const isTooLarge =
      error instanceof RangeError && error.message === "PAYLOAD_TOO_LARGE";
    return jsonResponse(isTooLarge ? 413 : 400, {
      ok: false,
      error: {
        code: isTooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
        message: isTooLarge
          ? "Analysis request is too large."
          : "Request body must be valid JSON.",
        providerAttempted: false,
      },
    });
  }

  try {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    const clientSecret = resolvePokePilotClientSecret(
      options.clientSecret,
      apiKey,
    );
    const identity = resolvePokePilotIdentity(
      {
        headers: request.headers,
        isSecure: new URL(request.url).protocol === "https:",
        trustedIp: options.requesterIp,
      },
      clientSecret,
    );
    const operations =
      options.operations ?? getDefaultPokePilotOperationsRuntime().operations;
    const result = await handlePokePilotAnalysis(body, {
      apiKey,
      reasoningEffort: options.reasoningEffort,
      modelId: options.modelId,
      billingSource: options.billingSource,
      billingIdentity: options.billingIdentity,
      clock: options.clock,
      onOperationalEvent:
        options.onOperationalEvent ?? logOperationalEvent,
      onUpstreamError: (error) => {
        console.error(
          "[PokePilot API] Hosted analysis failed.",
          summarizeUpstreamError(error),
        );
      },
      onQualityWarning: (warnings) => {
        console.warn("[PokePilot API] Analysis quality warnings.", warnings);
      },
      operations,
      requester: options.authenticatedAccountId
        ? { ...identity.requester, clientId: options.authenticatedAccountId }
        : identity.requester,
      safeguardMode: options.safeguardMode,
    });
    return jsonResponse(
      result.status,
      result.body,
      identity.setCookie ? { "Set-Cookie": identity.setCookie } : {},
    );
  } catch (error) {
    console.error(
      "[PokePilot API] Operations layer failed.",
      summarizeUpstreamError(error),
    );
    return jsonResponse(503, {
      ok: false,
      error: {
        code: "AI_UPSTREAM_ERROR",
        message: "Hosted analysis is temporarily unavailable.",
      },
    });
  }
}
