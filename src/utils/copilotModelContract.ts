import type { CopilotAnalysisResponse } from "./copilotAnalysis";

export type CopilotModelOutput = Omit<CopilotAnalysisResponse, "source">;

export type CopilotModelOutputValidation =
  | { success: true; data: CopilotModelOutput; errors: [] }
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
          },
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
