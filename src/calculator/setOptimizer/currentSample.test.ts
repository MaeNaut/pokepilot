import { describe, expect, it } from "vitest";
import { defaultEvs } from "../../data/natures";
import { shouldOfferCurrentSample } from "./currentSample";
import type { EvaluatedCandidate } from "./types";

function baseline(): EvaluatedCandidate {
  const outcome = { minDamage: 50, maxDamage: 60, minPercent: 50, maxPercent: 60, defenderCurrentHp: 100,
    defenderMaxHp: 100, oneHitKoChance: 0, koHits: 2, koChance: 100, possibleKoHits: 2, guaranteedKoHits: 2 };
  return {
    id: "baseline", slotIndex: 0, focuses: ["offense"], profiles: [], maxedStats: ["attack", "speed"],
    natureId: "jolly", evs: { ...defaultEvs, hp: 2, attack: 32, speed: 32 }, evTotal: 66,
    finalStats: { hp: 150, attack: 150, defense: 100, specialAttack: 80, specialDefense: 100, speed: 180 },
    itemId: null, itemName: null, changedStatPoints: 0, statPointChanges: { ...defaultEvs },
    offenseBenchmarks: [{ moveId: "attack", moveName: "Attack", moveCategory: "Physical", source: "selected",
      relevantStat: "attack", optimizedVsCurrent: "same", current: outcome, optimized: outcome }],
    defenseBenchmarks: [], speedBenchmark: { current: { playerSpeed: 180, opponentSpeed: 150, relation: "faster" },
      optimized: { playerSpeed: 180, opponentSpeed: 150, relation: "faster" } },
  };
}

describe("offering the current sample", () => {
  it("keeps a viable current set when adjustments have a role cost", () => {
    const current = baseline();
    expect(shouldOfferCurrentSample(current, [])).toBe(true);
    expect(shouldOfferCurrentSample(current, [{ ...current, roleCost: 5 }])).toBe(true);
  });
  it("does not add the current sample as filler when an alternative has no measured loss", () => {
    const current = baseline();
    const improved = structuredClone(current);
    improved.finalStats.defense += 10;
    expect(shouldOfferCurrentSample(current, [improved])).toBe(false);
  });
  it("requires calculated usefulness and a complete legal point allocation", () => {
    const current = baseline();
    expect(shouldOfferCurrentSample({ ...current, evTotal: 34 }, [])).toBe(false);
    expect(shouldOfferCurrentSample({ ...current, offenseBenchmarks: [] }, [])).toBe(false);
  });
  it("does not call lower damage an unconditional upgrade merely because KO tiers match", () => {
    const current = baseline();
    const alternative = structuredClone(current);
    alternative.offenseBenchmarks[0].optimized = { ...alternative.offenseBenchmarks[0].optimized, minDamage: 45 };
    expect(shouldOfferCurrentSample(current, [alternative])).toBe(true);
  });
  it("does not justify a current-only defensive set using a weak move while another attack KOs it", () => {
    const current = baseline();
    const benchmark = current.offenseBenchmarks[0];
    current.offenseBenchmarks = [];
    current.defenseBenchmarks = [benchmark, { ...benchmark, moveId: "strong", current: { ...benchmark.current, possibleKoHits: 1, guaranteedKoHits: 1 } }];
    expect(shouldOfferCurrentSample(current, [])).toBe(false);
  });
});
