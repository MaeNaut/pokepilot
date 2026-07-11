import { describe, expect, it } from "vitest";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type { TeamBuildState } from "../hooks/useTeamBuildState";
import type { ItemIndexEntry, PokemonIndexEntry, TeamMember } from "../types";
import { validateTeam } from "./teamValidity";

function createMember(id = "charizard"): TeamMember {
  return {
    id,
    name: id,
    types: ["fire", "flying"],
    roles: [],
    abilities: ["Blaze"],
    moves: [
      {
        id: "flamethrower",
        name: "Flamethrower",
        type: "fire",
        category: "special",
        power: 90,
        accuracy: 100,
        pp: 15,
        description: "",
      },
    ],
  };
}

function createSnapshot(
  overrides: Partial<ShowdownLegalitySnapshot> = {},
): ShowdownLegalitySnapshot {
  return {
    pokemonIds: new Set(["charizard"]),
    knownPokemonIds: new Set(["charizard"]),
    itemIds: new Set(["leftovers", "charizarditey"]),
    abilityByPokemon: new Map([["charizard", new Set(["blaze"])]]),
    moveByPokemon: new Map([["charizard", new Set(["flamethrower"])]]),
    loadedFormatId: "gen9-regulation-mb",
    dataMod: "champions",
    generatedAt: 1,
    source: "showdown",
    ...overrides,
  };
}

function createBuildState(overrides: Partial<TeamBuildState> = {}): TeamBuildState {
  return {
    itemBySlot: {},
    abilityBySlot: { 0: "Blaze" },
    natureBySlot: { 0: "modest" },
    evsBySlot: {},
    moveIdsBySlot: { 0: ["flamethrower"] },
    preMegaPokemonBySlot: {},
    ...overrides,
  };
}

const pokemonIndex: PokemonIndexEntry[] = [
  {
    id: 6,
    name: "charizard",
    displayName: "Charizard",
    url: "",
    speciesKey: "charizard",
    sortNumber: 6,
    formKind: "base",
    isSelectorOption: true,
    cacheVersion: 1,
  },
  {
    id: 10006,
    name: "charizard-mega-y",
    displayName: "Charizard Mega Y",
    url: "",
    speciesKey: "charizard",
    sortNumber: 6,
    formKind: "mega",
    formLabel: "Mega Y",
    isSelectorOption: false,
    cacheVersion: 1,
  },
];

const itemIndex: ItemIndexEntry[] = [
  {
    id: 1,
    name: "charizardite-y",
    displayName: "Charizardite Y",
    url: "",
    isMegaStone: true,
  },
];

describe("team validity", () => {
  it("accepts a legal partial set without requiring an item or four moves", () => {
    const result = validateTeam(
      [createMember("charizard"), null, null, null, null, null],
      createBuildState(),
      createSnapshot(),
      pokemonIndex,
      itemIndex,
    );

    expect(result.status).toBe("valid");
    expect(result.errorCount).toBe(0);
  });

  it("reports illegal choices, duplicate moves, and invalid EV totals", () => {
    const snapshot = createSnapshot({
      pokemonIds: new Set(["pikachu"]),
      knownPokemonIds: new Set(["charizard", "pikachu"]),
    });
    const result = validateTeam(
      [createMember("charizard")],
      createBuildState({
        itemBySlot: { 0: { id: "choice-band", name: "Choice Band" } },
        abilityBySlot: { 0: "Solar Power" },
        evsBySlot: {
          0: {
            hp: 3,
            attack: 33,
            defense: 0,
            specialAttack: 31,
            specialDefense: 0,
            speed: 0,
          },
        },
        moveIdsBySlot: { 0: ["flamethrower", "flamethrower", "surf"] },
      }),
      snapshot,
      pokemonIndex,
      itemIndex,
    );
    const issueIds = result.slotResults[0].issues.map((issue) => issue.id);

    expect(result.status).toBe("invalid");
    expect(issueIds).toEqual(
      expect.arrayContaining([
        "illegal-pokemon-0",
        "illegal-item-0",
        "illegal-ability-0",
        "duplicate-moves-0",
        "illegal-move-surf-0",
        "ev-attack-0",
        "ev-total-0",
      ]),
    );
  });

  it("requires the matching stone for an active Mega form", () => {
    const megaSnapshot = createSnapshot({
      pokemonIds: new Set(["charizardmegay"]),
      knownPokemonIds: new Set(["charizardmegay"]),
      abilityByPokemon: new Map([["charizardmegay", new Set(["drought"])]]),
      moveByPokemon: new Map([["charizardmegay", new Set(["flamethrower"])]]),
    });
    const result = validateTeam(
      [createMember("charizard-mega-y")],
      createBuildState({ abilityBySlot: { 0: "Drought" } }),
      megaSnapshot,
      pokemonIndex,
      itemIndex,
    );

    expect(result.slotResults[0].issues.some((issue) => issue.id === "mega-stone-0")).toBe(true);
  });

  it("accepts the matching Mega Stone and a move inherited from the pre-Mega form", () => {
    const megaSnapshot = createSnapshot({
      pokemonIds: new Set(["charizard", "charizardmegay"]),
      knownPokemonIds: new Set(["charizard", "charizardmegay"]),
      abilityByPokemon: new Map([
        ["charizard", new Set(["blaze"])],
        ["charizardmegay", new Set(["drought"])],
      ]),
      moveByPokemon: new Map([
        ["charizard", new Set(["flamethrower", "roost"])],
        ["charizardmegay", new Set(["flamethrower"])],
      ]),
    });
    const result = validateTeam(
      [createMember("charizard-mega-y")],
      createBuildState({
        itemBySlot: { 0: { id: "charizardite-y", name: "Charizardite Y" } },
        abilityBySlot: { 0: "Drought" },
        moveIdsBySlot: { 0: ["roost"] },
        preMegaPokemonBySlot: { 0: "charizard" },
      }),
      megaSnapshot,
      pokemonIndex,
      itemIndex,
    );

    expect(result.status).toBe("valid");
  });

  it("applies Species Clause and Item Clause across the team", () => {
    const secondMember = { ...createMember("charizard-mega-y"), name: "Charizard Mega Y" };
    const result = validateTeam(
      [createMember(), secondMember],
      createBuildState({
        itemBySlot: {
          0: { id: "leftovers", name: "Leftovers" },
          1: { id: "leftovers", name: "Leftovers" },
        },
        abilityBySlot: { 0: "Blaze", 1: "Drought" },
        moveIdsBySlot: { 0: [], 1: [] },
      }),
      createSnapshot({
        pokemonIds: new Set(["charizard", "charizardmegay"]),
        knownPokemonIds: new Set(["charizard", "charizardmegay"]),
        abilityByPokemon: new Map([
          ["charizard", new Set(["blaze"])],
          ["charizardmegay", new Set(["drought"])],
        ]),
      }),
      pokemonIndex,
      itemIndex,
    );

    expect(result.teamIssues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(["duplicate-species-charizard", "duplicate-item-leftovers"]),
    );
  });

  it("reports unavailable data without declaring a legal set invalid", () => {
    const result = validateTeam(
      [createMember()],
      createBuildState(),
      null,
      pokemonIndex,
      itemIndex,
    );

    expect(result.status).toBe("unavailable");
    expect(result.errorCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
  });
});
