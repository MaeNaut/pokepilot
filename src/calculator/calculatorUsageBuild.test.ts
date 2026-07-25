import { describe, expect, it } from "vitest";
import type { SmogonUsageSet } from "../api/smogonUsage";
import type { PokemonItem, PokemonMove, TeamMember } from "../types";
import {
  createDefaultCalculatorBuild,
  createUsageCalculatorBuild,
} from "./calculatorUsageBuild";

const moves: PokemonMove[] = [
  {
    id: "fake-out",
    name: "Fake Out",
    type: "normal",
    category: "Physical",
    power: 40,
    accuracy: 100,
    pp: 10,
    description: "",
  },
  {
    id: "flare-blitz",
    name: "Flare Blitz",
    type: "fire",
    category: "Physical",
    power: 120,
    accuracy: 100,
    pp: 15,
    description: "",
  },
  {
    id: "protect",
    name: "Protect",
    type: "normal",
    category: "Status",
    power: null,
    accuracy: null,
    pp: 10,
    description: "",
  },
];

const member: TeamMember = {
  id: "incineroar",
  name: "Incineroar",
  types: ["fire", "dark"],
  roles: [],
  abilities: ["Blaze", "Intimidate"],
  moves,
};

const item: PokemonItem = {
  id: "sitrus-berry",
  name: "Sitrus Berry",
};

const usageSet: SmogonUsageSet = {
  pokemonId: "incineroar",
  pokemonName: "Incineroar",
  sourceMonth: "2026-06",
  cutoff: 1630,
  ability: "Intimidate",
  itemName: "Sitrus Berry",
  nature: "Careful",
  evs: {
    hp: 32,
    attack: 32,
    defense: 32,
  },
  moveIds: ["fakeout", "protect", "missingmove", "flareblitz"],
};

describe("calculator usage builds", () => {
  it("applies the popular item, ability, nature, EVs, and resolved moves", () => {
    expect(createUsageCalculatorBuild(member, usageSet, item)).toEqual({
      item,
      ability: "Intimidate",
      natureId: "careful",
      evs: {
        hp: 32,
        attack: 32,
        defense: 2,
        specialAttack: 0,
        specialDefense: 0,
        speed: 0,
      },
      moveIds: ["fake-out", "protect", "flare-blitz", ""],
    });
  });

  it("uses the old defaults only when no popular set is available", () => {
    expect(createDefaultCalculatorBuild(member)).toMatchObject({
      item: null,
      ability: "Blaze",
      natureId: "hardy",
      moveIds: ["fake-out", "flare-blitz", "", ""],
    });
  });
});
