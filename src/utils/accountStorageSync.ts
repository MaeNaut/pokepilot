import { MAX_SAVED_TEAMS } from "../data/teamLimits";
import {
  normalizeCopilotHistoryEntries,
  type CopilotHistoryEntry,
} from "./copilotHistory";
import type { SavedTeamSummary } from "./teamStorage";

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
