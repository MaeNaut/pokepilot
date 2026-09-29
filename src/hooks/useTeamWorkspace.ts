import { useCallback, useState } from "react";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { ACTIVE_TEAM_SIZE } from "../data/teamLimits";
import type { TeamSlot } from "../types";
import type { BenchPokemon } from "../utils/benchPokemon";
import type { ImportedShowdownSnapshot } from "../utils/showdownImport";
import {
  clearLastActiveTeamId, createEmptyBuildState, createSavedSlot,
  storeLastActiveTeamId, type SavedTeamSummary,
} from "../utils/teamStorage";
import { useTeamBuildState } from "./useTeamBuildState";
import { useTeamDraft } from "./useTeamDraft";
import { moveTeamPokemonToBench, moveBenchPokemonToTeam } from "../utils/benchPokemon";
import { createSavedTeamId } from "../utils/teamStorage";
import { swapArrayItems } from "../utils/reorder";

type Options = {
  battleFormat: BattleFormat;
  setBattleFormat: (format: BattleFormat) => void;
  untitledName: string;
};

const emptyTeam = () => Array<TeamSlot>(ACTIVE_TEAM_SIZE).fill(null);

export function useTeamWorkspace({ battleFormat, setBattleFormat, untitledName }: Options) {
  const [team, setTeam] = useState<TeamSlot[]>(emptyTeam);
  const [bench, setBench] = useState<BenchPokemon[]>([]);
  const [selectedTeamSlot, setSelectedTeamSlot] = useState(0);
  const [activeSavedTeamId, setActiveSavedTeamId] = useState<string | null>(null);
  const teamBuildState = useTeamBuildState();
  const draft = useTeamDraft({
    team, bench, buildState: teamBuildState.getBuildStateSnapshot(),
    battleFormat, activeSavedTeamId, untitledName,
  });
  const { setTeamName, setTeamNameDraft, setCommittedSnapshot } = draft;
  const { replaceBuildState } = teamBuildState;

  const selectSavedTeamId = useCallback((id: string | null) => {
    setActiveSavedTeamId(id);
    if (id) storeLastActiveTeamId(id);
    else clearLastActiveTeamId();
  }, []);

  const resetWorkspace = useCallback((reason: "new-team" | "account-change") => {
    const members = emptyTeam();
    setTeam(members);
    setBench([]);
    replaceBuildState();
    setTeamName(untitledName);
    setTeamNameDraft(untitledName);
    selectSavedTeamId(null);
    if (reason === "account-change") setSelectedTeamSlot(0);
    setCommittedSnapshot(reason === "account-change" ? null : {
      name: untitledName, battleFormat, slots: members.map(createSavedSlot),
      bench: [], buildState: createEmptyBuildState(),
    });
  }, [battleFormat, untitledName, replaceBuildState, setTeamName, setTeamNameDraft,
    selectSavedTeamId, setCommittedSnapshot]);

  function importWorkspace(snapshot: ImportedShowdownSnapshot, name: string) {
    setTeam(snapshot.members);
    setBench([]);
    setSelectedTeamSlot(Math.max(0, snapshot.members.findIndex(Boolean)));
    replaceBuildState(snapshot.buildState);
    setTeamName(name);
    setTeamNameDraft(name);
    selectSavedTeamId(null);
    // Imported content remains dirty until explicitly saved.
    setCommittedSnapshot({
      name, battleFormat, slots: emptyTeam().map(createSavedSlot),
      bench: [], buildState: createEmptyBuildState(),
    });
  }

  function loadWorkspace(saved: SavedTeamSummary, members: TeamSlot[], hydratedBench: BenchPokemon[]) {
    setTeam(members);
    setBench(hydratedBench);
    setTeamName(saved.name);
    setTeamNameDraft(saved.name);
    setBattleFormat(saved.battleFormat);
    replaceBuildState(saved.buildState);
    selectSavedTeamId(saved.id);
    setCommittedSnapshot({
      name: saved.name, battleFormat: saved.battleFormat, slots: saved.slots,
      bench: saved.bench, buildState: saved.buildState ?? createEmptyBuildState(),
    });
  }

  function markWorkspaceSaved(id: string, name: string) {
    selectSavedTeamId(id);
    draft.markCurrentTeamCommitted(name);
  }

  function detachSavedTeam() {
    selectSavedTeamId(null);
    setCommittedSnapshot(null);
  }

  function handleReorderSlots(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    setTeam((currentTeam) =>
      swapArrayItems(currentTeam, sourceIndex, targetIndex),
    );
    teamBuildState.reorderSlots(sourceIndex, targetIndex);
  }

  function handleMoveTeamPokemonToBench(slotIndex: number) {
    const nextState = moveTeamPokemonToBench(
      {
        team,
        bench,
        buildState: teamBuildState.getBuildStateSnapshot(),
      },
      slotIndex,
      createSavedTeamId(),
    );

    setTeam(nextState.team);
    setBench(nextState.bench);
    teamBuildState.replaceBuildState(nextState.buildState);
  }

  function handleMoveBenchPokemonToTeam(benchIndex: number, slotIndex: number) {
    const nextState = moveBenchPokemonToTeam(
      {
        team,
        bench,
        buildState: teamBuildState.getBuildStateSnapshot(),
      },
      benchIndex,
      slotIndex,
      createSavedTeamId(),
    );

    setTeam(nextState.team);
    setBench(nextState.bench);
    setSelectedTeamSlot(slotIndex);
    teamBuildState.replaceBuildState(nextState.buildState);
  }

  function handleReorderBenchPokemon(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    setBench((current) => swapArrayItems(current, sourceIndex, targetIndex));
  }

  function handleRemoveBenchPokemon(benchId: string) {
    setBench((current) => current.filter((entry) => entry.id !== benchId));
  }

  return {
    handleReorderSlots, handleMoveTeamPokemonToBench, handleMoveBenchPokemonToTeam,
    handleReorderBenchPokemon, handleRemoveBenchPokemon,
    ...draft, team, setTeam, bench, setBench, selectedTeamSlot, setSelectedTeamSlot,
    teamBuildState, activeSavedTeamId, resetWorkspace, importWorkspace,
    loadWorkspace, markWorkspaceSaved, detachSavedTeam,
  };
}
