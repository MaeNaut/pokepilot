import { normalizeShowdownId } from "../../api/showdownIds";
import type { SmogonUsageSpread } from "../../api/smogonUsage";
import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  getNatureById,
  normalizeStatPointSpread,
  statKeys,
} from "../../data/natures";
import type { PokemonItem, PokemonMove, StatBlock, StatKey } from "../../types";
import type {
  GeneralSetOptimizationContext,
  SetOptimizationCandidate,
  SetOptimizationGeneralEvidence,
  SetOptimizationPlan,
} from "./types";

const MAX_GENERAL_CANDIDATES = 12;
const MAX_SPREAD_CANDIDATES = 6;
const MAX_ITEM_CANDIDATES = 4;
const MAX_MOVE_OPTIONS = 8;
const MIN_SPREAD_COVERAGE = 3;
const MIN_ITEM_COVERAGE = 2;
const MIN_MOVE_COVERAGE = 4;
const SPREAD_USAGE_TARGET = 80;
const ITEM_USAGE_TARGET = 80;
const MOVE_USAGE_TARGET_RATIO = 0.85;
const MOVE_SLOT_VARIANTS = 4;
const PRIORITY_MOVE_CANDIDATES = 4;
const PRIORITY_LOADOUT_CANDIDATES = 4;

type UsageMeta = {
  rank: number;
  percent: number;
};

type CandidateBuckets = {
  current: SetOptimizationCandidate[];
  standard: SetOptimizationCandidate[];
  spread: SetOptimizationCandidate[];
  item: SetOptimizationCandidate[];
  move: SetOptimizationCandidate[];
  loadout: SetOptimizationCandidate[];
};

function getItemId(item: PokemonItem | null | undefined) {
  return normalizeShowdownId(item?.showdownId ?? item?.id ?? item?.name ?? "");
}

function selectUsageCoverage<T extends { usagePercent: number }>(
  values: readonly T[],
  minimum: number,
  maximum: number,
  target: number,
) {
  const selected: T[] = [];
  let cumulative = 0;
  for (const value of values) {
    if (selected.length >= maximum) break;
    selected.push(value);
    cumulative += value.usagePercent;
    if (selected.length >= minimum && cumulative >= target) break;
  }
  return selected;
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

function getMoveById(context: GeneralSetOptimizationContext) {
  return new Map(
    (context.member.moves ?? []).flatMap((move) =>
      [move.id, move.name]
        .map(normalizeShowdownId)
        .filter(Boolean)
        .map((key) => [key, move] as const),
    ),
  );
}

function getCurrentMoveIds(context: GeneralSetOptimizationContext) {
  const moveById = getMoveById(context);
  return [...context.build.moveIds, "", "", "", ""].slice(0, 4).map(
    (moveId) => moveById.get(normalizeShowdownId(moveId))?.id ?? moveId,
  );
}

function getMoveOptions(context: GeneralSetOptimizationContext) {
  const raw = context.usageSet?.moveOptions?.length
    ? context.usageSet.moveOptions
    : (context.usageSet?.moveIds ?? []).map((id) => ({ id, usagePercent: 0 }));
  const bounded = raw.slice(0, MAX_MOVE_OPTIONS);
  const usageTarget = bounded.reduce(
    (total, option) => total + option.usagePercent,
    0,
  ) * MOVE_USAGE_TARGET_RATIO;
  return selectUsageCoverage(
    bounded,
    MIN_MOVE_COVERAGE,
    MAX_MOVE_OPTIONS,
    usageTarget,
  );
}

function resolveStandardMoveIds(context: GeneralSetOptimizationContext) {
  const moveById = getMoveById(context);
  const currentMoveIds = getCurrentMoveIds(context);
  if (currentMoveIds.some((id) => !id || !moveById.has(normalizeShowdownId(id)))) {
    return currentMoveIds;
  }

  const resolved = getMoveOptions(context).flatMap(({ id }) => {
    const move = moveById.get(normalizeShowdownId(id));
    return move ? [move.id] : [];
  }).filter((id, index, all) => all.indexOf(id) === index).slice(0, 4);
  if (resolved.length !== 4) return currentMoveIds;

  const resolvedSet = new Set(resolved);
  const currentSet = new Set(currentMoveIds);
  const replacementSlots = currentMoveIds.flatMap((id, slotIndex) =>
    resolvedSet.has(id) ? [] : [slotIndex],
  );
  const replacements = resolved.filter((id) => !currentSet.has(id));
  if (replacementSlots.length !== replacements.length) return currentMoveIds;

  const aligned = [...currentMoveIds];
  replacementSlots.forEach((slotIndex, index) => {
    aligned[slotIndex] = replacements[index];
  });
  return aligned;
}

function getRoleStats(context: GeneralSetOptimizationContext) {
  const moveById = getMoveById(context);
  const stats = new Set<StatKey>();
  for (const moveId of getCurrentMoveIds(context)) {
    const move = moveById.get(normalizeShowdownId(moveId));
    if (!move?.power || move.power <= 0) continue;
    if (move.category === "Physical") stats.add("attack");
    if (move.category === "Special") stats.add("specialAttack");
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
  variant: SetOptimizationGeneralEvidence["variant"],
  evs: StatBlock,
  natureId: string,
  usage?: UsageMeta,
): SetOptimizationGeneralEvidence {
  const roleStats = getRoleStats(context);
  const baseStats = context.member.baseStats!;
  const currentStats = calculateChampionsStats(
    baseStats,
    context.build.evs,
    getNatureById(context.build.natureId),
  );
  const candidateStats = calculateChampionsStats(baseStats, evs, getNatureById(natureId));
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
    variant,
    ...(source === "usage" && context.usageSet && usage
      ? {
          sourceMonth: context.usageSet.sourceMonth,
          cutoff: context.usageSet.cutoff,
          usageRank: usage.rank,
          usagePercent: usage.percent,
        }
      : {}),
    roleStats,
    reducedRoleStats,
  };
}

function createMoveChanges(context: GeneralSetOptimizationContext, moveIds: string[]) {
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
  item: PokemonItem | null,
  moveIds: string[],
  evidence: SetOptimizationGeneralEvidence,
): SetOptimizationCandidate {
  const currentItemId = getItemId(context.build.item) || null;
  const itemId = getItemId(item) || null;
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
  const statPointChanges = Object.fromEntries(
    statKeys.map((stat) => [stat, evs[stat] - context.build.evs[stat]]),
  ) as StatBlock;
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
    itemId,
    itemName: item?.name ?? null,
    itemChanged: itemId !== currentItemId,
    moveIds,
    moveChanges: createMoveChanges(context, moveIds),
    changedStatPoints: statKeys.reduce(
      (total, stat) => total + Math.abs(statPointChanges[stat]),
      0,
    ),
    statPointChanges,
    offenseBenchmarks: [],
    defenseBenchmarks: [],
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

function getCurrentSpread(context: GeneralSetOptimizationContext) {
  const total = statKeys.reduce((sum, stat) => sum + context.build.evs[stat], 0);
  return total === CHAMPIONS_MAX_EV_TOTAL ? { ...context.build.evs } : null;
}

function getUsageSpreads(context: GeneralSetOptimizationContext) {
  const raw: SmogonUsageSpread[] = context.usageSet?.spreads?.length
    ? context.usageSet.spreads
    : context.usageSet?.evs && context.usageSet.nature
      ? [{
          nature: context.usageSet.nature,
          evs: context.usageSet.evs,
          usagePercent: 0,
        }]
      : [];
  return selectUsageCoverage(
    raw,
    MIN_SPREAD_COVERAGE,
    MAX_SPREAD_CANDIDATES,
    SPREAD_USAGE_TARGET,
  );
}

function getUsageItems(context: GeneralSetOptimizationContext) {
  if (context.build.item?.category === "Mega Stones") return [];
  const currentItemId = getItemId(context.build.item);
  const reservedItemIds = new Set(context.reservedItemIds.map(normalizeShowdownId));
  const optionById = new Map(
    (context.usageSet?.itemOptions ?? []).map((option, index) => [
      option.id,
      { ...option, rank: index + 1 },
    ]),
  );
  const entries = context.usageItems.flatMap((item, index) => {
    if (item.category === "Mega Stones") return [];
    const id = getItemId(item);
    if (!id || (id !== currentItemId && reservedItemIds.has(id))) return [];
    const option = optionById.get(id);
    return [{
      item,
      rank: option?.rank ?? index + 1,
      usagePercent: option?.usagePercent ?? 0,
    }];
  });
  return selectUsageCoverage(
    entries,
    MIN_ITEM_COVERAGE,
    MAX_ITEM_CANDIDATES,
    ITEM_USAGE_TARGET,
  );
}

function moveReplacementScore(
  current: PokemonMove,
  proposed: PokemonMove,
  currentUsagePercent: number,
) {
  const currentDamaging = Boolean(current.power && current.power > 0);
  const proposedDamaging = Boolean(proposed.power && proposed.power > 0);
  let score = 0;
  if (current.type === proposed.type) score += 8;
  if (current.category === proposed.category) score += 6;
  if (currentDamaging === proposedDamaging) score += 4;
  score -= currentUsagePercent / 20;
  return score;
}

function flattenCandidateGroups(groups: SetOptimizationCandidate[][]) {
  return groups.flat();
}

function createGeneralCandidates(context: GeneralSetOptimizationContext) {
  const buckets: CandidateBuckets = {
    current: [], standard: [], spread: [], item: [], move: [], loadout: [],
  };
  const currentMoves = getCurrentMoveIds(context);
  const currentSpread = getCurrentSpread(context);
  const usageSpreads = getUsageSpreads(context);
  const usageItems = getUsageItems(context);
  const alternativeItems = usageItems.filter(
    ({ item }) => getItemId(item) !== getItemId(context.build.item),
  );
  const topSpread = usageSpreads[0];
  const topEvs = topSpread ? completeSpread(topSpread.evs) : null;
  const baselineEvs = currentSpread ?? topEvs;
  const baselineNature = currentSpread
    ? context.build.natureId
    : topSpread?.nature.toLowerCase();

  if (currentSpread) {
    buckets.current.push(createCandidate(
      context,
      "set-current",
      context.build.natureId,
      currentSpread,
      context.build.item,
      currentMoves,
      createEvidence(context, "current", "current", currentSpread, context.build.natureId),
    ));
  }

  if (topSpread && topEvs) {
    buckets.standard.push(createCandidate(
      context,
      "usage-standard",
      topSpread.nature.toLowerCase(),
      topEvs,
      usageItems[0]?.item ?? context.build.item,
      resolveStandardMoveIds(context),
      createEvidence(context, "usage", "standard", topEvs, topSpread.nature, {
        rank: 1,
        percent: topSpread.usagePercent,
      }),
    ));
  }

  usageSpreads.forEach((spread, index) => {
    const evs = completeSpread(spread.evs);
    if (!evs) return;
    buckets.spread.push(createCandidate(
      context,
      `usage-spread-${index + 1}`,
      spread.nature.toLowerCase(),
      evs,
      context.build.item,
      currentMoves,
      createEvidence(context, "usage", "spread", evs, spread.nature, {
        rank: index + 1,
        percent: spread.usagePercent,
      }),
    ));
  });

  if (baselineEvs && baselineNature) {
    alternativeItems.forEach(({ item, rank, usagePercent }) => {
      buckets.item.push(createCandidate(
        context,
        `usage-item-${rank}`,
        baselineNature,
        baselineEvs,
        item,
        currentMoves,
        createEvidence(context, "usage", "item", baselineEvs, baselineNature, {
          rank,
          percent: usagePercent,
        }),
      ));
    });
  }

  if (baselineEvs && baselineNature && currentMoves.every(Boolean)) {
    const moveById = getMoveById(context);
    const currentSet = new Set(currentMoves);
    const moveGroups: SetOptimizationCandidate[][] = [];
    const loadoutGroups: SetOptimizationCandidate[][] = [];
    const usageById = new Map(
      getMoveOptions(context).map((option, index) => [
        normalizeShowdownId(option.id),
        { ...option, rank: index + 1 },
      ]),
    );
    for (const [moveId, option] of usageById) {
      const proposed = moveById.get(moveId);
      if (!proposed || currentSet.has(proposed.id)) continue;
      const slots = currentMoves.map((currentMoveId, slotIndex) => {
        const current = moveById.get(normalizeShowdownId(currentMoveId));
        const currentUsage = usageById.get(normalizeShowdownId(currentMoveId));
        return {
          slotIndex,
          score: current
            ? moveReplacementScore(current, proposed, currentUsage?.usagePercent ?? 0)
            : Number.NEGATIVE_INFINITY,
        };
      }).sort((left, right) => right.score - left.score)
        .slice(0, MOVE_SLOT_VARIANTS);
      const moveCandidates: SetOptimizationCandidate[] = [];
      const loadoutCandidates: SetOptimizationCandidate[] = [];

      for (const { slotIndex } of slots) {
        const moveIds = [...currentMoves];
        moveIds[slotIndex] = proposed.id;
        moveCandidates.push(createCandidate(
          context,
          `usage-move-${proposed.id}-${slotIndex}`,
          baselineNature,
          baselineEvs,
          context.build.item,
          moveIds,
          createEvidence(context, "usage", "move", baselineEvs, baselineNature, {
            rank: option.rank,
            percent: option.usagePercent,
          }),
        ));
        const pairedItem = alternativeItems[0];
        if (pairedItem && proposed.category === "Status") {
          loadoutCandidates.push(createCandidate(
            context,
            `usage-loadout-${proposed.id}-${slotIndex}-${getItemId(pairedItem.item)}`,
            baselineNature,
            baselineEvs,
            pairedItem.item,
            moveIds,
            createEvidence(context, "usage", "loadout", baselineEvs, baselineNature, {
              rank: option.rank,
              percent: option.usagePercent,
            }),
          ));
        }
      }
      moveGroups.push(moveCandidates);
      if (loadoutCandidates.length > 0) loadoutGroups.push(loadoutCandidates);
    }
    buckets.move = flattenCandidateGroups(moveGroups);
    buckets.loadout = flattenCandidateGroups(loadoutGroups);
  }
  return buckets;
}

function selectDiverseCandidates(buckets: CandidateBuckets) {
  const selected: SetOptimizationCandidate[] = [];
  const keys = new Set<string>();
  const append = (candidate: SetOptimizationCandidate | undefined) => {
    if (!candidate) return false;
    const key = candidateKey(candidate);
    if (keys.has(key)) return false;
    keys.add(key);
    selected.push(candidate);
    return true;
  };

  buckets.current.forEach(append);
  buckets.standard.forEach(append);
  buckets.move.slice(0, PRIORITY_MOVE_CANDIDATES).forEach(append);
  buckets.loadout.slice(0, PRIORITY_LOADOUT_CANDIDATES).forEach(append);
  append(buckets.spread[0]);
  append(buckets.item[0]);

  const rotating = [buckets.move, buckets.loadout, buckets.spread, buckets.item];
  let depth = 0;
  while (selected.length < MAX_GENERAL_CANDIDATES) {
    let visited = false;
    for (const bucket of rotating) {
      const candidate = bucket[depth];
      if (!candidate) continue;
      visited = true;
      append(candidate);
      if (selected.length >= MAX_GENERAL_CANDIDATES) break;
    }
    if (!visited) break;
    depth += 1;
  }
  return selected;
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

  const candidates = selectDiverseCandidates(createGeneralCandidates(context));
  return {
    ...identity,
    status: candidates.length > 0 ? "ready" : "unavailable",
    candidates,
    itemMechanics: [context.build.item, ...context.usageItems].filter(
      (item): item is PokemonItem => Boolean(item),
    ),
    ...(candidates.length > 0
      ? {}
      : { reason: "no-meaningful-candidate" as const }),
  };
}
