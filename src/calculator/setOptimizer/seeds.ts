import { CHAMPIONS_MAX_EV_PER_STAT } from "../../data/natures";
import type { PokemonMove, StatBlock } from "../../types";
import { getDefensiveTargetStat } from "./evaluator";
import {
  cappedOffenseHits,
  compareDefenseOutcomes,
  compareOffenseOutcomes,
  getDefenseOutcomeTier,
  getGuaranteedKoHits,
  getOffenseOutcomeTier,
  hasMeaningfulProbabilisticKoGain,
  isPracticalOffenseOutcome,
  preservesProbabilisticKoOutcome,
  toBenchmark,
} from "./outcomes";
import {
  createBuild,
  createSeed,
  getNatureCandidates,
  getOffenseNatureCandidates,
  getOutcomeBreakpointSubset,
  getSpeedNatureCandidates,
  rebalanceSpread,
} from "./spreads";
import type {
  CalculatorAnalysisContext,
  CandidateSeed,
  OptimizationEvaluator,
  OptimizationMove,
  SetOptimizationBenchmark,
} from "./types";

export function createOffenseSeeds(
  context: CalculatorAnalysisContext,
  move: PokemonMove,
  evaluator: OptimizationEvaluator,
) {
  const currentResult = evaluator.calculate(
    move,
    context.player.build,
    "player-to-opponent",
  );
  if (!currentResult || currentResult.offensiveStatOwner !== "attacker") {
    return [];
  }

  const targetStat = currentResult.offensiveStatKey;
  const currentBenchmark = toBenchmark(currentResult);

  return getOffenseNatureCandidates(context, targetStat).flatMap(
    (natureId) => {
      const breakpoints: Array<{
        investment: number;
        evs: StatBlock;
        benchmark: SetOptimizationBenchmark;
      }> = [];
      let lastBenchmark: SetOptimizationBenchmark | null = null;

      for (
        let investment = 0;
        investment <= CHAMPIONS_MAX_EV_PER_STAT;
        investment += 1
      ) {
        const targets = { [targetStat]: investment } as Partial<StatBlock>;
        const evs = rebalanceSpread(context.player.build.evs, targets);
        const result = evaluator.calculate(
          move,
          createBuild(context, natureId, evs),
          "player-to-opponent",
        );
        if (!result || result.offensiveStatOwner !== "attacker") continue;

        const benchmark = toBenchmark(result);
        if (!isPracticalOffenseOutcome(benchmark)) continue;

        const comparisonToCurrent = compareOffenseOutcomes(
          benchmark,
          currentBenchmark,
        );
        const preservesWithLessInvestment =
          comparisonToCurrent === 0 &&
          investment < context.player.build.evs[targetStat];
        if (comparisonToCurrent < 0) continue;
        if (comparisonToCurrent === 0 && !preservesWithLessInvestment) {
          continue;
        }
        if (
          lastBenchmark &&
          compareOffenseOutcomes(benchmark, lastBenchmark) <= 0
        ) {
          continue;
        }

        breakpoints.push({ investment, evs, benchmark });
        lastBenchmark = benchmark;
      }

      return getOutcomeBreakpointSubset(
        breakpoints,
        (entry) => getOffenseOutcomeTier(entry.benchmark),
      ).map((entry) =>
        createSeed(
          natureId,
          entry.evs,
          "offense",
          { [targetStat]: entry.investment },
          `offense:${targetStat}`,
        ),
      );
    },
  );
}

export function createDefenseSeeds(
  context: CalculatorAnalysisContext,
  move: PokemonMove,
  evaluator: OptimizationEvaluator,
) {
  const currentResult = evaluator.calculate(
    move,
    context.player.build,
    "opponent-to-player",
  );
  if (!currentResult || currentResult.defensiveStatOwner !== "defender") {
    return [];
  }

  const targetStat = getDefensiveTargetStat(context, currentResult);
  const currentBenchmark = toBenchmark(currentResult);
  const currentBulkPoints =
    context.player.build.evs.hp + context.player.build.evs[targetStat];

  return getNatureCandidates(
    context.player.build.natureId,
    targetStat,
  ).flatMap((natureId) => {
    const bulkCandidates: Array<{
      hp: number;
      defense: number;
      evs: StatBlock;
      benchmark: SetOptimizationBenchmark;
    }> = [];

    for (
      let defense = 0;
      defense <= CHAMPIONS_MAX_EV_PER_STAT;
      defense += 1
    ) {
      // Build HP first, then scan the relevant defense for an exact boundary.
      const hp = CHAMPIONS_MAX_EV_PER_STAT;
      const targets = { hp, [targetStat]: defense } as Partial<StatBlock>;
      const evs = rebalanceSpread(context.player.build.evs, targets);
      const result = evaluator.calculate(
        move,
        createBuild(context, natureId, evs),
        "opponent-to-player",
      );
      if (!result || result.defensiveStatOwner !== "defender") continue;

      bulkCandidates.push({
        hp,
        defense,
        evs,
        benchmark: toBenchmark(result),
      });
    }

    const breakpoints: typeof bulkCandidates = [];
    let lastBenchmark: SetOptimizationBenchmark | null = null;
    for (const candidate of bulkCandidates) {
      const comparisonToCurrent = compareDefenseOutcomes(
        candidate.benchmark,
        currentBenchmark,
      );
      const candidateCost = candidate.hp + candidate.defense;
      const preservesWithFewerPoints =
        comparisonToCurrent === 0 && candidateCost < currentBulkPoints;
      if (comparisonToCurrent < 0) continue;
      if (comparisonToCurrent === 0 && !preservesWithFewerPoints) continue;
      if (
        lastBenchmark &&
        compareDefenseOutcomes(candidate.benchmark, lastBenchmark) <= 0 &&
        candidate.defense !== CHAMPIONS_MAX_EV_PER_STAT
      ) {
        continue;
      }

      breakpoints.push(candidate);
      lastBenchmark = candidate.benchmark;
    }

    return getOutcomeBreakpointSubset(
      breakpoints,
      (entry) => getDefenseOutcomeTier(entry.benchmark),
    ).map((entry) =>
      createSeed(
        natureId,
        entry.evs,
        "defense",
        { hp: entry.hp, [targetStat]: entry.defense },
        `defense:${targetStat}`,
      ),
    );
  });
}

export function createSpeedSeeds(
  context: CalculatorAnalysisContext,
  evaluator: OptimizationEvaluator,
) {
  const currentSpeed = evaluator.speed(context.player.build);
  if (!currentSpeed) return [];

  const seeds: CandidateSeed[] = [];
  for (const natureId of getSpeedNatureCandidates(
    context.player.build.natureId,
    "fast",
  )) {
    for (
      let speedInvestment = 0;
      speedInvestment <= CHAMPIONS_MAX_EV_PER_STAT;
      speedInvestment += 1
    ) {
      const speed = speedInvestment;
      const evs = rebalanceSpread(context.player.build.evs, { speed });
      const build = createBuild(context, natureId, evs);
      const speedState = evaluator.speed(build);
      if (speedState?.relation === "faster") {
        seeds.push(
          createSeed(
            natureId,
            evs,
            "speed",
            { speed },
            "speed:fast",
          ),
        );
        break;
      }
    }
  }

  for (const natureId of getSpeedNatureCandidates(
    context.player.build.natureId,
    "slow",
  )) {
    const evs = rebalanceSpread(context.player.build.evs, { speed: 0 });
    const speed = evaluator.speed(createBuild(context, natureId, evs));
    if (speed?.relation === "slower") {
      seeds.push(
        createSeed(
          natureId,
          evs,
          "speed",
          { speed: 0 },
          "speed:slow",
        ),
      );
    }
  }

  return seeds;
}

export function minimizeRedundantOffense(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  moves: OptimizationMove[],
  evaluator: OptimizationEvaluator,
) {
  let evs = seed.evs;
  const targets = { ...seed.targets };

  for (const stat of ["attack", "specialAttack"] as const) {
    const baselineBuild = createBuild(context, seed.natureId, evs);
    const zeroInvestmentEvs = rebalanceSpread(evs, {
      ...targets,
      [stat]: 0,
    });
    const zeroInvestmentBuild = createBuild(
      context,
      seed.natureId,
      zeroInvestmentEvs,
    );
    const relevantMoves = moves.flatMap(({ move }) => {
      const result = evaluator.calculate(
        move,
        baselineBuild,
        "player-to-opponent",
      );
      const zeroInvestmentResult = evaluator.calculate(
        move,
        zeroInvestmentBuild,
        "player-to-opponent",
      );

      if (
        result?.offensiveStatOwner !== "attacker" ||
        result.offensiveStatKey !== stat ||
        zeroInvestmentResult?.offensiveStatOwner !== "attacker" ||
        zeroInvestmentResult.offensiveStatKey !== stat ||
        !isPracticalOffenseOutcome(toBenchmark(result))
      ) {
        return [];
      }

      return [
        {
          move,
          targetHits: cappedOffenseHits(getGuaranteedKoHits(result)),
          probabilityTarget: hasMeaningfulProbabilisticKoGain(
            result,
            zeroInvestmentResult,
          )
            ? result
            : null,
        },
      ];
    });
    let best = zeroInvestmentEvs;

    if (relevantMoves.length > 0) {
      let minimum = 0;
      let maximum = evs[stat];
      best = evs;

      while (minimum <= maximum) {
        const investment = Math.floor((minimum + maximum) / 2);
        const candidateEvs = rebalanceSpread(evs, {
          ...targets,
          [stat]: investment,
        });
        const candidateBuild = createBuild(
          context,
          seed.natureId,
          candidateEvs,
        );
        const preservesEveryTier = relevantMoves.every(
          ({ move, targetHits, probabilityTarget }) => {
            const result = evaluator.calculate(
              move,
              candidateBuild,
              "player-to-opponent",
            );

            return (
              result?.offensiveStatOwner === "attacker" &&
              result.offensiveStatKey === stat &&
              cappedOffenseHits(getGuaranteedKoHits(result)) <= targetHits &&
              (!probabilityTarget ||
                preservesProbabilisticKoOutcome(result, probabilityTarget))
            );
          },
        );

        if (preservesEveryTier) {
          best = candidateEvs;
          maximum = investment - 1;
        } else {
          minimum = investment + 1;
        }
      }
    }

    evs = best;
    targets[stat] = best[stat];
  }

  return { ...seed, evs, targets };
}
