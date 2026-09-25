import { hasOnlyKeys, isFiniteNumber, isNonEmptyString, isNullableString, isPokemonTypeArray, isSlotIndex, isStatBlock, isStringArray, isUniqueEnumArray, pokemonTypeSet, teamConceptIds, teamConceptIdSet, teamRoleIds, teamRoleIdSet } from "./copilotRequestValidationPrimitives.js";
import { isRecord } from "./typeGuards.js";

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

export function hasValidSetShape(value: unknown) {
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

export function hasValidMegaOptionShape(value: unknown) {
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
