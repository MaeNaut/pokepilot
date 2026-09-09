import {
  getStatBlockTotal,
  hasOnlyKeys,
  isBoundedInteger,
  isBoundedIntegerStatBlock,
  isFiniteNumber,
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

function hasValidExactMatchupShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["mode", "opponent", "field", "teamBaseline", "members"]) &&
    value.mode === "exact" &&
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

function hasValidMetaMatchupOpponent(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, [
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
    "moves",
  ])) return false;

  return hasValidMatchupOpponent({ ...value, selectedMoveIds: [] });
}

function hasValidMetaMatchupField(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["weather", "terrain", "room", "gameType"]) &&
    ["none", "sun", "rain", "sand", "snow", "strong-winds"].includes(
      String(value.weather),
    ) &&
    ["none", "electric", "grassy", "psychic", "misty"].includes(
      String(value.terrain),
    ) &&
    ["none", "trick-room", "magic-room", "wonder-room"].includes(
      String(value.room),
    ) &&
    (value.gameType === "singles" || value.gameType === "doubles")
  );
}

function hasValidMetaMatchupOutcome(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "minPercent",
      "maxPercent",
      "possibleKoHits",
      "guaranteedKoHits",
    ]) &&
    isFiniteNumber(value.minPercent, 0, 10_000) &&
    isFiniteNumber(value.maxPercent, Number(value.minPercent), 10_000) &&
    isNullableHitCount(value.possibleKoHits) &&
    isNullableHitCount(value.guaranteedKoHits)
  );
}

function hasValidMetaMatchupMoveBenchmark(value: unknown) {
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
      "outcome",
      "persistentSequence",
    ]) &&
    isNonEmptyString(value.moveId) &&
    isNonEmptyString(value.moveDisplayName) &&
    (value.moveCategory === "Physical" || value.moveCategory === "Special") &&
    (value.source === "selected" || value.source === "usage") &&
    typeof value.requiresRecharge === "boolean" &&
    isNullableActionTurnCount(value.possibleActionTurns) &&
    isNullableActionTurnCount(value.guaranteedActionTurns) &&
    hasValidMetaMatchupOutcome(value.outcome) &&
    (value.persistentSequence === undefined ||
      hasValidPersistentSequence(value.persistentSequence))
  );
}

function hasValidMetaMatchupBenchmarks(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 2 &&
    value.every(hasValidMetaMatchupMoveBenchmark) &&
    new Set(
      value.map((entry) => (isRecord(entry) ? entry.moveId : null)),
    ).size === value.length
  );
}

function hasValidMetaMatchupMember(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "slotIndex",
      "pokemonId",
      "displayName",
      "state",
      "responseTier",
      "offenseBenchmarks",
      "defenseBenchmarks",
      "speed",
    ]) &&
    isSlotIndex(value.slotIndex) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.displayName) &&
    (value.state === "current" || value.state === "mega") &&
    ["answer", "check", "limited"].includes(String(value.responseTier)) &&
    hasValidMetaMatchupBenchmarks(value.offenseBenchmarks) &&
    hasValidMetaMatchupBenchmarks(value.defenseBenchmarks) &&
    ((Array.isArray(value.offenseBenchmarks) &&
      value.offenseBenchmarks.length > 0) ||
      (Array.isArray(value.defenseBenchmarks) &&
        value.defenseBenchmarks.length > 0)) &&
    hasValidOptimizationSpeedState(value.speed)
  );
}

function hasValidMetaThreat(value: unknown) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "usageRank",
      "opponent",
      "field",
      "testedMemberCount",
      "answerCount",
      "checkCount",
      "fastPressureCount",
      "oneHitThreatCount",
      "hardToBreakCount",
      "members",
    ]) ||
    !isBoundedInteger(value.usageRank, 1, 100_000) ||
    !hasValidMetaMatchupOpponent(value.opponent) ||
    !hasValidMetaMatchupField(value.field) ||
    !isBoundedInteger(value.testedMemberCount, 1, 6) ||
    !isBoundedInteger(value.answerCount, 0, 6) ||
    !isBoundedInteger(value.checkCount, 0, 6) ||
    !isBoundedInteger(value.fastPressureCount, 0, 6) ||
    !isBoundedInteger(value.oneHitThreatCount, 0, 6) ||
    !isBoundedInteger(value.hardToBreakCount, 0, 6) ||
    !Array.isArray(value.members) ||
    value.members.length < 1 ||
    value.members.length > 3 ||
    !value.members.every(hasValidMetaMatchupMember)
  ) {
    return false;
  }

  const opponentMoveIds = new Set(
    isRecord(value.opponent) && Array.isArray(value.opponent.moves)
      ? value.opponent.moves.flatMap((move) =>
          isRecord(move) && isNonEmptyString(move.id) ? [move.id] : [],
        )
      : [],
  );
  const everyDefenseBenchmarkHasMechanics = value.members.every((member) =>
    isRecord(member) &&
    Array.isArray(member.defenseBenchmarks) &&
    member.defenseBenchmarks.every((benchmark) =>
      isRecord(benchmark) && opponentMoveIds.has(String(benchmark.moveId)),
    ),
  );

  return (
    Number(value.answerCount) + Number(value.checkCount) <=
      Number(value.testedMemberCount) &&
    everyDefenseBenchmarkHasMechanics &&
    new Set(
      value.members.map((member) =>
        isRecord(member) ? member.slotIndex : null,
      ),
    ).size === value.members.length
  );
}

function hasValidMetaMatchupShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "mode",
      "sourceMonth",
      "cutoff",
      "evaluatedThreatCount",
      "teamBaseline",
      "threats",
    ]) &&
    value.mode === "meta" &&
    /^\d{4}-\d{2}$/.test(String(value.sourceMonth)) &&
    isBoundedInteger(value.cutoff, 0, 100_000) &&
    isBoundedInteger(value.evaluatedThreatCount, 1, 100) &&
    value.teamBaseline === "full-hp-neutral-stages" &&
    Array.isArray(value.threats) &&
    value.threats.length > 0 &&
    value.threats.length <= 5 &&
    value.threats.every(hasValidMetaThreat) &&
    new Set(
      value.threats.map((threat) =>
        isRecord(threat) && isRecord(threat.opponent)
          ? threat.opponent.pokemonId
          : null,
      ),
    ).size === value.threats.length
  );
}

export function hasValidMatchupShape(value: unknown) {
  return hasValidExactMatchupShape(value) || hasValidMetaMatchupShape(value);
}
