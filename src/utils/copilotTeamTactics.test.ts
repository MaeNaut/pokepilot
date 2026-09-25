import { describe, expect, it } from "vitest";
import type { CopilotSetSnapshot } from "./copilotContracts";
import { createCopilotMechanicsSnapshot } from "./copilotMechanics";
import { createCopilotTeamTactics } from "./copilotTeamTactics";

const emptyProfile = {
  weaknesses: [],
  resistances: [],
  immunities: [],
};
const baseStats = {
  hp: 100,
  attack: 100,
  defense: 100,
  specialAttack: 100,
  specialDefense: 100,
  speed: 100,
};

function createSet(
  slotIndex: number,
  displayName: string,
  moveIds: string[],
  speed: number,
  overrides: Partial<CopilotSetSnapshot> = {},
): CopilotSetSnapshot {
  return {
    slotIndex,
    pokemonId: displayName.toLowerCase().replace(/ /g, ""),
    pokemonName: displayName,
    displayName,
    isMegaForm: false,
    types: ["normal"],
    typeDisplayNames: ["Normal"],
    item: null,
    itemDisplayName: null,
    ability: null,
    abilityDisplayName: null,
    nature: "Hardy",
    natureDisplayName: "Hardy",
    baseStats,
    stats: { ...baseStats, speed },
    evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    evTotal: 0,
    moves: moveIds.map((id) => ({
      id,
      name: id,
      displayName: id,
      type: "normal",
      category: "status",
      power: null,
      spreadTarget: null,
    })),
    defensiveProfile: emptyProfile,
    megaEvolution: null,
    offensiveProfile: {
      physicalMoveIds: [],
      specialMoveIds: [],
      statusMoveIds: moveIds,
      spreadMoveIds: [],
    },
    roleIds: [],
    setterConceptIds: [],
    aceConceptIds: [],
    validityStatus: "valid",
    validityIssues: [],
    ...overrides,
  };
}

describe("PokePilot deterministic team tactics", () => {
  it("provides bounded opportunities without deciding their strategic value", () => {
    const sets = [
      createSet(0, "Charm User", ["charm", "raindance"], 100),
      createSet(1, "Contrary Ally", [], 110, { ability: "contrary" }),
      createSet(2, "Round One", ["round"], 100, {
        item: "Choice Scarf",
        itemDisplayName: "Choice Scarf",
      }),
      createSet(3, "Round Two", ["round"], 145),
      createSet(4, "Grass Weak", [], 90, {
        defensiveProfile: {
          weaknesses: [{ type: "grass", multiplier: 2 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(5, "Grass Resist", [], 80, {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "grass", multiplier: 0.5 }],
          immunities: [],
        },
      }),
    ];
    const mechanics = createCopilotMechanicsSnapshot([
      {
        abilities: [
          {
            id: "contrary",
            displayName: "Contrary",
            effect: "If this Pokemon has a stat stage raised it is lowered instead, and vice versa.",
          },
        ],
        itemId: null,
        itemDisplayName: null,
        moves: [
          {
            id: "charm",
            displayName: "Charm",
            description: "Lowers the target's Attack by two stages.",
            target: "any-adjacent",
            targetStatChanges: [{ stat: "attack", stages: -2 }],
          },
          {
            id: "raindance",
            displayName: "Rain Dance",
            target: "all",
            fieldEffects: [{ kind: "weather", id: "rain" }],
          },
          {
            id: "round",
            displayName: "Round",
            description: "Moves immediately after an ally that already used Round this turn.",
          },
        ],
      },
      {
        abilities: [],
        itemId: "choicescarf",
        itemDisplayName: "Choice Scarf",
        itemEffect: "Holder's Speed is 1.5×, but it can only select the first move it executes.",
        moves: [],
      },
    ]);

    const tactics = createCopilotTeamTactics(sets, mechanics, "doubles");

    expect(tactics.allyTargetOpportunities).toContainEqual({
      sourceSlotIndex: 0,
      moveId: "charm",
      target: "any-adjacent",
      targetSlotIndexes: [1, 2, 3, 4, 5],
    });
    expect(tactics.allyStatChangeInteractions).toContainEqual({
      sourceSlotIndex: 0,
      targetSlotIndex: 1,
      moveId: "charm",
      abilityId: "contrary",
      state: "current",
      mode: "reverse",
      targetStatChanges: [{ stat: "attack", stages: -2 }],
    });
    expect(tactics.sharedMoveSequences).toEqual([
      { moveId: "round", slotIndexes: [2, 3] },
    ]);
    expect(tactics.fieldSetters).toEqual([
      {
        sourceSlotIndex: 0,
        moveId: "raindance",
        fieldEffect: { kind: "weather", id: "rain" },
      },
    ]);
    expect(tactics.unconditionalSpeedOrder).toContainEqual({
      fasterSlotIndex: 2,
      slowerSlotIndex: 3,
    });
    expect(tactics.defensiveCoverage).toContainEqual({
      protectedSlotIndex: 4,
      defenderSlotIndex: 5,
      type: "grass",
      relation: "resists",
    });
  });

  it("does not expose ally-target opportunities in Singles", () => {
    const tactics = createCopilotTeamTactics(
      [createSet(0, "Support", ["charm"], 100), createSet(1, "Ally", [], 90)],
      createCopilotMechanicsSnapshot([{
        abilities: [],
        itemId: null,
        itemDisplayName: null,
        moves: [{ id: "charm", displayName: "Charm", target: "any-adjacent" }],
      }]),
      "singles",
    );

    expect(tactics.allyTargetOpportunities).toEqual([]);
  });
});
