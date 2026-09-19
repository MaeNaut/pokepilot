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

async function readStorage(key: AccountStorageKey): Promise<unknown | null> {
  const response = await fetch(endpoint(key), { cache: "no-store" });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");

  const body = await response.json() as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
  }
  return body[key] ?? null;
}

async function writeStorage(key: AccountStorageKey, value: unknown) {
  const response = await fetch(endpoint(key), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  });
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
}

export async function readAccountTeams(): Promise<SavedTeamSummary[] | null> {
  const value = await readStorage("teams");
  return value === null ? null : normalizeSavedTeams(value);
}

export function writeAccountTeams(teams: SavedTeamSummary[]) {
  return writeStorage("teams", teams);
}

export async function readAccountCopilotHistory(): Promise<CopilotHistoryEntry[] | null> {
  const value = await readStorage("analysis-history");
  return value === null ? null : normalizeCopilotHistoryEntries(value);
}

export function writeAccountCopilotHistory(entries: CopilotHistoryEntry[]) {
  return writeStorage("analysis-history", entries);
}

export async function readAccountPreferences(): Promise<AccountPreferences | null> {
  const value = await readStorage("preferences");
  return value === null ? null : normalizeAccountPreferences(value);
}

export function writeAccountPreferences(preferences: AccountPreferences) {
  return writeStorage("preferences", preferences);
}
