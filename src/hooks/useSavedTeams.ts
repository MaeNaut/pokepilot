import { useAccountCollection } from "./useAccountCollection";
import { readAccountTeams, writeAccountTeams } from "../api/accountStorage";
import { canAddSavedTeam } from "../data/teamLimits";
import { swapArrayItems } from "../utils/reorder";
import { copySavedTeam, createSavedTeam, renameSavedTeam } from "../utils/savedTeamLibrary";
import {
  clearStoredTeams,
  getStoredTeamsAccountId,
  getStoredTeams,
  storeSavedTeamsAccountId,
  storeTeams,
  getPendingTeams,
  getAllPendingTeams,
  storePendingTeams,
  clearPendingTeams,
  clearConsumedPendingTeams,
  hasManagedTeams,
  markManagedTeams,
  type SavedTeamSummary,
  type TeamSnapshot,
} from "../utils/teamStorage";
import {
  mergeAccountTeams, mergeAccountTeamsAfterLocalEdits, reconcileAccountTeams,
  reconcileLegacyAccountTeams,
  reconcileUnclaimedAccountTeams,
  resolveAccountTeamConflicts, type TeamConflictChoice,
} from "../utils/accountStorageSync";
import { pendingTeamsStorageKey } from "../utils/accountPendingStorage";

const storage = {
  pendingKey: pendingTeamsStorageKey,
  readLocal: getStoredTeams,
  writeLocal: storeTeams,
  clearLocal: clearStoredTeams,
  readOwner: getStoredTeamsAccountId,
  writeOwner: storeSavedTeamsAccountId,
  readRemote: readAccountTeams,
  writeRemote: writeAccountTeams,
  readPending: getPendingTeams,
  readPendings: getAllPendingTeams,
  writePending: storePendingTeams,
  clearPending: clearPendingTeams,
  clearPendingEntries: clearConsumedPendingTeams,
  isManaged: hasManagedTeams,
  markManaged: markManagedTeams,
  merge: mergeAccountTeams,
  mergeAfterLocalEdits: mergeAccountTeamsAfterLocalEdits,
  reconcile: reconcileAccountTeams,
  reconcileLegacy: reconcileLegacyAccountTeams,
  reconcileUnclaimed: reconcileUnclaimedAccountTeams,
};

export function useSavedTeams(accountId: string | null, authResolved = true) {
  const { items: teams, current: currentTeams, commit, isHydrated,
    conflict, resolveConflict, hasLocalStorageError } =
    useAccountCollection(accountId, storage, authResolved);

  function update(id: string, change: (team: SavedTeamSummary) => SavedTeamSummary) {
    commit(currentTeams.current.map((team) => team.id === id ? change(team) : team));
  }

  return {
    teams,
    isHydrated,
    conflict,
    hasLocalStorageError,
    resolveTeamConflicts(choices: Record<string, TeamConflictChoice>, copySuffix: string) {
      if (!conflict) return null;
      const resolution = resolveAccountTeamConflicts(
        conflict.merged, conflict.conflicts, choices, copySuffix,
      );
      if (!resolution) return null;
      void resolveConflict(resolution.teams);
      return resolution.copies;
    },
    save(snapshot: TeamSnapshot, id: string | null) {
      if (!authResolved) return null;
      const existing = currentTeams.current.find((team) => team.id === id);
      if (!existing && !canAddSavedTeam(currentTeams.current.length)) return null;
      const saved = createSavedTeam(snapshot, existing);
      commit(existing
        ? currentTeams.current.map((team) => team.id === saved.id ? saved : team)
        : [saved, ...currentTeams.current]);
      return saved;
    },
    rename(id: string, name: string) {
      update(id, (team) => renameSavedTeam(team, name));
    },
    duplicate(team: SavedTeamSummary) {
      if (!authResolved) return false;
      if (!canAddSavedTeam(currentTeams.current.length)) return false;
      commit([copySavedTeam(team, currentTeams.current), ...currentTeams.current]);
      return true;
    },
    remove(id: string) {
      commit(currentTeams.current.filter((team) => team.id !== id));
    },
    reorderByIds(sourceId: string, targetId: string) {
      const source = currentTeams.current.findIndex((team) => team.id === sourceId);
      const target = currentTeams.current.findIndex((team) => team.id === targetId);
      if (source < 0 || target < 0 || source === target) return false;
      commit(swapArrayItems(currentTeams.current, source, target));
      return true;
    },
    update,
  };
}
