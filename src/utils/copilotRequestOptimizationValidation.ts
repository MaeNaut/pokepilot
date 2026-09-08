import type { CopilotSetOptimizationCandidateSnapshot } from "./copilotContracts.js";
import {
  getStatBlockTotal,
  hasOnlyKeys,
  hasValidMaxedStats,
  isBoundedInteger,
  isBoundedIntegerStatBlock,
  isFiniteNumber,
  isNonEmptyString,
  isNullableString,
  isStringArray,
  isSlotIndex,
  isUniqueEnumArray,
  optimizationCandidateProfiles,
  pokemonTypeSet,
  statIdSet,
} from "./copilotRequestValidationPrimitives.js";
import { isRecord } from "./typeGuards.js";

function hasValidOptimizationBenchmark(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "minDamage",
      "maxDamage",
      "minPercent",
      "maxPercent",
      "defenderCurrentHp",
      "defenderMaxHp",
      "oneHitKoChance",
      "koHits",
      "koChance",
      "possibleKoHits",
      "guaranteedKoHits",
    ]) &&
    isFiniteNumber(value.minDamage, 0, 100_000) &&
    isFiniteNumber(value.maxDamage, 0, 100_000) &&
    isFiniteNumber(value.minPercent, 0, 100_000) &&
    isFiniteNumber(value.maxPercent, 0, 100_000) &&
    Number(value.minDamage) <= Number(value.maxDamage) &&
    Number(value.minPercent) <= Number(value.maxPercent) &&
    isBoundedInteger(value.defenderCurrentHp, 1, 100_000) &&
    isBoundedInteger(value.defenderMaxHp, 1, 100_000) &&
    Number(value.defenderCurrentHp) <= Number(value.defenderMaxHp) &&
    isFiniteNumber(value.oneHitKoChance, 0, 100) &&
    isBoundedInteger(value.koHits, 0, 100) &&
    (value.koChance === null || isFiniteNumber(value.koChance, 0, 100)) &&
    (value.possibleKoHits === null ||
      isBoundedInteger(value.possibleKoHits, 1, 100_000)) &&
    (value.guaranteedKoHits === null ||
      isBoundedInteger(value.guaranteedKoHits, 1, 100_000)) &&
    (value.possibleKoHits === null) === (value.guaranteedKoHits === null) &&
    (value.possibleKoHits === null ||
      Number(value.possibleKoHits) <= Number(value.guaranteedKoHits)) &&
    value.possibleKoHits ===
      (Number(value.maxDamage) > 0
        ? Math.ceil(Number(value.defenderCurrentHp) / Number(value.maxDamage))
        : null) &&
    value.guaranteedKoHits ===
      (Number(value.minDamage) > 0
        ? Math.ceil(Number(value.defenderCurrentHp) / Number(value.minDamage))
        : null)
  );
}

function hasValidOptimizationField(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "weather",
      "terrain",
      "room",
      "aura",
      "gameType",
      "isCritical",
      "isSpread",
      "isHelpingHand",
      "isTailwind",
      "isFriendGuard",
      "isPlusMinus",
      "isWall",
    ]) &&
    ["none", "sun", "rain", "sand", "snow"].includes(String(value.weather)) &&
    ["none", "electric", "grassy", "psychic", "misty"].includes(
      String(value.terrain),
    ) &&
    ["none", "magic", "wonder", "gravity"].includes(String(value.room)) &&
    ["none", "fairy"].includes(String(value.aura)) &&
    ["singles", "doubles"].includes(String(value.gameType)) &&
    [
      "isCritical",
      "isSpread",
      "isHelpingHand",
      "isTailwind",
      "isFriendGuard",
      "isPlusMinus",
      "isWall",
    ].every((key) => typeof value[key] === "boolean")
  );
}

function hasValidMoveIdSlots(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (moveId) => typeof moveId === "string" && moveId.length <= 100,
    )
  );
}

function hasValidOptimizationMoveChanges(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 1 &&
    value.every(
      (change) =>
        isRecord(change) &&
        hasOnlyKeys(change, [
          "slotIndex",
          "currentMoveId",
          "currentMoveDisplayName",
          "optimizedMoveId",
          "optimizedMoveDisplayName",
          "sameTypeAndCategory",
        ]) &&
        isBoundedInteger(change.slotIndex, 0, 3) &&
        isNonEmptyString(change.currentMoveId) &&
        isNonEmptyString(change.currentMoveDisplayName) &&
        isNonEmptyString(change.optimizedMoveId) &&
        isNonEmptyString(change.optimizedMoveDisplayName) &&
        change.currentMoveId !== change.optimizedMoveId &&
        typeof change.sameTypeAndCategory === "boolean",
    )
  );
}

function hasValidOptimizationMoveMechanic(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "displayName",
      "type",
      "category",
      "power",
      "effect",
      "tags",
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName) &&
    pokemonTypeSet.has(String(value.type)) &&
    ["physical", "special", "status", "unknown"].includes(
      String(value.category),
    ) &&
    (value.power === null || isFiniteNumber(value.power, 0, 1_000)) &&
    (!("effect" in value) ||
      (isNonEmptyString(value.effect) && String(value.effect).length <= 500)) &&
    (!("tags" in value) || isStringArray(value.tags, 32))
  );
}

function hasValidOptimizationMoveMechanics(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 8 &&
    value.every(hasValidOptimizationMoveMechanic) &&
    new Set(
      value.map((entry) => (isRecord(entry) ? entry.id : null)),
    ).size === value.length
  );
}

export function isValidCopilotOptimizationCandidateSnapshot(
  value: unknown,
): value is CopilotSetOptimizationCandidateSnapshot {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "slotIndex",
      "focuses",
      "profiles",
      "maxedStats",
      "natureId",
      "natureDisplayName",
      "evs",
      "evTotal",
      "finalStats",
      "itemId",
      "itemDisplayName",
      "itemChanged",
      "moveIds",
      "moveChanges",
      "changedStatPoints",
      "statPointChanges",
      "offenseBenchmarks",
      "defenseBenchmarks",
      "speedBenchmark",
    ]) &&
    isNonEmptyString(value.id) &&
    isSlotIndex(value.slotIndex) &&
    isUniqueEnumArray(
      value.focuses,
      new Set(["offense", "defense", "speed"]),
      3,
    ) &&
    Array.isArray(value.focuses) &&
    value.focuses.length > 0 &&
    isUniqueEnumArray(
      value.profiles,
      optimizationCandidateProfiles,
      optimizationCandidateProfiles.size,
    ) &&
    hasValidMaxedStats(value.maxedStats, value.evs) &&
    isNonEmptyString(value.natureId) &&
    isNonEmptyString(value.natureDisplayName) &&
    isBoundedIntegerStatBlock(value.evs, 0, 32) &&
    value.evTotal === 66 &&
    getStatBlockTotal(value.evs) === value.evTotal &&
    isBoundedIntegerStatBlock(value.finalStats, 1, 10_000) &&
    isNullableString(value.itemId) &&
    isNullableString(value.itemDisplayName) &&
    typeof value.itemChanged === "boolean" &&
    hasValidMoveIdSlots(value.moveIds) &&
    hasValidOptimizationMoveChanges(value.moveChanges) &&
    isBoundedInteger(value.changedStatPoints, 0, 384) &&
    isBoundedIntegerStatBlock(value.statPointChanges, -32, 32) &&
    hasValidOptimizationMoveBenchmarks(value.offenseBenchmarks) &&
    hasValidOptimizationMoveBenchmarks(value.defenseBenchmarks) &&
    hasValidOptimizationSpeedBenchmark(value.speedBenchmark)
  );
}

function hasValidOptimizationMoveBenchmark(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "moveId",
      "moveDisplayName",
      "currentMoveId",
      "currentMoveDisplayName",
      "moveCategory",
      "source",
      "relevantStat",
      "optimizedVsCurrent",
      "current",
      "optimized",
    ]) &&
    isNonEmptyString(value.moveId) &&
    isNonEmptyString(value.moveDisplayName) &&
    isNonEmptyString(value.currentMoveId) &&
    isNonEmptyString(value.currentMoveDisplayName) &&
    (value.moveCategory === "Physical" || value.moveCategory === "Special") &&
    (value.source === "selected" || value.source === "usage") &&
    statIdSet.has(String(value.relevantStat)) &&
    ["better", "same", "worse"].includes(String(value.optimizedVsCurrent)) &&
    hasValidOptimizationBenchmark(value.current) &&
    hasValidOptimizationBenchmark(value.optimized)
  );
}

function hasValidOptimizationMoveBenchmarks(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 2 &&
    value.every(hasValidOptimizationMoveBenchmark) &&
    new Set(
      value.map((entry) => (isRecord(entry) ? entry.moveId : null)),
    ).size === value.length
  );
}

function hasValidOptimizationSpeedState(value: unknown) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["playerSpeed", "opponentSpeed", "relation"]) ||
    !isBoundedInteger(value.playerSpeed, 1, 100_000) ||
    !isBoundedInteger(value.opponentSpeed, 1, 100_000) ||
    !["faster", "tie", "slower"].includes(String(value.relation))
  ) {
    return false;
  }

  const expectedRelation =
    Number(value.playerSpeed) === Number(value.opponentSpeed)
      ? "tie"
      : Number(value.playerSpeed) > Number(value.opponentSpeed)
        ? "faster"
        : "slower";
  return value.relation === expectedRelation;
}

function hasValidOptimizationSpeedBenchmark(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["current", "optimized"]) &&
    hasValidOptimizationSpeedState(value.current) &&
    hasValidOptimizationSpeedState(value.optimized) &&
    isRecord(value.current) &&
    isRecord(value.optimized) &&
    value.current.opponentSpeed === value.optimized.opponentSpeed
  );
}

export function hasValidOptimizationShape(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "slotIndex",
      "configuredDirection",
      "playerPokemonId",
      "playerDisplayName",
      "opponentPokemonId",
      "opponentDisplayName",
      "field",
      "currentBuild",
      "moveMechanics",
      "candidates",
    ]) &&
    isSlotIndex(value.slotIndex) &&
    ["player-to-opponent", "opponent-to-player"].includes(
      String(value.configuredDirection),
    ) &&
    isNonEmptyString(value.playerPokemonId) &&
    isNonEmptyString(value.playerDisplayName) &&
    isNonEmptyString(value.opponentPokemonId) &&
    isNonEmptyString(value.opponentDisplayName) &&
    hasValidOptimizationField(value.field) &&
    isRecord(value.currentBuild) &&
    hasOnlyKeys(value.currentBuild, [
      "natureId",
      "natureDisplayName",
      "evs",
      "finalStats",
      "itemId",
      "itemDisplayName",
      "moveIds",
    ]) &&
    isNonEmptyString(value.currentBuild.natureId) &&
    isNonEmptyString(value.currentBuild.natureDisplayName) &&
    isBoundedIntegerStatBlock(value.currentBuild.evs, 0, 32) &&
    getStatBlockTotal(value.currentBuild.evs) <= 66 &&
    isBoundedIntegerStatBlock(value.currentBuild.finalStats, 1, 10_000) &&
    isNullableString(value.currentBuild.itemId) &&
    isNullableString(value.currentBuild.itemDisplayName) &&
    hasValidMoveIdSlots(value.currentBuild.moveIds) &&
    hasValidOptimizationMoveMechanics(value.moveMechanics) &&
    Array.isArray(value.candidates) &&
    value.candidates.length > 0 &&
    value.candidates.length <= 12 &&
    value.candidates.every(isValidCopilotOptimizationCandidateSnapshot) &&
    value.candidates.every(
      (candidate) => candidate.slotIndex === value.slotIndex,
    ) &&
    value.candidates.every((candidate) => {
      if (
        !isValidCopilotOptimizationCandidateSnapshot(candidate) ||
        !isRecord(value.currentBuild) ||
        !isBoundedIntegerStatBlock(value.currentBuild.evs, 0, 32)
      ) {
        return false;
      }

      const currentEvs = value.currentBuild.evs as Record<string, number>;
      const expectedChanges = Object.fromEntries(
        Object.keys(candidate.evs).map((stat) => [
          stat,
          candidate.evs[stat as keyof typeof candidate.evs] -
            Number(currentEvs[stat]),
        ]),
      );
      const expectedChangedStatPoints = Object.values(expectedChanges).reduce(
        (total, change) => total + Math.abs(change),
        0,
      );

      const currentMoveIds = value.currentBuild.moveIds as string[];
      const candidateMoveIds = candidate.moveIds;
      const changedMoveSlots = candidateMoveIds.flatMap((moveId, slotIndex) =>
        moveId === currentMoveIds[slotIndex] ? [] : [slotIndex],
      );
      const moveChanges = candidate.moveChanges;
      const moveMechanics = Array.isArray(value.moveMechanics)
        ? value.moveMechanics.filter(isRecord)
        : [];

      return (
        Object.entries(expectedChanges).every(
          ([stat, change]) =>
            candidate.statPointChanges[
              stat as keyof typeof candidate.statPointChanges
            ] === change,
        ) &&
        candidate.changedStatPoints === expectedChangedStatPoints &&
        candidate.itemChanged ===
          (candidate.itemId !== value.currentBuild.itemId) &&
        changedMoveSlots.length === moveChanges.length &&
        changedMoveSlots.every((slotIndex) => {
          const change = moveChanges.find((entry) => entry.slotIndex === slotIndex);
          const currentMechanic = moveMechanics.find(
            (entry) => entry.id === change?.currentMoveId,
          );
          const optimizedMechanic = moveMechanics.find(
            (entry) => entry.id === change?.optimizedMoveId,
          );
          return Boolean(
            change &&
              change.currentMoveId === currentMoveIds[slotIndex] &&
              change.optimizedMoveId === candidateMoveIds[slotIndex] &&
              currentMechanic &&
              optimizedMechanic &&
              change.sameTypeAndCategory ===
                (currentMechanic.type === optimizedMechanic.type &&
                  currentMechanic.category === optimizedMechanic.category),
          );
        })
      );
    }) &&
    new Set(
      value.candidates.map((candidate) =>
        isRecord(candidate) ? candidate.id : null,
      ),
    ).size === value.candidates.length
  );
}
