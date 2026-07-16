import type {
  PokemonCandidateFilters,
  PokemonItem,
  StatBlock,
} from "../types";
import {
  hasPokemonCandidateFilters,
  normalizePokemonCandidateFilters,
} from "./pokemonCandidateFilters";

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

export function createEmptyBuildState(): TeamBuildState {
  return {
    itemBySlot: {},
    abilityBySlot: {},
    natureBySlot: {},
    evsBySlot: {},
    moveIdsBySlot: {},
    preMegaPokemonBySlot: {},
    candidateFiltersBySlot: {},
  };
}

export function replaceBuildStateField<K extends keyof TeamBuildState>(
  state: TeamBuildState,
  field: K,
  value: TeamBuildState[K],
): TeamBuildState {
  return Object.is(state[field], value) ? state : { ...state, [field]: value };
}

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
  return value === null || value === undefined
    ? withoutSlot(record, slotIndex)
    : { ...record, [slotIndex]: value };
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

export function normalizeBuildState(
  state?: Partial<TeamBuildState>,
): TeamBuildState {
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

export function clearBuildStateSlot(
  state: TeamBuildState,
  slotIndex: number,
): TeamBuildState {
  return {
    itemBySlot: withoutSlot(state.itemBySlot, slotIndex),
    abilityBySlot: withoutSlot(state.abilityBySlot, slotIndex),
    natureBySlot: withoutSlot(state.natureBySlot, slotIndex),
    evsBySlot: withoutSlot(state.evsBySlot, slotIndex),
    moveIdsBySlot: withoutSlot(state.moveIdsBySlot, slotIndex),
    preMegaPokemonBySlot: withoutSlot(state.preMegaPokemonBySlot, slotIndex),
    candidateFiltersBySlot: withoutSlot(
      state.candidateFiltersBySlot,
      slotIndex,
    ),
  };
}

export function patchBuildStateSlot(
  state: TeamBuildState,
  slotIndex: number,
  patch: TeamSlotBuildPatch,
): TeamBuildState {
  const nextState = { ...state };

  if (Object.prototype.hasOwnProperty.call(patch, "item")) {
    nextState.itemBySlot = {
      ...state.itemBySlot,
      [slotIndex]: patch.item ?? null,
    };
  }

  if (Object.prototype.hasOwnProperty.call(patch, "ability")) {
    nextState.abilityBySlot = withSlotValue(
      state.abilityBySlot,
      slotIndex,
      patch.ability,
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "nature")) {
    nextState.natureBySlot = withSlotValue(
      state.natureBySlot,
      slotIndex,
      patch.nature,
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "evs")) {
    nextState.evsBySlot = withSlotValue(state.evsBySlot, slotIndex, patch.evs);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "moveIds")) {
    nextState.moveIdsBySlot = withSlotValue(
      state.moveIdsBySlot,
      slotIndex,
      patch.moveIds,
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "preMegaPokemon")) {
    nextState.preMegaPokemonBySlot = withSlotValue(
      state.preMegaPokemonBySlot,
      slotIndex,
      patch.preMegaPokemon,
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "candidateFilters")) {
    const normalized = normalizePokemonCandidateFilters(patch.candidateFilters);
    nextState.candidateFiltersBySlot = hasPokemonCandidateFilters(normalized)
      ? { ...state.candidateFiltersBySlot, [slotIndex]: normalized }
      : withoutSlot(state.candidateFiltersBySlot, slotIndex);
  }

  return nextState;
}

export function reorderBuildStateSlots(
  state: TeamBuildState,
  sourceIndex: number,
  targetIndex: number,
): TeamBuildState {
  if (sourceIndex === targetIndex) {
    return state;
  }

  return {
    itemBySlot: swapSlotRecord(state.itemBySlot, sourceIndex, targetIndex),
    abilityBySlot: swapSlotRecord(state.abilityBySlot, sourceIndex, targetIndex),
    natureBySlot: swapSlotRecord(state.natureBySlot, sourceIndex, targetIndex),
    evsBySlot: swapSlotRecord(state.evsBySlot, sourceIndex, targetIndex),
    moveIdsBySlot: swapSlotRecord(state.moveIdsBySlot, sourceIndex, targetIndex),
    preMegaPokemonBySlot: swapSlotRecord(
      state.preMegaPokemonBySlot,
      sourceIndex,
      targetIndex,
    ),
    candidateFiltersBySlot: swapSlotRecord(
      state.candidateFiltersBySlot,
      sourceIndex,
      targetIndex,
    ),
  };
}
