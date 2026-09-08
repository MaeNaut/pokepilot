import { describe, expect, it } from "vitest";
import type { SmogonUsageSet } from "../api/smogonUsage";
import type {
  ItemIndexEntry,
  PokemonItem,
  PokemonMove,
  TeamMember,
} from "../types";
import {
  createDefaultCalculatorBuild,
  createUsageCalculatorBuild,
  resolveUsageCalculatorItems,
  resolveUsageCalculatorMoves,
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

  it("resolves more usage moves for analysis without changing the four-slot build", () => {
    const extraMove: PokemonMove = {
      id: "knock-off",
      name: "Knock Off",
      type: "dark",
      category: "Physical",
      power: 65,
      accuracy: 100,
      pp: 20,
      description: "",
    };
    const fifthMove: PokemonMove = {
      id: "u-turn",
      name: "U-turn",
      type: "bug",
      category: "Physical",
      power: 70,
      accuracy: 100,
      pp: 20,
      description: "",
    };
    const extendedMember = {
      ...member,
      moves: [...moves, extraMove, fifthMove],
    };
    const extendedUsageSet = {
      ...usageSet,
      moveIds: [
        "fakeout",
        "protect",
        "missingmove",
        "flareblitz",
        "knockoff",
        "uturn",
      ],
    };

    expect(
      resolveUsageCalculatorMoves(extendedMember, extendedUsageSet).map(
        (move) => move.id,
      ),
    ).toEqual([
      "fake-out",
      "protect",
      "flare-blitz",
      "knock-off",
      "u-turn",
    ]);
    expect(
      createUsageCalculatorBuild(extendedMember, extendedUsageSet, item).moveIds,
    ).toEqual(["fake-out", "protect", "flare-blitz", "knock-off"]);
  });

  it("resolves bounded, unique usage item alternatives from the legal item list", () => {
    const itemOptions: ItemIndexEntry[] = [
      {
        id: 1,
        name: "sitrusberry",
        showdownId: "sitrusberry",
        displayName: "Sitrus Berry",
        isMegaStone: false,
      },
      {
        id: 2,
        name: "assaultvest",
        showdownId: "assaultvest",
        displayName: "Assault Vest",
        isMegaStone: false,
      },
      {
        id: 3,
        name: "safetygoggles",
        showdownId: "safetygoggles",
        displayName: "Safety Goggles",
        isMegaStone: false,
      },
    ];
    const items = resolveUsageCalculatorItems(
      {
        ...usageSet,
        itemNames: [
          "Sitrus Berry",
          "missing-item",
          "Assault Vest",
          "Sitrus Berry",
          "Safety Goggles",
        ],
      },
      itemOptions,
      2,
    );

    expect(items.map((entry) => entry.showdownId)).toEqual([
      "sitrusberry",
      "assaultvest",
    ]);
  });
});
