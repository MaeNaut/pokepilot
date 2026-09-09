import { normalizeShowdownId } from "../../api/showdownIds";
import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  getNatureById,
  normalizeStatPointSpread,
  statKeys,
} from "../../data/natures";
import type { StatBlock, StatKey } from "../../types";
import type {
  GeneralSetOptimizationContext,
  SetOptimizationCandidate,
  SetOptimizationGeneralEvidence,
  SetOptimizationPlan,
} from "./types";

const MAX_GENERAL_USAGE_CANDIDATES = 3;
const MAX_COMBINED_CANDIDATES = 8;

function getItemId(item: GeneralSetOptimizationContext["build"]["item"]) {
  return normalizeShowdownId(item?.showdownId ?? item?.id ?? item?.name ?? "");
}

function completeSpread(partial: Partial<StatBlock>) {
  const spread = normalizeStatPointSpread(partial);
  let remaining = CHAMPIONS_MAX_EV_TOTAL - statKeys.reduce(
    (total, stat) => total + spread[stat],
    0,
  );
  const priorities = [...statKeys].sort(
    (left, right) => (partial[right] ?? 0) - (partial[left] ?? 0),
  );

  for (const stat of priorities) {
    if (remaining <= 0) break;
    const added = Math.min(CHAMPIONS_MAX_EV_PER_STAT - spread[stat], remaining);
    spread[stat] += added;
    remaining -= added;
  }

  return remaining === 0 ? spread : null;
}

function getCurrentMoveIds(context: GeneralSetOptimizationContext) {
  const moveById = getMoveById(context);
  return [...context.build.moveIds, "", "", "", ""].slice(0, 4).map(
    (moveId) => moveById.get(normalizeShowdownId(moveId))?.id ?? moveId,
  );
}

function getMoveById(context: GeneralSetOptimizationContext) {
  return new Map(
    (context.member.moves ?? []).flatMap((move) => {
      const keys = [move.id, move.name].map(normalizeShowdownId).filter(Boolean);
      return keys.map((key) => [key, move] as const);
    }),
  );
}

function resolveUsageMoveIds(context: GeneralSetOptimizationContext) {
  const moveById = getMoveById(context);
  const currentMoveIds = getCurrentMoveIds(context);
  if (
    currentMoveIds.some((moveId) =>
      !moveId || !moveById.has(normalizeShowdownId(moveId)),
    )
  ) {
    return currentMoveIds;
  }
  const resolved: string[] = [];
  for (const usageMoveId of context.usageSet?.moveIds ?? []) {
    const move = moveById.get(normalizeShowdownId(usageMoveId));
    if (move && !resolved.includes(move.id)) resolved.push(move.id);
    if (resolved.length === 4) break;
  }
  if (resolved.length !== 4) return currentMoveIds;

  const resolvedSet = new Set(resolved);
  const currentSet = new Set(currentMoveIds);
  const replacementSlots = currentMoveIds.flatMap((moveId, slotIndex) =>
    resolvedSet.has(moveId) ? [] : [slotIndex],
  );
  const replacementMoves = resolved.filter((moveId) => !currentSet.has(moveId));
  if (replacementSlots.length !== replacementMoves.length) return currentMoveIds;

  const aligned = [...currentMoveIds];
  replacementSlots.forEach((slotIndex, index) => {
    aligned[slotIndex] = replacementMoves[index];
  });
  return aligned;
}

function getRoleStats(context: GeneralSetOptimizationContext) {
  const currentMoves = getCurrentMoveIds(context);
  const moveById = getMoveById(context);
  const stats = new Set<StatKey>();

  for (const moveId of currentMoves) {
    const move = moveById.get(normalizeShowdownId(moveId));
    if (move?.power && move.power > 0) {
      if (move.category === "Physical") stats.add("attack");
      if (move.category === "Special") stats.add("specialAttack");
    }
  }

  const nature = getNatureById(context.build.natureId);
  for (const stat of ["attack", "specialAttack", "speed"] as const) {
    if (context.build.evs[stat] > 0 || nature.up === stat) stats.add(stat);
  }
  if (context.build.evs.speed === 0 && nature.down === "speed") stats.add("speed");
  return [...stats];
}

function createEvidence(
  context: GeneralSetOptimizationContext,
  source: SetOptimizationGeneralEvidence["source"],
  evs: StatBlock,
  natureId: string,
  usage?: { rank: number; percent: number },
): SetOptimizationGeneralEvidence {
  const roleStats = getRoleStats(context);
  const baseStats = context.member.baseStats!;
  const currentStats = calculateChampionsStats(
    baseStats,
    context.build.evs,
    getNatureById(context.build.natureId),
  );
  const candidateStats = calculateChampionsStats(
    baseStats,
    evs,
    getNatureById(natureId),
  );
  const reducedRoleStats = roleStats.filter((stat) => {
    if (
      stat === "speed" &&
      context.build.evs.speed === 0 &&
      getNatureById(context.build.natureId).down === "speed"
    ) {
      return candidateStats.speed > currentStats.speed;
    }
    return candidateStats[stat] < currentStats[stat];
  });

  return {
    source,
    ...(source === "usage" && context.usageSet
      ? {
          sourceMonth: context.usageSet.sourceMonth,
          cutoff: context.usageSet.cutoff,
          spreadRank: usage?.rank,
          usagePercent: usage?.percent,
        }
      : {}),
    roleStats,
    reducedRoleStats,
  };
}

function createMoveChanges(
  context: GeneralSetOptimizationContext,
  moveIds: string[],
) {
  const currentMoveIds = getCurrentMoveIds(context);
  const moveById = getMoveById(context);
  return moveIds.flatMap((moveId, slotIndex) => {
    const currentMoveId = currentMoveIds[slotIndex];
    if (!moveId || moveId === currentMoveId) return [];
    const currentMove = moveById.get(normalizeShowdownId(currentMoveId));
    const optimizedMove = moveById.get(normalizeShowdownId(moveId));
    if (!currentMove || !optimizedMove) return [];
    return [{
      slotIndex,
      currentMoveId: currentMove.id,
      currentMoveName: currentMove.name,
      optimizedMoveId: optimizedMove.id,
      optimizedMoveName: optimizedMove.name,
      sameTypeAndCategory:
        currentMove.type === optimizedMove.type &&
        currentMove.category === optimizedMove.category,
    }];
  });
}

function createCandidate(
  context: GeneralSetOptimizationContext,
  id: string,
  natureId: string,
  evs: StatBlock,
  item: { id: string | null; name: string | null },
  moveIds: string[],
  evidence: SetOptimizationGeneralEvidence,
): SetOptimizationCandidate {
  const currentItemId = getItemId(context.build.item) || null;
  const statPointChanges = Object.fromEntries(
    statKeys.map((stat) => [stat, evs[stat] - context.build.evs[stat]]),
  ) as StatBlock;
  const currentStats = calculateChampionsStats(
    context.member.baseStats!,
    context.build.evs,
    getNatureById(context.build.natureId),
  );
  const finalStats = calculateChampionsStats(
    context.member.baseStats!,
    evs,
    getNatureById(natureId),
  );
  return {
    id,
    slotIndex: context.selectedSlot,
    focuses: ["offense", "defense", "speed"],
    profiles: [],
    maxedStats: statKeys.filter((stat) => evs[stat] === CHAMPIONS_MAX_EV_PER_STAT),
    natureId,
    evs,
    evTotal: CHAMPIONS_MAX_EV_TOTAL,
    finalStats,
    itemId: item.id,
    itemName: item.name,
    itemChanged: item.id !== currentItemId,
    moveIds,
    moveChanges: createMoveChanges(context, moveIds),
    changedStatPoints: statKeys.reduce(
      (total, stat) => total + Math.abs(statPointChanges[stat]),
      0,
    ),
    statPointChanges,
    offenseBenchmarks: [],
    defenseBenchmarks: [],
    // General candidates do not expose this placeholder in the API snapshot.
    speedBenchmark: {
      current: { playerSpeed: currentStats.speed, opponentSpeed: 1, relation: "faster" },
      optimized: { playerSpeed: finalStats.speed, opponentSpeed: 1, relation: "faster" },
    },
    generalEvidence: evidence,
  };
}

function candidateKey(candidate: SetOptimizationCandidate) {
  return JSON.stringify([
    normalizeShowdownId(candidate.natureId),
    candidate.evs,
    normalizeShowdownId(candidate.itemId ?? ""),
    candidate.moveIds.map(normalizeShowdownId),
  ]);
}

export function createGeneralSetOptimizationPlan(
  context: GeneralSetOptimizationContext,
): SetOptimizationPlan {
  const identity = {
    mode: "general" as const,
    slotIndex: context.selectedSlot,
    playerId: context.member.id,
    playerName: context.member.name,
    opponentId: null,
    opponentName: null,
    configuredDirection: "player-to-opponent" as const,
  };
  if (!context.member.baseStats) {
    return { ...identity, status: "unavailable", candidates: [], reason: "missing-stats" };
  }

  const candidates: SetOptimizationCandidate[] = [];
  const currentTotal = statKeys.reduce(
    (total, stat) => total + context.build.evs[stat],
    0,
  );
  const currentEvs = currentTotal === CHAMPIONS_MAX_EV_TOTAL
    ? { ...context.build.evs }
    : null;
  const currentItemId = getItemId(context.build.item) || null;
  const currentItem = {
    id: currentItemId,
    name: context.build.item?.name ?? null,
  };
  if (currentEvs) {
    candidates.push(createCandidate(
      context,
      "set-current",
      context.build.natureId,
      currentEvs,
      currentItem,
      getCurrentMoveIds(context),
      createEvidence(context, "current", currentEvs, context.build.natureId),
    ));
  }

  const spreads = context.usageSet?.spreads?.length
    ? context.usageSet.spreads
    : context.usageSet?.evs && context.usageSet.nature
      ? [{
          nature: context.usageSet.nature,
          evs: context.usageSet.evs,
          usagePercent: 0,
        }]
      : [];
  const usageItem = context.usageItems.find((item) => {
    const id = getItemId(item);
    return id && !context.reservedItemIds.includes(id);
  }) ?? null;
  const usageItemId = getItemId(usageItem) || null;
  const canUseUsageItem = Boolean(
    usageItem && context.build.item?.category !== "Mega Stones",
  );
  const usageMoves = resolveUsageMoveIds(context);

  for (const [index, spread] of spreads.slice(0, MAX_GENERAL_USAGE_CANDIDATES).entries()) {
    const evs = completeSpread(spread.evs);
    if (!evs) continue;
    const natureId = spread.nature.toLowerCase();
    candidates.push(createCandidate(
      context,
      `usage-standard-${index + 1}`,
      natureId,
      evs,
      index === 0 && canUseUsageItem
        ? { id: usageItemId, name: usageItem?.name ?? null }
        : currentItem,
      index === 0 ? usageMoves : getCurrentMoveIds(context),
      createEvidence(context, "usage", evs, natureId, {
        rank: index + 1,
        percent: spread.usagePercent,
      }),
    ));
  }

  const unique = candidates.filter((candidate, index, all) =>
    all.findIndex((entry) => candidateKey(entry) === candidateKey(candidate)) === index,
  );
  return {
    ...identity,
    status: unique.length > 0 ? "ready" : "unavailable",
    candidates: unique,
    itemMechanics: [context.build.item, ...context.usageItems].filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    ),
    ...(unique.length > 0 ? {} : { reason: "no-meaningful-candidate" as const }),
  };
}

export function mergeGeneralAndMatchupPlans(
  general: SetOptimizationPlan,
  matchup: SetOptimizationPlan | null,
): SetOptimizationPlan {
  if (general.status !== "ready" || !matchup || matchup.status !== "ready") {
    return general;
  }
  const matchupCandidates = matchup.candidates
    .filter((candidate) => candidate.id !== "set-current")
    .map((candidate) => ({
      ...candidate,
      generalEvidence: {
        source: "matchup" as const,
        roleStats: general.candidates[0]?.generalEvidence?.roleStats ?? [],
        reducedRoleStats: general.candidates[0]?.generalEvidence?.roleStats.filter(
          (stat) => candidate.finalStats[stat] < general.candidates[0].finalStats[stat],
        ) ?? [],
      },
    }));
  const candidates = [...general.candidates, ...matchupCandidates]
    .filter((candidate, index, all) =>
      all.findIndex((entry) => candidateKey(entry) === candidateKey(candidate)) === index,
    )
    .slice(0, MAX_COMBINED_CANDIDATES);
  return {
    ...general,
    opponentId: matchup.opponentId,
    opponentName: matchup.opponentName,
    configuredDirection: matchup.configuredDirection,
    candidates,
  };
}
