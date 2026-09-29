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
import { rejectChangedAccount } from "./accountSessionBoundary";

type AccountStorageKey = "teams" | "analysis-history" | "preferences";

export type VersionedAccountStorage<T> = { value: T | null; version: string };

export class AccountStorageConflictError extends Error {
  constructor() {
    super("ACCOUNT_STORAGE_CONFLICT");
    this.name = "AccountStorageConflictError";
  }
}

function endpoint(key: AccountStorageKey) {
  if (key === "teams") return "/api/pokepilot/teams";
  if (key === "analysis-history") return "/api/pokepilot/analysis-history";
  return "/api/pokepilot/preferences";
}

async function readStorage(
  key: AccountStorageKey, signal?: AbortSignal, accountId?: string,
): Promise<VersionedAccountStorage<unknown>> {
  const response = await fetch(endpoint(key), {
    cache: "no-store", signal,
    ...(accountId ? { headers: { "X-PokePilot-Account-Id": accountId } } : {}),
  });
  await rejectChangedAccount(response);
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");

  const body = await response.json() as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
  }
  const version = response.headers.get("ETag");
  if (!version) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
  return { value: body[key] ?? null, version };
}

async function writeStorage(
  key: AccountStorageKey, value: unknown, version: string, signal?: AbortSignal, accountId?: string,
) {
  const response = await fetch(endpoint(key), {
    method: "PUT",
    signal,
    headers: {
      "content-type": "application/json", "If-Match": version,
      ...(accountId ? { "X-PokePilot-Account-Id": accountId } : {}),
    },
    body: JSON.stringify({ [key]: value }),
  });
  await rejectChangedAccount(response);
  if (response.status === 409) throw new AccountStorageConflictError();
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
  const nextVersion = response.headers.get("ETag");
  if (!nextVersion) throw new Error("ACCOUNT_STORAGE_UNAVAILABLE");
  return nextVersion;
}

export async function readAccountTeams(
  signal?: AbortSignal, accountId?: string,
): Promise<VersionedAccountStorage<SavedTeamSummary[]>> {
  const snapshot = await readStorage("teams", signal, accountId);
  return { ...snapshot, value: snapshot.value === null ? null : normalizeSavedTeams(snapshot.value) };
}

export function writeAccountTeams(
  teams: SavedTeamSummary[], version: string, signal?: AbortSignal, accountId?: string,
) {
  return writeStorage("teams", teams, version, signal, accountId);
}

export async function readAccountCopilotHistory(
  signal?: AbortSignal, accountId?: string,
): Promise<VersionedAccountStorage<CopilotHistoryEntry[]>> {
  const snapshot = await readStorage("analysis-history", signal, accountId);
  return { ...snapshot, value: snapshot.value === null ? null : normalizeCopilotHistoryEntries(snapshot.value) };
}

export function writeAccountCopilotHistory(
  entries: CopilotHistoryEntry[], version: string, signal?: AbortSignal, accountId?: string,
) {
  return writeStorage("analysis-history", entries, version, signal, accountId);
}

export async function readAccountPreferences(
  signal?: AbortSignal, accountId?: string,
): Promise<VersionedAccountStorage<AccountPreferences>> {
  const snapshot = await readStorage("preferences", signal, accountId);
  return { ...snapshot, value: snapshot.value === null ? null : normalizeAccountPreferences(snapshot.value) };
}

export function writeAccountPreferences(
  preferences: AccountPreferences, version: string, signal?: AbortSignal, accountId?: string,
) {
  return writeStorage("preferences", preferences, version, signal, accountId);
}
