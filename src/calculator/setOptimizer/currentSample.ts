import { compareDefenseOutcomes, compareOffenseOutcomes } from "./outcomes";
import type { EvaluatedCandidate } from "./types";

export const CURRENT_SAMPLE_ID = "set-current";

export function shouldOfferCurrentSample(current: EvaluatedCandidate, alternatives: EvaluatedCandidate[]) {
  if (current.evTotal !== 66) return false;
  const needsRoleOrLoadoutBaseline = alternatives.some((candidate) =>
    (candidate.roleCost ?? 0) > 0
    || candidate.itemChanged
    || candidate.moveChanges.length > 0,
  );
  const usefulOffense = current.offenseBenchmarks.some(({ current: outcome }) =>
    outcome.guaranteedKoHits !== null && outcome.guaranteedKoHits <= 3,
  );
  const usefulSurvival = current.defenseBenchmarks.some(({ current: outcome }) => outcome.maxDamage > 0)
    && current.defenseBenchmarks.every(({ current: outcome }) =>
      outcome.maxDamage === 0 || (outcome.possibleKoHits !== null && outcome.possibleKoHits >= 2),
    );
  if (!usefulOffense && !usefulSurvival && !needsRoleOrLoadoutBaseline) {
    return false;
  }

  const order = { slower: 0, tie: 1, faster: 2 };
  return !alternatives.some((candidate) => {
    if (candidate.itemChanged || candidate.moveChanges.length > 0) return false;
    if ((candidate.roleCost ?? 0) > 0) return false;
    if (candidate.speedBenchmark.optimized.playerSpeed < current.speedBenchmark.current.playerSpeed) return false;
    if (order[candidate.speedBenchmark.optimized.relation] < order[current.speedBenchmark.current.relation]) return false;
    if (candidate.finalStats.hp * candidate.finalStats.defense < current.finalStats.hp * current.finalStats.defense
      || candidate.finalStats.hp * candidate.finalStats.specialDefense < current.finalStats.hp * current.finalStats.specialDefense) return false;
    return current.offenseBenchmarks.every((baseline) => {
      const next = candidate.offenseBenchmarks.find(({ moveId }) => moveId === baseline.moveId);
      return next && compareOffenseOutcomes(next.optimized, baseline.current) >= 0
        && next.optimized.minDamage >= baseline.current.minDamage
        && next.optimized.maxDamage >= baseline.current.maxDamage;
    }) && current.defenseBenchmarks.every((baseline) => {
      const next = candidate.defenseBenchmarks.find(({ moveId }) => moveId === baseline.moveId);
      return next && compareDefenseOutcomes(next.optimized, baseline.current) >= 0
        && next.optimized.maxPercent <= baseline.current.maxPercent;
    });
  });
}
