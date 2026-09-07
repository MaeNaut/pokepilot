import {
  MAX_COMBINATION_FRONTIER,
  MAX_FINAL_SEARCH_FRONTIER,
  MAX_OPTIMIZATION_CANDIDATES,
} from "./constants";
import { evaluateSeeds } from "./candidateEvaluation";
import { minimizeRedundantDefense } from "./defenseInvestment";
import { createRolePreserver } from "./rolePreservation";
import { CURRENT_SAMPLE_ID, shouldOfferCurrentSample } from "./currentSample";
import {
  selectCandidates,
  selectSearchFrontier,
  trimCandidateBenchmarks,
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
    ],
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

  const preserveRole = createRolePreserver(context);
  const prepareSeeds = (seeds: CandidateSeed[]) => mergeSeeds(seeds.flatMap((seed) => {
    const minimized = minimizeRedundantOffense(context, seed, playerMoves, evaluator);
    const preserved = preserveRole(minimized);
    return [seed, minimized, ...(preserved ? [preserved] : [])];
  }));
  const atomicSeeds = prepareSeeds(createAtomicSeeds(
    context,
    evaluator,
    playerMoves,
    opponentMoves,
  ));
  const atomicEntries = evaluateSeeds(
    context,
    atomicSeeds,
    playerMoves,
    opponentMoves,
    currentSpeed,
    evaluator,
  );

  const pairSeeds = prepareSeeds(createPairSeeds(context, atomicSeeds));
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

  const tripleSeeds = prepareSeeds(
    createCombinedSeeds(
      context,
      pairFrontier.map(({ seed }) => seed),
      atomicSeeds,
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
  const selected = selectCandidates(searchFrontier.map(({ candidate }) => candidate));
  const finalized = selected.flatMap((candidate) => {
    const entry = searchFrontier.find(({ candidate: source }) => source.id === candidate.id);
    if (!entry) return [];
    return evaluateSeeds(
      context,
      [minimizeRedundantDefense(context, entry.seed, playerMoves, opponentMoves, evaluator)],
      playerMoves,
      opponentMoves,
      currentSpeed,
      evaluator,
    ).map(({ candidate: normalized }) => trimCandidateBenchmarks({
      ...normalized, profiles: candidate.profiles,
    }));
  });
  let candidates = [...new Map(finalized.map((candidate) => [candidate.id, candidate])).values()];
  const baseline = evaluateSeeds(context, [{
    natureId: context.player.build.natureId, evs: { ...context.player.build.evs },
    focuses: ["offense", "defense", "speed"], targets: {}, axes: [],
  }], playerMoves, opponentMoves, currentSpeed, evaluator)[0]?.candidate;
  if (baseline && shouldOfferCurrentSample(baseline, candidates)) {
    candidates = [{ ...trimCandidateBenchmarks(baseline), id: CURRENT_SAMPLE_ID },
      ...candidates.slice(0, MAX_OPTIMIZATION_CANDIDATES - 1)];
  }

  return {
    ...createPlanIdentity(context),
    status: candidates.length > 0 ? "ready" : "unavailable",
    candidates,
    ...(candidates.length > 0
      ? {}
      : { reason: "no-meaningful-candidate" as const }),
  };
}
