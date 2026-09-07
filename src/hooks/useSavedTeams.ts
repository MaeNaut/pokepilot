import { useRef, useState } from "react";
import { canAddSavedTeam } from "../data/teamLimits";
import { swapArrayItems } from "../utils/reorder";
import { copySavedTeam, createSavedTeam, renameSavedTeam } from "../utils/savedTeamLibrary";
import {
  getStoredTeams,
  storeTeams,
  type SavedTeamSummary,
  type TeamSnapshot,
} from "../utils/teamStorage";

export function useSavedTeams() {
  const [teams, setTeams] = useState(getStoredTeams);
  const currentTeams = useRef(teams);

  function commit(next: SavedTeamSummary[]) {
    // Persist once, outside React's replayable state updater.
    storeTeams(next);
    currentTeams.current = next;
    setTeams(next);
  }

  function update(id: string, change: (team: SavedTeamSummary) => SavedTeamSummary) {
    commit(currentTeams.current.map((team) => team.id === id ? change(team) : team));
  }

  return {
    teams,
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
