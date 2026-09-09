import { describe, expect, it } from "vitest";
import type { SmogonUsageSet } from "../../api/smogonUsage";
import type { PokemonMove, TeamMember } from "../../types";
import { createGeneralSetOptimizationPlan } from "./generalPlan";
import type { GeneralSetOptimizationContext } from "./types";

const fakeOut: PokemonMove = {
  id: "fakeout",
  name: "Fake Out",
  type: "normal",
  category: "Physical",
  power: 40,
  accuracy: 100,
  pp: 10,
  description: "Makes the target flinch.",
};
const icePunch: PokemonMove = {
  ...fakeOut,
  id: "icepunch",
  name: "Ice Punch",
  type: "ice",
  power: 75,
};
const protect: PokemonMove = {
  ...fakeOut,
  id: "protect",
  name: "Protect",
  category: "Status",
  power: null,
};
const knockOff: PokemonMove = {
  ...fakeOut,
  id: "knockoff",
  name: "Knock Off",
  type: "dark",
  power: 65,
};
const lowKick: PokemonMove = {
  ...fakeOut,
  id: "lowkick",
  name: "Low Kick",
  type: "fighting",
  power: 80,
};
const member: TeamMember = {
  id: "weavile",
  name: "Weavile",
  types: ["dark", "ice"],
  roles: [],
  abilities: ["Pressure"],
  moves: [fakeOut, icePunch, protect, knockOff, lowKick],
  baseStats: {
    hp: 70,
    attack: 120,
    defense: 65,
    specialAttack: 45,
    specialDefense: 85,
    speed: 125,
  },
};
const usageSet: SmogonUsageSet = {
  pokemonId: "weavile",
  pokemonName: "Weavile",
  sourceMonth: "2026-08",
  cutoff: 1630,
  itemName: "Focus Sash",
  moveIds: ["protect", "knockoff", "fakeout", "icepunch"],
  spreads: [
    {
      nature: "jolly",
      evs: { hp: 2, attack: 32, speed: 32 },
      usagePercent: 48.5,
    },
    {
      nature: "adamant",
      evs: { hp: 2, attack: 32, speed: 32 },
      usagePercent: 21.25,
    },
  ],
};

function createContext(overrides: Partial<GeneralSetOptimizationContext> = {}) {
  return {
    selectedSlot: 0,
    member,
    build: {
      item: { id: "lifeorb", name: "Life Orb" },
      ability: "Pressure",
      natureId: "jolly",
      evs: { hp: 2, attack: 32, defense: 0, specialAttack: 0, specialDefense: 0, speed: 32 },
      moveIds: ["fakeout", "icepunch", "protect", "knockoff"],
    },
    reservedItemIds: [],
    usageSet,
    usageItems: [{
      id: "focussash",
      showdownId: "focussash",
      name: "Focus Sash",
      effect: "At full HP, the holder survives one attack that would knock it out.",
    }],
    ...overrides,
  } satisfies GeneralSetOptimizationContext;
}

describe("general sample recommendation candidates", () => {
  it("keeps the current sample and observed alternatives without inventing matchup evidence", () => {
    const plan = createGeneralSetOptimizationPlan(createContext());

    expect(plan).toMatchObject({ mode: "general", status: "ready", opponentId: null });
    expect(plan.candidates.map(({ id }) => id)).toEqual([
      "set-current",
      "usage-standard-1",
      "usage-standard-2",
    ]);
    expect(plan.candidates[1]).toMatchObject({
      itemId: "focussash",
      generalEvidence: {
        source: "usage",
        spreadRank: 1,
        usagePercent: 48.5,
        reducedRoleStats: [],
      },
      offenseBenchmarks: [],
      defenseBenchmarks: [],
      moveIds: ["fakeout", "icepunch", "protect", "knockoff"],
      moveChanges: [],
    });
  });

  it("marks a slower-role regression and does not duplicate an ally's item", () => {
    const context = createContext({
      reservedItemIds: ["focussash"],
      build: {
        ...createContext().build,
        natureId: "brave",
        evs: { hp: 32, attack: 32, defense: 2, specialAttack: 0, specialDefense: 0, speed: 0 },
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);
    const usage = plan.candidates.find(({ id }) => id === "usage-standard-1");

    expect(usage).toMatchObject({
      itemId: "lifeorb",
      itemChanged: false,
      generalEvidence: { reducedRoleStats: ["attack", "speed"] },
    });
  });

  it("does not turn empty move slots into unverified replacements", () => {
    const context = createContext({
      build: {
        ...createContext().build,
        moveIds: ["", "", "", ""],
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);
    const usage = plan.candidates.find(({ id }) => id === "usage-standard-1");

    expect(usage?.moveIds).toEqual(["", "", "", ""]);
    expect(usage?.moveChanges).toEqual([]);
  });

  it("keeps shared moves in place and replaces only the actual usage difference", () => {
    const context = createContext({
      usageSet: {
        ...usageSet,
        moveIds: ["protect", "knockoff", "fakeout", "lowkick"],
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);
    const usage = plan.candidates.find(({ id }) => id === "usage-standard-1");

    expect(usage?.moveIds).toEqual([
      "fakeout",
      "lowkick",
      "protect",
      "knockoff",
    ]);
    expect(usage?.moveChanges).toEqual([
      expect.objectContaining({
        slotIndex: 1,
        currentMoveId: "icepunch",
        optimizedMoveId: "lowkick",
      }),
    ]);
  });

  it("collapses an observed sample that is identical to the current set", () => {
    const context = createContext({
      build: {
        ...createContext().build,
        item: {
          id: "focus-sash",
          showdownId: "focussash",
          name: "Focus Sash",
        },
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);

    expect(plan.candidates.map(({ id }) => id)).toEqual([
      "set-current",
      "usage-standard-2",
    ]);
  });
});
