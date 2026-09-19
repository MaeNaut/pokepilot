import {
  normalizeSavedTeams,
  type SavedTeamSummary,
} from "../utils/teamStorage";
import {
  normalizeCopilotHistoryEntries,
  type CopilotHistoryEntry,
} from "../utils/copilotHistory";
import {
  normalizeAccountPreferences,
  type AccountPreferences,
} from "../utils/accountPreferences";

type AccountStorageKey = "teams" | "analysis-history" | "preferences";

function endpoint(key: AccountStorageKey) {
  if (key === "teams") return "/api/pokepilot/teams";
  if (key === "analysis-history") return "/api/pokepilot/analysis-history";
  return "/api/pokepilot/preferences";
}

async function readStorage(key: AccountStorageKey, signal?: AbortSignal): Promise<unknown | null> {
  const response = await fetch(endpoint(key), { cache: "no-store", signal });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");

  const body = await response.json() as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
  }
  return body[key] ?? null;
}

async function writeStorage(key: AccountStorageKey, value: unknown, signal?: AbortSignal) {
  const response = await fetch(endpoint(key), {
    method: "PUT",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
}

export async function readAccountTeams(signal?: AbortSignal): Promise<SavedTeamSummary[] | null> {
  const value = await readStorage("teams", signal);
  return value === null ? null : normalizeSavedTeams(value);
}

export function writeAccountTeams(teams: SavedTeamSummary[], signal?: AbortSignal) {
  return writeStorage("teams", teams, signal);
}

export async function readAccountCopilotHistory(signal?: AbortSignal): Promise<CopilotHistoryEntry[] | null> {
  const value = await readStorage("analysis-history", signal);
  return value === null ? null : normalizeCopilotHistoryEntries(value);
}

export function writeAccountCopilotHistory(entries: CopilotHistoryEntry[], signal?: AbortSignal) {
  return writeStorage("analysis-history", entries, signal);
}

export async function readAccountPreferences(signal?: AbortSignal): Promise<AccountPreferences | null> {
  const value = await readStorage("preferences", signal);
  return value === null ? null : normalizeAccountPreferences(value);
}

export function writeAccountPreferences(preferences: AccountPreferences, signal?: AbortSignal) {
  return writeStorage("preferences", preferences, signal);
}
