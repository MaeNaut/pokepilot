import { readBoundedRequestJson, RequestBodyTooLargeError } from "../server/requestBody.js";

function privateHeaders(headers: HeadersInit = {}) {
  const result = new Headers(headers);
  result.set("Cache-Control", "no-store");
  result.set("X-Content-Type-Options", "nosniff");
  return result;
}

export function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  const result = privateHeaders(headers);
  result.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { headers: result, status });
}

export function emptyResponse(headers: HeadersInit = {}) {
  return new Response(null, { headers: privateHeaders(headers), status: 204 });
}

export function withSessionRefresh(response: Response, refreshCookie?: string) {
  if (!refreshCookie) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", refreshCookie);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export async function readJsonBody(request: Request, maxBytes: number, invalidCode: string) {
  try {
    return { ok: true as const, value: await readBoundedRequestJson(request, maxBytes) };
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return { ok: false as const, response: jsonResponse(tooLarge ? 413 : 400, {
      ok: false, error: { code: tooLarge ? "PAYLOAD_TOO_LARGE" : invalidCode },
    }) };
  }
}
