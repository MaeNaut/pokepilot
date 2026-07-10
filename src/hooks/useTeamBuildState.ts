import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PokemonItem, StatBlock } from "../types";

export type TeamBuildState = {
  itemBySlot: Record<number, PokemonItem | null>;
  abilityBySlot: Record<number, string>;
  natureBySlot: Record<number, string>;
  evsBySlot: Record<number, StatBlock>;
  moveIdsBySlot: Record<number, string[]>;
  preMegaPokemonBySlot: Record<number, string>;
};

export type TeamBuildStateController = TeamBuildState & {
  setItemBySlot: Dispatch<SetStateAction<Record<number, PokemonItem | null>>>;
  setAbilityBySlot: Dispatch<SetStateAction<Record<number, string>>>;
  setNatureBySlot: Dispatch<SetStateAction<Record<number, string>>>;
  setEvsBySlot: Dispatch<SetStateAction<Record<number, StatBlock>>>;
  setMoveIdsBySlot: Dispatch<SetStateAction<Record<number, string[]>>>;
  setPreMegaPokemonBySlot: Dispatch<SetStateAction<Record<number, string>>>;
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
};

function normalizeBuildState(state?: Partial<TeamBuildState>): TeamBuildState {
  return {
    itemBySlot: state?.itemBySlot ?? {},
    abilityBySlot: state?.abilityBySlot ?? {},
    natureBySlot: state?.natureBySlot ?? {},
    evsBySlot: state?.evsBySlot ?? {},
    moveIdsBySlot: state?.moveIdsBySlot ?? {},
    preMegaPokemonBySlot: state?.preMegaPokemonBySlot ?? {},
  };
}

export function useTeamBuildState(): TeamBuildStateController {
  const [itemBySlot, setItemBySlot] = useState<Record<number, PokemonItem | null>>({});
  const [abilityBySlot, setAbilityBySlot] = useState<Record<number, string>>({});
  const [natureBySlot, setNatureBySlot] = useState<Record<number, string>>({});
  const [evsBySlot, setEvsBySlot] = useState<Record<number, StatBlock>>({});
  const [moveIdsBySlot, setMoveIdsBySlot] = useState<Record<number, string[]>>({});
  const [preMegaPokemonBySlot, setPreMegaPokemonBySlot] = useState<Record<number, string>>({});

  function replaceBuildState(state?: Partial<TeamBuildState>) {
    const nextState = normalizeBuildState(state ?? emptyBuildState);

    setItemBySlot(nextState.itemBySlot);
    setAbilityBySlot(nextState.abilityBySlot);
    setNatureBySlot(nextState.natureBySlot);
    setEvsBySlot(nextState.evsBySlot);
    setMoveIdsBySlot(nextState.moveIdsBySlot);
    setPreMegaPokemonBySlot(nextState.preMegaPokemonBySlot);
  }

  function getBuildStateSnapshot(): TeamBuildState {
    return {
      itemBySlot,
      abilityBySlot,
      natureBySlot,
      evsBySlot,
      moveIdsBySlot,
      preMegaPokemonBySlot,
    };
  }

  return {
    itemBySlot,
    abilityBySlot,
    natureBySlot,
    evsBySlot,
    moveIdsBySlot,
    preMegaPokemonBySlot,
    setItemBySlot,
    setAbilityBySlot,
    setNatureBySlot,
    setEvsBySlot,
    setMoveIdsBySlot,
    setPreMegaPokemonBySlot,
    replaceBuildState,
    getBuildStateSnapshot,
  };
}
