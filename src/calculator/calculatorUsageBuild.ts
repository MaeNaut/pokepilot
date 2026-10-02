import {
  defaultEvs,
  normalizeStatPointSpread,
} from "../data/natures";
import type { BattleUsageSet } from "../api/battleUsage";
import { normalizeShowdownId } from "../api/showdownIds";
import { itemFromIndexEntry } from "../api/showdownCatalog";
import {
  resolveBattleUsageAbility,
  resolveBattleUsageMoveIds,
} from "../api/battleUsage";
import type {
  ItemIndexEntry,
  PokemonItem,
  PokemonMove,
  StatBlock,
  TeamMember,
} from "../types";
import { findMoveByLookup } from "../utils/pokemonMoves";

export type CalculatorUsageBuild = {
  item: PokemonItem | null;
  ability: string;
  natureId: string;
  evs: StatBlock;
  moveIds: string[];
};

export function resolveUsageCalculatorMoves(
  member: TeamMember,
  usageSet: BattleUsageSet,
  fallbackMoves: readonly PokemonMove[] = [],
  limit = 8,
) {
  const availableMoves = [...(member.moves ?? []), ...fallbackMoves];

  return resolveBattleUsageMoveIds(
    availableMoves,
    usageSet.moveIds,
    limit,
  ).flatMap((moveId) => {
    const move = findMoveByLookup(availableMoves, moveId);
    return move ? [move] : [];
  });
}

export function resolveUsageCalculatorItems(
  usageSet: BattleUsageSet,
  itemOptions: readonly ItemIndexEntry[],
  limit = 3,
) {
  const usageItemNames = usageSet.itemNames?.length
    ? usageSet.itemNames
    : usageSet.itemName
      ? [usageSet.itemName]
      : [];
  const itemsByLookup = new Map<string, ItemIndexEntry>();

  for (const item of itemOptions) {
    for (const value of [item.showdownId, item.name, item.displayName]) {
      const lookup = normalizeShowdownId(value);
      if (lookup && !itemsByLookup.has(lookup)) itemsByLookup.set(lookup, item);
    }
  }

  const resolved = new Map<string, PokemonItem>();
  for (const itemName of usageItemNames) {
    const entry = itemsByLookup.get(normalizeShowdownId(itemName));
    if (!entry || resolved.has(entry.showdownId)) continue;
    resolved.set(entry.showdownId, itemFromIndexEntry(entry));
    if (resolved.size >= limit) break;
  }

  return [...resolved.values()];
}

export function createDefaultCalculatorBuild(
  member: TeamMember,
  item: PokemonItem | null = null,
): CalculatorUsageBuild {
  return {
    item,
    ability: member.abilities?.[0] ?? "",
    natureId: "hardy",
    evs: { ...defaultEvs },
    moveIds: [
      ...(member.moves
        ?.filter((move) => move.category !== "Status")
        .slice(0, 4)
        .map((move) => move.id) ?? []),
      "",
      "",
      "",
      "",
    ].slice(0, 4),
  };
}

export function createUsageCalculatorBuild(
  member: TeamMember,
  usageSet: BattleUsageSet,
  item: PokemonItem | null,
): CalculatorUsageBuild {
  const fallback = createDefaultCalculatorBuild(member, item);
  const resolvedMoveIds = resolveBattleUsageMoveIds(
    member.moves,
    usageSet.moveIds,
  );

  return {
    item,
    ability: resolveBattleUsageAbility(member, usageSet.ability, fallback.ability),
    natureId: usageSet.nature?.toLowerCase() ?? fallback.natureId,
    evs: usageSet.evs
      ? normalizeStatPointSpread(usageSet.evs)
      : fallback.evs,
    moveIds: usageSet.moveIds.length
      ? [...resolvedMoveIds, "", "", "", ""].slice(0, 4)
      : fallback.moveIds,
  };
}
