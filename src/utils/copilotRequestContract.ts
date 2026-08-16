import type { CopilotAnalysisRequest } from "./copilotAnalysis.js";
import { pokemonTypes } from "../types.js";
import { copilotResponsibilityIds } from "./copilotResponsibilities.js";
import { isRecord } from "./typeGuards.js";

export type CopilotRequestValidation =
  | { success: true; data: CopilotAnalysisRequest; errors: [] }
  | { success: false; data: null; errors: string[] };

const requestKeys = new Set([
  "version",
  "locale",
  "scope",
  "battleFormat",
  "teamName",
  "selectedSlot",
  "typeLabels",
  "sets",
  "megaOptions",
  "candidateFilters",
  "recommendationCandidates",
  "mechanics",
  "diagnostics",
]);

function validateBoundedStructure(
  value: unknown,
  path: string,
  errors: string[],
  depth = 0,
) {
  if (depth > 12) {
    errors.push(`${path} exceeds the maximum nesting depth.`);
    return;
  }

  if (typeof value === "string") {
    if (value.length > 1_000) {
      errors.push(`${path} exceeds the maximum string length.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 100) {
      errors.push(`${path} exceeds the maximum array length.`);
      return;
    }
    value.forEach((entry, index) =>
      validateBoundedStructure(entry, `${path}[${index}]`, errors, depth + 1),
    );
    return;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > 100) {
      errors.push(`${path} exceeds the maximum object size.`);
      return;
    }
    entries.forEach(([key, entry]) =>
      validateBoundedStructure(entry, `${path}.${key}`, errors, depth + 1),
    );
  }
}

function hasValidSetShape(value: unknown) {
  return (
    isRecord(value) &&
    Number.isInteger(value.slotIndex) &&
    typeof value.pokemonId === "string" &&
    typeof value.displayName === "string" &&
    Array.isArray(value.types) &&
    Array.isArray(value.moves) &&
    value.moves.length <= 4 &&
    (value.baseStats === null || isStatBlock(value.baseStats)) &&
    (value.stats === null || isStatBlock(value.stats)) &&
    isRecord(value.evs) &&
    isRecord(value.defensiveProfile) &&
    isRecord(value.offensiveProfile) &&
    Array.isArray(value.validityIssues)
  );
}

function isStatBlock(value: unknown) {
  return (
    isRecord(value) &&
    ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"].every(
      (stat) => typeof value[stat] === "number" && Number.isFinite(value[stat]),
    )
  );
}

function hasValidMechanicEntry(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    (!("effect" in value) || typeof value.effect === "string") &&
    (!("tags" in value) ||
      (Array.isArray(value.tags) &&
        value.tags.length <= 32 &&
        value.tags.every((tag) => typeof tag === "string")))
  );
}

function hasValidMechanicsShape(value: unknown) {
  return (
    isRecord(value) &&
    Array.isArray(value.moves) &&
    value.moves.length <= 24 &&
    value.moves.every(hasValidMechanicEntry) &&
    Array.isArray(value.abilities) &&
    value.abilities.length <= 12 &&
    value.abilities.every(hasValidMechanicEntry) &&
    Array.isArray(value.items) &&
    value.items.length <= 6 &&
    value.items.every(hasValidMechanicEntry)
  );
}

function hasValidRecommendationCandidateShape(value: unknown) {
  const stringArray = (entry: unknown, maxLength = 18) =>
    Array.isArray(entry) &&
    entry.length <= maxLength &&
    entry.every((item) => typeof item === "string");
  const responsibilityArray = (entry: unknown) =>
    Array.isArray(entry) &&
    entry.length <= copilotResponsibilityIds.length &&
    entry.every(
      (responsibility): responsibility is (typeof copilotResponsibilityIds)[number] =>
        typeof responsibility === "string" &&
        copilotResponsibilityIds.includes(
          responsibility as (typeof copilotResponsibilityIds)[number],
        ),
    );

  return (
    isRecord(value) &&
    typeof value.pokemonId === "string" &&
    typeof value.displayName === "string" &&
    Array.isArray(value.types) &&
    value.types.length >= 1 &&
    value.types.length <= 2 &&
    Array.isArray(value.typeDisplayNames) &&
    value.typeDisplayNames.length === value.types.length &&
    Array.isArray(value.abilities) &&
    value.abilities.length <= 6 &&
    value.abilities.every(
      (ability) =>
        isRecord(ability) &&
        typeof ability.id === "string" &&
        typeof ability.displayName === "string" &&
        (!("effect" in ability) || typeof ability.effect === "string"),
    ) &&
    (value.baseStats === null || isStatBlock(value.baseStats)) &&
    typeof value.speedTier === "string" &&
    ["very-slow", "slow", "mid", "fast", "very-fast", "unknown"].includes(
      value.speedTier,
    ) &&
    typeof value.requiresMegaStone === "boolean" &&
    (value.usageRank === null ||
      (Number.isInteger(value.usageRank) && Number(value.usageRank) > 0)) &&
    (value.commonSet === null ||
      (isRecord(value.commonSet) &&
        (value.commonSet.ability === null ||
          typeof value.commonSet.ability === "string") &&
        (value.commonSet.item === null || typeof value.commonSet.item === "string") &&
        (value.commonSet.nature === null ||
          typeof value.commonSet.nature === "string") &&
        Array.isArray(value.commonSet.moves) &&
        value.commonSet.moves.length <= 4 &&
        value.commonSet.moves.every(
          (move) =>
            isRecord(move) &&
            typeof move.id === "string" &&
            typeof move.displayName === "string" &&
            typeof move.type === "string" &&
            typeof move.category === "string" &&
            (move.power === null ||
              (typeof move.power === "number" && Number.isFinite(move.power))) &&
            (!("effect" in move) || typeof move.effect === "string"),
        ))) &&
    responsibilityArray(value.responsibilityIds) &&
    isRecord(value.fit) &&
    stringArray(value.fit.weakTo) &&
    stringArray(value.fit.resistsTeamThreats) &&
    stringArray(value.fit.amplifiesTeamThreats) &&
    stringArray(value.fit.addsUnansweredWeaknesses) &&
    stringArray(value.fit.coversTypes) &&
    stringArray(value.fit.roleContributions, 6) &&
    stringArray(value.fit.roleRedundancies, 6) &&
    stringArray(value.fit.conceptSynergies, 7) &&
    stringArray(value.fit.conflicts, 6)
  );
}

function hasValidResponsibilityCounts(value: unknown) {
  return (
    isRecord(value) &&
    copilotResponsibilityIds.every(
      (responsibility) =>
        Number.isInteger(value[responsibility]) &&
        Number(value[responsibility]) >= 0 &&
        Number(value[responsibility]) <= 6,
    )
  );
}

function hasValidTypeLabels(value: unknown) {
  if (!Array.isArray(value) || value.length !== pokemonTypes.length) {
    return false;
  }

  const labelsById = new Map<string, string>();
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.displayName !== "string" ||
      entry.displayName.trim().length === 0 ||
      labelsById.has(entry.id)
    ) {
      return false;
    }
    labelsById.set(entry.id, entry.displayName);
  }

  return pokemonTypes.every((type) => labelsById.has(type));
}

export function validateCopilotAnalysisRequest(
  value: unknown,
): CopilotRequestValidation {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: ["Analysis request must be a JSON object."],
    };
  }

  const unexpectedKeys = Object.keys(value).filter((key) => !requestKeys.has(key));
  if (unexpectedKeys.length > 0) {
    errors.push(`Unexpected request fields: ${unexpectedKeys.join(", ")}.`);
  }

  if (value.version !== 14) {
    errors.push("version must be 14.");
  }
  if (value.locale !== "en" && value.locale !== "ko") {
    errors.push("locale must be en or ko.");
  }
  if (
    value.scope !== "team" &&
    value.scope !== "pokemon" &&
    value.scope !== "recommendation"
  ) {
    errors.push("scope must be team, pokemon, or recommendation.");
  }
  if (value.battleFormat !== "singles" && value.battleFormat !== "doubles") {
    errors.push("battleFormat must be singles or doubles.");
  }
  if (
    typeof value.teamName !== "string" ||
    value.teamName.length === 0 ||
    value.teamName.length > 100
  ) {
    errors.push("teamName must contain 1 to 100 characters.");
  }
  if (
    !Number.isInteger(value.selectedSlot) ||
    Number(value.selectedSlot) < 0 ||
    Number(value.selectedSlot) > 5
  ) {
    errors.push("selectedSlot must be an integer from 0 to 5.");
  }
  if (!hasValidTypeLabels(value.typeLabels)) {
    errors.push("typeLabels must contain one localized label for every type.");
  }
  if (
    !Array.isArray(value.sets) ||
    value.sets.length > 6 ||
    !value.sets.every(hasValidSetShape)
  ) {
    errors.push("sets must contain at most six valid set snapshots.");
  }
  if (!Array.isArray(value.megaOptions) || value.megaOptions.length > 6) {
    errors.push("megaOptions must contain at most six entries.");
  }
  if (
    !Array.isArray(value.candidateFilters) ||
    value.candidateFilters.length > 6
  ) {
    errors.push("candidateFilters must contain at most six entries.");
  }
  if (
    !Array.isArray(value.recommendationCandidates) ||
    value.recommendationCandidates.length > 30 ||
    !value.recommendationCandidates.every(hasValidRecommendationCandidateShape)
  ) {
    errors.push(
      "recommendationCandidates must contain at most thirty valid candidates.",
    );
  }
  if (
    value.scope !== "recommendation" &&
    Array.isArray(value.recommendationCandidates) &&
    value.recommendationCandidates.length > 0
  ) {
    errors.push(
      "recommendationCandidates must be empty outside recommendation scope.",
    );
  }
  if (!hasValidMechanicsShape(value.mechanics)) {
    errors.push("mechanics must contain bounded move, ability, and item arrays.");
  }
  if (!isRecord(value.diagnostics)) {
    errors.push("diagnostics must be an object.");
  } else if (!hasValidResponsibilityCounts(value.diagnostics.responsibilityCounts)) {
    errors.push(
      "diagnostics.responsibilityCounts must contain every supported responsibility.",
    );
  }

  validateBoundedStructure(value, "request", errors);

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return {
    success: true,
    data: value as CopilotAnalysisRequest,
    errors: [],
  };
}
