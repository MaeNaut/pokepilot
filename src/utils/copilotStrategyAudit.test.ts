import { describe, expect, it } from "vitest";
import type {
  CopilotAnalysisRequest,
  CopilotSetSnapshot,
} from "./copilotAnalysis";
import type { CopilotGroundedModelOutput } from "./copilotModelContract";
import { validateCopilotStrategyAuditForRequest } from "./copilotStrategyAudit";

const zeroStats = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

function createSet(
  slotIndex: number,
  displayName: string,
  moveIds: string[],
): CopilotSetSnapshot {
  return {
    slotIndex,
    pokemonId: displayName.toLowerCase(),
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
    baseStats: null,
    stats: null,
    evs: { ...zeroStats },
    evTotal: 0,
    moves: moveIds.map((id) => ({
      id,
      name: id,
      displayName: id,
      type: "normal",
      power: null,
      category: "status",
      spreadTarget: null,
    })),
    defensiveProfile: {
      weaknesses: [],
      resistances: [],
      immunities: [],
    },
    megaEvolution: null,
    offensiveProfile: {
      physicalMoveIds: [],
      specialMoveIds: [],
      statusMoveIds: [...moveIds],
      spreadMoveIds: [],
    },
    roleIds: [],
    setterConceptIds: [],
    aceConceptIds: [],
    validityStatus: "valid",
    validityIssues: [],
  };
}

function createRequest(sets: CopilotSetSnapshot[]): CopilotAnalysisRequest {
  return {
    version: 9,
    locale: "en",
    scope: "team",
    battleFormat: "doubles",
    teamName: "Audit Team",
    selectedSlot: 0,
    sets,
    megaOptions: [],
    candidateFilters: [],
    mechanics: { moves: [], abilities: [], items: [] },
    diagnostics: {
      filledSlots: sets.length,
      coverageCount: 0,
      coverageGaps: [],
      defensiveMatchups: [],
      alerts: [],
      roleCounts: {
        "physical-attacker": 0,
        "special-attacker": 0,
        "physical-wall": 0,
        "special-wall": 0,
        supporter: 0,
        setter: 0,
      },
      moveSources: {},
      defensiveProfile: { weakTo: {}, resists: {}, immuneTo: {} },
      offensiveProfile: {
        physicalMoveCount: 0,
        specialMoveCount: 0,
        spreadMoveCount: 0,
        physicalSources: {},
        specialSources: {},
        spreadSources: {},
      },
      concepts: [],
      validity: { status: "valid", errorCount: 0, unavailableCount: 0 },
    },
  };
}

function createOutput(
  strategyAudit: CopilotGroundedModelOutput["strategyAudit"],
): CopilotGroundedModelOutput {
  return {
    analysis: {
      version: 1,
      scope: "team",
      title: "Audit Team",
      summary: "Summary",
      playstyle: "Plan",
      strengths: [],
      weaknesses: [],
      recommendations: [],
    },
    strategyAudit,
  };
}

const sets = [
  createSet(0, "Farigiraf", ["trickroom"]),
  createSet(1, "Scrafty", ["fakeout", "coaching"]),
  createSet(2, "Mawile", ["playrough"]),
  createSet(3, "Tyranitar", ["rockslide"]),
];

describe("Copilot strategy audit", () => {
  it("accepts a legal Doubles opening with owned moves", () => {
    const output = createOutput({
      plans: [
        {
          id: "trick-room",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "trick-room",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
    });

    expect(validateCopilotStrategyAuditForRequest(output, createRequest(sets))).toEqual(
      [],
    );
  });

  it("rejects a move assigned to a Pokemon that did not select it", () => {
    const output = createOutput({
      plans: [
        {
          id: "invalid-owner",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 1,
              moveId: "trickroom",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
    });

    expect(
      validateCopilotStrategyAuditForRequest(output, createRequest(sets)),
    ).toContain(
      "strategyAudit.plans[0].actions[0].moveId is not selected by slot 1.",
    );
  });

  it("rejects an opening action by a Pokemon that is still in the backline", () => {
    const roundSets = [
      createSet(0, "Farigiraf", ["trickroom"]),
      createSet(1, "Zoroark", ["round"]),
      createSet(2, "Drampa", ["round"]),
      createSet(3, "Primarina", ["round"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "invalid-round-lead",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 2],
          backlineSlotIndexes: [1, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 1,
              moveId: "round",
              activeSlotIndexes: [0, 2],
            },
          ],
        },
      ],
    });

    expect(
      validateCopilotStrategyAuditForRequest(output, createRequest(roundSets)),
    ).toContain(
      "strategyAudit.plans[0].actions[0].actorSlotIndex must be active for the action.",
    );
  });

  it("allows an empty action audit when no moves have been selected", () => {
    const moveLessSets = sets.map((set) => ({ ...set, moves: [] }));
    const output = createOutput({
      plans: [
        {
          id: "incomplete-team",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [],
        },
      ],
    });

    expect(
      validateCopilotStrategyAuditForRequest(output, createRequest(moveLessSets)),
    ).toEqual([]);
  });
});
