import {
  CHAMPIONS_MAX_EV_PER_STAT,
  getNatureById,
} from "../../data/natures";
import {
  MAX_BENCHMARKS_PER_AXIS,
  MAX_OPTIMIZATION_CANDIDATES,
  MAX_PRACTICAL_GUARANTEED_KO_HITS,
} from "./constants";
import {
  cappedDefenseHits,
  cappedOffenseHits,
  compareDefenseOutcomes,
  compareOffenseOutcomes,
  getProbabilisticKoOutcome,
  hasDefensiveSurvivalBoundaryGain,
  hasMeaningfulProbabilisticKoGain,
} from "./outcomes";
import type {
  EvaluatedCandidate,
  EvaluatedSeed,
  SetOptimizationCandidate,
  SetOptimizationMoveBenchmark,
} from "./types";

function getNatureSpreadAlignment(candidate: SetOptimizationCandidate) {
  const nature = getNatureById(candidate.natureId);
  if (nature.up === nature.down) return 0;
  return candidate.evs[nature.up] - candidate.evs[nature.down];
}

function getSpeedOrderChange(candidate: EvaluatedCandidate) {
  // Without an explicit reverse-order objective, losing turn order is a cost.
  const rank = { slower: 0, tie: 1, faster: 2 };
  const { current, optimized } = candidate.speedBenchmark;
  return Math.sign(rank[optimized.relation] - rank[current.relation]);
}

function hasMeaningfulChange(candidate: EvaluatedCandidate) {
  const hasExplicitMoveReplacement = candidate.moveChanges.length > 0;
  if (
    (candidate.roleCost ?? 0) > 0 &&
    getCandidateScore(candidate) <= 0 &&
    !hasExplicitMoveReplacement
  ) return false;
  const sacrificesOffense = candidate.offenseBenchmarks.some(
    ({ current, optimized }) => compareOffenseOutcomes(optimized, current) < 0
      || optimized.maxDamage < current.maxDamage,
  );
  const gainsRelevantSurvival = candidate.defenseBenchmarks.some(
    ({ current, optimized }) => current.possibleKoHits !== null
      && current.possibleKoHits <= 2
      && hasDefensiveSurvivalBoundaryGain(optimized, current),
  );
  const offenseChanged = candidate.offenseBenchmarks.some(
    ({ current, optimized }) => compareOffenseOutcomes(optimized, current) > 0,
  );
  // Preserving a KO tier does not make an attack-to-bulk trade free.
  if (
    sacrificesOffense &&
    !gainsRelevantSurvival &&
    !offenseChanged &&
    !hasExplicitMoveReplacement
  ) return false;
  const gainsGuaranteedSurvival = candidate.defenseBenchmarks.some(
    ({ current, optimized }) => current.possibleKoHits !== null
      && current.possibleKoHits <= 2
      && cappedDefenseHits(optimized.possibleKoHits) > cappedDefenseHits(current.possibleKoHits),
  );
  if (
    sacrificesOffense &&
    !gainsGuaranteedSurvival &&
    getCandidateScore(candidate) <= 0 &&
    !hasExplicitMoveReplacement
  ) {
    return false;
  }

  const defenseChanged = candidate.defenseBenchmarks.some(
    ({ current, optimized }) => hasDefensiveSurvivalBoundaryGain(optimized, current),
  );
  const speedImproved = getSpeedOrderChange(candidate) > 0;

  return offenseChanged || defenseChanged || speedImproved || hasExplicitMoveReplacement;
}

function getBenchmarkByMove(
  benchmarks: SetOptimizationMoveBenchmark[],
  moveId: string,
) {
  return benchmarks.find((benchmark) => benchmark.moveId === moveId);
}

function dominates(left: EvaluatedCandidate, right: EvaluatedCandidate) {
  if ((left.roleCost ?? 0) > (right.roleCost ?? 0)) return false;
  if (
    left.itemId !== right.itemId ||
    left.moveIds.join("|") !== right.moveIds.join("|")
  ) {
    return false;
  }
  if (
    left.speedBenchmark.optimized.relation !==
    right.speedBenchmark.optimized.relation
  ) {
    return false;
  }

  let strictlyBetter = false;
  for (const rightBenchmark of right.offenseBenchmarks) {
    const leftBenchmark = getBenchmarkByMove(
      left.offenseBenchmarks,
      rightBenchmark.moveId,
    );
    if (!leftBenchmark) return false;

    const comparison = compareOffenseOutcomes(
      leftBenchmark.optimized,
      rightBenchmark.optimized,
    );
    if (comparison < 0) return false;
    if (comparison > 0) strictlyBetter = true;
  }

  for (const rightBenchmark of right.defenseBenchmarks) {
    const leftBenchmark = getBenchmarkByMove(
      left.defenseBenchmarks,
      rightBenchmark.moveId,
    );
    if (!leftBenchmark) return false;

    const comparison = compareDefenseOutcomes(
      leftBenchmark.optimized,
      rightBenchmark.optimized,
    );
    if (comparison < 0) return false;
    if (comparison > 0) strictlyBetter = true;
  }

  for (const stat of ["defense", "specialDefense"] as const) {
    const leftBulk = left.finalStats.hp * left.finalStats[stat];
    const rightBulk = right.finalStats.hp * right.finalStats[stat];
    if (leftBulk < rightBulk) return false;
    if (leftBulk > rightBulk) strictlyBetter = true;
  }

  if (!strictlyBetter) {
    return left.changedStatPoints < right.changedStatPoints;
  }

  return true;
}

function getCandidateScore(candidate: EvaluatedCandidate) {
  let score = 0;

  for (const { current, optimized } of candidate.offenseBenchmarks) {
    score +=
      (cappedOffenseHits(current.guaranteedKoHits) -
        cappedOffenseHits(optimized.guaranteedKoHits)) *
      80;

    if (hasMeaningfulProbabilisticKoGain(optimized, current)) {
      const currentOutcome = getProbabilisticKoOutcome(current);
      const optimizedOutcome = getProbabilisticKoOutcome(optimized);
      if (optimizedOutcome) {
        const improvedHitCounts = currentOutcome
          ? Math.max(0, currentOutcome.hitCount - optimizedOutcome.hitCount)
          : 0;
        const chanceGain =
          currentOutcome?.hitCount === optimizedOutcome.hitCount
            ? Math.max(0, optimizedOutcome.chance - currentOutcome.chance)
            : optimizedOutcome.chance;
        score += improvedHitCounts * 8 + chanceGain * 0.2;
      }
    }
  }
  for (const { current, optimized } of candidate.defenseBenchmarks) {
    score +=
      (cappedDefenseHits(optimized.possibleKoHits) -
        cappedDefenseHits(current.possibleKoHits)) *
      45;
    if (hasMeaningfulProbabilisticKoGain(current, optimized)) {
      const currentOutcome = getProbabilisticKoOutcome(current);
      const optimizedOutcome = getProbabilisticKoOutcome(optimized);
      if (currentOutcome) {
        const delayedHitCounts = optimizedOutcome
          ? Math.max(0, optimizedOutcome.hitCount - currentOutcome.hitCount)
          : 1;
        const chanceReduction =
          optimizedOutcome?.hitCount === currentOutcome.hitCount
            ? Math.max(0, currentOutcome.chance - optimizedOutcome.chance)
            : currentOutcome.chance;
        score += delayedHitCounts * 8 + chanceReduction * 0.2;
      }
    }
    if (hasDefensiveSurvivalBoundaryGain(optimized, current)) {
      score += Math.max(0, current.maxPercent - optimized.maxPercent) * 0.5;
    }
  }
  score += getSpeedOrderChange(candidate) * 12;
  score += getNatureSpreadAlignment(candidate) * 0.25;
  score -= candidate.changedStatPoints * 0.02;
  score -= candidate.roleCost ?? 0;
  score -= Number(candidate.itemChanged);
  score -= candidate.moveChanges.length * 2;

  return score;
}

function getOutcomeSignature(candidate: EvaluatedCandidate) {
  const offense = candidate.offenseBenchmarks
    .map(({ moveId, optimized }) => {
      const probability = getProbabilisticKoOutcome(optimized);
      return `${moveId}:${cappedOffenseHits(optimized.guaranteedKoHits)}:${
        probability
          ? `${probability.hitCount}:${probability.chance.toFixed(2)}`
          : "-"
      }`;
    })
    .join("|");
  const defense = candidate.defenseBenchmarks
    .map(({ moveId, optimized }) => {
      const probability = getProbabilisticKoOutcome(optimized);
      return `${moveId}:${cappedDefenseHits(optimized.possibleKoHits)}:${
        probability
          ? `${probability.hitCount}:${probability.chance.toFixed(2)}`
          : "-"
      }:${Math.round(optimized.maxPercent / 2)}`;
    })
    .join("|");

  // Maximum-bulk alternatives must survive coarse damage-percentage deduplication.
  const maximumBulk = candidate.profiles.filter((profile) =>
    profile === "physical-bulk-maximum" || profile === "special-bulk-maximum",
  ).sort().join(",");
  return `${offense}/${defense}/${candidate.speedBenchmark.optimized.relation}/${maximumBulk}/${candidate.itemId ?? "none"}/${candidate.moveIds.join(".")}`;
}

function selectOffenseHighlights(
  candidate: EvaluatedCandidate,
) {
  const replacementMoveIds = new Set(
    candidate.moveChanges.map(({ optimizedMoveId }) => optimizedMoveId),
  );
  const replacements = candidate.offenseBenchmarks.filter(
    ({ moveId, currentMoveId }) =>
      moveId !== currentMoveId && replacementMoveIds.has(moveId),
  );
  const highlights = candidate.offenseBenchmarks
    .filter((benchmark) => !replacements.includes(benchmark))
    .filter(
      ({ current, optimized }) =>
        cappedOffenseHits(current.guaranteedKoHits) <=
          MAX_PRACTICAL_GUARANTEED_KO_HITS ||
        cappedOffenseHits(optimized.guaranteedKoHits) <=
          MAX_PRACTICAL_GUARANTEED_KO_HITS,
    )
    .sort((left, right) => {
      const leftComparison = compareOffenseOutcomes(
        left.optimized,
        left.current,
      );
      const rightComparison = compareOffenseOutcomes(
        right.optimized,
        right.current,
      );
      if (leftComparison !== rightComparison) {
        return rightComparison - leftComparison;
      }

      const leftOutcome = getProbabilisticKoOutcome(left.optimized);
      const rightOutcome = getProbabilisticKoOutcome(right.optimized);
      if (leftOutcome?.hitCount !== rightOutcome?.hitCount) {
        return (
          (leftOutcome?.hitCount ?? Number.POSITIVE_INFINITY) -
          (rightOutcome?.hitCount ?? Number.POSITIVE_INFINITY)
        );
      }
      return (rightOutcome?.chance ?? 0) - (leftOutcome?.chance ?? 0);
    })
    .slice(0, Math.max(0, MAX_BENCHMARKS_PER_AXIS - replacements.length));

  return [...replacements, ...highlights].slice(0, MAX_BENCHMARKS_PER_AXIS);
}

function selectDefenseHighlights(
  benchmarks: SetOptimizationMoveBenchmark[],
) {
  return [...benchmarks]
    .sort((left, right) => {
      const leftImprovement = compareDefenseOutcomes(
        left.optimized,
        left.current,
      );
      const rightImprovement = compareDefenseOutcomes(
        right.optimized,
        right.current,
      );
      if (leftImprovement !== rightImprovement) {
        return rightImprovement - leftImprovement;
      }
      return right.current.maxPercent - left.current.maxPercent;
    })
    .slice(0, MAX_BENCHMARKS_PER_AXIS);
}

export function trimCandidateBenchmarks(
  candidate: EvaluatedCandidate,
): SetOptimizationCandidate {
  return {
    ...candidate,
    offenseBenchmarks: selectOffenseHighlights(candidate),
    defenseBenchmarks: selectDefenseHighlights(candidate.defenseBenchmarks),
  };
}

export function selectSearchFrontier(
  entries: EvaluatedSeed[],
  limit: number,
): EvaluatedSeed[] {
  const byOutcome = new Map<string, EvaluatedSeed>();
  for (const entry of [...entries].sort(
    (left, right) =>
      getCandidateScore(right.candidate) - getCandidateScore(left.candidate),
  )) {
    if (!hasMeaningfulChange(entry.candidate)) continue;
    const signature = getOutcomeSignature(entry.candidate);
    if (!byOutcome.has(signature)) byOutcome.set(signature, entry);
  }

  const frontier: EvaluatedSeed[] = [];
  for (const entry of byOutcome.values()) {
    if (
      frontier.some((kept) => dominates(kept.candidate, entry.candidate))
    ) {
      continue;
    }

    for (let index = frontier.length - 1; index >= 0; index -= 1) {
      if (dominates(entry.candidate, frontier[index].candidate)) {
        frontier.splice(index, 1);
      }
    }
    frontier.push(entry);

    if (frontier.length > limit * 2) {
      frontier.sort(
        (left, right) =>
          getCandidateScore(right.candidate) -
          getCandidateScore(left.candidate),
      );
      frontier.length = limit;
    }
  }

  return frontier
    .sort(
      (left, right) =>
        getCandidateScore(right.candidate) -
        getCandidateScore(left.candidate),
    )
    .slice(0, limit);
}

const bulkProfilePairs = [
  {
    maximum: "physical-bulk-maximum",
    reserve: "physical-survival-with-reserve",
    targetStat: "defense",
    reserveStat: "specialDefense",
  },
  {
    maximum: "special-bulk-maximum",
    reserve: "special-survival-with-reserve",
    targetStat: "specialDefense",
    reserveStat: "defense",
  },
] as const;

function collectRequiredBulkProfiles(
  candidates: EvaluatedCandidate[],
) {
  const required: EvaluatedCandidate[] = [];

  for (const profilePair of bulkProfilePairs) {
    const maximumCandidates = candidates.filter((candidate) =>
      candidate.profiles.includes(profilePair.maximum),
    );
    for (const candidate of candidates) {
      candidate.profiles = candidate.profiles.filter(
        (profile) => profile !== profilePair.reserve,
      );
    }
    if (maximumCandidates.length === 0) continue;

    const targetBenchmark = maximumCandidates
      .flatMap((candidate) => candidate.defenseBenchmarks)
      .filter(
        (benchmark) =>
          benchmark.relevantStat === profilePair.targetStat &&
          benchmark.optimizedVsCurrent === "better" &&
          hasDefensiveSurvivalBoundaryGain(
            benchmark.optimized,
            benchmark.current,
          ),
      )
      .sort((left, right) => {
        const possibleDifference =
          cappedDefenseHits(left.current.possibleKoHits) -
          cappedDefenseHits(right.current.possibleKoHits);
        if (possibleDifference !== 0) return possibleDifference;
        return right.current.maxPercent - left.current.maxPercent;
      })[0];
    if (!targetBenchmark) continue;

    const maximum = maximumCandidates
      .filter((candidate) =>
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === targetBenchmark.moveId &&
            benchmark.optimizedVsCurrent === "better" &&
            hasDefensiveSurvivalBoundaryGain(
              benchmark.optimized,
              benchmark.current,
            ),
        ),
      )
      .sort(
        (left, right) => getCandidateScore(right) - getCandidateScore(left),
      )[0];
    const reserveCandidates = candidates.filter((candidate) => {
      const currentReservePoints =
        candidate.evs[profilePair.reserveStat] -
        candidate.statPointChanges[profilePair.reserveStat];

      return (
        candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
        candidate.evs[profilePair.targetStat] < CHAMPIONS_MAX_EV_PER_STAT &&
        candidate.evs[profilePair.reserveStat] > currentReservePoints &&
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === targetBenchmark.moveId &&
            benchmark.relevantStat === profilePair.targetStat &&
            benchmark.optimizedVsCurrent === "better" &&
            hasDefensiveSurvivalBoundaryGain(
              benchmark.optimized,
              benchmark.current,
            ),
        )
      );
    });
    if (!maximum || reserveCandidates.length === 0) continue;

    const deepestReserve = [...reserveCandidates].sort((left, right) => {
      const leftBenchmark = getBenchmarkByMove(
        left.defenseBenchmarks,
        targetBenchmark.moveId,
      );
      const rightBenchmark = getBenchmarkByMove(
        right.defenseBenchmarks,
        targetBenchmark.moveId,
      );
      const possibleHitDifference =
        cappedDefenseHits(rightBenchmark?.optimized.possibleKoHits ?? null) -
        cappedDefenseHits(leftBenchmark?.optimized.possibleKoHits ?? null);
      if (possibleHitDifference !== 0) return possibleHitDifference;

      const reserveDifference =
        right.evs[profilePair.reserveStat] - left.evs[profilePair.reserveStat];
      if (reserveDifference !== 0) return reserveDifference;

      const targetDifference =
        left.evs[profilePair.targetStat] - right.evs[profilePair.targetStat];
      if (targetDifference !== 0) return targetDifference;

      return getCandidateScore(right) - getCandidateScore(left);
    })[0];

    deepestReserve.profiles.push(profilePair.reserve);
    required.push(maximum, deepestReserve);
  }

  return required;
}

function collectMoveReplacementRepresentatives(
  candidates: EvaluatedCandidate[],
) {
  const representatives = new Map<string, EvaluatedCandidate>();

  for (const candidate of [...candidates].sort(
    (left, right) => getCandidateScore(right) - getCandidateScore(left),
  )) {
    const change = candidate.moveChanges[0];
    if (!change) continue;
    const key = `${change.optimizedMoveId}:${change.slotIndex}`;
    if (!representatives.has(key)) representatives.set(key, candidate);
  }

  return [...representatives.values()];
}

export function selectCandidates(candidates: EvaluatedCandidate[]) {
  const meaningful = candidates.filter(hasMeaningfulChange);
  const frontier = meaningful.filter(
    (candidate, index) =>
      !meaningful.some(
        (other, otherIndex) =>
          index !== otherIndex && dominates(other, candidate),
      ),
  );
  const bySignature = new Map<string, EvaluatedCandidate>();

  for (const candidate of [...frontier].sort(
    (left, right) => getCandidateScore(right) - getCandidateScore(left),
  )) {
    const signature = getOutcomeSignature(candidate);
    if (!bySignature.has(signature)) bySignature.set(signature, candidate);
  }

  const diversified = [...bySignature.values()];
  const selected = new Map<string, EvaluatedCandidate>();
  for (const candidate of collectMoveReplacementRepresentatives(meaningful)) {
    if (selected.size >= MAX_OPTIMIZATION_CANDIDATES) break;
    selected.set(candidate.id, candidate);
  }
  for (const candidate of collectRequiredBulkProfiles(diversified)) {
    if (selected.size >= MAX_OPTIMIZATION_CANDIDATES) break;
    selected.set(candidate.id, candidate);
  }
  for (const candidate of diversified) {
    if (selected.size >= MAX_OPTIMIZATION_CANDIDATES) break;
    selected.set(candidate.id, candidate);
  }

  return [...selected.values()].map(trimCandidateBenchmarks);
}
