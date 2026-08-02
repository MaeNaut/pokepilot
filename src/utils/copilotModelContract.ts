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

export type CopilotStrategyAudit = {
  plans: CopilotStrategyPlan[];
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
    scope: { type: "string", enum: ["team", "pokemon"] },
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

export const copilotGroundedModelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysis", "strategyAudit"],
  properties: {
    analysis: copilotModelOutputJsonSchema,
    strategyAudit: {
      type: "object",
      additionalProperties: false,
      required: ["plans"],
      properties: {
        plans: {
          type: "array",
          maxItems: 3,
          items: strategyPlanJsonSchema,
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
const strategyAuditKeys = new Set(["plans"]);
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
const strategyPhases = new Set(["opening", "midgame", "endgame"]);

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

  if (value.scope !== "team" && value.scope !== "pokemon") {
    errors.push("scope must be team or pokemon.");
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
