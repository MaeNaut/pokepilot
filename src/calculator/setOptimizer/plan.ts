import {
  MAX_COMBINATION_FRONTIER,
  MAX_FINAL_SEARCH_FRONTIER,
} from "./constants";
import { evaluateSeeds } from "./candidateEvaluation";
import {
  selectCandidates,
  selectSearchFrontier,
} from "./candidateSelection";
import {
  createOptimizationEvaluator,
  getDamagingMoves,
} from "./evaluator";
import {
  createDefenseSeeds,
  createOffenseSeeds,
  createSpeedSeeds,
  minimizeRedundantOffense,
} from "./seeds";
import {
  combineSeeds,
  createCombinedSeeds,
  mergeSeeds,
} from "./spreads";
import type {
  CalculatorAnalysisContext,
  CandidateSeed,
  SetOptimizationPlan,
} from "./types";

function createPlanIdentity(context: CalculatorAnalysisContext) {
  return {
    slotIndex: context.selectedSlot,
    playerId: context.player.member?.id ?? null,
    playerName: context.player.member?.name ?? null,
    opponentId: context.opponent.member?.id ?? null,
    opponentName: context.opponent.member?.name ?? null,
    configuredDirection: context.direction,
  };
}

function createUnavailablePlan(
  context: CalculatorAnalysisContext,
  reason: NonNullable<SetOptimizationPlan["reason"]>,
): SetOptimizationPlan {
  return {
    ...createPlanIdentity(context),
    status: "unavailable",
    candidates: [],
    reason,
  };
}

function createAtomicSeeds(
  context: CalculatorAnalysisContext,
  evaluator: ReturnType<typeof createOptimizationEvaluator>,
  playerMoves: ReturnType<typeof getDamagingMoves>,
  opponentMoves: ReturnType<typeof getDamagingMoves>,
) {
  return mergeSeeds(
    [
      ...playerMoves.flatMap(({ move }) =>
        createOffenseSeeds(context, move, evaluator),
      ),
      ...opponentMoves.flatMap(({ move }) =>
        createDefenseSeeds(context, move, evaluator),
      ),
      ...createSpeedSeeds(context, evaluator),
    ].map((seed) =>
      minimizeRedundantOffense(context, seed, playerMoves, evaluator),
    ),
  );
}

function createPairSeeds(
  context: CalculatorAnalysisContext,
  atomicSeeds: CandidateSeed[],
) {
  const seeds: CandidateSeed[] = [];
  for (let left = 0; left < atomicSeeds.length; left += 1) {
    for (let right = left + 1; right < atomicSeeds.length; right += 1) {
      seeds.push(
        ...combineSeeds(context, atomicSeeds[left], atomicSeeds[right]),
      );
    }
  }
  return seeds;
}

export function createSetOptimizationPlan(
  context: CalculatorAnalysisContext,
): SetOptimizationPlan {
  if (!context.player.member || !context.opponent.member) {
    return createUnavailablePlan(context, "missing-pokemon");
  }
  if (!context.player.member.baseStats || !context.opponent.member.baseStats) {
    return createUnavailablePlan(context, "missing-stats");
  }

  const playerMoves = getDamagingMoves(context.player);
  const opponentMoves = getDamagingMoves(context.opponent);
  if (playerMoves.length === 0 && opponentMoves.length === 0) {
    return createUnavailablePlan(context, "missing-damaging-move");
  }

  const evaluator = createOptimizationEvaluator(context);
  const currentSpeed = evaluator.speed(context.player.build);
  if (!currentSpeed) return createUnavailablePlan(context, "missing-stats");

  const atomicSeeds = createAtomicSeeds(
    context,
    evaluator,
    playerMoves,
    opponentMoves,
  );
  const atomicEntries = evaluateSeeds(
    context,
    atomicSeeds,
    playerMoves,
    opponentMoves,
    currentSpeed,
    evaluator,
  );

  const pairSeeds = mergeSeeds(
    createPairSeeds(context, atomicSeeds).map((seed) =>
      minimizeRedundantOffense(context, seed, playerMoves, evaluator),
    ),
  );
  const pairFrontier = selectSearchFrontier(
    evaluateSeeds(
      context,
      pairSeeds,
      playerMoves,
      opponentMoves,
      currentSpeed,
      evaluator,
    ),
    MAX_COMBINATION_FRONTIER,
  );

  const tripleSeeds = mergeSeeds(
    createCombinedSeeds(
      context,
      pairFrontier.map(({ seed }) => seed),
      atomicSeeds,
    ).map((seed) =>
      minimizeRedundantOffense(context, seed, playerMoves, evaluator),
    ),
  );
  const tripleEntries = evaluateSeeds(
    context,
    tripleSeeds,
    playerMoves,
    opponentMoves,
    currentSpeed,
    evaluator,
  );
  const searchFrontier = selectSearchFrontier(
    [...atomicEntries, ...pairFrontier, ...tripleEntries],
    MAX_FINAL_SEARCH_FRONTIER,
  );
  const candidates = selectCandidates(
    searchFrontier.map(({ candidate }) => candidate),
  );

  return {
    ...createPlanIdentity(context),
    status: candidates.length > 0 ? "ready" : "unavailable",
    candidates,
    ...(candidates.length > 0
      ? {}
      : { reason: "no-meaningful-candidate" as const }),
  };
}
