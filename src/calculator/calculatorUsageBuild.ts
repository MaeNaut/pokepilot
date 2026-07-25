import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  defaultEvs,
  statKeys,
} from "../data/natures";
import type { SmogonUsageSet } from "../api/smogonUsage";
import { resolveSmogonUsageMoveIds } from "../api/smogonUsage";
import { normalizeShowdownId } from "../api/showdownIds";
import type { PokemonItem, StatBlock, TeamMember } from "../types";

export type CalculatorUsageBuild = {
  item: PokemonItem | null;
  ability: string;
  natureId: string;
  evs: StatBlock;
  moveIds: string[];
};

function normalizeUsageEvs(evs: Partial<StatBlock>): StatBlock {
  let remaining = CHAMPIONS_MAX_EV_TOTAL;

  return statKeys.reduce<StatBlock>(
    (normalized, stat) => {
      const value = Math.max(
        0,
        Math.min(CHAMPIONS_MAX_EV_PER_STAT, evs[stat] ?? 0, remaining),
      );

      normalized[stat] = value;
      remaining -= value;
      return normalized;
    },
    { ...defaultEvs },
  );
}

function resolveUsageAbility(member: TeamMember, usageSet: SmogonUsageSet) {
  if (!usageSet.ability) {
    return member.abilities?.[0] ?? "";
  }

  return (
    member.abilities?.find(
      (ability) =>
        normalizeShowdownId(ability) ===
        normalizeShowdownId(usageSet.ability ?? ""),
    ) ??
    usageSet.ability
  );
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
    ability: resolveUsageAbility(member, usageSet),
    natureId: usageSet.nature?.toLowerCase() ?? fallback.natureId,
    evs: usageSet.evs
      ? normalizeUsageEvs(usageSet.evs)
      : fallback.evs,
    moveIds: usageSet.moveIds.length
      ? [...resolvedMoveIds, "", "", "", ""].slice(0, 4)
      : fallback.moveIds,
  };
}
