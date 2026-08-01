import type { CopilotAnalysisRequest } from "./copilotAnalysis";

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
  "sets",
  "megaOptions",
  "candidateFilters",
  "diagnostics",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

  if (value.version !== 6) {
    errors.push("version must be 6.");
  }
  if (value.locale !== "en" && value.locale !== "ko") {
    errors.push("locale must be en or ko.");
  }
  if (value.scope !== "team" && value.scope !== "pokemon") {
    errors.push("scope must be team or pokemon.");
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
  if (!isRecord(value.diagnostics)) {
    errors.push("diagnostics must be an object.");
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
