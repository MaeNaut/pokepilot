import { defaultEvs } from "../data/natures";
import { canAddBenchPokemon } from "../data/teamLimits";
import {
  clearBuildStateSlot,
  patchBuildStateSlot,
  type TeamBuildState,
} from "./teamBuildState";
import type { PokemonItem, StatBlock, TeamMember, TeamSlot } from "../types";

export type PokemonBuildSnapshot = {
  item: PokemonItem | null;
  ability: string;
  nature: string;
  evs: StatBlock;
  moveIds: string[];
  preMegaPokemon: string;
};

export type BenchPokemon = {
  id: string;
  member: TeamMember;
  build: PokemonBuildSnapshot;
};

type BenchState = {
  team: TeamSlot[];
  bench: BenchPokemon[];
  buildState: TeamBuildState;
};

export function getPokemonBuildSnapshot(
  member: TeamMember,
  buildState: TeamBuildState,
  slotIndex: number,
): PokemonBuildSnapshot {
  return {
    item: buildState.itemBySlot[slotIndex] ?? null,
    ability: buildState.abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? "",
    nature: buildState.natureBySlot[slotIndex] ?? "hardy",
    evs: { ...(buildState.evsBySlot[slotIndex] ?? defaultEvs) },
    moveIds: [
      ...(buildState.moveIdsBySlot[slotIndex] ??
        member.moves?.slice(0, 4).map((move) => move.id) ??
        []),
    ],
    preMegaPokemon: buildState.preMegaPokemonBySlot[slotIndex] ?? "",
  };
}

export function moveTeamPokemonToBench(
  state: BenchState,
  slotIndex: number,
  benchId: string,
): BenchState {
  const member = state.team[slotIndex];

  if (!member || !canAddBenchPokemon(state.bench.length)) {
    return state;
  }

  const nextTeam = [...state.team];
  nextTeam[slotIndex] = null;

  return {
    team: nextTeam,
    bench: [
      ...state.bench,
      {
        id: benchId,
        member,
        build: getPokemonBuildSnapshot(member, state.buildState, slotIndex),
      },
    ],
    buildState: clearBuildStateSlot(state.buildState, slotIndex),
  };
}

export function moveBenchPokemonToTeam(
  state: BenchState,
  benchIndex: number,
  slotIndex: number,
  replacementBenchId: string,
): BenchState {
  const benchPokemon = state.bench[benchIndex];

  if (!benchPokemon) {
    return state;
  }

  const displacedMember = state.team[slotIndex];
  const nextTeam = [...state.team];
  const nextBench = [...state.bench];
  const nextBuildState = patchBuildStateSlot(state.buildState, slotIndex, {
    ...benchPokemon.build,
    evs: { ...benchPokemon.build.evs },
    moveIds: [...benchPokemon.build.moveIds],
    candidateFilters: null,
  });

  nextTeam[slotIndex] = benchPokemon.member;

  if (displacedMember) {
    nextBench[benchIndex] = {
      id: replacementBenchId,
      member: displacedMember,
      build: getPokemonBuildSnapshot(displacedMember, state.buildState, slotIndex),
    };
  } else {
    nextBench.splice(benchIndex, 1);
  }

  return {
    team: nextTeam,
    bench: nextBench,
    buildState: nextBuildState,
  };
}
