import { CHAMPIONS_MAX_EV_PER_STAT } from "../../data/natures";
import { getDefensiveTargetStat } from "./evaluator";
import { cappedDefenseHits, compareOffenseOutcomes, preservesProbabilisticKoOutcome, toBenchmark } from "./outcomes";
import { createBuild } from "./spreads";
import type { CalculatorAnalysisContext, CandidateSeed, OptimizationEvaluator, OptimizationMove } from "./types";

export function minimizeRedundantDefense(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  playerMoves: OptimizationMove[],
  opponentMoves: OptimizationMove[],
  evaluator: OptimizationEvaluator,
): CandidateSeed {
  const build = createBuild(context, seed.natureId, seed.evs);
  const defenses = opponentMoves.flatMap(({ move }) => {
    const result = evaluator.calculate(move, build, "opponent-to-player");
    return result?.defensiveStatOwner === "defender"
      ? [{ move, stat: getDefensiveTargetStat(context, result), outcome: toBenchmark(result) }]
      : [];
  });
  const offenses = playerMoves.flatMap(({ move }) => {
    const result = evaluator.calculate(move, build, "player-to-opponent");
    return result ? [{ move, outcome: toBenchmark(result) }] : [];
  });
  // Optimize the most immediate incoming threat; preserve every other benchmark.
  const primary = [...defenses].sort((left, right) =>
    cappedDefenseHits(left.outcome.possibleKoHits) - cappedDefenseHits(right.outcome.possibleKoHits)
      || right.outcome.maxPercent - left.outcome.maxPercent,
  )[0];
  if (!primary) return seed;
  const stat = primary.stat;
  const reserve = stat === "defense" ? "specialDefense" : "defense";
  // Keep explicit full-bulk alternatives distinct from minimum-survival spreads.
  if (seed.evs[stat] === CHAMPIONS_MAX_EV_PER_STAT) return seed;
  const minimum = Math.max(0, seed.evs[stat] + seed.evs[reserve] - CHAMPIONS_MAX_EV_PER_STAT);

  for (let investment = minimum; investment < seed.evs[stat]; investment += 1) {
    const evs = { ...seed.evs, [stat]: investment, [reserve]: seed.evs[reserve] + seed.evs[stat] - investment };
    const candidateBuild = createBuild(context, seed.natureId, evs);
    const preservesDefense = defenses.every(({ move, outcome }) => {
      const result = evaluator.calculate(move, candidateBuild, "opponent-to-player");
      if (!result) return false;
      const candidate = toBenchmark(result);
      return cappedDefenseHits(candidate.possibleKoHits) >= cappedDefenseHits(outcome.possibleKoHits)
        && cappedDefenseHits(candidate.guaranteedKoHits) >= cappedDefenseHits(outcome.guaranteedKoHits)
        && preservesProbabilisticKoOutcome(outcome, candidate);
    });
    if (!preservesDefense) continue;
    const preservesOffense = offenses.every(({ move, outcome }) => {
      const result = evaluator.calculate(move, candidateBuild, "player-to-opponent");
      if (!result) return false;
      const candidate = toBenchmark(result);
      return compareOffenseOutcomes(candidate, outcome) >= 0
        && preservesProbabilisticKoOutcome(candidate, outcome);
    });
    if (preservesOffense) {
      return { ...seed, evs, targets: { ...seed.targets, [stat]: investment, [reserve]: evs[reserve] } };
    }
  }
  return seed;
}
