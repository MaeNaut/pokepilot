import type { CopilotAnalysisResponse } from "./copilotAnalysis";

export type CopilotModelOutput = Omit<CopilotAnalysisResponse, "source">;

export type CopilotStrategyPhase = "opening" | "midgame" | "endgame";

export type CopilotStrategyAction = {
  phase: CopilotStrategyPhase;
  actorSlotIndex: number;
  moveId: string;
  activeSlotIndexes: number[];
};

export type CopilotStrategyPlan = {
  id: string;
  lineupSlotIndexes: number[];
  leadSlotIndexes: number[];
  backlineSlotIndexes: number[];
  actions: CopilotStrategyAction[];
};

export type CopilotStrategyPokemonState = "current" | "mega";

export type CopilotStrategyInteractionKind =
  | "ally-target"
  | "shared-move"
  | "move-ability"
  | "move-item"
  | "field-control"
  | "positioning"
  | "deception"
  | "other";

export type CopilotStrategyInteractionParticipant = {
  slotIndex: number;
  state: CopilotStrategyPokemonState;
  moveIds: string[];
  abilityIds: string[];
  itemIds: string[];
};

export type CopilotStrategyInteraction = {
  id: string;
  planId: string;
  kind: CopilotStrategyInteractionKind;
  phase: CopilotStrategyPhase;
  activeSlotIndexes: number[];
  participants: CopilotStrategyInteractionParticipant[];
};

export type CopilotStrategyFactKind =
  | "move-owner"
  | "ability-owner"
  | "item-owner"
  | "mega-option"
  | "weak-to"
  | "resists"
  | "immune-to"
  | "faster-than"
  | "slower-than"
  | "speed-tie";

export type CopilotStrategyFact = {
  id: string;
  kind: CopilotStrategyFactKind;
  subjectSlotIndex: number;
  objectSlotIndex: number;
  state: CopilotStrategyPokemonState;
  valueId: string;
};

export type CopilotRecommendationEvidence = {
  recommendationId: string;
  planIds: string[];
  interactionIds: string[];
  factIds: string[];
};

export type CopilotStrategyAudit = {
  plans: CopilotStrategyPlan[];
  interactions: CopilotStrategyInteraction[];
  facts: CopilotStrategyFact[];
  recommendationEvidence: CopilotRecommendationEvidence[];
};

export type CopilotGroundedModelOutput = {
  analysis: CopilotModelOutput;
  strategyAudit: CopilotStrategyAudit;
};

export type CopilotModelOutputValidation =
  | { success: true; data: CopilotModelOutput; errors: [] }
  | { success: false; data: null; errors: string[] };

export type CopilotGroundedModelOutputValidation =
  | { success: true; data: CopilotGroundedModelOutput; errors: [] }
  | { success: false; data: null; errors: string[] };

export const copilotModelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "scope",
    "title",
    "summary",
    "playstyle",
    "strengths",
    "weaknesses",
    "recommendations",
  ],
  properties: {
    version: { type: "integer", const: 1 },
    scope: {
      type: "string",
      enum: ["team", "pokemon", "recommendation"],
    },
    title: { type: "string" },
    summary: { type: "string" },
    playstyle: { type: "string" },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    weaknesses: {
      type: "array",
      items: { type: "string" },
    },
    recommendations: {
      type: "array",
      description:
        "Strategic guidance that may describe core plans, matchup branches, or optional refinements; it is not limited to edits the user must make.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "reason", "priority"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
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
      enum: ["opening", "midgame", "endgame"],
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
      enum: ["current", "mega"],
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
      enum: [
        "ally-target",
        "shared-move",
        "move-ability",
        "move-item",
        "field-control",
        "positioning",
        "deception",
        "other",
      ],
    },
    phase: {
      type: "string",
      enum: ["opening", "midgame", "endgame"],
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
      enum: [
        "move-owner",
        "ability-owner",
        "item-owner",
        "mega-option",
        "weak-to",
        "resists",
        "immune-to",
        "faster-than",
        "slower-than",
        "speed-tie",
      ],
    },
    subjectSlotIndex: { type: "integer", minimum: 0, maximum: 11 },
    objectSlotIndex: { type: "integer", minimum: -1, maximum: 11 },
    state: {
      type: "string",
      enum: ["current", "mega"],
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

const recommendationEvidenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendationId", "planIds", "interactionIds", "factIds"],
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
      required: ["plans", "interactions", "facts", "recommendationEvidence"],
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
        recommendationEvidence: {
          type: "array",
          maxItems: 3,
          items: recommendationEvidenceJsonSchema,
        },
      },
    },
  },
} as const;

const outputKeys = new Set(Object.keys(copilotModelOutputJsonSchema.properties));
const recommendationKeys = new Set(
  Object.keys(
    copilotModelOutputJsonSchema.properties.recommendations.items.properties,
  ),
);
const recommendationPriorities = new Set(["high", "medium", "low"]);
const groundedOutputKeys = new Set(["analysis", "strategyAudit"]);
const strategyAuditKeys = new Set([
  "plans",
  "interactions",
  "facts",
  "recommendationEvidence",
]);
const strategyPlanKeys = new Set([
  "id",
  "lineupSlotIndexes",
  "leadSlotIndexes",
  "backlineSlotIndexes",
  "actions",
]);
const strategyActionKeys = new Set([
  "phase",
  "actorSlotIndex",
  "moveId",
  "activeSlotIndexes",
]);
const strategyInteractionKeys = new Set([
  "id",
  "planId",
  "kind",
  "phase",
  "activeSlotIndexes",
  "participants",
]);
const strategyInteractionParticipantKeys = new Set([
  "slotIndex",
  "state",
  "moveIds",
  "abilityIds",
  "itemIds",
]);
const strategyFactKeys = new Set([
  "id",
  "kind",
  "subjectSlotIndex",
  "objectSlotIndex",
  "state",
  "valueId",
]);
const recommendationEvidenceKeys = new Set([
  "recommendationId",
  "planIds",
  "interactionIds",
  "factIds",
]);
const strategyPhases = new Set(["opening", "midgame", "endgame"]);
const strategyPokemonStates = new Set(["current", "mega"]);
const strategyInteractionKinds = new Set([
  "ally-target",
  "shared-move",
  "move-ability",
  "move-item",
  "field-control",
  "positioning",
  "deception",
  "other",
]);
const strategyFactKinds = new Set([
  "move-owner",
  "ability-owner",
  "item-owner",
  "mega-option",
  "weak-to",
  "resists",
  "immune-to",
  "faster-than",
  "slower-than",
  "speed-tie",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
) {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    errors.push(`${path} must be an array of strings.`);
  }
}

function validateIntegerArray(
  value: unknown,
  path: string,
  errors: string[],
) {
  if (!Array.isArray(value) || !value.every(Number.isInteger)) {
    errors.push(`${path} must be an array of integers.`);
  }
}

function validateExactKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  path: string,
  errors: string[],
) {
  const unexpectedKeys = Object.keys(value).filter(
    (key) => !allowedKeys.has(key),
  );

  if (unexpectedKeys.length > 0) {
    errors.push(`${path} has unexpected fields: ${unexpectedKeys.join(", ")}.`);
  }
}

export function validateCopilotModelOutput(
  value: unknown,
): CopilotModelOutputValidation {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: ["Model output must be a JSON object."],
    };
  }

  const unexpectedKeys = Object.keys(value).filter((key) => !outputKeys.has(key));

  if (unexpectedKeys.length > 0) {
    errors.push(`Unexpected output fields: ${unexpectedKeys.join(", ")}.`);
  }

  if (value.version !== 1) {
    errors.push("version must be 1.");
  }

  if (
    value.scope !== "team" &&
    value.scope !== "pokemon" &&
    value.scope !== "recommendation"
  ) {
    errors.push("scope must be team, pokemon, or recommendation.");
  }

  for (const field of ["title", "summary", "playstyle"] as const) {
    if (typeof value[field] !== "string") {
      errors.push(`${field} must be a string.`);
    }
  }

  validateStringArray(value.strengths, "strengths", errors);
  validateStringArray(value.weaknesses, "weaknesses", errors);

  if (!Array.isArray(value.recommendations)) {
    errors.push("recommendations must be an array.");
  } else {
    value.recommendations.forEach((recommendation, index) => {
      if (!isRecord(recommendation)) {
        errors.push(`recommendations[${index}] must be an object.`);
        return;
      }

      const unexpectedRecommendationKeys = Object.keys(recommendation).filter(
        (key) => !recommendationKeys.has(key),
      );

      if (unexpectedRecommendationKeys.length > 0) {
        errors.push(
          `Unexpected recommendations[${index}] fields: ${unexpectedRecommendationKeys.join(", ")}.`,
        );
      }

      for (const field of ["id", "title", "reason"] as const) {
        if (typeof recommendation[field] !== "string") {
          errors.push(`recommendations[${index}].${field} must be a string.`);
        }
      }

      if (
        typeof recommendation.priority !== "string" ||
        !recommendationPriorities.has(recommendation.priority)
      ) {
        errors.push(
          `recommendations[${index}].priority must be high, medium, or low.`,
        );
      }
    });
  }

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return {
    success: true,
    data: value as CopilotModelOutput,
    errors: [],
  };
}

function validateStrategyInteraction(
  interaction: unknown,
  path: string,
  errors: string[],
) {
  if (!isRecord(interaction)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateExactKeys(interaction, strategyInteractionKeys, path, errors);

  for (const field of ["id", "planId"] as const) {
    if (typeof interaction[field] !== "string" || !interaction[field].trim()) {
      errors.push(`${path}.${field} must be a non-empty string.`);
    }
  }

  if (
    typeof interaction.kind !== "string" ||
    !strategyInteractionKinds.has(interaction.kind)
  ) {
    errors.push(`${path}.kind is not supported.`);
  }

  if (
    typeof interaction.phase !== "string" ||
    !strategyPhases.has(interaction.phase)
  ) {
    errors.push(`${path}.phase must be opening, midgame, or endgame.`);
  }

  validateIntegerArray(
    interaction.activeSlotIndexes,
    `${path}.activeSlotIndexes`,
    errors,
  );

  if (!Array.isArray(interaction.participants)) {
    errors.push(`${path}.participants must be an array.`);
    return;
  }

  interaction.participants.forEach((participant, participantIndex) => {
    const participantPath = `${path}.participants[${participantIndex}]`;
    if (!isRecord(participant)) {
      errors.push(`${participantPath} must be an object.`);
      return;
    }

    validateExactKeys(
      participant,
      strategyInteractionParticipantKeys,
      participantPath,
      errors,
    );

    if (!Number.isInteger(participant.slotIndex)) {
      errors.push(`${participantPath}.slotIndex must be an integer.`);
    }

    if (
      typeof participant.state !== "string" ||
      !strategyPokemonStates.has(participant.state)
    ) {
      errors.push(`${participantPath}.state must be current or mega.`);
    }

    validateStringArray(participant.moveIds, `${participantPath}.moveIds`, errors);
    validateStringArray(
      participant.abilityIds,
      `${participantPath}.abilityIds`,
      errors,
    );
    validateStringArray(participant.itemIds, `${participantPath}.itemIds`, errors);
  });
}

function validateStrategyFact(fact: unknown, path: string, errors: string[]) {
  if (!isRecord(fact)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateExactKeys(fact, strategyFactKeys, path, errors);

  if (typeof fact.id !== "string" || !fact.id.trim()) {
    errors.push(`${path}.id must be a non-empty string.`);
  }

  if (typeof fact.kind !== "string" || !strategyFactKinds.has(fact.kind)) {
    errors.push(`${path}.kind is not supported.`);
  }

  if (!Number.isInteger(fact.subjectSlotIndex)) {
    errors.push(`${path}.subjectSlotIndex must be an integer.`);
  }

  if (!Number.isInteger(fact.objectSlotIndex)) {
    errors.push(`${path}.objectSlotIndex must be an integer.`);
  }

  if (
    typeof fact.state !== "string" ||
    !strategyPokemonStates.has(fact.state)
  ) {
    errors.push(`${path}.state must be current or mega.`);
  }

  if (typeof fact.valueId !== "string") {
    errors.push(`${path}.valueId must be a string.`);
  }
}

function validateRecommendationEvidence(
  evidence: unknown,
  path: string,
  errors: string[],
) {
  if (!isRecord(evidence)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateExactKeys(evidence, recommendationEvidenceKeys, path, errors);

  if (
    typeof evidence.recommendationId !== "string" ||
    !evidence.recommendationId.trim()
  ) {
    errors.push(`${path}.recommendationId must be a non-empty string.`);
  }

  validateStringArray(evidence.planIds, `${path}.planIds`, errors);
  validateStringArray(
    evidence.interactionIds,
    `${path}.interactionIds`,
    errors,
  );
  validateStringArray(evidence.factIds, `${path}.factIds`, errors);
}

export function validateCopilotGroundedModelOutput(
  value: unknown,
): CopilotGroundedModelOutputValidation {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: ["Grounded model output must be a JSON object."],
    };
  }

  validateExactKeys(value, groundedOutputKeys, "output", errors);

  const analysisValidation = validateCopilotModelOutput(value.analysis);
  if (!analysisValidation.success) {
    errors.push(
      ...analysisValidation.errors.map((error) => `analysis: ${error}`),
    );
  }

  if (!isRecord(value.strategyAudit)) {
    errors.push("strategyAudit must be an object.");
  } else {
    validateExactKeys(
      value.strategyAudit,
      strategyAuditKeys,
      "strategyAudit",
      errors,
    );

    if (!Array.isArray(value.strategyAudit.plans)) {
      errors.push("strategyAudit.plans must be an array.");
    } else {
      value.strategyAudit.plans.forEach((plan, planIndex) => {
        const planPath = `strategyAudit.plans[${planIndex}]`;

        if (!isRecord(plan)) {
          errors.push(`${planPath} must be an object.`);
          return;
        }

        validateExactKeys(plan, strategyPlanKeys, planPath, errors);

        if (typeof plan.id !== "string" || !plan.id.trim()) {
          errors.push(`${planPath}.id must be a non-empty string.`);
        }

        validateIntegerArray(
          plan.lineupSlotIndexes,
          `${planPath}.lineupSlotIndexes`,
          errors,
        );
        validateIntegerArray(
          plan.leadSlotIndexes,
          `${planPath}.leadSlotIndexes`,
          errors,
        );
        validateIntegerArray(
          plan.backlineSlotIndexes,
          `${planPath}.backlineSlotIndexes`,
          errors,
        );

        if (!Array.isArray(plan.actions)) {
          errors.push(`${planPath}.actions must be an array.`);
          return;
        }

        plan.actions.forEach((action, actionIndex) => {
          const actionPath = `${planPath}.actions[${actionIndex}]`;

          if (!isRecord(action)) {
            errors.push(`${actionPath} must be an object.`);
            return;
          }

          validateExactKeys(action, strategyActionKeys, actionPath, errors);

          if (
            typeof action.phase !== "string" ||
            !strategyPhases.has(action.phase)
          ) {
            errors.push(
              `${actionPath}.phase must be opening, midgame, or endgame.`,
            );
          }

          if (!Number.isInteger(action.actorSlotIndex)) {
            errors.push(`${actionPath}.actorSlotIndex must be an integer.`);
          }

          if (typeof action.moveId !== "string" || !action.moveId.trim()) {
            errors.push(`${actionPath}.moveId must be a non-empty string.`);
          }

          validateIntegerArray(
            action.activeSlotIndexes,
            `${actionPath}.activeSlotIndexes`,
            errors,
          );
        });
      });
    }

    if (!Array.isArray(value.strategyAudit.interactions)) {
      errors.push("strategyAudit.interactions must be an array.");
    } else {
      value.strategyAudit.interactions.forEach((interaction, index) => {
        validateStrategyInteraction(
          interaction,
          `strategyAudit.interactions[${index}]`,
          errors,
        );
      });
    }

    if (!Array.isArray(value.strategyAudit.facts)) {
      errors.push("strategyAudit.facts must be an array.");
    } else {
      value.strategyAudit.facts.forEach((fact, index) => {
        validateStrategyFact(fact, `strategyAudit.facts[${index}]`, errors);
      });
    }

    if (!Array.isArray(value.strategyAudit.recommendationEvidence)) {
      errors.push("strategyAudit.recommendationEvidence must be an array.");
    } else {
      value.strategyAudit.recommendationEvidence.forEach((evidence, index) => {
        validateRecommendationEvidence(
          evidence,
          `strategyAudit.recommendationEvidence[${index}]`,
          errors,
        );
      });
    }
  }

  if (errors.length > 0 || !analysisValidation.success) {
    return { success: false, data: null, errors };
  }

  return {
    success: true,
    data: value as CopilotGroundedModelOutput,
    errors: [],
  };
}
