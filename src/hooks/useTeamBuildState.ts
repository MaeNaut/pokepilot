import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  PokemonCandidateFilters,
  PokemonItem,
  StatBlock,
} from "../types";
import {
  hasPokemonCandidateFilters,
  normalizePokemonCandidateFilters,
} from "../utils/pokemonCandidateFilters";

export type TeamBuildState = {
  itemBySlot: Record<number, PokemonItem | null>;
  abilityBySlot: Record<number, string>;
  natureBySlot: Record<number, string>;
  evsBySlot: Record<number, StatBlock>;
  moveIdsBySlot: Record<number, string[]>;
  preMegaPokemonBySlot: Record<number, string>;
  candidateFiltersBySlot: Record<number, PokemonCandidateFilters>;
};

export type TeamSlotBuildPatch = {
  item?: PokemonItem | null;
  ability?: string | null;
  nature?: string | null;
  evs?: StatBlock | null;
  moveIds?: string[] | null;
  preMegaPokemon?: string | null;
  candidateFilters?: PokemonCandidateFilters | null;
};

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

const emptyBuildState: TeamBuildState = {
  itemBySlot: {},
  abilityBySlot: {},
  natureBySlot: {},
  evsBySlot: {},
  moveIdsBySlot: {},
  preMegaPokemonBySlot: {},
  candidateFiltersBySlot: {},
};

function withoutSlot<T>(record: Record<number, T>, slotIndex: number) {
  const nextRecord = { ...record };
  delete nextRecord[slotIndex];
  return nextRecord;
}

function withSlotValue<T>(
  record: Record<number, T>,
  slotIndex: number,
  value: T | null | undefined,
) {
  if (value === null || value === undefined) {
    return withoutSlot(record, slotIndex);
  }

  return {
    ...record,
    [slotIndex]: value,
  };
}

function swapSlotRecord<T>(
  record: Record<number, T>,
  sourceIndex: number,
  targetIndex: number,
) {
  const nextRecord = { ...record };
  const hasSource = Object.prototype.hasOwnProperty.call(record, sourceIndex);
  const hasTarget = Object.prototype.hasOwnProperty.call(record, targetIndex);

  if (hasTarget) {
    nextRecord[sourceIndex] = record[targetIndex];
  } else {
    delete nextRecord[sourceIndex];
  }

  if (hasSource) {
    nextRecord[targetIndex] = record[sourceIndex];
  } else {
    delete nextRecord[targetIndex];
  }

  return nextRecord;
}

function normalizeBuildState(state?: Partial<TeamBuildState>): TeamBuildState {
  return {
    itemBySlot: state?.itemBySlot ?? {},
    abilityBySlot: state?.abilityBySlot ?? {},
    natureBySlot: state?.natureBySlot ?? {},
    evsBySlot: state?.evsBySlot ?? {},
    moveIdsBySlot: state?.moveIdsBySlot ?? {},
    preMegaPokemonBySlot: state?.preMegaPokemonBySlot ?? {},
    candidateFiltersBySlot: Object.fromEntries(
      Object.entries(state?.candidateFiltersBySlot ?? {}).flatMap(
        ([slotIndex, filters]) => {
          const normalized = normalizePokemonCandidateFilters(filters);
          return hasPokemonCandidateFilters(normalized)
            ? [[Number(slotIndex), normalized]]
            : [];
        },
      ),
    ),
  };
}

export function useTeamBuildState(): TeamBuildStateController {
  const [itemBySlot, setItemBySlot] = useState<Record<number, PokemonItem | null>>({});
  const [abilityBySlot, setAbilityBySlot] = useState<Record<number, string>>({});
  const [natureBySlot, setNatureBySlot] = useState<Record<number, string>>({});
  const [evsBySlot, setEvsBySlot] = useState<Record<number, StatBlock>>({});
  const [moveIdsBySlot, setMoveIdsBySlot] = useState<Record<number, string[]>>({});
  const [preMegaPokemonBySlot, setPreMegaPokemonBySlot] = useState<Record<number, string>>({});
  const [candidateFiltersBySlot, setCandidateFiltersBySlot] = useState<
    Record<number, PokemonCandidateFilters>
  >({});

  function clearSlot(slotIndex: number) {
    setItemBySlot((current) => withoutSlot(current, slotIndex));
    setAbilityBySlot((current) => withoutSlot(current, slotIndex));
    setNatureBySlot((current) => withoutSlot(current, slotIndex));
    setEvsBySlot((current) => withoutSlot(current, slotIndex));
    setMoveIdsBySlot((current) => withoutSlot(current, slotIndex));
    setPreMegaPokemonBySlot((current) => withoutSlot(current, slotIndex));
    setCandidateFiltersBySlot((current) => withoutSlot(current, slotIndex));
  }

  function patchSlot(slotIndex: number, patch: TeamSlotBuildPatch) {
    if (Object.prototype.hasOwnProperty.call(patch, "item")) {
      setItemBySlot((current) => ({ ...current, [slotIndex]: patch.item ?? null }));
    }

    if (Object.prototype.hasOwnProperty.call(patch, "ability")) {
      setAbilityBySlot((current) => withSlotValue(current, slotIndex, patch.ability));
    }

    if (Object.prototype.hasOwnProperty.call(patch, "nature")) {
      setNatureBySlot((current) => withSlotValue(current, slotIndex, patch.nature));
    }

    if (Object.prototype.hasOwnProperty.call(patch, "evs")) {
      setEvsBySlot((current) => withSlotValue(current, slotIndex, patch.evs));
    }

    if (Object.prototype.hasOwnProperty.call(patch, "moveIds")) {
      setMoveIdsBySlot((current) => withSlotValue(current, slotIndex, patch.moveIds));
    }

    if (Object.prototype.hasOwnProperty.call(patch, "preMegaPokemon")) {
      setPreMegaPokemonBySlot((current) =>
        withSlotValue(current, slotIndex, patch.preMegaPokemon),
      );
    }

    if (Object.prototype.hasOwnProperty.call(patch, "candidateFilters")) {
      const normalized = normalizePokemonCandidateFilters(patch.candidateFilters);
      setCandidateFiltersBySlot((current) =>
        hasPokemonCandidateFilters(normalized)
          ? { ...current, [slotIndex]: normalized }
          : withoutSlot(current, slotIndex),
      );
    }
  }

  function reorderSlots(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    const swapRecord = <T,>(record: Record<number, T>) =>
      swapSlotRecord(record, sourceIndex, targetIndex);

    setItemBySlot(swapRecord);
    setAbilityBySlot(swapRecord);
    setNatureBySlot(swapRecord);
    setEvsBySlot(swapRecord);
    setMoveIdsBySlot(swapRecord);
    setPreMegaPokemonBySlot(swapRecord);
    setCandidateFiltersBySlot(swapRecord);
  }

  function replaceBuildState(state?: Partial<TeamBuildState>) {
    const nextState = normalizeBuildState(state ?? emptyBuildState);

    setItemBySlot(nextState.itemBySlot);
    setAbilityBySlot(nextState.abilityBySlot);
    setNatureBySlot(nextState.natureBySlot);
    setEvsBySlot(nextState.evsBySlot);
    setMoveIdsBySlot(nextState.moveIdsBySlot);
    setPreMegaPokemonBySlot(nextState.preMegaPokemonBySlot);
    setCandidateFiltersBySlot(nextState.candidateFiltersBySlot);
  }

  function getBuildStateSnapshot(): TeamBuildState {
    return {
      itemBySlot,
      abilityBySlot,
      natureBySlot,
      evsBySlot,
      moveIdsBySlot,
      preMegaPokemonBySlot,
      candidateFiltersBySlot,
    };
  }

  return {
    itemBySlot,
    abilityBySlot,
    natureBySlot,
    evsBySlot,
    moveIdsBySlot,
    preMegaPokemonBySlot,
    candidateFiltersBySlot,
    setItemBySlot,
    setAbilityBySlot,
    setNatureBySlot,
    setEvsBySlot,
    setMoveIdsBySlot,
    setPreMegaPokemonBySlot,
    setCandidateFiltersBySlot,
    clearSlot,
    patchSlot,
    reorderSlots,
    replaceBuildState,
    getBuildStateSnapshot,
  };
}
