import { isRecord } from "./typeGuards.js";
import {
  copilotModelOutputJsonSchema,
} from "./copilotModelSchema.js";
import {
  copilotRecommendationCandidateFactKinds,
  copilotStrategyFactKinds,
  copilotStrategyInteractionKinds,
  copilotStrategyPhases,
  copilotStrategyPokemonStates,
  type CopilotGroundedModelOutput,
  type CopilotGroundedModelOutputValidation,
  type CopilotModelOutput,
  type CopilotModelOutputValidation,
} from "./copilotModelTypes.js";

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
  "candidateFacts",
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
const recommendationCandidateFactKeys = new Set([
  "id",
  "candidateId",
  "kind",
  "valueId",
]);
const recommendationEvidenceKeys = new Set([
  "recommendationId",
  "planIds",
  "interactionIds",
  "factIds",
  "candidateFactIds",
]);
const strategyPhases = new Set<string>(copilotStrategyPhases);
const strategyPokemonStates = new Set<string>(copilotStrategyPokemonStates);
const strategyInteractionKinds = new Set<string>(
  copilotStrategyInteractionKinds,
);
const strategyFactKinds = new Set<string>(copilotStrategyFactKinds);
const recommendationCandidateFactKinds = new Set<string>(
  copilotRecommendationCandidateFactKinds,
);

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
    value.scope !== "recommendation" &&
    value.scope !== "optimization"
  ) {
    errors.push("scope must be team, pokemon, recommendation, or optimization.");
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

function validateRecommendationCandidateFact(
  fact: unknown,
  path: string,
  errors: string[],
) {
  if (!isRecord(fact)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateExactKeys(fact, recommendationCandidateFactKeys, path, errors);

  for (const field of ["id", "candidateId", "valueId"] as const) {
    if (typeof fact[field] !== "string" || !fact[field].trim()) {
      errors.push(`${path}.${field} must be a non-empty string.`);
    }
  }

  if (
    typeof fact.kind !== "string" ||
    !recommendationCandidateFactKinds.has(fact.kind)
  ) {
    errors.push(`${path}.kind is not supported.`);
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
  validateStringArray(
    evidence.candidateFactIds,
    `${path}.candidateFactIds`,
    errors,
  );
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

    if (!Array.isArray(value.strategyAudit.candidateFacts)) {
      errors.push("strategyAudit.candidateFacts must be an array.");
    } else {
      value.strategyAudit.candidateFacts.forEach((fact, index) => {
        validateRecommendationCandidateFact(
          fact,
          `strategyAudit.candidateFacts[${index}]`,
          errors,
        );
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
