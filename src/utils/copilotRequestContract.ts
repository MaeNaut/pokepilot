import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import { normalizeShowdownId } from "../api/showdownIds.js";
import { pokemonTypes } from "../types.js";
import { copilotResponsibilityIds } from "./copilotResponsibilities.js";
import { hasValidOptimizationShape } from "./copilotRequestOptimizationValidation.js";
import { hasValidMatchupShape } from "./copilotRequestMatchupValidation.js";
import {
  hasOnlyKeys,
  hasUniqueSlots,
  isBoundedInteger,
  isFiniteNumber,
  isNonEmptyString,
  isNullableString,
  isPokemonTypeArray,
  isSlotIndex,
  isStatBlock,
  isStringArray,
  isUniqueEnumArray,
  pokemonTypeSet,
  teamConceptIds,
  teamConceptIdSet,
  teamRoleIds,
  teamRoleIdSet,
  validateBoundedStructure,
} from "./copilotRequestValidationPrimitives.js";
import { isRecord } from "./typeGuards.js";

export { isValidCopilotOptimizationCandidateSnapshot } from "./copilotRequestOptimizationValidation.js";

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
  "optimization",
  "matchup",
  "mechanics",
  "diagnostics",
]);
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
      "baseStats",
      "stats",
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
    (value.baseStats === null || isStatBlock(value.baseStats)) &&
    (value.stats === null || isStatBlock(value.stats)) &&
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
      "baseStats",
      "stats",
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
      "baseStats",
      "stats",
    ]) &&
    isSlotIndex(value.slotIndex) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.pokemonName) &&
    isNonEmptyString(value.displayName) &&
    isPokemonTypeArray(value.types, 2, 1) &&
    isStringArray(value.typeDisplayNames, 2) &&
    value.typeDisplayNames.length === value.types.length &&
    isNullableString(value.ability) &&
    isNullableString(value.abilityDisplayName) &&
    (value.baseStats === null || isStatBlock(value.baseStats)) &&
    (value.stats === null || isStatBlock(value.stats))
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
      "target",
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
    isRecord(value.target) &&
    hasOnlyKeys(value.target, [
      "mode",
      "slotIndex",
      "currentPokemonId",
      "currentDisplayName",
      "currentRoleIds",
      "currentSetterConceptIds",
      "currentAceConceptIds",
      "currentResponsibilityIds",
      "currentSupportElements",
      "megaOptionPokemonId",
      "allySupportLinks",
    ]) &&
    (value.target.mode === "addition" || value.target.mode === "replacement") &&
    isSlotIndex(value.target.slotIndex) &&
    isNullableString(value.target.currentPokemonId) &&
    isNullableString(value.target.currentDisplayName) &&
    isUniqueEnumArray(
      value.target.currentRoleIds,
      teamRoleIdSet,
      teamRoleIds.length,
    ) &&
    isUniqueEnumArray(
      value.target.currentSetterConceptIds,
      teamConceptIdSet,
      teamConceptIds.length,
    ) &&
    isUniqueEnumArray(
      value.target.currentAceConceptIds,
      teamConceptIdSet,
      teamConceptIds.length,
    ) &&
    isUniqueEnumArray(
      value.target.currentResponsibilityIds,
      new Set<string>(copilotResponsibilityIds),
      copilotResponsibilityIds.length,
    ) &&
    Array.isArray(value.target.currentSupportElements) &&
    value.target.currentSupportElements.length <= 12 &&
    value.target.currentSupportElements.every(
      (element) =>
        isRecord(element) &&
        hasOnlyKeys(element, ["kind", "id", "responsibilityIds"]) &&
        (element.kind === "move" || element.kind === "ability") &&
        isNonEmptyString(element.id) &&
        isUniqueEnumArray(
          element.responsibilityIds,
          new Set<string>(copilotResponsibilityIds),
          copilotResponsibilityIds.length,
          1,
        ),
    ) &&
    isNullableString(value.target.megaOptionPokemonId) &&
    Array.isArray(value.target.allySupportLinks) &&
    value.target.allySupportLinks.length <= 36 &&
    value.target.allySupportLinks.every(
      (link) =>
        isRecord(link) &&
        hasOnlyKeys(link, [
          "sourceSlotIndex",
          "sourceKind",
          "sourceId",
          "responsibilityId",
        ]) &&
        isSlotIndex(link.sourceSlotIndex) &&
        (link.sourceKind === "move" || link.sourceKind === "ability") &&
        isNonEmptyString(link.sourceId) &&
        copilotResponsibilityIds.includes(
          link.responsibilityId as (typeof copilotResponsibilityIds)[number],
        ),
    ) &&
    (value.target.mode === "addition"
      ? value.target.currentPokemonId === null &&
        value.target.currentDisplayName === null
      : isNonEmptyString(value.target.currentPokemonId) &&
        isNonEmptyString(value.target.currentDisplayName)) &&
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

  if (value.version !== 30) errors.push("version must be 30.");
  if (value.locale !== "en" && value.locale !== "ko") {
    errors.push("locale must be en or ko.");
  }
  if (
    value.scope !== "team" &&
    value.scope !== "pokemon" &&
    value.scope !== "recommendation" &&
    value.scope !== "optimization" &&
    value.scope !== "matchup"
  ) {
    errors.push("scope must be team, pokemon, recommendation, optimization, or matchup.");
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
  if (
    value.scope === "recommendation" &&
    setsAreValid &&
    Array.isArray(value.recommendationCandidates) &&
    value.recommendationCandidates.every(hasValidRecommendationCandidateShape)
  ) {
    const candidates = value.recommendationCandidates as
      CopilotAnalysisRequest["recommendationCandidates"];
    const sets = value.sets as CopilotAnalysisRequest["sets"];
    const candidateIds = candidates.map((candidate) =>
      String(candidate.pokemonId),
    );
    if (new Set(candidateIds).size !== candidateIds.length) {
      errors.push("recommendationCandidates must use unique pokemonId values.");
    }

    const modes = new Set(
      candidates.map((candidate) =>
        String(candidate.target.mode),
      ),
    );
    if (modes.size > 1) {
      errors.push("recommendationCandidates must use one recommendation mode.");
    }

    for (const candidate of candidates) {
      const targetSet = sets.find(
        (set) => set.slotIndex === candidate.target.slotIndex,
      );
      if (candidate.target.mode === "addition" && targetSet) {
        errors.push("Addition recommendation targets must be empty slots.");
        break;
      }
      if (
        candidate.target.mode === "addition" &&
        ((candidate.target.currentRoleIds?.length ?? 0) > 0 ||
          (candidate.target.currentSetterConceptIds?.length ?? 0) > 0 ||
          (candidate.target.currentAceConceptIds?.length ?? 0) > 0 ||
          (candidate.target.currentResponsibilityIds?.length ?? 0) > 0 ||
          (candidate.target.currentSupportElements?.length ?? 0) > 0 ||
          candidate.target.megaOptionPokemonId !== null ||
          (candidate.target.allySupportLinks?.length ?? 0) > 0)
      ) {
        errors.push("Addition recommendation targets must not report replacement losses.");
        break;
      }
      if (
        candidate.target.mode === "replacement" &&
        (!targetSet || targetSet.pokemonId !== candidate.target.currentPokemonId)
      ) {
        errors.push(
          "Replacement recommendation targets must match the current set.",
        );
        break;
      }
      if (candidate.target.mode !== "replacement" || !targetSet) continue;

      const hasSameValues = (left: readonly string[], right: readonly string[]) =>
        left.length === right.length && left.every((entry) => right.includes(entry));
      if (
        !hasSameValues(candidate.target.currentRoleIds ?? [], targetSet.roleIds) ||
        !hasSameValues(
          candidate.target.currentSetterConceptIds ?? [],
          targetSet.setterConceptIds,
        ) ||
        !hasSameValues(
          candidate.target.currentAceConceptIds ?? [],
          targetSet.aceConceptIds,
        )
      ) {
        errors.push("Replacement target roles and concepts must match the current set.");
        break;
      }

      const expectedMegaOptionId = targetSet.isMegaForm
        ? targetSet.pokemonId
        : targetSet.megaEvolution?.pokemonId ?? null;
      if (candidate.target.megaOptionPokemonId !== expectedMegaOptionId) {
        errors.push("Replacement target Mega option must match the current set.");
        break;
      }

      const hasInvalidTargetSupportElement =
        candidate.target.currentSupportElements.some((element) =>
          element.kind === "move"
            ? !targetSet.moves.some(
                (move) =>
                  normalizeShowdownId(move.id) === normalizeShowdownId(element.id),
              )
            : normalizeShowdownId(targetSet.ability ?? "") !==
              normalizeShowdownId(element.id),
        );
      if (hasInvalidTargetSupportElement) {
        errors.push("Replacement target support elements must use selected elements.");
        break;
      }

      const hasInvalidSupportLink = (candidate.target.allySupportLinks ?? []).some(
        (link) => {
          if (link.sourceSlotIndex === candidate.target.slotIndex) return true;
          const sourceSet = sets.find(
            (set) => set.slotIndex === link.sourceSlotIndex,
          );
          if (!sourceSet) return true;
          return link.sourceKind === "move"
            ? !sourceSet.moves.some(
                (move) =>
                  normalizeShowdownId(move.id) ===
                  normalizeShowdownId(link.sourceId),
              )
            : normalizeShowdownId(sourceSet.ability ?? "") !==
                normalizeShowdownId(link.sourceId);
        },
      );
      if (hasInvalidSupportLink) {
        errors.push("Replacement target ally support links must use selected elements.");
        break;
      }
    }
  }
  if (
    value.optimization !== undefined &&
    value.optimization !== null &&
    !hasValidOptimizationShape(value.optimization)
  ) {
    errors.push("optimization must match the sample recommendation contract.");
  }
  if (value.scope === "optimization" && !hasValidOptimizationShape(value.optimization)) {
    errors.push("optimization scope requires verified sample candidates.");
  }
  if (
    value.scope !== "optimization" &&
    value.scope !== "matchup" &&
    value.optimization !== undefined &&
    value.optimization !== null
  ) {
    errors.push("optimization must be null outside optimization scope.");
  }
  if (
    value.matchup !== undefined &&
    value.matchup !== null &&
    !hasValidMatchupShape(value.matchup)
  ) {
    errors.push("matchup must match the exact team matchup contract.");
  }
  if (value.scope === "matchup" && !hasValidMatchupShape(value.matchup)) {
    errors.push("matchup scope requires verified team matchup evidence.");
  }
  if (
    value.scope !== "matchup" &&
    value.matchup !== undefined &&
    value.matchup !== null
  ) {
    errors.push("matchup must be null outside matchup scope.");
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
  if (
    (value.scope === "optimization" || value.scope === "matchup") &&
    isRecord(value.optimization) &&
    value.optimization.slotIndex !== value.selectedSlot
  ) {
    errors.push("optimization slotIndex must match selectedSlot.");
  }
  if (
    (value.scope === "optimization" || value.scope === "matchup") &&
    isRecord(value.optimization)
  ) {
    const optimizationField = isRecord(value.optimization.field)
      ? value.optimization.field
      : null;

    if (
      value.optimization.field !== null &&
      optimizationField?.gameType !== value.battleFormat
    ) {
      errors.push("optimization field gameType must match battleFormat.");
    }
  }
  if (value.scope === "matchup" && isRecord(value.matchup)) {
    const matchupField = isRecord(value.matchup.field)
      ? value.matchup.field
      : null;
    if (matchupField?.gameType !== value.battleFormat) {
      errors.push("matchup field gameType must match battleFormat.");
    }

    const setBySlot = new Map(
      Array.isArray(value.sets)
        ? value.sets.flatMap((set) =>
            isRecord(set) && isSlotIndex(set.slotIndex)
              ? [[set.slotIndex, set] as const]
              : [],
          )
        : [],
    );
    const matchupMembers = Array.isArray(value.matchup.members)
      ? value.matchup.members
      : [];
    if (
      matchupMembers.some((member) => {
        if (!isRecord(member)) return true;
        const set = setBySlot.get(member.slotIndex);
        if (!set) return true;
        if (member.state === "current") {
          return set.pokemonId !== member.pokemonId;
        }

        return member.state !== "mega" ||
          !isRecord(set.megaEvolution) ||
          set.megaEvolution.pokemonId !== member.pokemonId;
      })
    ) {
      errors.push("matchup members must match the supplied team sets.");
    }
    if (
      isRecord(value.optimization) &&
      isRecord(value.matchup.opponent) &&
      value.optimization.opponentPokemonId !== value.matchup.opponent.pokemonId
    ) {
      errors.push("optimization and matchup must use the same opponent.");
    }
  }

  validateBoundedStructure(value, "request", errors);

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return { success: true, data: value as CopilotAnalysisRequest, errors: [] };
}
