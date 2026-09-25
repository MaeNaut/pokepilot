import { AccountAuthError, readAccountSession } from "./accountAuth.js";
import { emptyResponse, isSameOrigin, jsonResponse, withSessionRefresh } from "./http.js";
import type { WorkerEnvironment } from "./env.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type KeyRow = { ciphertext: string; iv: string };

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey(env: WorkerEnvironment) {
  if (!env.POKEPILOT_SESSION_SECRET) {
    throw new AccountAuthError(503, "AUTH_UNAVAILABLE");
  }
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`pokepilot:personal-api-key:v1:${env.POKEPILOT_SESSION_SECRET}`),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptPersonalApiKey(value: string, accountId: string, env: WorkerEnvironment) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(accountId) },
    await encryptionKey(env),
    encoder.encode(value),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function readPersonalApiKey(accountId: string, env: WorkerEnvironment) {
  const row = await env.DB.prepare(
    "SELECT ciphertext, iv FROM personal_api_keys WHERE account_id = ?",
  ).bind(accountId).first<KeyRow>();
  if (!row) return null;
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(row.iv), additionalData: encoder.encode(accountId) },
    await encryptionKey(env),
    fromBase64(row.ciphertext),
  );
  return decoder.decode(plaintext);
}

export async function handlePersonalApiKey(request: Request, env: WorkerEnvironment) {
  const session = await readAccountSession(request, env);
  if (!session) return jsonResponse(401, { ok: false, error: { code: "AUTH_REQUIRED" } });
  const accountId = session.account.id;
  const refreshed = session.refreshCookie;

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT 1 AS present FROM personal_api_keys WHERE account_id = ?",
    ).bind(accountId).first<{ present: number }>();
    return withSessionRefresh(jsonResponse(200, { hasKey: Boolean(row) }), refreshed);
  }

  if (request.method !== "PUT" && request.method !== "DELETE") {
    return jsonResponse(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED" } }, { Allow: "GET, PUT, DELETE" });
  }
  if (!isSameOrigin(request)) throw new AccountAuthError(403, "AUTH_FORBIDDEN");

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM personal_api_keys WHERE account_id = ?").bind(accountId).run();
    return withSessionRefresh(emptyResponse(), refreshed);
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { ok: false, error: { code: "INVALID_KEY" } });
  }
  const raw = await request.text();
  if (raw.length > 1_024) return jsonResponse(413, { ok: false, error: { code: "INVALID_KEY" } });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { value = null; }
  const apiKey = typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as { apiKey?: unknown }).apiKey
    : null;
  if (typeof apiKey !== "string" || !/^sk-[^\s]{16,512}$/.test(apiKey)) {
    return jsonResponse(400, { ok: false, error: { code: "INVALID_KEY" } });
  }
  const encrypted = await encryptPersonalApiKey(apiKey, accountId, env);
  await env.DB.prepare(
    `INSERT INTO personal_api_keys (account_id, ciphertext, iv, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at`,
  ).bind(accountId, encrypted.ciphertext, encrypted.iv, Date.now()).run();
  return withSessionRefresh(emptyResponse(), refreshed);
}
