import { MAX_SAVED_TEAMS } from "../data/teamLimits";
import {
  normalizeCopilotHistoryEntries,
  type CopilotHistoryEntry,
} from "./copilotHistory";
import { createSavedTeamId, type SavedTeamSummary } from "./teamStorage";

export type TeamSyncConflict = {
  id: string;
  local: SavedTeamSummary | null;
  remote: SavedTeamSummary | null;
  reason?: "capacity";
};
export type TeamConflictChoice = "both" | "local" | "remote" | "discard";

function sameEntry<T>(left: T | undefined, right: T | undefined) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function reconcileAccountTeams(
  remote: SavedTeamSummary[], local: SavedTeamSummary[], baseline: SavedTeamSummary[],
) {
  const remoteById = new Map(remote.map((team) => [team.id, team]));
  const localById = new Map(local.map((team) => [team.id, team]));
  const baselineById = new Map(baseline.map((team) => [team.id, team]));
  const ids = new Set([...localById.keys(), ...remoteById.keys(), ...baselineById.keys()]);
  const merged: SavedTeamSummary[] = [];
  const conflicts: TeamSyncConflict[] = [];

  for (const id of ids) {
    const before = baselineById.get(id);
    const here = localById.get(id);
    const there = remoteById.get(id);
    const changedHere = !sameEntry(here, before);
    const changedThere = !sameEntry(there, before);
    if (changedHere && changedThere && !sameEntry(here, there)) {
      conflicts.push({ id, local: here ?? null, remote: there ?? null });
    }
    const chosen = changedHere && !changedThere ? here : there;
    if (chosen) merged.push(chosen);
  }
  if (merged.length > MAX_SAVED_TEAMS) {
    const conflictingIds = new Set(conflicts.map(({ id }) => id));
    for (const team of merged) {
      if (!conflictingIds.has(team.id)) {
        conflicts.push({
          id: team.id,
          local: localById.get(team.id) ?? null,
          remote: remoteById.get(team.id) ?? null,
          reason: "capacity",
        });
      }
    }
  }
  return { merged, conflicts };
}

export function reconcileLegacyAccountTeams(remote: SavedTeamSummary[], local: SavedTeamSummary[]) {
  const localById = new Map(local.map((team) => [team.id, team]));
  const remoteById = new Map(remote.map((team) => [team.id, team]));
  const conflicts: TeamSyncConflict[] = [];
  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const here = localById.get(id);
    const there = remoteById.get(id);
    if (!sameEntry(here, there)) {
      conflicts.push({ id, local: here ?? null, remote: there ?? null });
    }
  }
  return { merged: remote, conflicts };
}

export function reconcileUnclaimedAccountTeams(remote: SavedTeamSummary[], local: SavedTeamSummary[]) {
  const remoteIds = new Set(remote.map((team) => team.id));
  const total = remote.length + local.filter((team) => !remoteIds.has(team.id)).length;
  if (total > MAX_SAVED_TEAMS) return reconcileLegacyAccountTeams(remote, local);
  return { merged: mergeAccountTeams(remote, local), conflicts: [] as TeamSyncConflict[] };
}

export function resolveAccountTeamConflicts(
  merged: SavedTeamSummary[], conflicts: TeamSyncConflict[],
  choices: Record<string, TeamConflictChoice>, copySuffix: string,
) {
  const byId = new Map(merged.map((team) => [team.id, team]));
  const copies: Array<{ originalId: string; copy: SavedTeamSummary }> = [];
  for (const conflict of conflicts) {
    const choice = choices[conflict.id];
    if (!choice || (choice === "both" && (!conflict.local || !conflict.remote)) ||
        (choice === "discard" && conflict.reason !== "capacity")) return null;
    if (choice === "discard") {
      byId.delete(conflict.id);
      continue;
    }
    const chosen = choice === "local" ? conflict.local : conflict.remote;
    if (chosen) byId.set(conflict.id, chosen);
    else byId.delete(conflict.id);
    if (choice === "both" && conflict.local) {
      const now = new Date().toISOString();
      const copy = {
        ...conflict.local,
        id: createSavedTeamId(),
        name: `${conflict.local.name} ${copySuffix}`,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(copy.id, copy);
      copies.push({ originalId: conflict.id, copy });
    }
  }
  if (byId.size > MAX_SAVED_TEAMS) return null;
  return { teams: [...byId.values()], copies };
}

function isNewer(left: { updatedAt?: string }, right: { updatedAt?: string }) {
  return (left.updatedAt ?? "") > (right.updatedAt ?? "");
}

export function mergeAccountTeams(
  remoteTeams: SavedTeamSummary[],
  localTeams: SavedTeamSummary[],
) {
  const remoteById = new Map(remoteTeams.map((team) => [team.id, team]));
  const localOnly = localTeams.filter((team) => !remoteById.has(team.id));
  const mergedRemote = remoteTeams.map((team) => {
    const local = localTeams.find((candidate) => candidate.id === team.id);
    return local && isNewer(local, team) ? local : team;
  });

  return [...mergedRemote, ...localOnly].slice(0, MAX_SAVED_TEAMS);
}

function withoutLocallyDeleted<T extends { id: string }>(
  remote: T[], local: T[], baseline: T[],
) {
  const localIds = new Set(local.map((entry) => entry.id));
  const deletedIds = new Set(baseline
    .filter((entry) => !localIds.has(entry.id))
    .map((entry) => entry.id));
  return remote.filter((entry) => !deletedIds.has(entry.id));
}

export function mergeAccountTeamsAfterLocalEdits(
  remote: SavedTeamSummary[], local: SavedTeamSummary[], baseline: SavedTeamSummary[],
) {
  const merged = mergeAccountTeams(withoutLocallyDeleted(remote, local, baseline), local);
  const mergedById = new Map(merged.map((team) => [team.id, team]));
  const localIds = new Set(local.map((team) => team.id));
  return [
    ...local.flatMap((team) => mergedById.has(team.id) ? [mergedById.get(team.id)!] : []),
    ...merged.filter((team) => !localIds.has(team.id)),
  ].slice(0, MAX_SAVED_TEAMS);
}

export function mergeAccountCopilotHistory(
  remoteEntries: CopilotHistoryEntry[],
  localEntries: CopilotHistoryEntry[],
) {
  const entriesById = new Map(remoteEntries.map((entry) => [entry.id, entry]));

  for (const localEntry of localEntries) {
    const remoteEntry = entriesById.get(localEntry.id);
    if (!remoteEntry || localEntry.createdAt > remoteEntry.createdAt) {
      entriesById.set(localEntry.id, localEntry);
    }
  }

  return normalizeCopilotHistoryEntries([...entriesById.values()]);
}

export function mergeAccountCopilotHistoryAfterLocalEdits(
  remote: CopilotHistoryEntry[], local: CopilotHistoryEntry[], baseline: CopilotHistoryEntry[],
) {
  return mergeAccountCopilotHistory(withoutLocallyDeleted(remote, local, baseline), local);
}

export function reconcileAccountCopilotHistory(
  remote: CopilotHistoryEntry[], local: CopilotHistoryEntry[], baseline: CopilotHistoryEntry[],
) {
  const byId = new Map(remote.map((entry) => [entry.id, entry]));
  const localById = new Map(local.map((entry) => [entry.id, entry]));
  const baselineById = new Map(baseline.map((entry) => [entry.id, entry]));
  for (const id of new Set([...localById.keys(), ...baselineById.keys()])) {
    const before = baselineById.get(id);
    const here = localById.get(id);
    if (sameEntry(here, before)) continue;
    if (here) byId.set(id, here);
    else byId.delete(id);
  }
  return normalizeCopilotHistoryEntries([...byId.values()]);
}
