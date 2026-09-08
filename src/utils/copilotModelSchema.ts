import {
  copilotRecommendationCandidateFactKinds,
  copilotStrategyFactKinds,
  copilotStrategyInteractionKinds,
  copilotStrategyPhases,
  copilotStrategyPokemonStates,
} from "./copilotModelTypes.js";

export const copilotModelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "scope",
    "title",
    "paragraphs",
    "recommendations",
  ],
  properties: {
    version: { type: "integer", const: 2 },
    scope: {
      type: "string",
      enum: ["team", "pokemon", "recommendation", "optimization", "matchup"],
    },
    title: { type: "string", minLength: 1 },
    paragraphs: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      description:
        "One to four connected prose paragraphs. Do not split them into strengths, weaknesses, checks, labels, or bullet-like fragments.",
      items: { type: "string", minLength: 1 },
    },
    recommendations: {
      type: "array",
      maxItems: 3,
      description:
        "Strategic guidance that may describe core plans, matchup branches, or optional refinements; it is not limited to edits the user must make.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "reason", "priority"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: {
            type: "string",
            minLength: 1,
            description: "A complete user-facing sentence.",
          },
          reason: {
            type: "string",
            minLength: 1,
            description: "One or more complete user-facing sentences.",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description:
              "high for the central plan or a broadly important issue, medium for matchup-dependent guidance, and low for optional refinement.",
          },
        },
      },
    },
  },
} as const;

const strategyActionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["phase", "actorSlotIndex", "moveId", "activeSlotIndexes"],
  properties: {
    phase: {
      type: "string",
      enum: copilotStrategyPhases,
    },
    actorSlotIndex: { type: "integer", minimum: 0, maximum: 11 },
    moveId: { type: "string" },
    activeSlotIndexes: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "integer", minimum: 0, maximum: 11 },
    },
  },
} as const;

const strategyPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "lineupSlotIndexes",
    "leadSlotIndexes",
    "backlineSlotIndexes",
    "actions",
  ],
  properties: {
    id: { type: "string" },
    lineupSlotIndexes: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "integer", minimum: 0, maximum: 11 },
    },
    leadSlotIndexes: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "integer", minimum: 0, maximum: 11 },
    },
    backlineSlotIndexes: {
      type: "array",
      maxItems: 3,
      items: { type: "integer", minimum: 0, maximum: 11 },
    },
    actions: {
      type: "array",
      maxItems: 12,
      items: strategyActionJsonSchema,
    },
  },
} as const;

const strategyInteractionParticipantJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["slotIndex", "state", "moveIds", "abilityIds", "itemIds"],
  properties: {
    slotIndex: { type: "integer", minimum: 0, maximum: 11 },
    state: {
      type: "string",
      enum: copilotStrategyPokemonStates,
      description:
        "current is the exact supplied set state, including an already-Mega set; mega is only a projected megaEvolution after activation.",
    },
    moveIds: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
    abilityIds: {
      type: "array",
      maxItems: 1,
      items: { type: "string" },
    },
    itemIds: {
      type: "array",
      maxItems: 1,
      items: { type: "string" },
    },
  },
} as const;

const strategyInteractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "planId",
    "kind",
    "phase",
    "activeSlotIndexes",
    "participants",
  ],
  properties: {
    id: { type: "string" },
    planId: { type: "string" },
    kind: {
      type: "string",
      description:
        "shared-move requires the exact same canonical selected move and simultaneous Doubles users; it never means merely similar moves.",
      enum: copilotStrategyInteractionKinds,
    },
    phase: {
      type: "string",
      enum: copilotStrategyPhases,
    },
    activeSlotIndexes: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "integer", minimum: 0, maximum: 11 },
    },
    participants: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: strategyInteractionParticipantJsonSchema,
    },
  },
} as const;

const strategyFactJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "kind",
    "subjectSlotIndex",
    "objectSlotIndex",
    "state",
    "valueId",
  ],
  properties: {
    id: { type: "string" },
    kind: {
      type: "string",
      enum: copilotStrategyFactKinds,
    },
    subjectSlotIndex: { type: "integer", minimum: 0, maximum: 11 },
    objectSlotIndex: { type: "integer", minimum: -1, maximum: 11 },
    state: {
      type: "string",
      enum: copilotStrategyPokemonStates,
      description:
        "current is the exact supplied set state; mega is only a projected megaEvolution after activation. A mega-option fact always uses current.",
    },
    valueId: {
      type: "string",
      description:
        "Use the matching canonical element ID; mega-option uses request.megaOptions pokemonId, and Speed facts use an empty string.",
    },
  },
} as const;

const recommendationCandidateFactJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "candidateId", "kind", "valueId"],
  properties: {
    id: { type: "string" },
    candidateId: { type: "string" },
    kind: {
      type: "string",
      enum: copilotRecommendationCandidateFactKinds,
    },
    valueId: { type: "string" },
  },
} as const;

const recommendationEvidenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "recommendationId",
    "planIds",
    "interactionIds",
    "factIds",
    "candidateFactIds",
  ],
  properties: {
    recommendationId: { type: "string" },
    planIds: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    },
    interactionIds: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
    factIds: {
      type: "array",
      maxItems: 24,
      items: { type: "string" },
    },
    candidateFactIds: {
      type: "array",
      maxItems: 40,
      items: { type: "string" },
    },
  },
} as const;

export const copilotGroundedModelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysis", "strategyAudit"],
  properties: {
    analysis: copilotModelOutputJsonSchema,
    strategyAudit: {
      type: "object",
      additionalProperties: false,
      required: [
        "plans",
        "interactions",
        "facts",
        "candidateFacts",
        "recommendationEvidence",
      ],
      properties: {
        plans: {
          type: "array",
          maxItems: 3,
          items: strategyPlanJsonSchema,
        },
        interactions: {
          type: "array",
          maxItems: 12,
          items: strategyInteractionJsonSchema,
        },
        facts: {
          type: "array",
          maxItems: 24,
          items: strategyFactJsonSchema,
        },
        candidateFacts: {
          type: "array",
          maxItems: 40,
          items: recommendationCandidateFactJsonSchema,
        },
        recommendationEvidence: {
          type: "array",
          maxItems: 3,
          items: recommendationEvidenceJsonSchema,
        },
      },
    },
  },
} as const;
