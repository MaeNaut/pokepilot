import { AccountAuthError, readAccountSession } from "./accountAuth.js";
import { emptyResponse, isSameOrigin, jsonResponse, withSessionRefresh } from "./http.js";
import type { WorkerEnvironment } from "./env.js";
import { isAnalysisPreference } from "../src/utils/accountPreferences.js";

export type AccountStorageKey = "teams" | "analysis-history" | "preferences";

const collectionStorageLimits = {
  teams: { items: 30, bytes: 1_500_000 },
  "analysis-history": { items: 60, bytes: 1_000_000 },
};
const preferencesStorageLimit = 4_096;

function isPreferences(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const preferences = value as Record<string, unknown>;
  const expectedKeys = [
    "locale",
    "themePreference",
    "battleFormat",
    "tutorialCompleted",
    "analysis",
  ];
  if (Object.keys(preferences).some((key) => !expectedKeys.includes(key))) {
    return false;
  }

  return (preferences.locale === "en" || preferences.locale === "ko") &&
    (preferences.analysis === undefined || isAnalysisPreference(preferences.analysis)) &&
    (preferences.themePreference === "system" ||
      preferences.themePreference === "light" ||
      preferences.themePreference === "dark") &&
    (preferences.battleFormat === "singles" ||
      preferences.battleFormat === "doubles") &&
    typeof preferences.tutorialCompleted === "boolean";
}

function getPayload(value: unknown, key: AccountStorageKey) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const payload = (value as Record<string, unknown>)[key];

  if (key === "preferences") {
    if (!isPreferences(payload)) return null;
    const serialized = JSON.stringify(payload);
    return serialized.length <= preferencesStorageLimit ? serialized : null;
  }

  const limits = collectionStorageLimits[key];
  if (!Array.isArray(payload) || payload.length > limits.items) return null;

  const serialized = JSON.stringify(payload);
  if (serialized.length > limits.bytes) return null;
  return serialized;
}

function parseStoredPayload(payload: string | null, key: AccountStorageKey) {
  if (!payload) return { [key]: null };
  try {
    const value = JSON.parse(payload);
    const isValid = key === "preferences" ? isPreferences(value) : Array.isArray(value);
    return isValid ? { [key]: value } : { [key]: null };
  } catch {
    return { [key]: null };
  }
}

export async function handleAccountStorage(
  request: Request,
  env: WorkerEnvironment,
  key: AccountStorageKey,
) {
  const session = await readAccountSession(request, env);
  if (!session) return jsonResponse(401, { ok: false, error: { code: "AUTH_REQUIRED" } });

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT payload FROM account_storage WHERE account_id = ? AND storage_key = ?",
    )
      .bind(session.account.id, key)
      .first<{ payload: string }>();
    return jsonResponse(
      200,
      parseStoredPayload(row?.payload ?? null, key),
      session.refreshCookie ? { "Set-Cookie": session.refreshCookie } : {},
    );
  }

  if (request.method === "PUT") {
    if (!isSameOrigin(request)) {
      throw new AccountAuthError(403, "AUTH_FORBIDDEN");
    }

    const body = await request.json().catch(() => null);
    const payload = getPayload(body, key);
    if (!payload) {
      return jsonResponse(400, { ok: false, error: { code: "INVALID_ACCOUNT_STORAGE" } });
    }

    await env.DB.prepare(
      `INSERT INTO account_storage (account_id, storage_key, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id, storage_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    )
      .bind(session.account.id, key, payload, Date.now())
      .run();
    return withSessionRefresh(emptyResponse(), session.refreshCookie);
  }

  return jsonResponse(
    405,
    { ok: false, error: { code: "METHOD_NOT_ALLOWED" } },
    { Allow: "GET, PUT" },
  );
}
