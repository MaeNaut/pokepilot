import { describe, expect, it } from "vitest";
import type { CopilotSetOptimizationCandidateSnapshot } from "./copilotContracts";
import { selectOptimizationEvidence } from "./copilotOptimizationEvidence";

type MoveBenchmark = CopilotSetOptimizationCandidateSnapshot[
  "offenseBenchmarks"
][number];

function outcome(): MoveBenchmark["current"] {
  return {
    minDamage: 80,
    maxDamage: 90,
    minPercent: 45,
    maxPercent: 50,
    defenderCurrentHp: 180,
    defenderMaxHp: 180,
    oneHitKoChance: 0,
    koHits: 2,
    koChance: 100,
    possibleKoHits: 2,
    guaranteedKoHits: 2,
  };
}

describe("optimization evidence", () => {
  it("keeps an applied move replacement even when its displayed outcome is unchanged", () => {
    const benchmark: MoveBenchmark = {
      moveId: "drainpunch",
      moveDisplayName: "Drain Punch",
      currentMoveId: "closecombat",
      currentMoveDisplayName: "Close Combat",
      moveCategory: "Physical",
      source: "usage",
      relevantStat: "attack",
      optimizedVsCurrent: "same",
      current: outcome(),
      optimized: outcome(),
    };

    const evidence = selectOptimizationEvidence({
      offenseBenchmarks: [benchmark],
      defenseBenchmarks: [],
      speedBenchmark: {
        current: { playerSpeed: 80, opponentSpeed: 100, relation: "slower" },
        optimized: { playerSpeed: 80, opponentSpeed: 100, relation: "slower" },
      },
    });

    expect(evidence.offense).toEqual([benchmark]);
  });
});
