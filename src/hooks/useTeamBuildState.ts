import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  PokemonCandidateFilters,
  PokemonItem,
  StatBlock,
} from "../types";
import {
  clearBuildStateSlot,
  createEmptyBuildState,
  normalizeBuildState,
  patchBuildStateSlot,
  reorderBuildStateSlots,
  replaceBuildStateField,
  type TeamBuildState,
  type TeamSlotBuildPatch,
} from "../utils/teamBuildState";

export type { TeamBuildState, TeamSlotBuildPatch } from "../utils/teamBuildState";

export type TeamBuildStateController = TeamBuildState & {
  setItemBySlot: Dispatch<SetStateAction<Record<number, PokemonItem | null>>>;
  setAbilityBySlot: Dispatch<SetStateAction<Record<number, string>>>;
  setNatureBySlot: Dispatch<SetStateAction<Record<number, string>>>;
  setEvsBySlot: Dispatch<SetStateAction<Record<number, StatBlock>>>;
  setMoveIdsBySlot: Dispatch<SetStateAction<Record<number, string[]>>>;
  setPreMegaPokemonBySlot: Dispatch<SetStateAction<Record<number, string>>>;
  setCandidateFiltersBySlot: Dispatch<
    SetStateAction<Record<number, PokemonCandidateFilters>>
  >;
  clearSlot: (slotIndex: number) => void;
  patchSlot: (slotIndex: number, patch: TeamSlotBuildPatch) => void;
  reorderSlots: (sourceIndex: number, targetIndex: number) => void;
  replaceBuildState: (state?: Partial<TeamBuildState>) => void;
  getBuildStateSnapshot: () => TeamBuildState;
};

function resolveStateAction<T>(action: SetStateAction<T>, current: T) {
  return typeof action === "function"
    ? (action as (previous: T) => T)(current)
    : action;
}

function createFieldSetter<K extends keyof TeamBuildState>(
  setBuildState: Dispatch<SetStateAction<TeamBuildState>>,
  field: K,
): Dispatch<SetStateAction<TeamBuildState[K]>> {
  return (action) => {
    setBuildState((current) =>
      replaceBuildStateField(
        current,
        field,
        resolveStateAction(action, current[field]),
      ),
    );
  };
}

export function useTeamBuildState(): TeamBuildStateController {
  const [buildState, setBuildState] = useState(createEmptyBuildState);
  const fieldSetters = useMemo(
    () => ({
      setItemBySlot: createFieldSetter(setBuildState, "itemBySlot"),
      setAbilityBySlot: createFieldSetter(setBuildState, "abilityBySlot"),
      setNatureBySlot: createFieldSetter(setBuildState, "natureBySlot"),
      setEvsBySlot: createFieldSetter(setBuildState, "evsBySlot"),
      setMoveIdsBySlot: createFieldSetter(setBuildState, "moveIdsBySlot"),
      setPreMegaPokemonBySlot: createFieldSetter(
        setBuildState,
        "preMegaPokemonBySlot",
      ),
      setCandidateFiltersBySlot: createFieldSetter(
        setBuildState,
        "candidateFiltersBySlot",
      ),
    }),
    [],
  );

  const clearSlot = useCallback((slotIndex: number) => {
    setBuildState((current) => clearBuildStateSlot(current, slotIndex));
  }, []);

  const patchSlot = useCallback(
    (slotIndex: number, patch: TeamSlotBuildPatch) => {
      setBuildState((current) => patchBuildStateSlot(current, slotIndex, patch));
    },
    [],
  );

  const reorderSlots = useCallback((sourceIndex: number, targetIndex: number) => {
    setBuildState((current) =>
      reorderBuildStateSlots(current, sourceIndex, targetIndex),
    );
  }, []);

  const replaceBuildState = useCallback((state?: Partial<TeamBuildState>) => {
    setBuildState(normalizeBuildState(state));
  }, []);

  const getBuildStateSnapshot = useCallback(() => buildState, [buildState]);

  return {
    ...buildState,
    ...fieldSetters,
    clearSlot,
    patchSlot,
    reorderSlots,
    replaceBuildState,
    getBuildStateSnapshot,
  };
}
