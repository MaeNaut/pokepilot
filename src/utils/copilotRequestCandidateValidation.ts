import { hasOnlyKeys, isBoundedInteger, isFiniteNumber, isNonEmptyString, isNullableString, isPokemonTypeArray, isSlotIndex, isStatBlock, isStringArray, isUniqueEnumArray, pokemonTypeSet, teamConceptIds, teamConceptIdSet, teamRoleIds, teamRoleIdSet } from "./copilotRequestValidationPrimitives.js";
import { copilotResponsibilityIds } from "./copilotResponsibilities.js";
import { isRecord } from "./typeGuards.js";
import { natures, statKeys } from "../data/natures.js";

function hasValidFilterValue(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "name"]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name)
  );
}

export function hasValidCandidateFilterShape(value: unknown) {
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

function hasValidUsageOptions(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, ["sourcePokemonId", "sourceMonth", "sourceDate", "season", "alternativeMoves", "items", "natures", "statPointSpreads"])) return false;
  const percentage = (value: unknown) => value === null || isFiniteNumber(value, 0, 100);
  const uniqueOptions = (options: unknown, limit: number, valid: (option: Record<string, unknown>) => boolean) =>
    Array.isArray(options) && options.length <= limit && options.every((option) => isRecord(option) && valid(option)) &&
    new Set(options.map((option) => option.id)).size === options.length;
  const namedOption = (option: Record<string, unknown>) => isNonEmptyString(option.id) &&
    isNonEmptyString(option.displayName) && percentage(option.usagePercent);
  return isNonEmptyString(value.sourcePokemonId) &&
    typeof value.sourceMonth === "string" && /^\d{4}-\d{2}$/.test(value.sourceMonth) &&
    (value.sourceDate === null || (typeof value.sourceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.sourceDate) && value.sourceDate.startsWith(value.sourceMonth))) &&
    isNullableString(value.season) &&
    uniqueOptions(value.alternativeMoves, 8, (move) => {
      const { usagePercent, ...commonMove } = move;
      return percentage(usagePercent) && hasValidCommonSet({ ability: null, item: null, nature: null, moves: [commonMove] });
    }) &&
    uniqueOptions(value.items, 6, (item) => hasOnlyKeys(item, ["id", "displayName", "usagePercent", "effect"]) &&
      namedOption(item) && (!("effect" in item) || (typeof item.effect === "string" && item.effect.length <= 500))) &&
    uniqueOptions(value.natures, 3, (nature) => hasOnlyKeys(nature, ["id", "displayName", "usagePercent"]) &&
      namedOption(nature) && natures.some((entry) => entry.id === nature.id)) &&
    Array.isArray(value.statPointSpreads) && value.statPointSpreads.length <= 10 && value.statPointSpreads.every((spread) =>
      isRecord(spread) && hasOnlyKeys(spread, ["evs", "usagePercent"]) && percentage(spread.usagePercent) &&
      isRecord(spread.evs) && hasOnlyKeys(spread.evs, statKeys) &&
      statKeys.every((stat) => isBoundedInteger((spread.evs as Record<string, unknown>)[stat], 0, 32)) &&
      Object.values(spread.evs).reduce<number>((sum, point) => sum + Number(point), 0) <= 66);
}

export function hasValidRecommendationCandidateShape(value: unknown) {
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
      "megaEvolution",
      "usageOptions",
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
    (!("megaEvolution" in value) || value.megaEvolution === null || (
      isRecord(value.commonSet) && isNonEmptyString(value.commonSet.item) &&
      value.requiresMegaStone === false &&
      isRecord(value.megaEvolution) &&
      hasOnlyKeys(value.megaEvolution, ["pokemonId", "displayName", "types", "typeDisplayNames", "ability", "baseStats"]) &&
      isNonEmptyString(value.megaEvolution.pokemonId) && value.megaEvolution.pokemonId !== value.pokemonId &&
      isNonEmptyString(value.megaEvolution.displayName) &&
      isPokemonTypeArray(value.megaEvolution.types, 2, 1) &&
      isStringArray(value.megaEvolution.typeDisplayNames, 2) &&
      value.megaEvolution.types.length === value.megaEvolution.typeDisplayNames.length &&
      (value.megaEvolution.baseStats === null || isStatBlock(value.megaEvolution.baseStats)) &&
      (value.megaEvolution.ability === null || (
        isRecord(value.megaEvolution.ability) &&
        hasOnlyKeys(value.megaEvolution.ability, ["id", "displayName", "effect"]) &&
        isNonEmptyString(value.megaEvolution.ability.id) && isNonEmptyString(value.megaEvolution.ability.displayName) &&
        (!("effect" in value.megaEvolution.ability) || (typeof value.megaEvolution.ability.effect === "string" && value.megaEvolution.ability.effect.length <= 500))
      ))
    )) &&
    (!("usageOptions" in value) || hasValidUsageOptions(value.usageOptions)) &&
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
