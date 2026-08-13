import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handlePokePilotAnalysis,
  POKEPILOT_API_MAX_BODY_BYTES,
  type PokePilotOperationalEvent,
  type PokePilotApiResponse,
} from "./pokepilotApi.js";
import {
  resolvePokePilotClientSecret,
  resolvePokePilotRequester,
} from "./pokepilotIdentity.js";
import {
  type PokePilotOperations,
  type PokePilotSafeguardMode,
} from "./pokepilotOperations.js";
import { getDefaultPokePilotOperationsRuntime } from "./pokepilotOperationsRuntime.js";

type ParsedRequest = IncomingMessage & {
  body?: unknown;
};

type NodePokePilotApiOptions = {
  apiKey?: string;
  clientSecret?: string;
  clock?: () => number;
  onOperationalEvent?: (event: PokePilotOperationalEvent) => void;
  operations?: PokePilotOperations;
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

function sendJson(
  response: ServerResponse,
  status: number,
  body: PokePilotApiResponse,
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!body.ok && body.error.retryAfterSeconds) {
    response.setHeader("Retry-After", String(body.error.retryAfterSeconds));
  }
  response.end(JSON.stringify(body));
}

function getFirstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSameOriginRequest(request: IncomingMessage) {
  const origin = getFirstHeader(request.headers.origin);

  if (!origin) {
    return true;
  }

  const forwardedHost = getFirstHeader(request.headers["x-forwarded-host"]);
  const host = forwardedHost ?? getFirstHeader(request.headers.host);

  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hasJsonContentType(request: IncomingMessage) {
  const contentType = getFirstHeader(request.headers["content-type"]);
  return (
    contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
  );
}

function logOperationalEvent(event: PokePilotOperationalEvent) {
  if (event.type === "cooldown") {
    console.info("[PokePilot API] Analysis cooldown.", event);
    return;
  }

  console.info("[PokePilot API] Analysis completed.", event);
}

async function readRequestBody(request: ParsedRequest) {
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > POKEPILOT_API_MAX_BODY_BYTES
  ) {
    throw new RangeError("PAYLOAD_TOO_LARGE");
  }

  if (request.body !== undefined) {
    const serializedBody =
      typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body);
    if (Buffer.byteLength(serializedBody, "utf8") > POKEPILOT_API_MAX_BODY_BYTES) {
      throw new RangeError("PAYLOAD_TOO_LARGE");
    }

    if (typeof request.body === "string") {
      return JSON.parse(request.body) as unknown;
    }
    return request.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > POKEPILOT_API_MAX_BODY_BYTES) {
      throw new RangeError("PAYLOAD_TOO_LARGE");
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export async function handleNodePokePilotApi(
  request: ParsedRequest,
  response: ServerResponse,
  options: NodePokePilotApiOptions = {},
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, {
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST requests are supported.",
      },
    });
    return;
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Cross-origin analysis requests are not supported.",
      },
    });
    return;
  }

  if (!hasJsonContentType(request)) {
    sendJson(response, 415, {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Content-Type must be application/json.",
      },
    });
    return;
  }

  let body: unknown;

  try {
    body = await readRequestBody(request);
  } catch (error) {
    const isTooLarge =
      error instanceof RangeError && error.message === "PAYLOAD_TOO_LARGE";
    sendJson(response, isTooLarge ? 413 : 400, {
      ok: false,
      error: {
        code: isTooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
        message: isTooLarge
          ? "Analysis request is too large."
          : "Request body must be valid JSON.",
      },
    });
    return;
  }

  try {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    const clientSecret = resolvePokePilotClientSecret(
      options.clientSecret,
      apiKey,
    );
    const requester = resolvePokePilotRequester(
      request,
      response,
      clientSecret,
    );
    const operations =
      options.operations ?? getDefaultPokePilotOperationsRuntime().operations;
    const result = await handlePokePilotAnalysis(body, {
      apiKey,
      clock: options.clock,
      onOperationalEvent:
        options.onOperationalEvent ?? logOperationalEvent,
      onUpstreamError: (error) => {
        console.error(
          "[PokePilot API] Hosted analysis failed.",
          summarizeUpstreamError(error),
        );
      },
      operations,
      requester,
      safeguardMode: options.safeguardMode,
    });
    sendJson(response, result.status, result.body);
  } catch (error) {
    console.error(
      "[PokePilot API] Operations layer failed.",
      summarizeUpstreamError(error),
    );
    sendJson(response, 503, {
      ok: false,
      error: {
        code: "AI_UPSTREAM_ERROR",
        message: "Hosted analysis is temporarily unavailable.",
      },
    });
  }
}
