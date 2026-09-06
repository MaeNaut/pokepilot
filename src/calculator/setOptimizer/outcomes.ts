import {
  KO_CHANCE_EPSILON,
  MAX_PRACTICAL_DEFENSIVE_KO_HITS,
  MAX_PRACTICAL_GUARANTEED_KO_HITS,
  MIN_MEANINGFUL_KO_CHANCE_GAIN,
} from "./constants";
import type {
  KoProbabilitySource,
  ProbabilisticKoOutcome,
  ReadyDamageResult,
  SetOptimizationBenchmark,
} from "./types";

export function toBenchmark(
  result: ReadyDamageResult,
): SetOptimizationBenchmark {
  return {
    minDamage: result.minDamage,
    maxDamage: result.maxDamage,
    minPercent: Number(result.minPercent.toFixed(2)),
    maxPercent: Number(result.maxPercent.toFixed(2)),
    defenderCurrentHp: result.defenderCurrentHp,
    defenderMaxHp: result.defenderMaxHp,
    oneHitKoChance: Number(result.oneHitKoChance.toFixed(2)),
    koHits: result.koHits,
    koChance:
      result.koChance === null ? null : Number(result.koChance.toFixed(2)),
    possibleKoHits:
      result.maxDamage > 0
        ? Math.ceil(result.defenderCurrentHp / result.maxDamage)
        : null,
    guaranteedKoHits:
      result.minDamage > 0
        ? Math.ceil(result.defenderCurrentHp / result.minDamage)
        : null,
  };
}

export function getGuaranteedKoHits(result: ReadyDamageResult) {
  return result.minDamage > 0
    ? Math.ceil(result.defenderCurrentHp / result.minDamage)
    : null;
}

export function getProbabilisticKoOutcome(
  result: KoProbabilitySource,
): ProbabilisticKoOutcome | null {
  if (result.oneHitKoChance > 0) {
    return { hitCount: 1, chance: result.oneHitKoChance };
  }
  if (result.koHits <= 0 || result.koChance === null || result.koChance <= 0) {
    return null;
  }

  return { hitCount: result.koHits, chance: result.koChance };
}

export function hasMeaningfulProbabilisticKoGain(
  optimized: KoProbabilitySource,
  current: KoProbabilitySource,
) {
  const optimizedOutcome = getProbabilisticKoOutcome(optimized);
  const currentOutcome = getProbabilisticKoOutcome(current);
  if (!optimizedOutcome) return false;
  if (!currentOutcome) {
    return (
      optimizedOutcome.chance + KO_CHANCE_EPSILON >=
      MIN_MEANINGFUL_KO_CHANCE_GAIN
    );
  }
  if (optimizedOutcome.hitCount < currentOutcome.hitCount) {
    return (
      optimizedOutcome.chance + KO_CHANCE_EPSILON >=
      MIN_MEANINGFUL_KO_CHANCE_GAIN
    );
  }
  if (optimizedOutcome.hitCount > currentOutcome.hitCount) return false;

  return (
    optimizedOutcome.chance - currentOutcome.chance + KO_CHANCE_EPSILON >=
    MIN_MEANINGFUL_KO_CHANCE_GAIN
  );
}

export function preservesProbabilisticKoOutcome(
  candidate: KoProbabilitySource,
  target: KoProbabilitySource,
) {
  const candidateOutcome = getProbabilisticKoOutcome(candidate);
  const targetOutcome = getProbabilisticKoOutcome(target);
  if (!targetOutcome) return true;
  if (!candidateOutcome) return false;
  if (candidateOutcome.hitCount < targetOutcome.hitCount) return true;
  if (candidateOutcome.hitCount > targetOutcome.hitCount) return false;

  return candidateOutcome.chance + KO_CHANCE_EPSILON >= targetOutcome.chance;
}

export function cappedOffenseHits(value: number | null) {
  return value === null
    ? MAX_PRACTICAL_GUARANTEED_KO_HITS + 1
    : Math.min(MAX_PRACTICAL_GUARANTEED_KO_HITS + 1, value);
}

export function cappedDefenseHits(value: number | null) {
  return value === null
    ? MAX_PRACTICAL_DEFENSIVE_KO_HITS + 1
    : Math.min(MAX_PRACTICAL_DEFENSIVE_KO_HITS + 1, value);
}

export function compareOffenseOutcomes(
  left: SetOptimizationBenchmark,
  right: SetOptimizationBenchmark,
) {
  const leftGuaranteed = cappedOffenseHits(left.guaranteedKoHits);
  const rightGuaranteed = cappedOffenseHits(right.guaranteedKoHits);
  if (leftGuaranteed < rightGuaranteed) return 1;
  if (leftGuaranteed > rightGuaranteed) return -1;
  if (hasMeaningfulProbabilisticKoGain(left, right)) return 1;
  if (hasMeaningfulProbabilisticKoGain(right, left)) return -1;
  return 0;
}

export function getOffenseOutcomeTier(result: SetOptimizationBenchmark) {
  const probability = getProbabilisticKoOutcome(result);
  return `${cappedOffenseHits(result.guaranteedKoHits)}:${
    probability
      ? `${probability.hitCount}:${Math.floor(
          (probability.chance + KO_CHANCE_EPSILON) /
            MIN_MEANINGFUL_KO_CHANCE_GAIN,
        )}`
      : "-"
  }`;
}

export function isPracticalOffenseOutcome(
  result: SetOptimizationBenchmark,
) {
  const probability = getProbabilisticKoOutcome(result);
  return (
    cappedOffenseHits(result.guaranteedKoHits) <=
      MAX_PRACTICAL_GUARANTEED_KO_HITS ||
    (probability !== null &&
      probability.hitCount <= MAX_PRACTICAL_GUARANTEED_KO_HITS)
  );
}

export function compareDefenseOutcomes(
  left: SetOptimizationBenchmark,
  right: SetOptimizationBenchmark,
) {
  const leftPossible = cappedDefenseHits(left.possibleKoHits);
  const rightPossible = cappedDefenseHits(right.possibleKoHits);
  if (leftPossible > rightPossible) return 1;
  if (leftPossible < rightPossible) return -1;

  if (hasMeaningfulProbabilisticKoGain(right, left)) return 1;
  if (hasMeaningfulProbabilisticKoGain(left, right)) return -1;
  if (left.maxPercent < right.maxPercent - 2 + KO_CHANCE_EPSILON) return 1;
  if (left.maxPercent > right.maxPercent + 2 - KO_CHANCE_EPSILON) return -1;
  return 0;
}

export function hasDefensiveSurvivalBoundaryGain(
  optimized: SetOptimizationBenchmark,
  current: SetOptimizationBenchmark,
) {
  return (
    cappedDefenseHits(optimized.possibleKoHits) >
      cappedDefenseHits(current.possibleKoHits) ||
    hasMeaningfulProbabilisticKoGain(current, optimized)
  );
}

export function getDefenseOutcomeTier(result: SetOptimizationBenchmark) {
  const probability = getProbabilisticKoOutcome(result);
  return `${cappedDefenseHits(result.possibleKoHits)}:${
    probability
      ? `${probability.hitCount}:${Math.floor(
          (probability.chance + KO_CHANCE_EPSILON) /
            MIN_MEANINGFUL_KO_CHANCE_GAIN,
        )}`
      : "-"
  }:${Math.floor(result.maxPercent / 2)}`;
}
