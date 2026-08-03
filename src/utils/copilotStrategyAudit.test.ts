import { describe, expect, it } from "vitest";
import {
  createCopilotTypeLabels,
  type CopilotAnalysisRequest,
  type CopilotSetSnapshot,
} from "./copilotAnalysis";
import type { CopilotGroundedModelOutput } from "./copilotModelContract";
import type { CopilotRecommendationCandidateSnapshot } from "./pokemonRecommendations";
import { createCopilotResponsibilityCounts } from "./copilotResponsibilities";
import {
  completeCopilotRecommendationAudit,
  completeCopilotStrategyAudit,
  validateCopilotStrategyAuditForRequest,
} from "./copilotStrategyAudit";

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
  overrides: Partial<CopilotSetSnapshot> = {},
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
    ...overrides,
  };
}

function createRequest(
  sets: CopilotSetSnapshot[],
  overrides: Partial<CopilotAnalysisRequest> = {},
): CopilotAnalysisRequest {
  return {
    version: 14,
    locale: "en",
    scope: "team",
    battleFormat: "doubles",
    teamName: "Audit Team",
    selectedSlot: 0,
    typeLabels: createCopilotTypeLabels("en"),
    sets,
    megaOptions: [],
    candidateFilters: [],
    recommendationCandidates: [],
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
      responsibilityCounts: createCopilotResponsibilityCounts([]),
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
    ...overrides,
  };
}

function createOutput(
  strategyAudit: Pick<
    CopilotGroundedModelOutput["strategyAudit"],
    "plans"
  > &
    Partial<Omit<CopilotGroundedModelOutput["strategyAudit"], "plans">>,
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
    strategyAudit: {
      interactions: [],
      facts: [],
      candidateFacts: [],
      recommendationEvidence: [],
      ...strategyAudit,
    },
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

  it("accepts interactions, deterministic facts, and recommendation evidence", () => {
    const groundedSets = [
      createSet(0, "Farigiraf", ["trickroom"], {
        ability: "armor-tail",
        item: "mental-herb",
        stats: { ...zeroStats, speed: 60 },
        defensiveProfile: {
          weaknesses: [{ type: "fighting", multiplier: 2 }],
          resistances: [],
          immunities: [{ type: "ghost", cause: "typing" }],
        },
      }),
      createSet(1, "Scrafty", ["fakeout", "coaching"], {
        ability: "intimidate",
        item: "sitrus-berry",
        stats: { ...zeroStats, speed: 61 },
      }),
      createSet(2, "Mawile", ["playrough"]),
      createSet(3, "Tyranitar", ["rockslide"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "setup",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 1,
              moveId: "coaching",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "opening-coaching",
          planId: "setup",
          kind: "ally-target",
          phase: "opening",
          activeSlotIndexes: [0, 1],
          participants: [
            {
              slotIndex: 1,
              state: "current",
              moveIds: ["coaching"],
              abilityIds: ["intimidate"],
              itemIds: ["sitrusberry"],
            },
            {
              slotIndex: 0,
              state: "current",
              moveIds: [],
              abilityIds: ["armor-tail"],
              itemIds: ["mental-herb"],
            },
          ],
        },
      ],
      facts: [
        {
          id: "scrafty-move",
          kind: "move-owner",
          subjectSlotIndex: 1,
          objectSlotIndex: -1,
          state: "current",
          valueId: "coaching",
        },
        {
          id: "farigiraf-weakness",
          kind: "weak-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "fighting",
        },
        {
          id: "speed-order",
          kind: "faster-than",
          subjectSlotIndex: 1,
          objectSlotIndex: 0,
          state: "current",
          valueId: "",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "protect-setup",
          planIds: ["setup"],
          interactionIds: ["opening-coaching"],
          factIds: ["scrafty-move", "speed-order"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.recommendations = [
      {
        id: "protect-setup",
        title: "Protect the setup",
        reason: "Use the legal opening sequence.",
        priority: "high",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(groundedSets),
      ),
    ).toEqual([]);
  });

  it("treats an already-Mega set as the supplied current state", () => {
    const singlesSets = [
      createSet(0, "Gengar Mega", ["shadowball"], {
        pokemonId: "gengar-mega",
        isMegaForm: true,
        ability: "shadow-tag",
        item: "gengarite",
        stats: { ...zeroStats, speed: 200 },
      }),
      createSet(1, "Bellibolt", ["voltswitch"]),
      createSet(2, "Corviknight", ["uturn"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "singles-positioning",
          lineupSlotIndexes: [0, 1, 2],
          leadSlotIndexes: [0],
          backlineSlotIndexes: [1, 2],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "shadowball",
              activeSlotIndexes: [0],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "singles-switch-branch",
          planId: "singles-positioning",
          kind: "positioning",
          phase: "opening",
          activeSlotIndexes: [0],
          participants: [
            {
              slotIndex: 0,
              state: "current",
              moveIds: ["shadowball"],
              abilityIds: ["shadowtag"],
              itemIds: ["gengarite"],
            },
            {
              slotIndex: 1,
              state: "current",
              moveIds: [],
              abilityIds: [],
              itemIds: [],
            },
          ],
        },
      ],
      facts: [
        {
          id: "gengar-mega-option",
          kind: "mega-option",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "gengar-mega",
        },
      ],
    });
    const request = createRequest(singlesSets, {
      battleFormat: "singles",
      megaOptions: [
        {
          slotIndex: 0,
          pokemonId: "gengar-mega",
          pokemonName: "Gengar Mega",
          displayName: "Gengar Mega",
          types: ["ghost", "poison"],
          typeDisplayNames: ["Ghost", "Poison"],
          ability: "shadow-tag",
          abilityDisplayName: "Shadow Tag",
        },
      ],
    });

    expect(validateCopilotStrategyAuditForRequest(output, request)).toEqual([]);
  });

  it("binds a projected Mega option to the supplied current roster slot", () => {
    const staraptor = createSet(0, "Staraptor", ["closecombat"], {
      pokemonId: "staraptor",
      item: "staraptite",
      ability: "intimidate",
      megaEvolution: {
        pokemonId: "staraptor-mega",
        pokemonName: "Staraptor Mega",
        displayName: "Staraptor Mega",
        types: ["fighting", "flying"],
        typeDisplayNames: ["Fighting", "Flying"],
        ability: "contrary",
        abilityDisplayName: "Contrary",
        defensiveProfile: {
          weaknesses: [],
          resistances: [],
          immunities: [],
        },
      },
    });
    const output = createOutput({
      plans: [
        {
          id: "mega-option",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "closecombat",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      facts: [
        {
          id: "staraptor-mega-option",
          kind: "mega-option",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "staraptor-mega",
        },
      ],
    });
    const request = createRequest([staraptor, ...sets.slice(1)], {
      megaOptions: [
        {
          slotIndex: 0,
          pokemonId: "staraptor-mega",
          pokemonName: "Staraptor Mega",
          displayName: "Staraptor Mega",
          types: ["fighting", "flying"],
          typeDisplayNames: ["Fighting", "Flying"],
          ability: "contrary",
          abilityDisplayName: "Contrary",
        },
      ],
    });

    expect(validateCopilotStrategyAuditForRequest(output, request)).toEqual([]);
  });

  it("allows a non-simultaneous interaction to bind a documented multi-turn sequence", () => {
    const singlesSets = [
      createSet(0, "Gengar Mega", ["perishsong", "protect"], {
        pokemonId: "gengar-mega",
        isMegaForm: true,
        ability: "shadowtag",
      }),
      createSet(1, "Bellibolt", ["voltswitch"]),
      createSet(2, "Corviknight", ["uturn"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "perish-sequence",
          lineupSlotIndexes: [0, 1, 2],
          leadSlotIndexes: [0],
          backlineSlotIndexes: [1, 2],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "perishsong",
              activeSlotIndexes: [0],
            },
            {
              phase: "midgame",
              actorSlotIndex: 0,
              moveId: "protect",
              activeSlotIndexes: [0],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "perish-trap",
          planId: "perish-sequence",
          kind: "move-ability",
          phase: "midgame",
          activeSlotIndexes: [0],
          participants: [
            {
              slotIndex: 0,
              state: "current",
              moveIds: ["perishsong", "protect"],
              abilityIds: ["shadowtag"],
              itemIds: [],
            },
          ],
        },
      ],
    });

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(singlesSets, { battleFormat: "singles" }),
      ),
    ).toEqual([]);
  });

  it("removes only surplus participant moves when another plan action is valid", () => {
    const singlesSets = [
      createSet(0, "Gengar Mega", ["perishsong", "protect", "shadowball"], {
        pokemonId: "gengar-mega",
        isMegaForm: true,
        ability: "shadowtag",
      }),
      createSet(1, "Bellibolt", ["voltswitch"]),
      createSet(2, "Corviknight", ["uturn"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "perish-sequence",
          lineupSlotIndexes: [0, 1, 2],
          leadSlotIndexes: [0],
          backlineSlotIndexes: [1, 2],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "perishsong",
              activeSlotIndexes: [0],
            },
            {
              phase: "midgame",
              actorSlotIndex: 0,
              moveId: "protect",
              activeSlotIndexes: [0],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "perish-trap",
          planId: "perish-sequence",
          kind: "move-ability",
          phase: "midgame",
          activeSlotIndexes: [0],
          participants: [
            {
              slotIndex: 0,
              state: "current",
              moveIds: ["perishsong", "protect", "shadowball"],
              abilityIds: ["shadowtag"],
              itemIds: [],
            },
          ],
        },
      ],
    });
    const request = createRequest(singlesSets, { battleFormat: "singles" });

    expect(validateCopilotStrategyAuditForRequest(output, request)).toContain(
      "strategyAudit.interactions[0].participants[0].moveIds must reference an action by the same owner in the referenced plan.",
    );

    const completed = completeCopilotStrategyAudit(output, request);

    expect(completed.strategyAudit.interactions[0].participants[0].moveIds).toEqual([
      "perishsong",
      "protect",
    ]);
    expect(validateCopilotStrategyAuditForRequest(completed, request)).toEqual([]);
    expect(output.strategyAudit.interactions[0].participants[0].moveIds).toEqual([
      "perishsong",
      "protect",
      "shadowball",
    ]);
  });

  it("removes an unreferenced false defensive fact but preserves cited facts", () => {
    const output = createOutput({
      plans: [
        {
          id: "basic-plan",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "trickroom",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      facts: [
        {
          id: "unused-false-weakness",
          kind: "weak-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "water",
        },
        {
          id: "cited-false-weakness",
          kind: "weak-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "fire",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "basic-recommendation",
          planIds: ["basic-plan"],
          interactionIds: [],
          factIds: ["cited-false-weakness"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.recommendations = [
      {
        id: "basic-recommendation",
        title: "Basic recommendation",
        reason: "Use the recorded plan.",
        priority: "medium",
      },
    ];
    const request = createRequest(sets);

    const completed = completeCopilotStrategyAudit(output, request);

    expect(completed.strategyAudit.facts.map((fact) => fact.id)).toEqual([
      "cited-false-weakness",
    ]);
    expect(validateCopilotStrategyAuditForRequest(completed, request)).toContain(
      "strategyAudit.facts[0] contradicts the supplied defensive profile.",
    );
  });

  it("normalizes a unary fact's meaningless comparison slot", () => {
    const output = createOutput({
      plans: [
        {
          id: "basic-plan",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "trickroom",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      facts: [
        {
          id: "trick-room-owner",
          kind: "move-owner",
          subjectSlotIndex: 0,
          objectSlotIndex: 1,
          state: "current",
          valueId: "trickroom",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "basic-recommendation",
          planIds: ["basic-plan"],
          interactionIds: [],
          factIds: ["trick-room-owner"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.recommendations = [
      {
        id: "basic-recommendation",
        title: "Basic recommendation",
        reason: "Use Trick Room.",
        priority: "medium",
      },
    ];
    const request = createRequest(sets);

    const completed = completeCopilotStrategyAudit(output, request);

    expect(completed.strategyAudit.facts[0].objectSlotIndex).toBe(-1);
    expect(validateCopilotStrategyAuditForRequest(completed, request)).toEqual([]);
  });

  it("rejects interaction bindings that the recorded participant does not own", () => {
    const output = createOutput({
      plans: [
        {
          id: "invalid-binding",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 1,
              moveId: "coaching",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "invented-elements",
          planId: "invalid-binding",
          kind: "move-ability",
          phase: "opening",
          activeSlotIndexes: [0, 1],
          participants: [
            {
              slotIndex: 1,
              state: "current",
              moveIds: ["coaching"],
              abilityIds: ["huge-power"],
              itemIds: ["choice-band"],
            },
          ],
        },
      ],
    });
    const ownedSets = sets.map((set) =>
      set.slotIndex === 1
        ? { ...set, ability: "intimidate", item: "sitrus-berry" }
        : set,
    );

    const errors = validateCopilotStrategyAuditForRequest(
      output,
      createRequest(ownedSets),
    );
    expect(errors).toContain(
      "strategyAudit.interactions[0].participants[0].abilityIds contains an element not owned in the recorded state.",
    );
    expect(errors).toContain(
      "strategyAudit.interactions[0].participants[0].itemIds contains an element not owned in the recorded state.",
    );
  });

  it("rejects an interaction participant outside the active pair and an unaudited move", () => {
    const output = createOutput({
      plans: [
        {
          id: "inactive-interaction",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "trickroom",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "backline-action",
          planId: "inactive-interaction",
          kind: "shared-move",
          phase: "opening",
          activeSlotIndexes: [0, 1],
          participants: [
            {
              slotIndex: 1,
              state: "current",
              moveIds: ["coaching"],
              abilityIds: [],
              itemIds: [],
            },
            {
              slotIndex: 2,
              state: "current",
              moveIds: ["playrough"],
              abilityIds: [],
              itemIds: [],
            },
          ],
        },
      ],
    });

    const errors = validateCopilotStrategyAuditForRequest(
      output,
      createRequest(sets),
    );
    expect(errors).toContain(
      "strategyAudit.interactions[0].participants[1].slotIndex must be active for a simultaneous interaction.",
    );
    expect(errors).toContain(
      "strategyAudit.interactions[0].participants[0].moveIds must reference an action in the same plan, phase, and active state.",
    );
  });

  it("rejects two simultaneously activated Mega states", () => {
    const megaSets = [
      createSet(0, "Mawile", ["playrough"], {
        item: "mawilite",
        megaEvolution: {
          pokemonId: "mawile-mega",
          pokemonName: "Mawile Mega",
          displayName: "Mawile Mega",
          types: ["steel", "fairy"],
          typeDisplayNames: ["Steel", "Fairy"],
          ability: "huge-power",
          abilityDisplayName: "Huge Power",
          defensiveProfile: {
            weaknesses: [
              { type: "fire", multiplier: 2 },
              { type: "ground", multiplier: 2 },
            ],
            resistances: [],
            immunities: [
              { type: "dragon", cause: "typing" },
              { type: "poison", cause: "typing" },
            ],
          },
        },
      }),
      createSet(1, "Tyranitar", ["rockslide"], {
        item: "tyranitarite",
        megaEvolution: {
          pokemonId: "tyranitar-mega",
          pokemonName: "Tyranitar Mega",
          displayName: "Tyranitar Mega",
          types: ["rock", "dark"],
          typeDisplayNames: ["Rock", "Dark"],
          ability: "sand-stream",
          abilityDisplayName: "Sand Stream",
          defensiveProfile: {
            weaknesses: [{ type: "fighting", multiplier: 4 }],
            resistances: [],
            immunities: [{ type: "psychic", cause: "typing" }],
          },
        },
      }),
      createSet(2, "Farigiraf", ["trickroom"]),
      createSet(3, "Scrafty", ["fakeout"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "double-mega",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "playrough",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      interactions: [
        {
          id: "impossible-megas",
          planId: "double-mega",
          kind: "other",
          phase: "opening",
          activeSlotIndexes: [0, 1],
          participants: [
            {
              slotIndex: 0,
              state: "mega",
              moveIds: [],
              abilityIds: ["huge-power"],
              itemIds: ["mawilite"],
            },
            {
              slotIndex: 1,
              state: "mega",
              moveIds: [],
              abilityIds: ["sand-stream"],
              itemIds: ["tyranitarite"],
            },
          ],
        },
      ],
    });

    expect(
      validateCopilotStrategyAuditForRequest(output, createRequest(megaSets)),
    ).toContain(
      "strategyAudit.interactions[0] cannot activate more than one Mega Evolution.",
    );
  });

  it("rejects defensive and final-Speed facts contradicted by the request", () => {
    const factSets = [
      createSet(0, "Farigiraf", ["trickroom"], {
        stats: { ...zeroStats, speed: 60 },
        defensiveProfile: {
          weaknesses: [{ type: "fighting", multiplier: 2 }],
          resistances: [],
          immunities: [{ type: "ghost", cause: "typing" }],
        },
      }),
      createSet(1, "Scrafty", ["fakeout"], {
        stats: { ...zeroStats, speed: 61 },
      }),
      createSet(2, "Mawile", ["playrough"]),
      createSet(3, "Tyranitar", ["rockslide"]),
    ];
    const output = createOutput({
      plans: [
        {
          id: "facts",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "trickroom",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
      facts: [
        {
          id: "wrong-resistance",
          kind: "resists",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "fighting",
        },
        {
          id: "wrong-speed",
          kind: "faster-than",
          subjectSlotIndex: 0,
          objectSlotIndex: 1,
          state: "current",
          valueId: "",
        },
      ],
    });

    const errors = validateCopilotStrategyAuditForRequest(
      output,
      createRequest(factSets),
    );
    expect(errors).toContain(
      "strategyAudit.facts[0] contradicts the supplied defensive profile.",
    );
    expect(errors).toContain(
      "strategyAudit.facts[1] contradicts the supplied final Speed values and unconditional held-item modifiers.",
    );
  });

  it("requires each recommendation to cite validated private evidence", () => {
    const output = createOutput({
      plans: [
        {
          id: "recommendation",
          lineupSlotIndexes: [0, 1, 2, 3],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [2, 3],
          actions: [
            {
              phase: "opening",
              actorSlotIndex: 0,
              moveId: "trickroom",
              activeSlotIndexes: [0, 1],
            },
          ],
        },
      ],
    });
    output.analysis.recommendations = [
      {
        id: "missing-grounding",
        title: "Unsupported",
        reason: "No private evidence is linked.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(output, createRequest(sets)),
    ).toContain(
      "Recommendation missing-grounding must have private audit evidence.",
    );
  });

  it("accepts fact-grounded recommendations for a selected Pokemon", () => {
    const pokemonSets = [
      createSet(0, "Hisuian Zoroark", ["round", "icywind"], {
        ability: "illusion",
        item: "choice-scarf",
        stats: { ...zeroStats, speed: 80 },
      }),
      createSet(1, "Gardevoir Mega", ["round"], {
        ability: "pixilate",
        stats: { ...zeroStats, speed: 100 },
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "zoroark-round",
          kind: "move-owner",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "round",
        },
        {
          id: "zoroark-scarf",
          kind: "item-owner",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "choice-scarf",
        },
        {
          id: "zoroark-faster",
          kind: "faster-than",
          subjectSlotIndex: 0,
          objectSlotIndex: 1,
          state: "current",
          valueId: "",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "round-opening",
          planIds: [],
          interactionIds: [],
          factIds: ["zoroark-round", "zoroark-scarf", "zoroark-faster"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "round-opening",
        title: "Use the fast Round opener",
        reason: "The selected set owns the required move and item.",
        priority: "high",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 0,
          mechanics: {
            moves: [],
            abilities: [],
            items: [
              {
                id: "choice-scarf",
                displayName: "Choice Scarf",
                effect:
                  "Holder's Speed is 1.5x, but it can only select the first move it executes.",
              },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it("counts a Speed comparison object as named Pokemon evidence", () => {
    const pokemonSets = [
      createSet(0, "Swampert", ["tailwind"], {
        stats: { ...zeroStats, speed: 110 },
      }),
      createSet(1, "Sneasler", ["closecombat"], {
        stats: { ...zeroStats, speed: 143 },
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "swampert-slower",
          kind: "slower-than",
          subjectSlotIndex: 0,
          objectSlotIndex: 1,
          state: "current",
          valueId: "",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "speed-order",
          planIds: [],
          interactionIds: [],
          factIds: ["swampert-slower"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "speed-order",
        title: "Compare Swampert and Sneasler",
        reason: "Swampert is slower than Sneasler before other modifiers.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 0,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a resistance recorded as an immunity in Pokemon analysis", () => {
    const pokemonSet = createSet(0, "Sinistcha", ["matchagotcha"], {
      defensiveProfile: {
        weaknesses: [],
        resistances: [{ type: "ground", multiplier: 0.5 }],
        immunities: [],
      },
    });
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "false-ground-immunity",
          kind: "immune-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "ground",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "earthquake-partner",
          planIds: [],
          interactionIds: [],
          factIds: ["false-ground-immunity"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "earthquake-partner",
        title: "Unsupported positioning",
        reason: "This should fail deterministic validation.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest([pokemonSet], {
          scope: "pokemon",
          selectedSlot: 0,
        }),
      ),
    ).toContain(
      "strategyAudit.facts[0] contradicts the supplied defensive profile.",
    );
  });

  it("rejects Pokemon advice whose named move and teammates use unrelated facts", () => {
    const pokemonSets = [
      createSet(0, "Hisuian Zoroark", ["round", "icywind"]),
      createSet(1, "Gardevoir", ["round"], {
        megaEvolution: {
          pokemonId: "gardevoir-mega",
          pokemonName: "Gardevoir Mega",
          displayName: "Gardevoir Mega",
          types: ["psychic", "fairy"],
          typeDisplayNames: ["Psychic", "Fairy"],
          ability: "pixilate",
          abilityDisplayName: "Pixilate",
          defensiveProfile: {
            weaknesses: [],
            resistances: [],
            immunities: [],
          },
        },
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "unrelated-icy-wind",
          kind: "move-owner",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "icywind",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "round-chain",
          planIds: [],
          interactionIds: [],
          factIds: ["unrelated-icy-wind"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "round-chain",
        title: "Use Hisuian Zoroark and Gardevoir for Round",
        reason: "Gardevoir is the strongest Round responder.",
        priority: "high",
      },
    ];

    const errors = validateCopilotStrategyAuditForRequest(
      output,
      createRequest(pokemonSets, {
        scope: "pokemon",
        selectedSlot: 0,
        mechanics: {
          moves: [
            {
              id: "round",
              displayName: "round",
              effect:
                "Power doubles and the user moves immediately after an ally that already used round this turn.",
            },
          ],
          abilities: [],
          items: [],
        },
      }),
    );

    expect(errors).toContain(
      "Recommendation round-chain names Gardevoir without fact evidence for slot 1.",
    );
    expect(errors).toContain(
      "Recommendation round-chain names shared move round without matching owner fact evidence.",
    );
  });

  it("treats the selected Pokemon as the established analysis subject", () => {
    const pokemonSets = [
      createSet(0, "Hisuian Zoroark", [], {
        ability: "illusion",
        abilityDisplayName: "Illusion",
      }),
      createSet(1, "Gengar", [], {
        ability: "cursedbody",
        abilityDisplayName: "Cursed Body",
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "gengar-cursed-body",
          kind: "ability-owner",
          subjectSlotIndex: 1,
          objectSlotIndex: -1,
          state: "current",
          valueId: "cursedbody",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "illusion-gengar",
          planIds: [],
          interactionIds: [],
          factIds: ["gengar-cursed-body"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "illusion-gengar",
        title: "Present Hisuian Zoroark as Gengar",
        reason: "The opponent may respect Gengar's Cursed Body.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 0,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a teammate whose unrelated resistance is grouped into weakness coverage", () => {
    const pokemonSets = [
      createSet(0, "Swampert", [], {
        defensiveProfile: {
          weaknesses: [{ type: "grass", multiplier: 4 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Pelipper", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "fire", multiplier: 0.5 }],
          immunities: [],
        },
      }),
      createSet(2, "Archaludon", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "grass", multiplier: 0.5 }],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "swampert-weak-grass",
          kind: "weak-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "grass",
        },
        {
          id: "pelipper-resists-fire",
          kind: "resists",
          subjectSlotIndex: 1,
          objectSlotIndex: -1,
          state: "current",
          valueId: "fire",
        },
        {
          id: "archaludon-resists-grass",
          kind: "resists",
          subjectSlotIndex: 2,
          objectSlotIndex: -1,
          state: "current",
          valueId: "grass",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "grass-cover",
          planIds: [],
          interactionIds: [],
          factIds: [
            "swampert-weak-grass",
            "pelipper-resists-fire",
            "archaludon-resists-grass",
          ],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "grass-cover",
        title: "Cover Swampert's Grass weakness",
        reason: "Use Pelipper and Archaludon to answer Grass pressure.",
        priority: "medium",
      },
    ];

    const errors = validateCopilotStrategyAuditForRequest(
      output,
      createRequest(pokemonSets, {
        scope: "pokemon",
        selectedSlot: 0,
      }),
    );

    expect(errors).toContain(
      "Recommendation grass-cover links teammate slot 1's fire defense to an unrelated selected-Pokemon weakness.",
    );
    expect(errors).toContain(
      "Recommendation grass-cover names Pelipper in Grass coverage advice without matching resistance or immunity evidence.",
    );
  });

  it("accepts exact teammate resistance evidence for Pokemon weakness coverage", () => {
    const pokemonSets = [
      createSet(0, "Swampert", [], {
        defensiveProfile: {
          weaknesses: [{ type: "grass", multiplier: 4 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Archaludon", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "grass", multiplier: 0.5 }],
          immunities: [],
        },
      }),
      createSet(2, "Sinistcha", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "grass", multiplier: 0.5 }],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "swampert-weak-grass",
          kind: "weak-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "grass",
        },
        {
          id: "archaludon-resists-grass",
          kind: "resists",
          subjectSlotIndex: 1,
          objectSlotIndex: -1,
          state: "current",
          valueId: "grass",
        },
        {
          id: "sinistcha-resists-grass",
          kind: "resists",
          subjectSlotIndex: 2,
          objectSlotIndex: -1,
          state: "current",
          valueId: "grass",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "grass-cover",
          planIds: [],
          interactionIds: [],
          factIds: [
            "swampert-weak-grass",
            "archaludon-resists-grass",
            "sinistcha-resists-grass",
          ],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "grass-cover",
        title: "Cover Swampert's Grass weakness",
        reason: "Archaludon and Sinistcha both resist Grass pressure.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 0,
        }),
      ),
    ).toEqual([]);
  });

  it("keeps spread-move partner immunity separate from selected weaknesses", () => {
    const pokemonSets = [
      createSet(0, "Pelipper", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [],
          immunities: [{ type: "ground", cause: "typing" }],
        },
      }),
      createSet(1, "Swampert", ["earthquake"], {
        defensiveProfile: {
          weaknesses: [{ type: "grass", multiplier: 4 }],
          resistances: [],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "swampert-earthquake",
          kind: "move-owner",
          subjectSlotIndex: 1,
          objectSlotIndex: -1,
          state: "current",
          valueId: "earthquake",
        },
        {
          id: "pelipper-ground-immunity",
          kind: "immune-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "ground",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "earthquake-partner",
          planIds: [],
          interactionIds: [],
          factIds: ["swampert-earthquake", "pelipper-ground-immunity"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "earthquake-partner",
        title: "Pair Swampert with Pelipper for Earthquake",
        reason: "Pelipper is immune to Ground while Swampert uses Earthquake.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 1,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a false claim that no teammate resists a named weakness", () => {
    const pokemonSets = [
      createSet(0, "Hisuian Zoroark", [], {
        defensiveProfile: {
          weaknesses: [{ type: "dark", multiplier: 2 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Umbreon", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "dark", multiplier: 0.5 }],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({ plans: [] });
    output.analysis.scope = "pokemon";
    output.analysis.weaknesses = [
      "No teammate resists or is immune to Dark attacks.",
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 0,
        }),
      ),
    ).toContain(
      "Pokemon analysis claims no teammate defends against Dark, but current slot 1 does.",
    );
  });

  it("rejects a natural Korean no-switch-in claim contradicted by the roster", () => {
    const pokemonSets = [
      createSet(0, "Hisuian Zoroark", [], {
        defensiveProfile: {
          weaknesses: [{ type: "dark", multiplier: 2 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Umbreon", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "dark", multiplier: 0.5 }],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({ plans: [] });
    output.analysis.scope = "pokemon";
    output.analysis.weaknesses = [
      "현재 팀에 악 타입 공격을 받는 직접적인 저항 교대점이 없다.",
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          locale: "ko",
          scope: "pokemon",
          selectedSlot: 0,
          typeLabels: createCopilotTypeLabels("ko"),
        }),
      ),
    ).toContain(
      "Pokemon analysis claims no teammate defends against 악, but current slot 1 does.",
    );
  });

  it("does not read Korean physical-pressure prose as a Water-type claim", () => {
    const pokemonSets = [
      createSet(0, "Test Pokemon", [], {
        defensiveProfile: {
          weaknesses: [{ type: "water", multiplier: 2 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Incineroar", ["fakeout"]),
    ];
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "selected-weak-water",
          kind: "weak-to",
          subjectSlotIndex: 0,
          objectSlotIndex: -1,
          state: "current",
          valueId: "water",
        },
        {
          id: "incineroar-fake-out",
          kind: "move-owner",
          subjectSlotIndex: 1,
          objectSlotIndex: -1,
          state: "current",
          valueId: "fakeout",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "physical-pressure",
          planIds: [],
          interactionIds: [],
          factIds: ["selected-weak-water", "incineroar-fake-out"],
          candidateFactIds: [],
        },
      ],
    });
    output.analysis.scope = "pokemon";
    output.analysis.recommendations = [
      {
        id: "physical-pressure",
        title: "물리적 압박 보완",
        reason: "어흥염의 속이기로 물리적 압박을 보완한다.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          locale: "ko",
          scope: "pokemon",
          selectedSlot: 0,
          typeLabels: createCopilotTypeLabels("ko"),
        }),
      ),
    ).toEqual([]);
  });

  it("does not infer a resistance when a teammate's combined profile is neutral", () => {
    const pokemonSets = [
      createSet(0, "Hisuian Zoroark", [], {
        defensiveProfile: {
          weaknesses: [{ type: "dark", multiplier: 2 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Sableye", [], {
        types: ["dark", "ghost"],
        typeDisplayNames: ["Dark", "Ghost"],
        defensiveProfile: {
          weaknesses: [],
          resistances: [],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({ plans: [] });
    output.analysis.scope = "pokemon";
    output.analysis.weaknesses = [
      "No teammate resists or is immune to Dark attacks.",
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(pokemonSets, {
          scope: "pokemon",
          selectedSlot: 0,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a team-wide negative defensive claim contradicted by a current set", () => {
    const defensiveSets = [
      createSet(0, "Charizard", [], {
        defensiveProfile: {
          weaknesses: [{ type: "water", multiplier: 2 }],
          resistances: [],
          immunities: [],
        },
      }),
      createSet(1, "Gastrodon", [], {
        defensiveProfile: {
          weaknesses: [],
          resistances: [{ type: "water", multiplier: 0.5 }],
          immunities: [],
        },
      }),
    ];
    const output = createOutput({
      plans: [
        {
          id: "defensive-core",
          lineupSlotIndexes: [0, 1],
          leadSlotIndexes: [0, 1],
          backlineSlotIndexes: [],
          actions: [],
        },
      ],
    });
    output.analysis.weaknesses = [
      "No team member resists or is immune to Water attacks.",
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(defensiveSets),
      ),
    ).toContain(
      "Team analysis claims no teammate defends against Water, but current slot 1 does.",
    );
  });

  it("accepts recommendation evidence grounded in the supplied candidate", () => {
    const recommendationCandidate: CopilotRecommendationCandidateSnapshot = {
      pokemonId: "rotom-wash",
      displayName: "Rotom Wash",
      types: ["electric", "water"],
      typeDisplayNames: ["Electric", "Water"],
      abilities: [
        { id: "levitate", displayName: "Levitate", effect: "Ground immunity." },
      ],
      baseStats: null,
      speedTier: "mid",
      requiresMegaStone: false,
      usageRank: 18,
      commonSet: null,
      responsibilityIds: [],
      fit: {
        weakTo: [],
        resistsTeamThreats: ["water"],
        amplifiesTeamThreats: [],
        addsUnansweredWeaknesses: [],
        coversTypes: [],
        roleContributions: [],
        roleRedundancies: [],
        conceptSynergies: [],
        conflicts: [],
      },
    };
    const output = createOutput({
      plans: [],
      candidateFacts: [
        {
          id: "rotom-water-answer",
          candidateId: "rotom-wash",
          kind: "resists-team-threat",
          valueId: "water",
        },
        {
          id: "rotom-speed-tier",
          candidateId: "rotom-wash",
          kind: "speed-tier",
          valueId: "mid",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "rotom-wash",
          planIds: [],
          interactionIds: [],
          factIds: [],
          candidateFactIds: ["rotom-water-answer", "rotom-speed-tier"],
        },
      ],
    });
    output.analysis.scope = "recommendation";
    output.analysis.recommendations = [
      {
        id: "rotom-wash",
        title: "Rotom Wash",
        reason: "Answers Water pressure, but its mid Speed needs positioning.",
        priority: "medium",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest([], {
          scope: "recommendation",
          recommendationCandidates: [recommendationCandidate],
        }),
      ),
    ).toEqual([]);
  });

  it("completes exact named candidate-element evidence from the request", () => {
    const recommendationCandidate: CopilotRecommendationCandidateSnapshot = {
      pokemonId: "rotom-wash",
      displayName: "Rotom Wash",
      types: ["electric", "water"],
      typeDisplayNames: ["Electric", "Water"],
      abilities: [{ id: "levitate", displayName: "Levitate" }],
      baseStats: null,
      speedTier: "mid",
      requiresMegaStone: false,
      usageRank: 18,
      commonSet: {
        ability: "Levitate",
        item: "Sitrus Berry",
        nature: "Modest",
        moves: [
          {
            id: "hydropump",
            displayName: "Hydro Pump",
            type: "water",
            category: "Special",
            power: 110,
          },
        ],
      },
      responsibilityIds: [],
      fit: {
        weakTo: [],
        resistsTeamThreats: ["water"],
        amplifiesTeamThreats: [],
        addsUnansweredWeaknesses: [],
        coversTypes: [],
        roleContributions: [],
        roleRedundancies: [],
        conceptSynergies: [],
        conflicts: [],
      },
    };
    const output = createOutput({
      plans: [],
      candidateFacts: [
        {
          id: "rotom-water-answer",
          candidateId: "rotom-wash",
          kind: "resists-team-threat",
          valueId: "water",
        },
        {
          id: "rotom-speed-tier",
          candidateId: "rotom-wash",
          kind: "speed-tier",
          valueId: "mid",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "rotom-wash",
          planIds: [],
          interactionIds: [],
          factIds: [],
          candidateFactIds: ["rotom-speed-tier"],
        },
      ],
    });
    output.analysis.scope = "recommendation";
    output.analysis.recommendations = [
      {
        id: "rotom-wash",
        title: "Rotom Wash",
        reason: "Levitate provides the fit, while Hydro Pump supplies pressure.",
        priority: "medium",
      },
    ];
    const request = createRequest([], {
      scope: "recommendation",
      recommendationCandidates: [recommendationCandidate],
    });

    const completed = completeCopilotRecommendationAudit(output, request);

    expect(completed.strategyAudit.candidateFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateId: "rotom-wash",
          kind: "ability",
          valueId: "levitate",
        }),
        expect.objectContaining({
          candidateId: "rotom-wash",
          kind: "common-move",
          valueId: "hydropump",
        }),
      ]),
    );
    expect(validateCopilotStrategyAuditForRequest(completed, request)).toEqual([]);
    expect(
      completed.strategyAudit.recommendationEvidence[0]?.candidateFactIds,
    ).toContain("rotom-water-answer");
    expect(output.strategyAudit.candidateFacts).toHaveLength(2);
  });

  it("downgrades an over-specific candidate weakness fact to exact typing evidence", () => {
    const recommendationCandidate: CopilotRecommendationCandidateSnapshot = {
      pokemonId: "raichu",
      displayName: "Raichu",
      types: ["electric"],
      typeDisplayNames: ["Electric"],
      abilities: [{ id: "lightningrod", displayName: "Lightning Rod" }],
      baseStats: null,
      speedTier: "fast",
      requiresMegaStone: false,
      usageRank: 20,
      commonSet: null,
      responsibilityIds: ["attack-redirection"],
      fit: {
        weakTo: ["ground"],
        resistsTeamThreats: [],
        amplifiesTeamThreats: [],
        addsUnansweredWeaknesses: [],
        coversTypes: [],
        roleContributions: [],
        roleRedundancies: [],
        conceptSynergies: [],
        conflicts: [],
      },
    };
    const output = createOutput({
      plans: [],
      candidateFacts: [
        {
          id: "raichu-fit",
          candidateId: "raichu",
          kind: "ability",
          valueId: "lightningrod",
        },
        {
          id: "raichu-ground",
          candidateId: "raichu",
          kind: "adds-unanswered-weakness",
          valueId: "ground",
        },
        {
          id: "raichu-redirection",
          candidateId: "raichu",
          kind: "role-contribution",
          valueId: "attack-redirection",
        },
        {
          id: "raichu-invented-rain-fit",
          candidateId: "raichu",
          kind: "concept-synergy",
          valueId: "rain",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "raichu",
          planIds: [],
          interactionIds: [],
          factIds: [],
          candidateFactIds: [
            "raichu-fit",
            "raichu-ground",
            "raichu-redirection",
            "raichu-invented-rain-fit",
          ],
        },
      ],
    });
    output.analysis.scope = "recommendation";
    output.analysis.recommendations = [
      {
        id: "raichu",
        title: "Raichu",
        reason: "Lightning Rod redirects Electric moves, but Raichu is weak to Ground.",
        priority: "medium",
      },
    ];
    const request = createRequest([], {
      scope: "recommendation",
      recommendationCandidates: [recommendationCandidate],
    });

    const completed = completeCopilotRecommendationAudit(output, request);

    expect(completed.strategyAudit.candidateFacts[1]).toMatchObject({
      id: "raichu-ground",
      kind: "weak-to",
      valueId: "ground",
    });
    expect(completed.strategyAudit.candidateFacts[2]).toMatchObject({
      id: "raichu-redirection",
      kind: "responsibility",
      valueId: "attack-redirection",
    });
    expect(completed.strategyAudit.candidateFacts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "raichu-invented-rain-fit" }),
      ]),
    );
    expect(
      completed.strategyAudit.recommendationEvidence[0]?.candidateFactIds,
    ).not.toContain("raichu-invented-rain-fit");
    expect(validateCopilotStrategyAuditForRequest(completed, request)).toEqual([]);
  });

  it("rejects invented recommendation fit and ungrounded named elements", () => {
    const recommendationCandidate: CopilotRecommendationCandidateSnapshot = {
      pokemonId: "rotom-wash",
      displayName: "Rotom Wash",
      types: ["electric", "water"],
      typeDisplayNames: ["Electric", "Water"],
      abilities: [{ id: "levitate", displayName: "Levitate" }],
      baseStats: null,
      speedTier: "mid",
      requiresMegaStone: false,
      usageRank: 18,
      commonSet: null,
      responsibilityIds: [],
      fit: {
        weakTo: [],
        resistsTeamThreats: ["water"],
        amplifiesTeamThreats: [],
        addsUnansweredWeaknesses: [],
        coversTypes: [],
        roleContributions: [],
        roleRedundancies: [],
        conceptSynergies: [],
        conflicts: [],
      },
    };
    const output = createOutput({
      plans: [],
      candidateFacts: [
        {
          id: "invented-rain-fit",
          candidateId: "rotom-wash",
          kind: "concept-synergy",
          valueId: "rain",
        },
        {
          id: "rotom-speed-tier",
          candidateId: "rotom-wash",
          kind: "speed-tier",
          valueId: "mid",
        },
      ],
      recommendationEvidence: [
        {
          recommendationId: "rotom-wash",
          planIds: [],
          interactionIds: [],
          factIds: [],
          candidateFactIds: ["invented-rain-fit", "rotom-speed-tier"],
        },
      ],
    });
    output.analysis.scope = "recommendation";
    output.analysis.recommendations = [
      {
        id: "rotom-wash",
        title: "Rotom Wash",
        reason: "Levitate supports the rain plan, but its mid Speed needs help.",
        priority: "medium",
      },
    ];

    const errors = validateCopilotStrategyAuditForRequest(
      output,
      createRequest([], {
        scope: "recommendation",
        recommendationCandidates: [recommendationCandidate],
      }),
    );

    expect(errors).toContain(
      "strategyAudit.candidateFacts[0] contradicts the supplied recommendation candidate.",
    );
    expect(errors).toContain(
      "Recommendation rotom-wash names Levitate without matching candidate evidence.",
    );
  });

  it("keeps the private audit empty for an unfilled Pokemon slot", () => {
    const output = createOutput({
      plans: [],
      facts: [
        {
          id: "invented-slot",
          kind: "move-owner",
          subjectSlotIndex: 5,
          objectSlotIndex: -1,
          state: "current",
          valueId: "protect",
        },
      ],
    });
    output.analysis.scope = "pokemon";

    expect(
      validateCopilotStrategyAuditForRequest(
        output,
        createRequest(sets, {
          scope: "pokemon",
          selectedSlot: 5,
        }),
      ),
    ).toContain(
      "An empty Pokemon slot must use an empty private strategy audit.",
    );
  });

  it("allows an empty team to return general guidance without invented evidence", () => {
    const output = createOutput({ plans: [] });
    output.analysis.recommendations = [
      {
        id: "start-team",
        title: "Choose a Pokemon",
        reason: "The team has no configured sets yet.",
        priority: "high",
      },
    ];

    expect(
      validateCopilotStrategyAuditForRequest(output, createRequest([])),
    ).toEqual([]);
  });
});
