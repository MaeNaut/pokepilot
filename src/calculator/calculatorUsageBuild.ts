import {
  defaultEvs,
  normalizeStatPointSpread,
} from "../data/natures";
import type { SmogonUsageSet } from "../api/smogonUsage";
import {
  resolveSmogonUsageAbility,
  resolveSmogonUsageMoveIds,
} from "../api/smogonUsage";
import type { PokemonItem, PokemonMove, StatBlock, TeamMember } from "../types";
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
  usageSet: SmogonUsageSet,
  fallbackMoves: readonly PokemonMove[] = [],
  limit = 8,
) {
  const availableMoves = [...(member.moves ?? []), ...fallbackMoves];

  return resolveSmogonUsageMoveIds(
    availableMoves,
    usageSet.moveIds,
    limit,
  ).flatMap((moveId) => {
    const move = findMoveByLookup(availableMoves, moveId);
    return move ? [move] : [];
  });
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
  usageSet: SmogonUsageSet,
  item: PokemonItem | null,
): CalculatorUsageBuild {
  const fallback = createDefaultCalculatorBuild(member, item);
  const resolvedMoveIds = resolveSmogonUsageMoveIds(
    member.moves,
    usageSet.moveIds,
  );

  return {
    item,
    ability: resolveSmogonUsageAbility(member, usageSet.ability, fallback.ability),
    natureId: usageSet.nature?.toLowerCase() ?? fallback.natureId,
    evs: usageSet.evs
      ? normalizeStatPointSpread(usageSet.evs)
      : fallback.evs,
    moveIds: usageSet.moveIds.length
      ? [...resolvedMoveIds, "", "", "", ""].slice(0, 4)
      : fallback.moveIds,
  };
}
