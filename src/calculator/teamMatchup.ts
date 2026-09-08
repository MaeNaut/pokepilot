import { compareOffenseOutcomes, toBenchmark } from "./setOptimizer/outcomes";
import { normalizeShowdownId } from "../api/showdownIds";
import {
  createOptimizationEvaluator,
  getDamagingMoves,
} from "./setOptimizer/evaluator";
import type {
  CalculatorAnalysisContext,
  SetOptimizationBenchmark,
  SetOptimizationMoveSource,
  SetOptimizationSpeedState,
} from "./setOptimizer/types";

export type TeamMatchupResponseTier = "answer" | "check" | "limited";

export type TeamMatchupMoveBenchmark = {
  moveId: string;
  moveName: string;
  moveCategory: "Physical" | "Special";
  source: SetOptimizationMoveSource;
  requiresRecharge: boolean;
  possibleActionTurns: number | null;
  guaranteedActionTurns: number | null;
  result: SetOptimizationBenchmark;
  persistentSequence?: TeamMatchupPersistentSequence;
};

export type TeamMatchupPersistentSequence = {
  triggerAbilityId: string;
  boostedStat: "defense";
  stagesPerHit: number;
  boostAffectedDamage: boolean;
  includesBetweenHitRecovery: false;
  possibleKoHits: number | null;
  guaranteedKoHits: number | null;
  hits: Array<{
    hit: number;
    defensiveStage: number;
    minPercent: number;
    maxPercent: number;
    cumulativeMinPercent: number;
    cumulativeMaxPercent: number;
  }>;
};

export type TeamMatchupMemberPlan = {
  slotIndex: number;
  pokemonId: string;
  pokemonName: string;
  responseTier: TeamMatchupResponseTier;
  offenseBenchmarks: TeamMatchupMoveBenchmark[];
  defenseBenchmarks: TeamMatchupMoveBenchmark[];
  speed: SetOptimizationSpeedState;
};

export type TeamMatchupPlan =
  | {
      status: "ready";
      opponentId: string;
      opponentName: string;
      members: TeamMatchupMemberPlan[];
    }
  | {
      status: "unavailable";
      opponentId: string | null;
      opponentName: string | null;
      members: [];
      reason: "missing-opponent" | "missing-roster" | "missing-benchmarks";
    };

const responseTierOrder: Record<TeamMatchupResponseTier, number> = {
  answer: 0,
  check: 1,
  limited: 2,
};

function responseSort(
  left: TeamMatchupMemberPlan,
  right: TeamMatchupMemberPlan,
) {
  const tierDifference = responseTierOrder[left.responseTier] -
    responseTierOrder[right.responseTier];
  if (tierDifference !== 0) return tierDifference;

  const leftOffense = left.offenseBenchmarks[0];
  const rightOffense = right.offenseBenchmarks[0];
  if (leftOffense && rightOffense) {
    const actionTurnDifference =
      (leftOffense.guaranteedActionTurns ?? Number.POSITIVE_INFINITY) -
      (rightOffense.guaranteedActionTurns ?? Number.POSITIVE_INFINITY);
    if (actionTurnDifference !== 0) return actionTurnDifference;

    const speedOrder = { faster: 0, tie: 1, slower: 2 } as const;
    const speedDifference = speedOrder[left.speed.relation] -
      speedOrder[right.speed.relation];
    if (speedDifference !== 0) return speedDifference;

    const offenseDifference = offenseSort(leftOffense, rightOffense);
    if (offenseDifference !== 0) return offenseDifference;
  } else if (leftOffense || rightOffense) {
    return leftOffense ? -1 : 1;
  }

  const speedOrder = { faster: 0, tie: 1, slower: 2 } as const;
  return speedOrder[left.speed.relation] - speedOrder[right.speed.relation];
}

function offenseSort(
  left: TeamMatchupMoveBenchmark,
  right: TeamMatchupMoveBenchmark,
) {
  const leftGuaranteedTurns = left.guaranteedActionTurns ??
    Number.POSITIVE_INFINITY;
  const rightGuaranteedTurns = right.guaranteedActionTurns ??
    Number.POSITIVE_INFINITY;
  if (leftGuaranteedTurns !== rightGuaranteedTurns) {
    return leftGuaranteedTurns - rightGuaranteedTurns;
  }

  if (left.requiresRecharge !== right.requiresRecharge) {
    return left.requiresRecharge ? 1 : -1;
  }

  const leftGuaranteed = left.persistentSequence?.guaranteedKoHits ??
    left.result.guaranteedKoHits ?? Number.POSITIVE_INFINITY;
  const rightGuaranteed = right.persistentSequence?.guaranteedKoHits ??
    right.result.guaranteedKoHits ?? Number.POSITIVE_INFINITY;
  if (leftGuaranteed !== rightGuaranteed) return leftGuaranteed - rightGuaranteed;

  const leftPossible = left.persistentSequence?.possibleKoHits ??
    left.result.possibleKoHits ?? Number.POSITIVE_INFINITY;
  const rightPossible = right.persistentSequence?.possibleKoHits ??
    right.result.possibleKoHits ?? Number.POSITIVE_INFINITY;
  const leftPossibleTurns = left.possibleActionTurns ?? Number.POSITIVE_INFINITY;
  const rightPossibleTurns = right.possibleActionTurns ?? Number.POSITIVE_INFINITY;
  if (leftPossibleTurns !== rightPossibleTurns) {
    return leftPossibleTurns - rightPossibleTurns;
  }
  if (leftPossible !== rightPossible) return leftPossible - rightPossible;

  const leftSequenceHits = left.persistentSequence?.hits;
  const rightSequenceHits = right.persistentSequence?.hits;
  const leftSequenceEnd = leftSequenceHits?.[leftSequenceHits.length - 1];
  const rightSequenceEnd = rightSequenceHits?.[rightSequenceHits.length - 1];
  if (leftSequenceEnd && rightSequenceEnd) {
    const cumulativeDifference = rightSequenceEnd.cumulativeMinPercent -
      leftSequenceEnd.cumulativeMinPercent;
    if (cumulativeDifference !== 0) return cumulativeDifference;

    if (
      left.persistentSequence?.boostAffectedDamage !==
      right.persistentSequence?.boostAffectedDamage
    ) {
      return left.persistentSequence?.boostAffectedDamage ? 1 : -1;
    }
  }

  const comparison = compareOffenseOutcomes(left.result, right.result);
  return comparison === 0
    ? right.result.maxPercent - left.result.maxPercent
    : -comparison;
}

const MAX_PERSISTENT_SEQUENCE_HITS = 6;

function toActionTurns(hitCount: number | null, requiresRecharge: boolean) {
  if (hitCount === null) return null;
  return requiresRecharge ? hitCount * 2 - 1 : hitCount;
}

function createMoveBenchmark(
  move: Parameters<ReturnType<typeof createOptimizationEvaluator>["calculate"]>[0],
  source: SetOptimizationMoveSource,
  result: NonNullable<ReturnType<ReturnType<typeof createOptimizationEvaluator>["calculate"]>>,
  persistentSequence?: TeamMatchupPersistentSequence,
): TeamMatchupMoveBenchmark {
  const requiresRecharge = move.tags?.includes("Recharge") ?? false;
  const benchmark = toBenchmark(result);
  const possibleKoHits = persistentSequence
    ? persistentSequence.possibleKoHits
    : benchmark.possibleKoHits;
  const guaranteedKoHits = persistentSequence
    ? persistentSequence.guaranteedKoHits
    : benchmark.guaranteedKoHits;

  return {
    moveId: move.id,
    moveName: move.name,
    moveCategory: move.category as "Physical" | "Special",
    source,
    requiresRecharge,
    possibleActionTurns: toActionTurns(possibleKoHits, requiresRecharge),
    guaranteedActionTurns: toActionTurns(guaranteedKoHits, requiresRecharge),
    result: benchmark,
    ...(persistentSequence ? { persistentSequence } : {}),
  };
}

function createPersistentOffenseSequence(
  context: CalculatorAnalysisContext,
  move: Parameters<ReturnType<typeof createOptimizationEvaluator>["calculate"]>[0],
  baseResult: NonNullable<ReturnType<ReturnType<typeof createOptimizationEvaluator>["calculate"]>>,
): TeamMatchupPersistentSequence | undefined {
  const abilityId = normalizeShowdownId(context.opponent.build.ability);
  if (
    abilityId !== "stamina" ||
    move.category !== "Physical" ||
    baseResult.maxDamage <= 0
  ) {
    return undefined;
  }

  const initialStage = context.opponent.battle.boosts.defense;
  const defenderHp = baseResult.defenderCurrentHp;
  const hits: TeamMatchupPersistentSequence["hits"] = [];
  let cumulativeMin = 0;
  let cumulativeMax = 0;
  let possibleKoHits: number | null = null;
  let guaranteedKoHits: number | null = null;

  for (let hit = 1; hit <= MAX_PERSISTENT_SEQUENCE_HITS; hit += 1) {
    const defensiveStage = Math.min(6, initialStage + hit - 1);
    const result = hit === 1
      ? baseResult
      : createOptimizationEvaluator({
          ...context,
          opponent: {
            ...context.opponent,
            battle: {
              ...context.opponent.battle,
              boosts: {
                ...context.opponent.battle.boosts,
                defense: defensiveStage,
              },
            },
          },
        }).calculate(move, context.player.build, "player-to-opponent");
    if (!result) break;

    cumulativeMin += result.minDamage;
    cumulativeMax += result.maxDamage;
    hits.push({
      hit,
      defensiveStage,
      minPercent: result.minPercent,
      maxPercent: result.maxPercent,
      cumulativeMinPercent: (cumulativeMin / result.defenderMaxHp) * 100,
      cumulativeMaxPercent: (cumulativeMax / result.defenderMaxHp) * 100,
    });
    if (possibleKoHits === null && cumulativeMax >= defenderHp) {
      possibleKoHits = hit;
    }
    if (guaranteedKoHits === null && cumulativeMin >= defenderHp) {
      guaranteedKoHits = hit;
    }
    if (possibleKoHits !== null && guaranteedKoHits !== null) break;
  }

  const firstHit = hits[0];
  return {
    triggerAbilityId: abilityId,
    boostedStat: "defense",
    stagesPerHit: 1,
    boostAffectedDamage: hits.slice(1).some(
      (hit) => hit.minPercent !== firstHit?.minPercent ||
        hit.maxPercent !== firstHit?.maxPercent,
    ),
    includesBetweenHitRecovery: false,
    possibleKoHits,
    guaranteedKoHits,
    hits,
  };
}

function defenseSort(
  left: TeamMatchupMoveBenchmark,
  right: TeamMatchupMoveBenchmark,
) {
  const leftHits = left.result.possibleKoHits ?? Number.POSITIVE_INFINITY;
  const rightHits = right.result.possibleKoHits ?? Number.POSITIVE_INFINITY;
  return leftHits - rightHits || right.result.maxPercent - left.result.maxPercent;
}

function retainSelectedOrTopBenchmarks(
  benchmarks: TeamMatchupMoveBenchmark[],
  compare: (
    left: TeamMatchupMoveBenchmark,
    right: TeamMatchupMoveBenchmark,
  ) => number,
) {
  const sorted = [...benchmarks].sort(compare);
  const selected = sorted.filter(({ source }) => source === "selected");
  const retained = [...selected];
  const targetCount = Math.max(2, selected.length);

  for (const benchmark of sorted) {
    if (retained.length >= targetCount) break;
    if (!retained.some(({ moveId }) => moveId === benchmark.moveId)) {
      retained.push(benchmark);
    }
  }

  return retained.sort(compare);
}

function getResponseTier(
  offense: TeamMatchupMoveBenchmark | undefined,
  defense: TeamMatchupMoveBenchmark | undefined,
  speed: SetOptimizationSpeedState,
): TeamMatchupResponseTier {
  const offenseTurns = offense?.guaranteedActionTurns ??
    Number.POSITIVE_INFINITY;
  const survivesOneHit =
    !defense ||
    defense.result.maxDamage === 0 ||
    (defense.result.possibleKoHits ?? 0) >= 2;
  const movesFirst = speed.relation !== "slower";

  if (
    (offenseTurns <= 1 && movesFirst) ||
    (offenseTurns <= 2 && survivesOneHit)
  ) {
    return "answer";
  }

  if (
    offenseTurns <= 2 ||
    (offenseTurns <= 3 && survivesOneHit)
  ) {
    return "check";
  }

  return "limited";
}

export function createTeamMatchupPlan(
  context: CalculatorAnalysisContext,
): TeamMatchupPlan {
  const opponent = context.opponent.member;
  if (!opponent) {
    return {
      status: "unavailable",
      opponentId: null,
      opponentName: null,
      members: [],
      reason: "missing-opponent",
    };
  }

  const roster = context.roster?.filter((side) => side.member) ?? [];
  if (roster.length === 0) {
    return {
      status: "unavailable",
      opponentId: opponent.id,
      opponentName: opponent.name,
      members: [],
      reason: "missing-roster",
    };
  }

  const members = roster.flatMap<TeamMatchupMemberPlan>((side) => {
    const member = side.member;
    if (!member) return [];

    const memberContext: CalculatorAnalysisContext = {
      ...context,
      selectedSlot: side.slotIndex,
      player: side,
    };
    const evaluator = createOptimizationEvaluator(memberContext);
    const speed = evaluator.speed(side.build);
    if (!speed) return [];

    const offenseBenchmarks = retainSelectedOrTopBenchmarks(
      getDamagingMoves(side)
      .flatMap<TeamMatchupMoveBenchmark>(({ move, source }) => {
        const result = evaluator.calculate(
          move,
          side.build,
          "player-to-opponent",
        );
        if (!result) return [];
        const persistentSequence = createPersistentOffenseSequence(
          memberContext,
          move,
          result,
        );
        return [createMoveBenchmark(
          move,
          source,
          result,
          persistentSequence,
        )];
      }),
      offenseSort,
    );
    const defenseBenchmarks = retainSelectedOrTopBenchmarks(
      getDamagingMoves(context.opponent)
      .flatMap<TeamMatchupMoveBenchmark>(({ move, source }) => {
        const result = evaluator.calculate(
          move,
          side.build,
          "opponent-to-player",
        );
        return result
          ? [createMoveBenchmark(move, source, result)]
          : [];
      }),
      defenseSort,
    );

    if (offenseBenchmarks.length === 0 && defenseBenchmarks.length === 0) {
      return [];
    }

    return [{
      slotIndex: side.slotIndex,
      pokemonId: member.id,
      pokemonName: member.name,
      responseTier: getResponseTier(
        offenseBenchmarks[0],
        defenseBenchmarks[0],
        speed,
      ),
      offenseBenchmarks,
      defenseBenchmarks,
      speed,
    }];
  });

  if (members.length === 0) {
    return {
      status: "unavailable",
      opponentId: opponent.id,
      opponentName: opponent.name,
      members: [],
      reason: "missing-benchmarks",
    };
  }

  return {
    status: "ready",
    opponentId: opponent.id,
    opponentName: opponent.name,
    members: members.sort(responseSort),
  };
}
