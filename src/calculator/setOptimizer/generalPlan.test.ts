import { describe, expect, it } from "vitest";
import type { BattleUsageSet } from "../../api/battleUsage";
import type { PokemonMove, TeamMember } from "../../types";
import { createGeneralSetOptimizationPlan } from "./generalPlan";
import type { GeneralSetOptimizationContext } from "./types";
import { createCopilotOptimizationSnapshot } from "../../utils/copilotRequestOptimizationSnapshot";
import { hasValidOptimizationShape } from "../../utils/copilotRequestOptimizationValidation";
import { resolveOptimizationCandidatePatch } from "../../utils/optimizationCandidateApplication";

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
const taunt: PokemonMove = {
  ...fakeOut,
  id: "taunt",
  name: "Taunt",
  category: "Status",
  power: null,
};
const round: PokemonMove = {
  ...fakeOut,
  id: "round",
  name: "Round",
  type: "normal",
  category: "Special",
  power: 60,
  description: "Power doubles if another Pokemon used Round earlier this turn.",
};
const snarl: PokemonMove = {
  ...round,
  id: "snarl",
  name: "Snarl",
  type: "dark",
  power: 55,
  description: "Lowers both opposing Pokemon's Special Attack.",
};
const bitterMalice: PokemonMove = {
  ...round,
  id: "bittermalice",
  name: "Bitter Malice",
  type: "ghost",
  power: 75,
};
const hyperVoice: PokemonMove = {
  ...round,
  id: "hypervoice",
  name: "Hyper Voice",
  power: 90,
};
const icyWind: PokemonMove = {
  ...round,
  id: "icywind",
  name: "Icy Wind",
  type: "ice",
  power: 55,
  description: "Lowers both opposing Pokemon's Speed.",
};
const member: TeamMember = {
  id: "weavile",
  name: "Weavile",
  types: ["dark", "ice"],
  roles: [],
  abilities: ["Pressure"],
  moves: [fakeOut, icePunch, protect, knockOff, lowKick, taunt],
  baseStats: {
    hp: 70,
    attack: 120,
    defense: 65,
    specialAttack: 45,
    specialDefense: 85,
    speed: 125,
  },
};
const usageSet: BattleUsageSet = {
  pokemonId: "weavile",
  pokemonName: "Weavile",
  sourceMonth: "2026-08",
  cutoff: 1630,
  itemName: "Focus Sash",
  itemNames: ["Focus Sash", "Life Orb", "Clear Amulet", "Covert Cloak"],
  itemOptions: [
    { id: "focussash", usagePercent: 50 },
    { id: "lifeorb", usagePercent: 25 },
    { id: "clearamulet", usagePercent: 15 },
    { id: "covertcloak", usagePercent: 10 },
  ],
  moveIds: ["fakeout", "lowkick", "knockoff", "protect", "taunt", "icepunch"],
  moveOptions: [
    { id: "fakeout", usagePercent: 90 },
    { id: "lowkick", usagePercent: 70 },
    { id: "knockoff", usagePercent: 65 },
    { id: "protect", usagePercent: 60 },
    { id: "taunt", usagePercent: 50 },
    { id: "icepunch", usagePercent: 40 },
  ],
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
    {
      nature: "jolly",
      evs: { hp: 32, attack: 32, speed: 2 },
      usagePercent: 11,
    },
    {
      nature: "careful",
      evs: { hp: 32, specialDefense: 32, speed: 2 },
      usagePercent: 5,
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
    }, {
      id: "lifeorb",
      showdownId: "lifeorb",
      name: "Life Orb",
      effect: "Boosts damage at the cost of recoil.",
    }, {
      id: "clearamulet",
      showdownId: "clearamulet",
      name: "Clear Amulet",
      effect: "Prevents stat drops.",
    }, {
      id: "covertcloak",
      showdownId: "covertcloak",
      name: "Covert Cloak",
      effect: "Blocks additional move effects.",
    }],
    ...overrides,
  } satisfies GeneralSetOptimizationContext;
}

describe("general sample recommendation candidates", () => {
  it("includes low-usage role spreads with the user's nature and later move options", () => {
    const context = createContext();
    const alternatives = Array.from({ length: 8 }, (_, index) => ({ ...icePunch, id: `alternative${index}`, name: `Alternative ${index}` }));
    context.member = { ...member, moves: [...member.moves!, ...alternatives, round] };
    context.build.natureId = "timid";
    context.build.moveIds = ["round", "icepunch", "protect", "knockoff"];
    context.usageSet = {
      ...usageSet, spreads: undefined, nature: "adamant",
      natureOptions: [{ id: "adamant", usagePercent: 70 }, { id: "jolly", usagePercent: 25 }, { id: "modest", usagePercent: 5 }],
      statPointSpreads: Array.from({ length: 10 }, (_, index) => ({
        evs: { hp: 2 + index, attack: index === 9 ? 0 : 32, defense: 0, specialAttack: index === 9 ? 32 : 0, specialDefense: 0, speed: 32 - index },
        usagePercent: index === 0 ? 90 : 1,
      })),
      moveIds: [...context.build.moveIds, ...alternatives.map((move) => move.id)],
      moveOptions: [...context.build.moveIds, ...alternatives.map((move) => move.id)].map((id, index) => ({ id, usagePercent: index < 4 ? 99 : 1 })),
    };
    const plan = createGeneralSetOptimizationPlan(context);
    expect(plan.candidates).toHaveLength(24);
    expect(plan.candidates.some((candidate) => candidate.natureId === "timid" && candidate.evs.specialAttack === 32 &&
      candidate.generalEvidence?.usageRank === 10 && candidate.generalEvidence.usagePercent === 1)).toBe(true);
    expect(plan.candidates.some((candidate) => candidate.moveIds.includes("alternative7"))).toBe(true);
    expect(new Set(plan.candidates.map((candidate) => JSON.stringify([candidate.evs, candidate.natureId, candidate.itemId, candidate.moveIds]))).size).toBe(plan.candidates.length);
    const snapshot = createCopilotOptimizationSnapshot(null, "en", [], plan, { member: context.member, ...context.build });
    expect(hasValidOptimizationShape(snapshot)).toBe(true);
    expect(snapshot!.moveMechanics!.length).toBeGreaterThan(8);
  });
  it.each([0, 12])("preserves the actual %i-point baseline in focused changes", (points) => {
    const context = createContext();
    context.build = {
      ...context.build,
      natureId: "timid",
      evs: { hp: 0, attack: 0, defense: 0, specialAttack: points, specialDefense: 0, speed: 0 },
    };
    const before = structuredClone(context);
    const plan = createGeneralSetOptimizationPlan(context);
    expect(context).toEqual(before);
    expect(plan.candidates[0]).toMatchObject({
      id: "set-current", natureId: "timid", evTotal: points,
      evs: context.build.evs, changedStatPoints: 0,
    });
    const focused = plan.candidates.filter((candidate) =>
      ["item", "move", "loadout"].includes(candidate.generalEvidence!.variant),
    );
    expect(new Set(focused.map((candidate) => candidate.generalEvidence!.variant)))
      .toEqual(new Set(["item", "move", "loadout"]));
    for (const candidate of focused) {
      expect(candidate).toMatchObject({
        natureId: "timid", evs: context.build.evs, evTotal: points, changedStatPoints: 0,
      });
    }
    const snapshot = createCopilotOptimizationSnapshot(null, "en", [], plan, {
      member: context.member, ...context.build,
    })!;
    expect(hasValidOptimizationShape(snapshot)).toBe(true);
    const move = snapshot.candidates.find((candidate) => candidate.generalEvidence!.variant === "move")!;
    expect(resolveOptimizationCandidatePatch(move, [])).toMatchObject({
      nature: "timid", evs: context.build.evs,
    });
    const forged = structuredClone(snapshot);
    forged.candidates[0].natureId = "adamant";
    expect(hasValidOptimizationShape(forged)).toBe(false);
    const wrongRole = structuredClone(snapshot);
    wrongRole.candidates[0].generalEvidence!.losesSlowSpeedRole = true;
    expect(hasValidOptimizationShape(wrongRole)).toBe(false);
    const incompleteSpread = structuredClone(snapshot);
    const spread = incompleteSpread.candidates.find((candidate) => candidate.generalEvidence!.variant === "spread")!;
    spread.evs = { ...context.build.evs };
    spread.evTotal = points;
    expect(hasValidOptimizationShape(incompleteSpread)).toBe(false);
  });

  it("keeps an incomplete current build available when usage is absent", () => {
    const context = createContext({ usageSet: null, usageItems: [] });
    context.build.evs = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
    const plan = createGeneralSetOptimizationPlan(context);
    expect(plan.status).toBe("ready");
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]).toMatchObject({ id: "set-current", evTotal: 0 });
  });

  it("labels the actual usage species when a projected form uses aggregate data", () => {
    const context = createContext();
    context.usagePokemonId = "weavile-mega";
    const plan = createGeneralSetOptimizationPlan(context);
    expect(plan.candidates.find((candidate) => candidate.id === "usage-standard")?.generalEvidence)
      .toMatchObject({ usagePokemonId: "weavile", requestedUsagePokemonId: "weavile-mega" });
  });

  it("excludes full investment in an unused attacking stat but preserves mixed bulk", () => {
    const context = createContext({
      usageSet: {
        ...usageSet,
        spreads: [
          { nature: "adamant", evs: { hp: 2, specialAttack: 32, speed: 32 }, usagePercent: 50 },
          { nature: "impish", evs: { hp: 32, specialDefense: 32, defense: 2 }, usagePercent: 40 },
        ],
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);
    expect(plan.candidates.some((candidate) => candidate.evs.specialAttack === 32)).toBe(false);
    expect(plan.candidates.some((candidate) => candidate.evs.specialDefense === 32)).toBe(true);
  });

  it("never filters the user's current spread even when its offense is mismatched", () => {
    const context = createContext();
    context.build.evs = { hp: 2, attack: 0, defense: 0, specialAttack: 32, specialDefense: 0, speed: 32 };
    const plan = createGeneralSetOptimizationPlan(context);
    expect(plan.candidates.find((candidate) => candidate.id === "set-current")?.evs.specialAttack).toBe(32);
  });

  it("keeps special investment when a selected special move can use it", () => {
    const context = createContext();
    context.member = { ...member, moves: [...member.moves!, round] };
    context.build.moveIds = ["round", "icepunch", "protect", "knockoff"];
    context.usageSet = { ...usageSet, spreads: [{ nature: "modest", evs: { hp: 2, specialAttack: 32, speed: 32 }, usagePercent: 50 }] };
    const plan = createGeneralSetOptimizationPlan(context);
    expect(plan.candidates.some((candidate) => candidate.evs.specialAttack === 32 && candidate.moveIds.includes("round"))).toBe(true);
  });

  it("builds a bounded, diverse general pool without matchup candidates", () => {
    const plan = createGeneralSetOptimizationPlan(createContext());

    expect(plan).toMatchObject({ mode: "general", status: "ready", opponentId: null });
    expect(plan.candidates.length).toBeGreaterThan(3);
    expect(plan.candidates.length).toBeLessThanOrEqual(24);
    expect(new Set(plan.candidates.map((candidate) => candidate.generalEvidence?.variant)))
      .toEqual(new Set(["current", "standard", "spread", "item", "move", "loadout"]));
    expect(plan.candidates.every(
      (candidate) => candidate.generalEvidence?.source !== "matchup",
    )).toBe(true);
    expect(plan.candidates.some((candidate) =>
      candidate.moveChanges.some(({ optimizedMoveId }) => optimizedMoveId === "taunt"),
    )).toBe(true);
    expect(plan.candidates.find(({ id }) => id === "usage-standard")).toMatchObject({
      itemId: "focussash",
      generalEvidence: {
        source: "usage",
        variant: "standard",
        usageRank: 1,
        usagePercent: 48.5,
        reducedRoleStats: [],
      },
      offenseBenchmarks: [],
      defenseBenchmarks: [],
      moveIds: ["fakeout", "lowkick", "protect", "knockoff"],
      moveChanges: [expect.objectContaining({
        currentMoveId: "icepunch",
        optimizedMoveId: "lowkick",
      })],
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
    const usage = plan.candidates.find(({ id }) => id === "usage-standard");

    expect(usage).toMatchObject({
      itemId: "lifeorb",
      itemChanged: false,
      generalEvidence: { reducedRoleStats: ["attack"], losesSlowSpeedRole: true },
    });
    expect(usage!.finalStats.speed).toBeGreaterThan(plan.candidates[0].finalStats.speed);
    expect(plan.candidates[0].generalEvidence?.losesSlowSpeedRole).toBe(false);
  });

  it("does not turn empty move slots into unverified replacements", () => {
    const context = createContext({
      build: {
        ...createContext().build,
        moveIds: ["", "", "", ""],
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);
    const usage = plan.candidates.find(({ id }) => id === "usage-standard");

    expect(usage?.moveIds).toEqual(["", "", "", ""]);
    expect(usage?.moveChanges).toEqual([]);
  });

  it("keeps shared moves in place and replaces only the actual usage difference", () => {
    const context = createContext({
      usageSet: {
        ...usageSet,
        moveIds: ["protect", "knockoff", "fakeout", "lowkick"],
        moveOptions: [
          { id: "protect", usagePercent: 90 },
          { id: "knockoff", usagePercent: 85 },
          { id: "fakeout", usagePercent: 80 },
          { id: "lowkick", usagePercent: 75 },
        ],
      },
    });
    const plan = createGeneralSetOptimizationPlan(context);
    const usage = plan.candidates.find(({ id }) => id === "usage-standard");

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
      usageSet: {
        ...usageSet,
        moveIds: ["fakeout", "icepunch", "protect", "knockoff"],
        moveOptions: [
          { id: "fakeout", usagePercent: 90 },
          { id: "icepunch", usagePercent: 80 },
          { id: "protect", usagePercent: 75 },
          { id: "knockoff", usagePercent: 70 },
        ],
      },
      usageItems: [{
        id: "focussash",
        showdownId: "focussash",
        name: "Focus Sash",
        effect: "At full HP, the holder survives one attack that would knock it out.",
      }],
    });
    const plan = createGeneralSetOptimizationPlan(context);

    expect(plan.candidates[0].id).toBe("set-current");
    const keys = plan.candidates.map((candidate) => JSON.stringify([
      candidate.natureId,
      candidate.evs,
      candidate.itemId,
      candidate.moveIds,
    ]));
    expect(new Set(keys).size).toBe(keys.length);
    expect(plan.candidates.some(({ id }) => id === "usage-standard")).toBe(false);
  });

  it("keeps every replacement slot and pairs a new move with an alternative item", () => {
    const zoroark: TeamMember = {
      ...member,
      id: "zoroarkhisui",
      name: "Zoroark-Hisui",
      types: ["normal", "ghost"],
      abilities: ["Illusion"],
      moves: [round, snarl, bitterMalice, hyperVoice, icyWind, taunt],
      baseStats: {
        hp: 55,
        attack: 100,
        defense: 60,
        specialAttack: 125,
        specialDefense: 60,
        speed: 110,
      },
    };
    const createZoroarkContext = (
      proposedMove: PokemonMove,
    ): GeneralSetOptimizationContext => ({
      selectedSlot: 0,
      member: zoroark,
      build: {
        item: {
          id: "choicescarf",
          showdownId: "choicescarf",
          name: "Choice Scarf",
          effect: "Raises Speed but locks the holder into its first selected move.",
        },
        ability: "Illusion",
        natureId: "modest",
        evs: {
          hp: 2,
          attack: 0,
          defense: 0,
          specialAttack: 32,
          specialDefense: 0,
          speed: 32,
        },
        moveIds: ["round", "snarl", "bittermalice", "hypervoice"],
      },
      reservedItemIds: [],
      usageSet: {
        pokemonId: "zoroarkhisui",
        pokemonName: "Zoroark-Hisui",
        sourceMonth: "2026-08",
        cutoff: 1630,
        itemName: "Choice Scarf",
        itemNames: ["Choice Scarf", "Focus Sash"],
        itemOptions: [
          { id: "choicescarf", usagePercent: 60 },
          { id: "focussash", usagePercent: 30 },
        ],
        moveIds: ["round", proposedMove.id, "snarl", "bittermalice", "hypervoice"],
        moveOptions: [
          { id: "round", usagePercent: 90 },
          { id: proposedMove.id, usagePercent: 70 },
          { id: "snarl", usagePercent: 65 },
          { id: "bittermalice", usagePercent: 60 },
          { id: "hypervoice", usagePercent: 50 },
        ],
        spreads: [{
          nature: "modest",
          evs: { hp: 2, specialAttack: 32, speed: 32 },
          usagePercent: 80,
        }],
      },
      usageItems: [{
        id: "choicescarf",
        showdownId: "choicescarf",
        name: "Choice Scarf",
        effect: "Raises Speed but locks the holder into its first selected move.",
      }, {
        id: "focussash",
        showdownId: "focussash",
        name: "Focus Sash",
        effect: "At full HP, the holder survives one attack that would knock it out.",
      }],
    });

    const icyWindPlan = createGeneralSetOptimizationPlan(
      createZoroarkContext(icyWind),
    );
    const icyWindRemovedMoves = icyWindPlan.candidates.flatMap((candidate) =>
      candidate.moveChanges[0]?.optimizedMoveId === "icywind"
        ? [candidate.moveChanges[0].currentMoveId]
        : [],
    );
    expect(new Set(icyWindRemovedMoves)).toEqual(
      new Set(["round", "snarl", "bittermalice", "hypervoice"]),
    );

    const tauntPlan = createGeneralSetOptimizationPlan(createZoroarkContext(taunt));
    expect(tauntPlan.candidates).toContainEqual(expect.objectContaining({
      itemId: "focussash",
      itemChanged: true,
      generalEvidence: expect.objectContaining({ variant: "loadout" }),
      moveChanges: [expect.objectContaining({
        currentMoveId: "snarl",
        optimizedMoveId: "taunt",
      })],
    }));

    const combinedContext = createZoroarkContext(icyWind);
    combinedContext.usageSet = {
      ...combinedContext.usageSet!,
      moveIds: ["round", "icywind", "taunt", "snarl", "bittermalice", "hypervoice"],
      moveOptions: [
        { id: "round", usagePercent: 90 },
        { id: "icywind", usagePercent: 70 },
        { id: "taunt", usagePercent: 68 },
        { id: "snarl", usagePercent: 65 },
        { id: "bittermalice", usagePercent: 60 },
        { id: "hypervoice", usagePercent: 50 },
      ],
    };
    const combinedPlan = createGeneralSetOptimizationPlan(combinedContext);
    expect(combinedPlan.candidates).toContainEqual(expect.objectContaining({
      itemId: "choicescarf",
      moveChanges: [expect.objectContaining({
        currentMoveId: "snarl",
        optimizedMoveId: "icywind",
      })],
    }));
    expect(combinedPlan.candidates).toContainEqual(expect.objectContaining({
      itemId: "focussash",
      generalEvidence: expect.objectContaining({ variant: "loadout" }),
      moveChanges: [expect.objectContaining({
        currentMoveId: "snarl",
        optimizedMoveId: "taunt",
      })],
    }));
  });
});
