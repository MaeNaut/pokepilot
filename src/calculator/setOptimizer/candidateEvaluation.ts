import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  getNatureById,
  statKeys,
} from "../../data/natures";
import { normalizeShowdownId } from "../../api/showdownIds";
import type { PokemonMove, StatKey } from "../../types";
import { getDefensiveTargetStat } from "./evaluator";
import { getRoleCost } from "./rolePreservation";
import {
  compareDefenseOutcomes,
  compareOffenseOutcomes,
  hasDefensiveSurvivalBoundaryGain,
  toBenchmark,
} from "./outcomes";
import {
  createBuild,
  getChangedStatPoints,
  getStatPointChanges,
  mergeSeeds,
  totalStatPoints,
} from "./spreads";
import type {
  CalculatorAnalysisContext,
  CandidateLoadout,
  CandidateSeed,
  EvaluatedCandidate,
  EvaluatedSeed,
  OptimizationEvaluator,
  OptimizationMove,
  ReadyDamageResult,
  SetOptimizationCandidateProfile,
  SetOptimizationMoveBenchmark,
  SetOptimizationMoveSource,
  SetOptimizationSpeedState,
} from "./types";

function createMoveBenchmark(
  currentMove: PokemonMove,
  optimizedMove: PokemonMove,
  source: SetOptimizationMoveSource,
  current: ReadyDamageResult,
  optimized: ReadyDamageResult,
  focus: "offense" | "defense",
  relevantStat: StatKey,
): SetOptimizationMoveBenchmark {
  const currentBenchmark = toBenchmark(current);
  const optimizedBenchmark = toBenchmark(optimized);
  const comparison =
    focus === "offense"
      ? compareOffenseOutcomes(optimizedBenchmark, currentBenchmark)
      : compareDefenseOutcomes(optimizedBenchmark, currentBenchmark);

  return {
    moveId: optimizedMove.id,
    moveName: optimizedMove.name,
    currentMoveId: currentMove.id,
    currentMoveName: currentMove.name,
    moveCategory: optimizedMove.category as "Physical" | "Special",
    source,
    relevantStat,
    optimizedVsCurrent:
      comparison > 0 ? "better" : comparison < 0 ? "worse" : "same",
    current: currentBenchmark,
    optimized: optimizedBenchmark,
  };
}

function getCandidateProfiles(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  offenseBenchmarks: SetOptimizationMoveBenchmark[],
  defenseBenchmarks: SetOptimizationMoveBenchmark[],
  currentSpeed: SetOptimizationSpeedState,
  optimizedSpeed: SetOptimizationSpeedState,
): SetOptimizationCandidateProfile[] {
  const profiles = new Set<SetOptimizationCandidateProfile>();

  if (
    offenseBenchmarks.some(
      (benchmark) => benchmark.optimizedVsCurrent === "better",
    )
  ) {
    profiles.add("offense-breakpoint");
  }

  for (const benchmark of defenseBenchmarks) {
    if (benchmark.optimizedVsCurrent !== "better") continue;
    const targetStat = benchmark.relevantStat;
    if (targetStat !== "defense" && targetStat !== "specialDefense") {
      continue;
    }

    const maximumProfile =
      targetStat === "defense"
        ? "physical-bulk-maximum"
        : "special-bulk-maximum";
    const reserveProfile =
      targetStat === "defense"
        ? "physical-survival-with-reserve"
        : "special-survival-with-reserve";
    const oppositeStat =
      targetStat === "defense" ? "specialDefense" : "defense";

    if (
      seed.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
      seed.evs[targetStat] === CHAMPIONS_MAX_EV_PER_STAT
    ) {
      profiles.add(maximumProfile);
    } else if (
      seed.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
      seed.evs[targetStat] < CHAMPIONS_MAX_EV_PER_STAT &&
      seed.evs[oppositeStat] > context.player.build.evs[oppositeStat] &&
      hasDefensiveSurvivalBoundaryGain(
        benchmark.optimized,
        benchmark.current,
      )
    ) {
      profiles.add(reserveProfile);
    }
  }

  if (
    currentSpeed.relation !== optimizedSpeed.relation ||
    currentSpeed.playerSpeed !== optimizedSpeed.playerSpeed
  ) {
    profiles.add("speed-adjustment");
  }

  return [...profiles];
}

function evaluateSeed(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  playerMoves: OptimizationMove[],
  opponentMoves: OptimizationMove[],
  currentSpeed: SetOptimizationSpeedState,
  evaluator: OptimizationEvaluator,
  loadout?: CandidateLoadout,
): EvaluatedCandidate | null {
  if (!context.player.member?.baseStats) return null;

  const build = {
    ...createBuild(context, seed.natureId, seed.evs),
    ...(loadout ? { item: loadout.item, moveIds: loadout.moveIds } : {}),
  };
  const optimizedMoves = loadout?.moves ?? playerMoves;
  const offenseBenchmarks = optimizedMoves.flatMap(({ move, source }) => {
    const moveChange = loadout?.moveChanges.find(
      ({ optimizedMoveId }) => optimizedMoveId === move.id,
    );
    const currentMove = moveChange
      ? playerMoves.find(
          ({ move: candidate }) => candidate.id === moveChange.currentMoveId,
        )?.move
      : move;
    if (!currentMove) return [];
    const current = evaluator.calculate(
      currentMove,
      context.player.build,
      "player-to-opponent",
    );
    const optimized = evaluator.calculate(
      move,
      build,
      "player-to-opponent",
    );

    return current &&
      optimized &&
      current.offensiveStatOwner === "attacker" &&
      optimized.offensiveStatOwner === "attacker"
      ? [
          createMoveBenchmark(
            currentMove,
            move,
            source,
            current,
            optimized,
            "offense",
            optimized.offensiveStatKey,
          ),
        ]
      : [];
  });
  const defenseBenchmarks = opponentMoves.flatMap(({ move, source }) => {
    const current = evaluator.calculate(
      move,
      context.player.build,
      "opponent-to-player",
    );
    const optimized = evaluator.calculate(
      move,
      build,
      "opponent-to-player",
    );

    return current &&
      optimized &&
      current.defensiveStatOwner === "defender" &&
      optimized.defensiveStatOwner === "defender"
      ? [
          createMoveBenchmark(
            move,
            move,
            source,
            current,
            optimized,
            "defense",
            getDefensiveTargetStat(context, optimized),
          ),
        ]
      : [];
  });
  const optimizedSpeed = evaluator.speed(build);
  if (!optimizedSpeed) return null;

  const item = loadout?.item ?? context.player.build.item;
  const currentItem = context.player.build.item;
  const itemId = item
    ? normalizeShowdownId(item.showdownId ?? item.id ?? item.name)
    : null;
  const currentItemId = currentItem
    ? normalizeShowdownId(
        currentItem.showdownId ?? currentItem.id ?? currentItem.name,
      )
    : null;
  const moveIds = loadout?.moveIds ?? [0, 1, 2, 3].map(
    (index) => context.player.moves[index]?.id ?? context.player.build.moveIds[index] ?? "",
  );
  const evCode = statKeys.map((stat) => seed.evs[stat]).join("-");
  const loadoutCode = loadout
    ? `-item-${itemId ?? "none"}-moves-${moveIds.join(".")}`
    : "";

  return {
    id: `set-${seed.natureId}-${evCode}${loadoutCode}`,
    roleCost: getRoleCost(context, seed),
    slotIndex: context.selectedSlot,
    focuses: seed.focuses,
    profiles: getCandidateProfiles(
      context,
      seed,
      offenseBenchmarks,
      defenseBenchmarks,
      currentSpeed,
      optimizedSpeed,
    ),
    maxedStats: statKeys.filter(
      (stat) => seed.evs[stat] === CHAMPIONS_MAX_EV_PER_STAT,
    ),
    natureId: seed.natureId,
    evs: seed.evs,
    evTotal: totalStatPoints(seed.evs),
    finalStats: calculateChampionsStats(
      context.player.member.baseStats,
      seed.evs,
      getNatureById(seed.natureId),
    ),
    itemId,
    itemName: item?.name ?? null,
    itemChanged: itemId !== currentItemId,
    moveIds,
    moveChanges: loadout?.moveChanges ?? [],
    changedStatPoints: getChangedStatPoints(
      context.player.build.evs,
      seed.evs,
    ),
    statPointChanges: getStatPointChanges(
      context.player.build.evs,
      seed.evs,
    ),
    offenseBenchmarks,
    defenseBenchmarks,
    speedBenchmark: { current: currentSpeed, optimized: optimizedSpeed },
  };
}

export function evaluateSeeds(
  context: CalculatorAnalysisContext,
  seeds: CandidateSeed[],
  playerMoves: OptimizationMove[],
  opponentMoves: OptimizationMove[],
  currentSpeed: SetOptimizationSpeedState,
  evaluator: OptimizationEvaluator,
  loadout?: CandidateLoadout,
): EvaluatedSeed[] {
  return mergeSeeds(seeds).flatMap((seed) => {
    const candidate = evaluateSeed(
      context,
      seed,
      playerMoves,
      opponentMoves,
      currentSpeed,
      evaluator,
      loadout,
    );
    return candidate ? [{ seed, candidate }] : [];
  });
}
