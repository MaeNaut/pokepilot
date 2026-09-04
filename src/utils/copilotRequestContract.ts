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
const pokemonTypeSet = new Set<string>(pokemonTypes);
const teamRoleIds = [
  "physical-attacker",
  "special-attacker",
  "physical-wall",
  "special-wall",
  "supporter",
  "setter",
] as const;
const teamRoleIdSet = new Set<string>(teamRoleIds);
const teamConceptIds = [
  "trick-room",
  "tailwind",
  "gravity",
  "rain",
  "sun",
  "sand",
  "snow",
] as const;
const teamConceptIdSet = new Set<string>(teamConceptIds);
const validityCodes = new Set([
  "ev-stat",
  "ev-total",
  "duplicate-moves",
  "move-data-unavailable",
  "illegal-move",
  "unknown-nature",
  "mega-stone",
  "legality-unavailable",
  "illegal-pokemon",
  "illegal-item",
  "ability-data-unavailable",
  "illegal-ability",
  "duplicate-species",
  "duplicate-item",
]);
const validityScopes = new Set([
  "pokemon",
  "item",
  "ability",
  "nature",
  "ev",
  "move",
  "team",
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

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown, minimum = -10_000, maximum = 10_000) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isSlotIndex(value: unknown) {
  return isBoundedInteger(value, 0, 5);
}

function isStringArray(value: unknown, maximum = 100): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((entry) => typeof entry === "string")
  );
}

function isUniqueEnumArray(
  value: unknown,
  allowed: Set<string>,
  maximum: number,
  minimum = 0,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.every((entry) => typeof entry === "string" && allowed.has(entry)) &&
    new Set(value).size === value.length
  );
}

function isPokemonTypeArray(
  value: unknown,
  maximum = 18,
  minimum = 0,
): value is string[] {
  return isUniqueEnumArray(value, pokemonTypeSet, maximum, minimum);
}

function isStatBlock(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "hp",
      "attack",
      "defense",
      "specialAttack",
      "specialDefense",
      "speed",
    ]) &&
    ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"].every(
      (stat) => isFiniteNumber(value[stat]),
    )
  );
}

function hasValidMoveShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "name",
      "type",
      "power",
      "displayName",
      "category",
      "spreadTarget",
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    pokemonTypeSet.has(String(value.type)) &&
    (value.power === null || isFiniteNumber(value.power, 0, 1_000)) &&
    isNonEmptyString(value.displayName) &&
    ["physical", "special", "status", "unknown"].includes(String(value.category)) &&
    (value.spreadTarget === null ||
      ["all", "adjacent", "foes"].includes(String(value.spreadTarget)))
  );
}

function hasValidDefensiveProfile(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, ["weaknesses", "resistances", "immunities"])) {
    return false;
  }

  const multiplierEntriesAreValid = (entries: unknown) =>
    Array.isArray(entries) &&
    entries.length <= 18 &&
    entries.every(
      (entry) =>
        isRecord(entry) &&
        hasOnlyKeys(entry, ["type", "multiplier"]) &&
        pokemonTypeSet.has(String(entry.type)) &&
        isFiniteNumber(entry.multiplier, 0, 4),
    );
  const immunitiesAreValid =
    Array.isArray(value.immunities) &&
    value.immunities.length <= 18 &&
    value.immunities.every(
      (entry) =>
        isRecord(entry) &&
        hasOnlyKeys(entry, ["type", "cause", "ability"]) &&
        pokemonTypeSet.has(String(entry.type)) &&
        (entry.cause === "typing" || entry.cause === "ability") &&
        (!("ability" in entry) || typeof entry.ability === "string"),
    );

  return (
    multiplierEntriesAreValid(value.weaknesses) &&
    multiplierEntriesAreValid(value.resistances) &&
    immunitiesAreValid
  );
}

function hasValidMegaEvolutionShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "pokemonId",
      "pokemonName",
      "displayName",
      "types",
      "typeDisplayNames",
      "ability",
      "abilityDisplayName",
      "defensiveProfile",
    ]) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.pokemonName) &&
    isNonEmptyString(value.displayName) &&
    isPokemonTypeArray(value.types, 2, 1) &&
    isStringArray(value.typeDisplayNames, 2) &&
    value.typeDisplayNames.length === value.types.length &&
    isNullableString(value.ability) &&
    isNullableString(value.abilityDisplayName) &&
    hasValidDefensiveProfile(value.defensiveProfile)
  );
}

function hasValidOffensiveProfile(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "physicalMoveIds",
      "specialMoveIds",
      "statusMoveIds",
      "spreadMoveIds",
    ]) &&
    isStringArray(value.physicalMoveIds, 4) &&
    isStringArray(value.specialMoveIds, 4) &&
    isStringArray(value.statusMoveIds, 4) &&
    isStringArray(value.spreadMoveIds, 4)
  );
}

function hasValidIssueValues(value: unknown) {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => typeof entry === "string" || isFiniteNumber(entry),
    )
  );
}

function hasValidValidityIssue(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "code",
      "severity",
      "scope",
      "message",
      "values",
      "slotIndex",
    ]) &&
    isNonEmptyString(value.id) &&
    validityCodes.has(String(value.code)) &&
    (value.severity === "error" || value.severity === "unavailable") &&
    validityScopes.has(String(value.scope)) &&
    isNonEmptyString(value.message) &&
    (!("values" in value) || hasValidIssueValues(value.values)) &&
    (!("slotIndex" in value) || isSlotIndex(value.slotIndex))
  );
}

function hasValidSetShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "slotIndex",
      "pokemonId",
      "pokemonName",
      "displayName",
      "isMegaForm",
      "types",
      "typeDisplayNames",
      "item",
      "itemDisplayName",
      "ability",
      "abilityDisplayName",
      "nature",
      "natureDisplayName",
      "baseStats",
      "stats",
      "evs",
      "evTotal",
      "moves",
      "defensiveProfile",
      "megaEvolution",
      "offensiveProfile",
      "roleIds",
      "setterConceptIds",
      "aceConceptIds",
      "validityStatus",
      "validityIssues",
    ]) &&
    isSlotIndex(value.slotIndex) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.pokemonName) &&
    isNonEmptyString(value.displayName) &&
    typeof value.isMegaForm === "boolean" &&
    isPokemonTypeArray(value.types, 2, 1) &&
    isStringArray(value.typeDisplayNames, 2) &&
    value.typeDisplayNames.length === value.types.length &&
    isNullableString(value.item) &&
    isNullableString(value.itemDisplayName) &&
    isNullableString(value.ability) &&
    isNullableString(value.abilityDisplayName) &&
    isNonEmptyString(value.nature) &&
    isNonEmptyString(value.natureDisplayName) &&
    (value.baseStats === null || isStatBlock(value.baseStats)) &&
    (value.stats === null || isStatBlock(value.stats)) &&
    isStatBlock(value.evs) &&
    isFiniteNumber(value.evTotal, 0, 1_512) &&
    Array.isArray(value.moves) &&
    value.moves.length <= 4 &&
    value.moves.every(hasValidMoveShape) &&
    hasValidDefensiveProfile(value.defensiveProfile) &&
    (value.megaEvolution === null || hasValidMegaEvolutionShape(value.megaEvolution)) &&
    hasValidOffensiveProfile(value.offensiveProfile) &&
    isUniqueEnumArray(value.roleIds, teamRoleIdSet, teamRoleIds.length) &&
    isUniqueEnumArray(value.setterConceptIds, teamConceptIdSet, teamConceptIds.length) &&
    isUniqueEnumArray(value.aceConceptIds, teamConceptIdSet, teamConceptIds.length) &&
    ["empty", "valid", "invalid", "unavailable"].includes(
      String(value.validityStatus),
    ) &&
    Array.isArray(value.validityIssues) &&
    value.validityIssues.length <= 32 &&
    value.validityIssues.every(hasValidValidityIssue)
  );
}

function hasValidMegaOptionShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "slotIndex",
      "pokemonId",
      "pokemonName",
      "displayName",
      "types",
      "typeDisplayNames",
      "ability",
      "abilityDisplayName",
    ]) &&
    isSlotIndex(value.slotIndex) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.pokemonName) &&
    isNonEmptyString(value.displayName) &&
    isPokemonTypeArray(value.types, 2, 1) &&
    isStringArray(value.typeDisplayNames, 2) &&
    value.typeDisplayNames.length === value.types.length &&
    isNullableString(value.ability) &&
    isNullableString(value.abilityDisplayName)
  );
}

function hasValidFilterValue(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "name"]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name)
  );
}

function hasValidCandidateFilterShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["slotIndex", "types", "ability", "moves"]) &&
    isSlotIndex(value.slotIndex) &&
    isPokemonTypeArray(value.types, 2) &&
    (value.ability === null || hasValidFilterValue(value.ability)) &&
    Array.isArray(value.moves) &&
    value.moves.length <= 4 &&
    value.moves.every(hasValidFilterValue)
  );
}

function hasValidMechanicEntry(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "displayName", "effect", "tags"]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName) &&
    (!("effect" in value) || typeof value.effect === "string") &&
    (!("tags" in value) || isStringArray(value.tags, 32))
  );
}

function hasValidMechanicsShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["moves", "abilities", "items"]) &&
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

function hasValidCommonSet(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["ability", "item", "nature", "moves"]) &&
    isNullableString(value.ability) &&
    isNullableString(value.item) &&
    isNullableString(value.nature) &&
    Array.isArray(value.moves) &&
    value.moves.length <= 4 &&
    value.moves.every(
      (move) =>
        isRecord(move) &&
        hasOnlyKeys(move, [
          "id",
          "displayName",
          "type",
          "category",
          "power",
          "effect",
        ]) &&
        isNonEmptyString(move.id) &&
        isNonEmptyString(move.displayName) &&
        pokemonTypeSet.has(String(move.type)) &&
        isNonEmptyString(move.category) &&
        (move.power === null || isFiniteNumber(move.power, 0, 1_000)) &&
        (!("effect" in move) || typeof move.effect === "string"),
    )
  );
}

function hasValidRecommendationCandidateShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "pokemonId",
      "displayName",
      "types",
      "typeDisplayNames",
      "abilities",
      "baseStats",
      "speedTier",
      "requiresMegaStone",
      "usageRank",
      "commonSet",
      "responsibilityIds",
      "fit",
    ]) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.displayName) &&
    isPokemonTypeArray(value.types, 2, 1) &&
    isStringArray(value.typeDisplayNames, 2) &&
    value.typeDisplayNames.length === value.types.length &&
    Array.isArray(value.abilities) &&
    value.abilities.length <= 6 &&
    value.abilities.every(
      (ability) =>
        isRecord(ability) &&
        hasOnlyKeys(ability, ["id", "displayName", "effect"]) &&
        isNonEmptyString(ability.id) &&
        isNonEmptyString(ability.displayName) &&
        (!("effect" in ability) || typeof ability.effect === "string"),
    ) &&
    (value.baseStats === null || isStatBlock(value.baseStats)) &&
    ["very-slow", "slow", "mid", "fast", "very-fast", "unknown"].includes(
      String(value.speedTier),
    ) &&
    typeof value.requiresMegaStone === "boolean" &&
    (value.usageRank === null || isBoundedInteger(value.usageRank, 1, 100_000)) &&
    (value.commonSet === null || hasValidCommonSet(value.commonSet)) &&
    isUniqueEnumArray(
      value.responsibilityIds,
      new Set<string>(copilotResponsibilityIds),
      copilotResponsibilityIds.length,
    ) &&
    isRecord(value.fit) &&
    hasOnlyKeys(value.fit, [
      "weakTo",
      "resistsTeamThreats",
      "amplifiesTeamThreats",
      "addsUnansweredWeaknesses",
      "coversTypes",
      "roleContributions",
      "roleRedundancies",
      "conceptSynergies",
      "conflicts",
    ]) &&
    isPokemonTypeArray(value.fit.weakTo) &&
    isPokemonTypeArray(value.fit.resistsTeamThreats) &&
    isPokemonTypeArray(value.fit.amplifiesTeamThreats) &&
    isPokemonTypeArray(value.fit.addsUnansweredWeaknesses) &&
    isPokemonTypeArray(value.fit.coversTypes) &&
    isUniqueEnumArray(value.fit.roleContributions, teamRoleIdSet, teamRoleIds.length) &&
    isUniqueEnumArray(value.fit.roleRedundancies, teamRoleIdSet, teamRoleIds.length) &&
    isUniqueEnumArray(
      value.fit.conceptSynergies,
      teamConceptIdSet,
      teamConceptIds.length,
    ) &&
    isStringArray(value.fit.conflicts, 6)
  );
}

function hasValidResponsibilityCounts(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, copilotResponsibilityIds) &&
    copilotResponsibilityIds.every((responsibility) =>
      isBoundedInteger(value[responsibility], 0, 6),
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
      !hasOnlyKeys(entry, ["id", "displayName"]) ||
      !pokemonTypeSet.has(String(entry.id)) ||
      !isNonEmptyString(entry.displayName) ||
      labelsById.has(String(entry.id))
    ) {
      return false;
    }
    labelsById.set(String(entry.id), String(entry.displayName));
  }

  return pokemonTypes.every((type) => labelsById.has(type));
}

function hasValidStringArrayRecord(value: unknown, restrictToTypes = false) {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, entries]) =>
        (!restrictToTypes || pokemonTypeSet.has(key)) && isStringArray(entries, 24),
    )
  );
}

function hasValidConcept(value: unknown) {
  const slotArray = (entry: unknown) =>
    Array.isArray(entry) &&
    entry.length <= 6 &&
    entry.every(isSlotIndex) &&
    new Set(entry).size === entry.length;

  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "label",
      "status",
      "setterSlots",
      "aceSlots",
      "dependentAceSlots",
      "independentAttackerSlots",
      "hasIndependentAttacker",
    ]) &&
    teamConceptIdSet.has(String(value.id)) &&
    isNonEmptyString(value.label) &&
    ["complete", "setup-only", "beneficiary-only"].includes(String(value.status)) &&
    slotArray(value.setterSlots) &&
    slotArray(value.aceSlots) &&
    slotArray(value.dependentAceSlots) &&
    slotArray(value.independentAttackerSlots) &&
    typeof value.hasIndependentAttacker === "boolean"
  );
}

function hasValidDiagnostics(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasOnlyKeys(value, [
      "filledSlots",
      "coverageCount",
      "coverageGaps",
      "defensiveMatchups",
      "alerts",
      "roleCounts",
      "responsibilityCounts",
      "moveSources",
      "defensiveProfile",
      "offensiveProfile",
      "concepts",
      "validity",
    ])
  ) {
    return false;
  }

  return (
    isBoundedInteger(value.filledSlots, 0, 6) &&
    isBoundedInteger(value.coverageCount, 0, 18) &&
    isPokemonTypeArray(value.coverageGaps) &&
    Array.isArray(value.defensiveMatchups) &&
    value.defensiveMatchups.length <= 18 &&
    value.defensiveMatchups.every(
      (matchup) =>
        isRecord(matchup) &&
        hasOnlyKeys(matchup, [
          "type",
          "weakCount",
          "fourTimesWeakCount",
          "resistCount",
          "immuneCount",
        ]) &&
        pokemonTypeSet.has(String(matchup.type)) &&
        isBoundedInteger(matchup.weakCount, 0, 6) &&
        isBoundedInteger(matchup.fourTimesWeakCount, 0, 6) &&
        isBoundedInteger(matchup.resistCount, 0, 6) &&
        isBoundedInteger(matchup.immuneCount, 0, 6),
    ) &&
    Array.isArray(value.alerts) &&
    value.alerts.length <= 32 &&
    value.alerts.every(
      (alert) =>
        isRecord(alert) &&
        hasOnlyKeys(alert, ["id", "tone", "message"]) &&
        isNonEmptyString(alert.id) &&
        ["danger", "warning", "info", "success"].includes(String(alert.tone)) &&
        isNonEmptyString(alert.message),
    ) &&
    isRecord(value.roleCounts) &&
    hasOnlyKeys(value.roleCounts, teamRoleIds) &&
    teamRoleIds.every((role) =>
      isBoundedInteger(
        (value.roleCounts as Record<string, unknown>)[role],
        0,
        6,
      ),
    ) &&
    hasValidResponsibilityCounts(value.responsibilityCounts) &&
    hasValidStringArrayRecord(value.moveSources) &&
    isRecord(value.defensiveProfile) &&
    hasOnlyKeys(value.defensiveProfile, ["weakTo", "resists", "immuneTo"]) &&
    hasValidStringArrayRecord(value.defensiveProfile.weakTo, true) &&
    hasValidStringArrayRecord(value.defensiveProfile.resists, true) &&
    hasValidStringArrayRecord(value.defensiveProfile.immuneTo, true) &&
    isRecord(value.offensiveProfile) &&
    hasOnlyKeys(value.offensiveProfile, [
      "physicalMoveCount",
      "specialMoveCount",
      "spreadMoveCount",
      "physicalSources",
      "specialSources",
      "spreadSources",
    ]) &&
    isBoundedInteger(value.offensiveProfile.physicalMoveCount, 0, 24) &&
    isBoundedInteger(value.offensiveProfile.specialMoveCount, 0, 24) &&
    isBoundedInteger(value.offensiveProfile.spreadMoveCount, 0, 24) &&
    hasValidStringArrayRecord(value.offensiveProfile.physicalSources) &&
    hasValidStringArrayRecord(value.offensiveProfile.specialSources) &&
    hasValidStringArrayRecord(value.offensiveProfile.spreadSources) &&
    Array.isArray(value.concepts) &&
    value.concepts.length <= teamConceptIds.length &&
    value.concepts.every(hasValidConcept) &&
    isRecord(value.validity) &&
    hasOnlyKeys(value.validity, ["status", "errorCount", "unavailableCount"]) &&
    ["valid", "invalid", "unavailable"].includes(String(value.validity.status)) &&
    isBoundedInteger(value.validity.errorCount, 0, 100) &&
    isBoundedInteger(value.validity.unavailableCount, 0, 100)
  );
}

function hasUniqueSlots(entries: unknown[]) {
  const slots = entries.map((entry) =>
    isRecord(entry) ? Number(entry.slotIndex) : Number.NaN,
  );
  return new Set(slots).size === slots.length;
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

  if (value.version !== 14) errors.push("version must be 14.");
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
  if (!isSlotIndex(value.selectedSlot)) {
    errors.push("selectedSlot must be an integer from 0 to 5.");
  }
  if (!hasValidTypeLabels(value.typeLabels)) {
    errors.push("typeLabels must contain one localized label for every type.");
  }

  const setsAreValid =
    Array.isArray(value.sets) &&
    value.sets.length <= 6 &&
    value.sets.every(hasValidSetShape) &&
    hasUniqueSlots(value.sets);
  if (!setsAreValid) {
    const invalidSetIndexes = Array.isArray(value.sets)
      ? value.sets.flatMap((set, index) =>
          hasValidSetShape(set) ? [] : [index],
        )
      : [];
    errors.push(
      invalidSetIndexes.length > 0
        ? `sets contain invalid snapshots at indexes ${invalidSetIndexes.join(", ")}.`
        : "sets must contain at most six valid snapshots with unique slots.",
    );
  }

  const megaOptionsAreValid =
    Array.isArray(value.megaOptions) &&
    value.megaOptions.length <= 6 &&
    value.megaOptions.every(hasValidMegaOptionShape) &&
    hasUniqueSlots(value.megaOptions);
  if (!megaOptionsAreValid) {
    errors.push("megaOptions must contain at most six valid entries with unique slots.");
  }

  const candidateFiltersAreValid =
    Array.isArray(value.candidateFilters) &&
    value.candidateFilters.length <= 6 &&
    value.candidateFilters.every(hasValidCandidateFilterShape) &&
    hasUniqueSlots(value.candidateFilters);
  if (!candidateFiltersAreValid) {
    errors.push("candidateFilters must contain at most six valid entries with unique slots.");
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
    errors.push("recommendationCandidates must be empty outside recommendation scope.");
  }
  if (!hasValidMechanicsShape(value.mechanics)) {
    errors.push("mechanics must contain bounded move, ability, and item arrays.");
  }
  if (!hasValidDiagnostics(value.diagnostics)) {
    errors.push("diagnostics must match the complete diagnostics contract.");
  }

  if (
    setsAreValid &&
    Array.isArray(value.sets) &&
    isRecord(value.diagnostics) &&
    value.diagnostics.filledSlots !== value.sets.length
  ) {
    errors.push("diagnostics.filledSlots must match the number of set snapshots.");
  }
  if (
    value.scope === "pokemon" &&
    setsAreValid &&
    Array.isArray(value.sets) &&
    !value.sets.some(
      (set) => isRecord(set) && set.slotIndex === value.selectedSlot,
    )
  ) {
    errors.push("pokemon scope requires a set in selectedSlot.");
  }

  validateBoundedStructure(value, "request", errors);

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return { success: true, data: value as CopilotAnalysisRequest, errors: [] };
}
