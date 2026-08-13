import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PokePilotRequester } from "./pokepilotOperations.js";

export const POKEPILOT_CLIENT_COOKIE = "pokepilot_client";
const clientCookieMaxAgeSeconds = 365 * 24 * 60 * 60;
const fallbackClientSecret = randomBytes(32).toString("base64url");

function signClientId(clientId: string, secret: string) {
  return createHmac("sha256", secret).update(clientId).digest("base64url");
}

export function createSignedPokePilotClientToken(
  clientId: string,
  secret: string,
) {
  return `${clientId}.${signClientId(clientId, secret)}`;
}

export function readSignedPokePilotClientToken(
  token: string | undefined,
  secret: string,
) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const clientId = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = signClientId(clientId, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.byteLength !== expectedBuffer.byteLength ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return clientId;
}

function getCookieValue(header: string | undefined, name: string) {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(separatorIndex + 1).trim());
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequesterIp(request: IncomingMessage) {
  const platformForwarded = getHeaderValue(
    request.headers["x-vercel-forwarded-for"],
  );
  const realIp = getHeaderValue(request.headers["x-real-ip"]);
  const forwarded = getHeaderValue(request.headers["x-forwarded-for"]);

  return (
    platformForwarded?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function appendSetCookie(response: ServerResponse, cookie: string) {
  const current = response.getHeader("Set-Cookie");

  if (Array.isArray(current)) {
    response.setHeader("Set-Cookie", [...current, cookie]);
  } else if (typeof current === "string") {
    response.setHeader("Set-Cookie", [current, cookie]);
  } else {
    response.setHeader("Set-Cookie", cookie);
  }
}

export function resolvePokePilotClientSecret(
  explicitSecret?: string,
  apiKey?: string,
) {
  return (
    explicitSecret?.trim() ||
    process.env.POKEPILOT_CLIENT_SECRET?.trim() ||
    apiKey?.trim() ||
    fallbackClientSecret
  );
}

export function resolvePokePilotRequester(
  request: IncomingMessage,
  response: ServerResponse,
  secret: string,
): PokePilotRequester {
  const cookieHeader = getHeaderValue(request.headers.cookie);
  const storedToken = getCookieValue(cookieHeader, POKEPILOT_CLIENT_COOKIE);
  let clientId = readSignedPokePilotClientToken(storedToken, secret);

  if (!clientId) {
    clientId = randomBytes(18).toString("base64url");
    const token = createSignedPokePilotClientToken(clientId, secret);
    const forwardedProto = getHeaderValue(request.headers["x-forwarded-proto"]);
    const secure =
      process.env.NODE_ENV === "production" || forwardedProto === "https";
    appendSetCookie(
      response,
      `${POKEPILOT_CLIENT_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${clientCookieMaxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
  }

  const ipHash = createHmac("sha256", secret)
    .update(`ip:${getRequesterIp(request)}`)
    .digest("base64url");

  return { clientId, ipHash };
}
