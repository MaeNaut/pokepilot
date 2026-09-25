import { pokemonMoveFieldEffectKinds, pokemonMoveStatStages, pokemonMoveTargets, pokemonTypes, } from "../types.js";
import { hasOnlyKeys, isBoundedInteger, isNonEmptyString, isPokemonTypeArray, isSlotIndex, isStringArray, pokemonTypeSet, teamConceptIds, teamConceptIdSet, teamRoleIds } from "./copilotRequestValidationPrimitives.js";
import { copilotResponsibilityIds } from "./copilotResponsibilities.js";
import { isRecord } from "./typeGuards.js";

function hasValidMechanicEntry(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "displayName",
      "effect",
      "tags",
      "target",
      "priority",
      "targetStatChanges",
      "fieldEffects",
      "statChangeMode",
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName) &&
    (!("effect" in value) || typeof value.effect === "string") &&
    (!("tags" in value) || isStringArray(value.tags, 32)) &&
    (!("target" in value) || pokemonMoveTargets.includes(value.target as never)) &&
    (!("priority" in value) || isBoundedInteger(value.priority, -10, 10)) &&
    (!("targetStatChanges" in value) ||
      (Array.isArray(value.targetStatChanges) &&
        value.targetStatChanges.length <= pokemonMoveStatStages.length &&
        value.targetStatChanges.every(
          (change) =>
            isRecord(change) &&
            hasOnlyKeys(change, ["stat", "stages"]) &&
            pokemonMoveStatStages.includes(change.stat as never) &&
            isBoundedInteger(change.stages, -6, 6) &&
            change.stages !== 0,
        ))) &&
    (!("fieldEffects" in value) ||
      (Array.isArray(value.fieldEffects) &&
        value.fieldEffects.length <= 5 &&
        value.fieldEffects.every(
          (effect) =>
            isRecord(effect) &&
            hasOnlyKeys(effect, ["kind", "id"]) &&
            pokemonMoveFieldEffectKinds.includes(effect.kind as never) &&
            isNonEmptyString(effect.id),
        ))) &&
    (!("statChangeMode" in value) ||
      value.statChangeMode === "reverse" || value.statChangeMode === "double")
  );
}

export function hasValidMechanicsShape(value: unknown) {
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

function hasValidResponsibilityCounts(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, copilotResponsibilityIds) &&
    copilotResponsibilityIds.every((responsibility) =>
      isBoundedInteger(value[responsibility], 0, 6),
    )
  );
}

export function hasValidTypeLabels(value: unknown) {
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

export function hasValidTactics(value: unknown) {
  const hasSlotIndexes = (entries: unknown, maximum: number, minimum = 0) =>
    Array.isArray(entries) &&
    entries.length >= minimum &&
    entries.length <= maximum &&
    entries.every(isSlotIndex) &&
    new Set(entries).size === entries.length;
  const hasFieldEffect = (effect: unknown) =>
    isRecord(effect) &&
    hasOnlyKeys(effect, ["kind", "id"]) &&
    pokemonMoveFieldEffectKinds.includes(effect.kind as never) &&
    isNonEmptyString(effect.id);

  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "allyTargetOpportunities",
      "allyStatChangeInteractions",
      "sharedMoveSequences",
      "fieldSetters",
      "unconditionalSpeedOrder",
      "defensiveCoverage",
    ]) &&
    Array.isArray(value.allyTargetOpportunities) &&
    value.allyTargetOpportunities.length <= 24 &&
    value.allyTargetOpportunities.every(
      (opportunity) =>
        isRecord(opportunity) &&
        hasOnlyKeys(opportunity, [
          "sourceSlotIndex",
          "moveId",
          "target",
          "targetSlotIndexes",
        ]) &&
        isSlotIndex(opportunity.sourceSlotIndex) &&
        isNonEmptyString(opportunity.moveId) &&
        pokemonMoveTargets.includes(opportunity.target as never) &&
        hasSlotIndexes(opportunity.targetSlotIndexes, 5, 1) &&
        Array.isArray(opportunity.targetSlotIndexes) &&
        !opportunity.targetSlotIndexes.includes(opportunity.sourceSlotIndex),
    ) &&
    Array.isArray(value.allyStatChangeInteractions) &&
    value.allyStatChangeInteractions.length <= 24 &&
    value.allyStatChangeInteractions.every(
      (interaction) =>
        isRecord(interaction) &&
        hasOnlyKeys(interaction, [
          "sourceSlotIndex",
          "targetSlotIndex",
          "moveId",
          "abilityId",
          "state",
          "mode",
          "targetStatChanges",
        ]) &&
        isSlotIndex(interaction.sourceSlotIndex) &&
        isSlotIndex(interaction.targetSlotIndex) &&
        interaction.sourceSlotIndex !== interaction.targetSlotIndex &&
        isNonEmptyString(interaction.moveId) &&
        isNonEmptyString(interaction.abilityId) &&
        (interaction.state === "current" || interaction.state === "mega") &&
        (interaction.mode === "reverse" || interaction.mode === "double") &&
        Array.isArray(interaction.targetStatChanges) &&
        interaction.targetStatChanges.length > 0 &&
        interaction.targetStatChanges.length <= pokemonMoveStatStages.length &&
        interaction.targetStatChanges.every(
          (change) =>
            isRecord(change) &&
            hasOnlyKeys(change, ["stat", "stages"]) &&
            pokemonMoveStatStages.includes(change.stat as never) &&
            isBoundedInteger(change.stages, -6, 6) &&
            change.stages !== 0,
        ),
    ) &&
    Array.isArray(value.sharedMoveSequences) &&
    value.sharedMoveSequences.length <= 12 &&
    value.sharedMoveSequences.every(
      (sequence) =>
        isRecord(sequence) &&
        hasOnlyKeys(sequence, ["moveId", "slotIndexes"]) &&
        isNonEmptyString(sequence.moveId) &&
        hasSlotIndexes(sequence.slotIndexes, 6, 2),
    ) &&
    Array.isArray(value.fieldSetters) &&
    value.fieldSetters.length <= 24 &&
    value.fieldSetters.every(
      (setter) =>
        isRecord(setter) &&
        hasOnlyKeys(setter, ["sourceSlotIndex", "moveId", "fieldEffect"]) &&
        isSlotIndex(setter.sourceSlotIndex) &&
        isNonEmptyString(setter.moveId) &&
        hasFieldEffect(setter.fieldEffect),
    ) &&
    Array.isArray(value.unconditionalSpeedOrder) &&
    value.unconditionalSpeedOrder.length <= 15 &&
    value.unconditionalSpeedOrder.every(
      (order) =>
        isRecord(order) &&
        hasOnlyKeys(order, ["fasterSlotIndex", "slowerSlotIndex"]) &&
        isSlotIndex(order.fasterSlotIndex) &&
        isSlotIndex(order.slowerSlotIndex) &&
        order.fasterSlotIndex !== order.slowerSlotIndex,
    ) &&
    Array.isArray(value.defensiveCoverage) &&
    value.defensiveCoverage.length <= 48 &&
    value.defensiveCoverage.every(
      (coverage) =>
        isRecord(coverage) &&
        hasOnlyKeys(coverage, [
          "protectedSlotIndex",
          "defenderSlotIndex",
          "type",
          "relation",
        ]) &&
        isSlotIndex(coverage.protectedSlotIndex) &&
        isSlotIndex(coverage.defenderSlotIndex) &&
        coverage.protectedSlotIndex !== coverage.defenderSlotIndex &&
        pokemonTypeSet.has(String(coverage.type)) &&
        (coverage.relation === "resists" || coverage.relation === "immune"),
    )
  );
}

export function hasValidDiagnostics(value: unknown) {
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
