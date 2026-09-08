import {
  getStatBlockTotal,
  hasOnlyKeys,
  isBoundedIntegerStatBlock,
  isNonEmptyString,
  isNullableString,
  isPokemonTypeArray,
  isSlotIndex,
  isStringArray,
  isUniqueEnumArray,
  teamRoleIdSet,
} from "./copilotRequestValidationPrimitives.js";
import {
  hasValidOptimizationBenchmark,
  hasValidOptimizationField,
  hasValidOptimizationMoveMechanic,
  hasValidOptimizationSpeedState,
} from "./copilotRequestOptimizationValidation.js";
import { isRecord } from "./typeGuards.js";

function isNullableHitCount(value: unknown) {
  return value === null ||
    (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6);
}

function isNullableActionTurnCount(value: unknown) {
  return value === null ||
    (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 199_999);
}

function hasValidPersistentSequence(value: unknown) {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [
    "triggerAbilityId",
    "boostedStat",
    "stagesPerHit",
    "boostAffectedDamage",
    "includesBetweenHitRecovery",
    "possibleKoHits",
    "guaranteedKoHits",
    "hits",
  ])) return false;
  if (
    !isNonEmptyString(value.triggerAbilityId) ||
    value.boostedStat !== "defense" ||
    value.stagesPerHit !== 1 ||
    typeof value.boostAffectedDamage !== "boolean" ||
    value.includesBetweenHitRecovery !== false ||
    !isNullableHitCount(value.possibleKoHits) ||
    !isNullableHitCount(value.guaranteedKoHits) ||
    !Array.isArray(value.hits) ||
    value.hits.length < 1 ||
    value.hits.length > 6
  ) return false;

  return value.hits.every((hit, index) =>
    isRecord(hit) &&
    hasOnlyKeys(hit, [
      "hit",
      "defensiveStage",
      "minPercent",
      "maxPercent",
      "cumulativeMinPercent",
      "cumulativeMaxPercent",
    ]) &&
    hit.hit === index + 1 &&
    Number.isInteger(hit.defensiveStage) &&
    Number(hit.defensiveStage) >= -6 &&
    Number(hit.defensiveStage) <= 6 &&
    typeof hit.minPercent === "number" &&
    Number.isFinite(hit.minPercent) &&
    hit.minPercent >= 0 &&
    typeof hit.maxPercent === "number" &&
    Number.isFinite(hit.maxPercent) &&
    hit.maxPercent >= hit.minPercent &&
    typeof hit.cumulativeMinPercent === "number" &&
    Number.isFinite(hit.cumulativeMinPercent) &&
    hit.cumulativeMinPercent >= hit.minPercent &&
    typeof hit.cumulativeMaxPercent === "number" &&
    Number.isFinite(hit.cumulativeMaxPercent) &&
    hit.cumulativeMaxPercent >= hit.cumulativeMinPercent
  );
}

function hasValidMatchupMoveBenchmark(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "moveId",
      "moveDisplayName",
      "moveCategory",
      "source",
      "requiresRecharge",
      "possibleActionTurns",
      "guaranteedActionTurns",
      "result",
      "persistentSequence",
    ]) &&
    isNonEmptyString(value.moveId) &&
    isNonEmptyString(value.moveDisplayName) &&
    (value.moveCategory === "Physical" || value.moveCategory === "Special") &&
    (value.source === "selected" || value.source === "usage") &&
    typeof value.requiresRecharge === "boolean" &&
    isNullableActionTurnCount(value.possibleActionTurns) &&
    isNullableActionTurnCount(value.guaranteedActionTurns) &&
    hasValidOptimizationBenchmark(value.result) &&
    (value.persistentSequence === undefined ||
      hasValidPersistentSequence(value.persistentSequence))
  );
}

function hasValidMatchupMoveBenchmarks(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    value.every(hasValidMatchupMoveBenchmark) &&
    new Set(
      value.map((entry) => (isRecord(entry) ? entry.moveId : null)),
    ).size === value.length
  );
}

function selectedMovesBelongToMovePool(
  selectedMoveIds: unknown,
  moves: unknown,
) {
  if (!Array.isArray(selectedMoveIds) || !Array.isArray(moves)) return false;
  const moveIds = new Set(
    moves.flatMap((move) =>
      isRecord(move) && isNonEmptyString(move.id) ? [move.id] : [],
    ),
  );
  return selectedMoveIds.every(
    (moveId) => isNonEmptyString(moveId) && moveIds.has(moveId),
  );
}

function hasValidMatchupMember(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "slotIndex",
      "pokemonId",
      "displayName",
      "state",
      "roleIds",
      "responseTier",
      "offenseBenchmarks",
      "defenseBenchmarks",
      "speed",
    ]) &&
    isSlotIndex(value.slotIndex) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.displayName) &&
    (value.state === "current" || value.state === "mega") &&
    isUniqueEnumArray(value.roleIds, teamRoleIdSet, teamRoleIdSet.size) &&
    ["answer", "check", "limited"].includes(String(value.responseTier)) &&
    hasValidMatchupMoveBenchmarks(value.offenseBenchmarks) &&
    hasValidMatchupMoveBenchmarks(value.defenseBenchmarks) &&
    ((Array.isArray(value.offenseBenchmarks) &&
      value.offenseBenchmarks.length > 0) ||
      (Array.isArray(value.defenseBenchmarks) &&
        value.defenseBenchmarks.length > 0)) &&
    hasValidOptimizationSpeedState(value.speed)
  );
}

function hasValidMatchupOpponent(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "pokemonId",
      "displayName",
      "types",
      "typeDisplayNames",
      "itemId",
      "itemDisplayName",
      "itemEffect",
      "abilityId",
      "abilityDisplayName",
      "abilityEffect",
      "natureId",
      "natureDisplayName",
      "evs",
      "finalStats",
      "selectedMoveIds",
      "moves",
    ]) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.displayName) &&
    isPokemonTypeArray(value.types, 2, 1) &&
    isStringArray(value.typeDisplayNames, 2) &&
    value.typeDisplayNames.length === value.types.length &&
    isNullableString(value.itemId) &&
    isNullableString(value.itemDisplayName) &&
    isNullableString(value.itemEffect) &&
    isNullableString(value.abilityId) &&
    isNullableString(value.abilityDisplayName) &&
    isNullableString(value.abilityEffect) &&
    isNonEmptyString(value.natureId) &&
    isNonEmptyString(value.natureDisplayName) &&
    isBoundedIntegerStatBlock(value.evs, 0, 32) &&
    getStatBlockTotal(value.evs) <= 66 &&
    isBoundedIntegerStatBlock(value.finalStats, 1, 10_000) &&
    isStringArray(value.selectedMoveIds, 4) &&
    Array.isArray(value.selectedMoveIds) &&
    value.selectedMoveIds.every(isNonEmptyString) &&
    new Set(value.selectedMoveIds).size === value.selectedMoveIds.length &&
    Array.isArray(value.moves) &&
    value.moves.length <= 8 &&
    value.moves.every(hasValidOptimizationMoveMechanic) &&
    new Set(
      value.moves.map((move) => (isRecord(move) ? move.id : null)),
    ).size === value.moves.length &&
    selectedMovesBelongToMovePool(value.selectedMoveIds, value.moves)
  );
}

export function hasValidMatchupShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["opponent", "field", "teamBaseline", "members"]) &&
    hasValidMatchupOpponent(value.opponent) &&
    hasValidOptimizationField(value.field) &&
    value.teamBaseline === "full-hp-neutral-stages" &&
    Array.isArray(value.members) &&
    value.members.length > 0 &&
    value.members.length <= 6 &&
    value.members.every(hasValidMatchupMember) &&
    new Set(
      value.members.map((member) =>
        isRecord(member) ? member.slotIndex : null,
      ),
    ).size === value.members.length
  );
}
