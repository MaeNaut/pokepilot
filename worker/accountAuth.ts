import { isSameOrigin } from "./http.js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { WorkerEnvironment } from "./env.js";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const GOOGLE_STATE_COOKIE = "pokepilot_google_state";
const SESSION_COOKIE = "pokepilot_session";
const sessionIdleMaxAgeSeconds = 30 * 24 * 60 * 60;
const sessionAbsoluteMaxAgeMs = 90 * 24 * 60 * 60 * 1_000;
const sessionRefreshThresholdMs = 7 * 24 * 60 * 60 * 1_000;
const oauthStateMaxAgeSeconds = 10 * 60;
const textEncoder = new TextEncoder();

type AccountRow = {
  id: string;
  email: string | null;
  name: string | null;
  picture_url: string | null;
};

type AccountSessionRow = AccountRow & {
  expires_at: number;
  session_created_at: number;
};

type GoogleTokenResponse = {
  id_token?: unknown;
};

export type AccountProfile = {
  id: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
};

export type AccountSession = {
  account: AccountProfile;
  refreshCookie?: string;
};

export class AccountAuthError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function getRequired(env: WorkerEnvironment, name: keyof WorkerEnvironment) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new AccountAuthError(503, "AUTH_UNAVAILABLE");
  }
  return value.trim();
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rawValue.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isSecure(request: Request) {
  return new URL(request.url).protocol === "https:";
}

function cookie(name: string, value: string, maxAge: number, request: Request, path = "/") {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${
    isSecure(request) ? "; Secure" : ""
  }`;
}

function expireCookie(name: string, request: Request, path = "/") {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax${
    isSecure(request) ? "; Secure" : ""
  }`;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function toProfile(row: AccountRow): AccountProfile {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.name ? { name: row.name } : {}),
    ...(isHttpsUrl(row.picture_url) ? { pictureUrl: row.picture_url } : {}),
  };
}

function appRedirect(request: Request, error?: string) {
  const target = new URL("/", request.url);
  if (error) target.searchParams.set("auth_error", error);
  return target;
}

function googleCallbackFailure(
  request: Request,
  clearState: string,
  error: unknown,
  fallbackCode: "GOOGLE_ACCOUNT_STORAGE_FAILED" | "GOOGLE_SESSION_STORAGE_FAILED",
) {
  const errorCode = error instanceof AccountAuthError ? error.code : fallbackCode;
  console.error("[PokePilot auth] Google OAuth callback failed.", { code: errorCode });
  const redirectError = errorCode === "GOOGLE_TOKEN_EXCHANGE_FAILED"
    ? "google-token"
    : errorCode === "GOOGLE_ID_TOKEN_INVALID"
      ? "google-identity"
      : errorCode === "GOOGLE_SESSION_STORAGE_FAILED"
        ? "google-session-storage"
        : errorCode === "GOOGLE_ACCOUNT_UPSERT_FAILED"
          ? "google-account-upsert"
          : errorCode === "GOOGLE_ACCOUNT_READ_FAILED"
            ? "google-account-read"
        : "google-account-storage";
  return redirectWithCookies(appRedirect(request, redirectError), [clearState]);
}

function redirectWithCookies(target: URL, cookies: string[]) {
  const headers = new Headers({ Location: target.toString() });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { headers, status: 302 });
}

async function sessionHash(token: string, env: WorkerEnvironment) {
  return hmac(`session:${token}`, getRequired(env, "POKEPILOT_SESSION_SECRET"));
}

export async function accountUsageId(account: AccountProfile, env: WorkerEnvironment) {
  return `account:${await hmac(`usage:${account.id}`, getRequired(env, "POKEPILOT_SESSION_SECRET"))}`;
}

function cookieMaxAgeSeconds(expiresAt: number, now: number) {
  return Math.max(1, Math.floor((expiresAt - now) / 1_000));
}

export async function readAccountSession(
  request: Request,
  env: WorkerEnvironment,
  { refresh = true }: { refresh?: boolean } = {},
): Promise<AccountSession | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || token.length > 512) return null;

  const now = Date.now();
  const idHash = await sessionHash(token, env);
  const row = await env.DB.prepare(
    `SELECT accounts.id, accounts.email, accounts.name, accounts.picture_url,
            account_sessions.expires_at,
            account_sessions.created_at AS session_created_at
     FROM account_sessions
     JOIN accounts ON accounts.id = account_sessions.account_id
     WHERE account_sessions.id_hash = ?
       AND account_sessions.expires_at > ?
       AND account_sessions.created_at > ?`,
  )
    .bind(idHash, now, now - sessionAbsoluteMaxAgeMs)
    .first<AccountSessionRow>();
  if (!row) return null;

  const account = toProfile(row);
  if (!refresh || row.expires_at - now > sessionRefreshThresholdMs) {
    return { account };
  }

  const refreshedExpiresAt = Math.min(
    now + sessionIdleMaxAgeSeconds * 1_000,
    row.session_created_at + sessionAbsoluteMaxAgeMs,
  );
  if (refreshedExpiresAt <= row.expires_at) {
    return {
      account,
      refreshCookie: cookie(
        SESSION_COOKIE,
        token,
        cookieMaxAgeSeconds(refreshedExpiresAt, now),
        request,
      ),
    };
  }

  const refreshedToken = randomToken();
  try {
    const result = await env.DB.prepare(
      `UPDATE account_sessions
       SET id_hash = ?, expires_at = ?
       WHERE id_hash = ? AND expires_at = ? AND created_at = ?`,
    )
      .bind(
        await sessionHash(refreshedToken, env),
        refreshedExpiresAt,
        idHash,
        row.expires_at,
        row.session_created_at,
      )
      .run();
    const changes = (result as { meta?: { changes?: number } }).meta?.changes;
    if (changes !== 1) return { account };
  } catch {
    return { account };
  }

  return {
    account,
    refreshCookie: cookie(
      SESSION_COOKIE,
      refreshedToken,
      cookieMaxAgeSeconds(refreshedExpiresAt, now),
      request,
    ),
  };
}

async function createSession(request: Request, env: WorkerEnvironment, accountId: string) {
  const token = randomToken();
  const now = Date.now();
  const expiresAt = now + sessionIdleMaxAgeSeconds * 1_000;
  await env.DB.prepare(
    `INSERT INTO account_sessions (id_hash, account_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(await sessionHash(token, env), accountId, expiresAt, now)
    .run();
  return cookie(SESSION_COOKIE, token, sessionIdleMaxAgeSeconds, request);
}

async function exchangeAuthorizationCode(env: WorkerEnvironment, code: string) {
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: getRequired(env, "GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: getRequired(env, "GOOGLE_OAUTH_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: getRequired(env, "GOOGLE_OAUTH_REDIRECT_URI"),
      }),
      // Workers supports "follow" and "manual". A token endpoint never needs a redirect.
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AccountAuthError(502, "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }
  if (!response.ok) throw new AccountAuthError(401, "GOOGLE_TOKEN_EXCHANGE_FAILED");
  const payload = await response.json().catch(() => null) as GoogleTokenResponse | null;
  if (!payload?.id_token || typeof payload.id_token !== "string") {
    throw new AccountAuthError(401, "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }
  return payload.id_token;
}

async function upsertGoogleAccount(env: WorkerEnvironment, idToken: string) {
  const clientId = getRequired(env, "GOOGLE_OAUTH_CLIENT_ID");
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      audience: clientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    }));
  } catch {
    throw new AccountAuthError(401, "GOOGLE_ID_TOKEN_INVALID");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new AccountAuthError(401, "GOOGLE_ID_TOKEN_INVALID");
  }

  const email = payload.email_verified === true && typeof payload.email === "string"
    ? payload.email
    : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  const pictureUrl = isHttpsUrl(payload.picture) ? payload.picture : null;
  const now = Date.now();
  // randomToken already uses Web Crypto supported by the Worker runtime.
  const accountId = randomToken();
  try {
    await env.DB.prepare(
      `INSERT INTO accounts (id, google_subject, email, name, picture_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(google_subject) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture_url = excluded.picture_url,
         updated_at = excluded.updated_at`,
    )
      .bind(accountId, payload.sub, email, name, pictureUrl, now, now)
      .run();
  } catch {
    throw new AccountAuthError(503, "GOOGLE_ACCOUNT_UPSERT_FAILED");
  }

  let account: AccountRow | null;
  try {
    account = await env.DB.prepare(
      "SELECT id, email, name, picture_url FROM accounts WHERE google_subject = ?",
    )
      .bind(payload.sub)
      .first<AccountRow>();
  } catch {
    throw new AccountAuthError(503, "GOOGLE_ACCOUNT_READ_FAILED");
  }
  if (!account) throw new AccountAuthError(503, "AUTH_UNAVAILABLE");
  return toProfile(account);
}

export function createGoogleAuthorizationResponse(request: Request, env: WorkerEnvironment) {
  const clientId = getRequired(env, "GOOGLE_OAUTH_CLIENT_ID");
  const redirectUri = getRequired(env, "GOOGLE_OAUTH_REDIRECT_URI");
  const state = randomToken();
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  }).toString();
  return new Response(null, {
    headers: {
      Location: authorizationUrl.toString(),
      "Set-Cookie": cookie(
        GOOGLE_STATE_COOKIE,
        state,
        oauthStateMaxAgeSeconds,
        request,
        "/api/auth/google/callback",
      ),
    },
    status: 302,
  });
}

export async function completeGoogleAuthorization(request: Request, env: WorkerEnvironment) {
  const url = new URL(request.url);
  const expectedState = getCookie(request, GOOGLE_STATE_COOKIE);
  const receivedState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const clearState = expireCookie(GOOGLE_STATE_COOKIE, request, "/api/auth/google/callback");

  if (url.searchParams.has("error") || !expectedState || !receivedState || expectedState !== receivedState || !code) {
    return redirectWithCookies(appRedirect(request, "google"), [clearState]);
  }

  let account: AccountProfile;
  try {
    const idToken = await exchangeAuthorizationCode(env, code);
    account = await upsertGoogleAccount(env, idToken);
  } catch (error) {
    return googleCallbackFailure(request, clearState, error, "GOOGLE_ACCOUNT_STORAGE_FAILED");
  }

  try {
    return redirectWithCookies(appRedirect(request), [
      clearState,
      await createSession(request, env, account.id),
    ]);
  } catch (error) {
    return googleCallbackFailure(request, clearState, error, "GOOGLE_SESSION_STORAGE_FAILED");
  }
}

export async function deleteCurrentAccount(request: Request, env: WorkerEnvironment, account: AccountProfile) {
  if (!isSameOrigin(request)) throw new AccountAuthError(403, "AUTH_FORBIDDEN");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM account_sessions WHERE account_id = ?").bind(account.id),
    env.DB.prepare("DELETE FROM account_storage WHERE account_id = ?").bind(account.id),
    env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(account.id),
  ]);
  return expireCookie(SESSION_COOKIE, request);
}

export async function logoutCurrentAccount(request: Request, env: WorkerEnvironment) {
  if (!isSameOrigin(request)) throw new AccountAuthError(403, "AUTH_FORBIDDEN");
  const token = getCookie(request, SESSION_COOKIE);
  if (token && token.length <= 512) {
    await env.DB.prepare("DELETE FROM account_sessions WHERE id_hash = ?")
      .bind(await sessionHash(token, env))
      .run();
  }
  return expireCookie(SESSION_COOKIE, request);
}
