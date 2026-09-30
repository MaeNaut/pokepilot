import { rejectChangedAccount } from "./accountSessionBoundary";
import { normalizeSavedTeams, type SavedTeamSummary } from "../utils/teamStorage";

export class TeamLibraryChanged extends Error {}

async function request(accountId: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch("/api/pokepilot/team-library", {
    method: body ? "PUT" : "GET", cache: "no-store", signal,
    headers: { "X-PokePilot-Account-Id": accountId, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  await rejectChangedAccount(response);
  if (response.status === 409) throw new TeamLibraryChanged();
  if (!response.ok) throw new Error("TEAM_STORAGE_UNAVAILABLE");
  return response.json();
}

export async function readTeamLibrary(accountId: string, signal: AbortSignal) {
  const body = await request(accountId, signal);
  return normalizeSavedTeams(body.teams);
}

export async function saveLibraryTeam(accountId: string, signal: AbortSignal, team: SavedTeamSummary, revision: string | null) {
  const body = await request(accountId, signal, { operation: "save", id: team.id, revision, team });
  return normalizeSavedTeams([body.team])[0];
}

export async function deleteLibraryTeam(accountId: string, signal: AbortSignal, team: SavedTeamSummary) {
  await request(accountId, signal, { operation: "delete", id: team.id, revision: team.revision ?? null });
}

export async function orderLibraryTeams(accountId: string, signal: AbortSignal, ids: string[]) {
  await request(accountId, signal, { operation: "order", ids });
}
