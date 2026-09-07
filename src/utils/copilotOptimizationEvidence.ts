import type { CopilotSetOptimizationCandidateSnapshot } from "./copilotContracts";

type MoveBenchmark = CopilotSetOptimizationCandidateSnapshot["offenseBenchmarks"][number];
type Outcome = MoveBenchmark["current"];
type EvidenceCandidate = Pick<CopilotSetOptimizationCandidateSnapshot,
  "offenseBenchmarks" | "defenseBenchmarks" | "speedBenchmark">;

// Match the KO label and precision rendered on the card, not internal stat changes.
function koLabelKey(outcome: Outcome): string {
  const { possibleKoHits, guaranteedKoHits, koHits, koChance } = outcome;
  if (guaranteedKoHits === 1) return "guaranteed-1";
  if (possibleKoHits === null || guaranteedKoHits === null) return "no-ko";
  if (possibleKoHits === guaranteedKoHits) return `guaranteed-${guaranteedKoHits}`;
  const range = `${possibleKoHits}-${guaranteedKoHits}`;
  return koHits > 0 && koChance !== null ? `${range}:${koChance.toFixed(1)}` : range;
}

function hasChangedOutcome({ current, optimized }: MoveBenchmark): boolean {
  return current.minPercent.toFixed(1) !== optimized.minPercent.toFixed(1)
    || current.maxPercent.toFixed(1) !== optimized.maxPercent.toFixed(1)
    || koLabelKey(current) !== koLabelKey(optimized);
}

function involvesEarlyKo(benchmark: MoveBenchmark): boolean {
  return [benchmark.current, benchmark.optimized].some(({ possibleKoHits }) =>
    possibleKoHits !== null && possibleKoHits >= 1 && possibleKoHits <= 2);
}

function selectMoveEvidence(benchmarks: MoveBenchmark[]): MoveBenchmark[] {
  const changed = benchmarks.filter(hasChangedOutcome);
  const earlyKo = changed.filter(involvesEarlyKo);
  return earlyKo.length > 0 ? earlyKo : changed;
}

export function selectOptimizationEvidence(candidate: EvidenceCandidate) {
  const { current, optimized } = candidate.speedBenchmark;
  return {
    offense: selectMoveEvidence(candidate.offenseBenchmarks),
    defense: selectMoveEvidence(candidate.defenseBenchmarks),
    showSpeed: current.playerSpeed !== optimized.playerSpeed
      || current.opponentSpeed !== optimized.opponentSpeed
      || current.relation !== optimized.relation,
  };
}
