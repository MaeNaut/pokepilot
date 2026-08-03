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
    version: 11,
    locale: "en",
    scope: "team",
    battleFormat: "doubles",
    teamName: "Audit Team",
    selectedSlot: 0,
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
      "strategyAudit.facts[1] contradicts the supplied final Speed values.",
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
