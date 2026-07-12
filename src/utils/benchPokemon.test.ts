import { describe, expect, it } from "vitest";
import { MAX_BENCH_POKEMON } from "../data/teamLimits";
import type { TeamBuildState } from "../hooks/useTeamBuildState";
import type { TeamMember } from "../types";
import {
  moveBenchPokemonToTeam,
  moveTeamPokemonToBench,
  type BenchPokemon,
} from "./benchPokemon";

const emptyBuildState: TeamBuildState = {
  itemBySlot: {},
  abilityBySlot: {},
  natureBySlot: {},
  evsBySlot: {},
  moveIdsBySlot: {},
  preMegaPokemonBySlot: {},
};

function member(id: string): TeamMember {
  return {
    id,
    name: id,
    types: [],
    roles: [],
    abilities: [`${id} ability`],
    moves: [],
  };
}

describe("bench Pokemon transfers", () => {
  it("moves a complete configured set from the active team to the bench", () => {
    const charizard = member("charizard");
    const state = moveTeamPokemonToBench(
      {
        team: [charizard, null],
        bench: [],
        buildState: {
          ...emptyBuildState,
          abilityBySlot: { 0: "Drought" },
          moveIdsBySlot: { 0: ["overheat", "solar-beam"] },
        },
      },
      0,
      "bench-1",
    );

    expect(state.team).toEqual([null, null]);
    expect(state.bench[0]).toMatchObject({
      id: "bench-1",
      member: charizard,
      build: {
        ability: "Drought",
        moveIds: ["overheat", "solar-beam"],
      },
    });
    expect(state.buildState.abilityBySlot).toEqual({});
    expect(state.buildState.moveIdsBySlot).toEqual({});
  });

  it("swaps a benched set with an occupied active slot", () => {
    const charizard = member("charizard");
    const swampert = member("swampert");
    const bench: BenchPokemon[] = [
      {
        id: "bench-1",
        member: charizard,
        build: {
          item: null,
          ability: "Drought",
          nature: "modest",
          evs: {
            hp: 0,
            attack: 0,
            defense: 0,
            specialAttack: 32,
            specialDefense: 2,
            speed: 32,
          },
          moveIds: ["overheat"],
          preMegaPokemon: "charizard",
        },
      },
    ];
    const state = moveBenchPokemonToTeam(
      {
        team: [swampert],
        bench,
        buildState: {
          ...emptyBuildState,
          abilityBySlot: { 0: "Torrent" },
          moveIdsBySlot: { 0: ["waterfall"] },
        },
      },
      0,
      0,
      "bench-2",
    );

    expect(state.team[0]).toBe(charizard);
    expect(state.buildState.abilityBySlot[0]).toBe("Drought");
    expect(state.buildState.moveIdsBySlot[0]).toEqual(["overheat"]);
    expect(state.bench[0]).toMatchObject({
      id: "bench-2",
      member: swampert,
      build: {
        ability: "Torrent",
        moveIds: ["waterfall"],
      },
    });
  });

  it("removes a bench entry when moving it into an empty slot", () => {
    const charizard = member("charizard");
    const bench: BenchPokemon[] = [
      {
        id: "bench-1",
        member: charizard,
        build: {
          item: null,
          ability: "Blaze",
          nature: "hardy",
          evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
          moveIds: [],
          preMegaPokemon: "",
        },
      },
    ];
    const state = moveBenchPokemonToTeam(
      { team: [null], bench, buildState: emptyBuildState },
      0,
      0,
      "unused",
    );

    expect(state.team[0]).toBe(charizard);
    expect(state.bench).toEqual([]);
    expect(state.buildState.abilityBySlot[0]).toBe("Blaze");
  });

  it("does not move another active Pokemon into a full bench", () => {
    const charizard = member("charizard");
    const bench = Array.from({ length: MAX_BENCH_POKEMON }, (_, index) => ({
      id: `bench-${index}`,
      member: member(`bench-pokemon-${index}`),
      build: {
        item: null,
        ability: "Ability",
        nature: "hardy",
        evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        moveIds: [],
        preMegaPokemon: "",
      },
    }));
    const originalState = {
      team: [charizard],
      bench,
      buildState: emptyBuildState,
    };

    expect(moveTeamPokemonToBench(originalState, 0, "overflow")).toBe(originalState);
  });
});
