import { describe, expect, it } from "vitest";
import { MAX_BENCH_POKEMON } from "../data/teamLimits";
import { defaultEvs } from "../data/natures";
import type { TeamBuildState } from "./teamBuildState";
import type { TeamMember } from "../types";
import {
  moveBenchPokemonToTeam,
  moveTeamPokemonToBench,
  getPokemonBuildSnapshot,
  type BenchPokemon,
} from "./benchPokemon";

const emptyBuildState: TeamBuildState = {
  itemBySlot: {},
  abilityBySlot: {},
  natureBySlot: {},
  evsBySlot: {},
  moveIdsBySlot: {},
  preMegaPokemonBySlot: {},
  candidateFiltersBySlot: {},
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
  it("round-trips a complete build and clears only the source slot", () => {
    const scizor = member("scizor-mega");
    const buildState: TeamBuildState = {
      itemBySlot: { 0: { id: "scizorite", name: "Scizorite" }, 1: null },
      abilityBySlot: { 0: "Technician", 1: "Intimidate" },
      natureBySlot: { 0: "adamant", 1: "careful" },
      evsBySlot: { 0: { ...defaultEvs, hp: 32, attack: 32 }, 1: { ...defaultEvs } },
      moveIdsBySlot: { 0: ["bug-bite", "", "protect", ""], 1: ["fake-out"] },
      preMegaPokemonBySlot: { 0: "scizor", 1: "" },
      candidateFiltersBySlot: {
        0: { types: ["bug"], ability: null, moves: [] },
        1: { types: ["dark"], ability: null, moves: [] },
      },
    };
    const original = { team: [scizor, member("incineroar")], bench: [], buildState };
    const before = structuredClone(original);
    const benched = moveTeamPokemonToBench(original, 0, "bench-scizor");
    for (const field of Object.keys(buildState) as Array<keyof TeamBuildState>) {
      expect(benched.buildState[field]).not.toHaveProperty("0");
      expect(benched.buildState[field][1]).toBe(buildState[field][1]);
    }
    const restored = moveBenchPokemonToTeam(benched, 0, 0, "unused");
    expect(restored.team).toEqual(original.team);
    expect(restored.bench).toEqual([]);
    expect(restored.buildState).toEqual({
      ...buildState,
      candidateFiltersBySlot: { 1: buildState.candidateFiltersBySlot[1] },
    });
    expect(original).toEqual(before);
  });

  it("copies EV and move arrays both into and out of the bench", () => {
    const pokemon = member("scizor");
    const buildState: TeamBuildState = {
      ...emptyBuildState,
      evsBySlot: { 0: { ...defaultEvs, hp: 32 } },
      moveIdsBySlot: { 0: ["bug-bite", ""] },
    };
    const benched = moveTeamPokemonToBench({ team: [pokemon], bench: [], buildState }, 0, "entry");
    const snapshot = benched.bench[0].build;
    expect(snapshot.evs).not.toBe(buildState.evsBySlot[0]);
    expect(snapshot.moveIds).not.toBe(buildState.moveIdsBySlot[0]);
    const restored = moveBenchPokemonToTeam(benched, 0, 0, "unused");
    expect(restored.buildState.evsBySlot[0]).not.toBe(snapshot.evs);
    expect(restored.buildState.moveIdsBySlot[0]).not.toBe(snapshot.moveIds);
    restored.buildState.evsBySlot[0].hp = 0;
    restored.buildState.moveIdsBySlot[0][0] = "protect";
    expect(snapshot.evs.hp).toBe(32);
    expect(snapshot.moveIds[0]).toBe("bug-bite");
    expect(buildState.evsBySlot[0].hp).toBe(32);
  });

  it("replaces old values with explicit empty build values rather than merging", () => {
    const pokemon = member("scizor");
    const emptyBuild = {
      item: null, ability: "", nature: "", evs: { ...defaultEvs },
      moveIds: ["", "", "", ""], preMegaPokemon: "",
    };
    const buildState: TeamBuildState = {
      ...emptyBuildState,
      itemBySlot: { 0: { id: "life-orb", name: "Life Orb" } },
      abilityBySlot: { 0: "Technician" },
      natureBySlot: { 0: "adamant" },
      preMegaPokemonBySlot: { 0: "scizor" },
    };
    const result = moveBenchPokemonToTeam({
      team: [pokemon], buildState,
      bench: [{ id: "entry", member: pokemon, build: emptyBuild }],
    }, 0, 0, "displaced");
    expect(getPokemonBuildSnapshot(pokemon, result.buildState, 0)).toEqual(emptyBuild);
    expect(result.buildState.itemBySlot).toHaveProperty("0", null);
    expect(result.buildState.preMegaPokemonBySlot).toHaveProperty("0", "");
    expect(result.bench[0].build.ability).toBe("Technician");
  });

  it("allows an occupied-slot swap even when the bench is full", () => {
    const active = member("incineroar");
    const incoming = member("scizor");
    const bench = Array.from({ length: MAX_BENCH_POKEMON }, (_, i) => ({
      id: `entry-${i}`, member: incoming,
      build: getPokemonBuildSnapshot(incoming, emptyBuildState, 0),
    }));
    const result = moveBenchPokemonToTeam({ team: [active], bench, buildState: emptyBuildState }, 0, 0, "displaced");
    expect(result.bench).toHaveLength(MAX_BENCH_POKEMON);
    expect(result.bench[0].member).toBe(active);
    expect(result.team[0]).toBe(incoming);
    expect(result.bench[1]).toBe(bench[1]);
  });

  it("leaves state untouched when the source team or bench entry is absent", () => {
    const state = { team: [null], bench: [], buildState: emptyBuildState };
    expect(moveTeamPokemonToBench(state, 0, "unused")).toBe(state);
    expect(moveBenchPokemonToTeam(state, 0, 0, "unused")).toBe(state);
  });

  it("uses member defaults only for absent build fields", () => {
    const pokemon = member("scizor");
    const fallback = getPokemonBuildSnapshot(pokemon, emptyBuildState, 0);
    expect(fallback.ability).toBe("scizor ability");
    expect(fallback.nature).toBe("hardy");
    expect(fallback.evs).toEqual(defaultEvs);
    expect(fallback.evs).not.toBe(defaultEvs);
    expect(getPokemonBuildSnapshot(pokemon, {
      ...emptyBuildState, abilityBySlot: { 0: "" }, moveIdsBySlot: { 0: [""] },
    }, 0)).toMatchObject({ ability: "", moveIds: [""] });
  });

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
      {
        team: [null],
        bench,
        buildState: {
          ...emptyBuildState,
          candidateFiltersBySlot: {
            0: { types: ["fire"], ability: null, moves: [] },
          },
        },
      },
      0,
      0,
      "unused",
    );

    expect(state.team[0]).toBe(charizard);
    expect(state.bench).toEqual([]);
    expect(state.buildState.abilityBySlot[0]).toBe("Blaze");
    expect(state.buildState.candidateFiltersBySlot).toEqual({});
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
