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
  type SavedTeamSummary,
  type TeamSnapshot,
} from "../utils/teamStorage";
import { mergeAccountTeams } from "../utils/accountStorageSync";

const storage = {
  readLocal: getStoredTeams,
  writeLocal: storeTeams,
  clearLocal: clearStoredTeams,
  readOwner: getStoredTeamsAccountId,
  writeOwner: storeSavedTeamsAccountId,
  readRemote: readAccountTeams,
  writeRemote: writeAccountTeams,
  merge: mergeAccountTeams,
};

export function useSavedTeams(accountId: string | null) {
  const { items: teams, current: currentTeams, commit, isHydrated } =
    useAccountCollection(accountId, storage);

  function update(id: string, change: (team: SavedTeamSummary) => SavedTeamSummary) {
    commit(currentTeams.current.map((team) => team.id === id ? change(team) : team));
  }

  return {
    teams,
    isHydrated,
    save(snapshot: TeamSnapshot, id: string | null) {
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
      if (!canAddSavedTeam(currentTeams.current.length)) return false;
      commit([copySavedTeam(team, currentTeams.current), ...currentTeams.current]);
      return true;
    },
    remove(id: string) {
      commit(currentTeams.current.filter((team) => team.id !== id));
    },
    reorder(source: number, target: number) {
      if (source !== target) commit(swapArrayItems(currentTeams.current, source, target));
    },
    update,
  };
}
