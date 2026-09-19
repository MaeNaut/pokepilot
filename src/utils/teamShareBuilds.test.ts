import { describe, expect, it } from "vitest";
import type { PokemonIndexEntry, PokemonMove, TeamMember } from "../types";
import { createEmptyBuildState } from "./teamBuildState";
import { createShareMoveCatalog, createTeamShareBuilds, resolveShareMoves } from "./teamShareBuilds";

const move: PokemonMove = {
  id: "earthquake", name: "Earthquake", type: "ground", power: 100,
  accuracy: 100, pp: 10, description: "Ground move",
};
const member: TeamMember = {
  id: "garchomp", name: "Garchomp", types: ["dragon", "ground"], roles: [],
  moves: [move], abilities: ["Rough Skin"],
};

function build(options: Partial<Parameters<typeof createTeamShareBuilds>[0]> = {}) {
  return createTeamShareBuilds({
    team: [member, null],
    buildState: createEmptyBuildState(),
    pokemonIndexByName: new Map(),
    selectedSlot: 0,
    selectedMoves: [move, null, null, null],
    shareMoveCatalog: new Map(),
    getMemberDisplayName: (pokemon) => pokemon.name,
    localization: {
      pokemonName: (value) => value.fallback,
      gameName: (_category, _id, fallback) => fallback,
      t: (key) => key,
    },
    ...options,
  });
}

describe("team share model", () => {
  it("preserves empty slots and active editor moves", () => {
    const selected = [null, move, null, null];
    const result = build({ selectedMoves: selected });
    expect(result[1]).toBeNull();
    expect(result[0]?.moves).toBe(selected);
    expect(result[0]?.ability).toBe("Rough Skin");
  });

  it("preserves selected builds without modifying team state", () => {
    const state = createEmptyBuildState();
    state.abilityBySlot[0] = "Sand Veil";
    state.natureBySlot[0] = "jolly";
    state.itemBySlot[0] = { id: "leftovers", name: "Leftovers" };
    const before = JSON.stringify(state);
    const result = build({ buildState: state });
    expect(result[0]?.ability).toBe("Sand Veil");
    expect(result[0]?.nature.id).toBe("jolly");
    expect(result[0]?.item?.id).toBe("leftovers");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("preserves explicit empty move slots rather than filling defaults", () => {
    expect(resolveShareMoves(member, [""], new Map())).toEqual([null, null, null, null]);
    expect(resolveShareMoves(member, undefined, new Map())[0]).toBe(move);
  });

  it("uses a member's move before catalog data and falls back for unknown moves", () => {
    const catalog = createShareMoveCatalog([member], { base: [{ ...move, power: 50 }] });
    expect(catalog.get("earthquake")?.power).toBe(50);
    const result = resolveShareMoves(member, ["Earthquake", "unknown-move"], catalog);
    expect(result[0]).toBe(move);
    expect(result[1]).toMatchObject({ id: "unknown-move", power: null });
  });

  it("resolves inactive team slots from selected IDs", () => {
    const state = createEmptyBuildState();
    state.moveIdsBySlot[1] = ["", "earthquake"];
    const result = build({ team: [member, member], buildState: state });
    expect(result[1]?.moves).toEqual([null, move, null, null]);
  });

  it("retains Mega labels when index data is unavailable", () => {
    const result = build({ team: [{ ...member, id: "garchomp-mega" }] });
    expect(result[0]?.formLabel).toBe("Mega");
  });

  it("retains the existing Pyroar full-name exception", () => {
    const entry: PokemonIndexEntry = {
      name: "pyroar", showdownId: "pyroar", displayName: "Pyroar", speciesKey: "pyroar",
      sortNumber: 668, types: ["fire", "normal"], abilities: [], formKind: "gender",
      formLabel: "Male", isSelectorOption: true,
    };
    let includesForm: boolean | undefined;
    const result = build({
      team: [{ ...member, id: "pyroar", name: "Pyroar" }],
      pokemonIndexByName: new Map([["pyroar", entry]]),
      localization: {
        pokemonName: (value) => { includesForm = value.includeForm; return value.fallback; },
        gameName: (_category, _id, fallback) => fallback,
        t: (key) => key,
      },
    });
    expect(includesForm).toBe(false);
    expect(result[0]?.member.id).toBe("pyroar");
  });
});
