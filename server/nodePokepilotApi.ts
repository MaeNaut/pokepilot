import type { IncomingMessage, ServerResponse } from "node:http";
import {
  handlePokePilotAnalysis,
  POKEPILOT_API_MAX_BODY_BYTES,
  type PokePilotApiResponse,
} from "./pokepilotApi";

type ParsedRequest = IncomingMessage & {
  body?: unknown;
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
  response.end(JSON.stringify(body));
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
  apiKey = process.env.OPENAI_API_KEY,
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

  try {
    const body = await readRequestBody(request);
    const result = await handlePokePilotAnalysis(body, {
      apiKey,
      onUpstreamError: (error) => {
        console.error(
          "[PokePilot API] Hosted analysis failed.",
          summarizeUpstreamError(error),
        );
      },
    });
    sendJson(response, result.status, result.body);
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
  }
}
