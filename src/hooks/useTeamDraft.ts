import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { TeamSlot } from "../types";
import type { BenchPokemon } from "../utils/benchPokemon";
import type { TeamBuildState } from "../utils/teamBuildState";
import { createSavedBenchPokemon, createSavedSlot, serializeTeamSnapshot, type TeamSnapshot } from "../utils/teamStorage";

const untitledNames = new Set(["Untitled Team", "이름 없는 팀"]);

type TeamDraftOptions = {
  team: TeamSlot[];
  bench: BenchPokemon[];
  buildState: TeamBuildState;
  battleFormat: BattleFormat;
  activeSavedTeamId: string | null;
  untitledName: string;
};

export function useTeamDraft({ team, bench, buildState, battleFormat, activeSavedTeamId, untitledName }: TeamDraftOptions) {
  const [teamName, setTeamName] = useState(untitledName);
  const [teamNameDraft, setTeamNameDraft] = useState(untitledName);
  const baseline = useRef<string | null>(null);

  const setCommittedSnapshot = useCallback((snapshot: TeamSnapshot | null) => {
    baseline.current = snapshot ? serializeTeamSnapshot(snapshot) : null;
  }, []);

  const renameCommittedSnapshot = useCallback((name: string) => {
    if (baseline.current === null) return;
    // The fingerprint is normalized comparison data, not a persisted TeamSnapshot.
    const fingerprint = JSON.parse(baseline.current) as { name: string };
    fingerprint.name = name;
    baseline.current = JSON.stringify(fingerprint);
  }, []);

  useEffect(() => {
    if (activeSavedTeamId || !untitledNames.has(teamName) || !untitledNames.has(teamNameDraft) || teamName === untitledName) return;
    setTeamName(untitledName);
    setTeamNameDraft(untitledName);
    renameCommittedSnapshot(untitledName);
  }, [activeSavedTeamId, teamName, teamNameDraft, untitledName, renameCommittedSnapshot]);

  function getCurrentTeamSnapshot(name = teamNameDraft): TeamSnapshot {
    return {
      name: name.trim() || untitledName,
      battleFormat,
      slots: team.map(createSavedSlot),
      bench: bench.map(createSavedBenchPokemon),
      buildState,
    };
  }

  function commitTeamName() {
    const name = teamNameDraft.trim() || untitledName;
    setTeamName(name);
    setTeamNameDraft(name);
    return name;
  }

  return {
    teamName, setTeamName, teamNameDraft, setTeamNameDraft, commitTeamName,
    getCurrentTeamSnapshot, setCommittedSnapshot, renameCommittedSnapshot,
    markCurrentTeamCommitted: (name = teamNameDraft) => setCommittedSnapshot(getCurrentTeamSnapshot(name)),
    hasUnsavedTeamChanges: () => baseline.current !== null && serializeTeamSnapshot(getCurrentTeamSnapshot()) !== baseline.current,
  };
}
