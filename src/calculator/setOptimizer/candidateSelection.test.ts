import { describe, expect, it } from "vitest";
import { defaultEvs } from "../../data/natures";
import { selectCandidates, selectSearchFrontier } from "./candidateSelection";
import type { EvaluatedCandidate, SetOptimizationBenchmark } from "./types";

function outcome(hits: number, maxPercent = 100 / hits): SetOptimizationBenchmark {
  return {
    minDamage: maxPercent, maxDamage: maxPercent, minPercent: maxPercent, maxPercent,
    defenderCurrentHp: 100, defenderMaxHp: 100, oneHitKoChance: hits === 1 ? 100 : 0,
    koHits: hits, koChance: 100, possibleKoHits: hits, guaranteedKoHits: hits,
  };
}

function candidate(currentHits: number, optimizedHits: number): EvaluatedCandidate {
  return {
    id: "bulk", slotIndex: 0, focuses: ["defense"], profiles: [], maxedStats: [],
    natureId: "careful", evs: { ...defaultEvs }, evTotal: 0, finalStats: { ...defaultEvs },
    itemId: null, itemName: null, changedStatPoints: 32, statPointChanges: { ...defaultEvs },
    offenseBenchmarks: [{ moveId: "crunch", moveName: "Crunch", moveCategory: "Physical", source: "selected", relevantStat: "attack", optimizedVsCurrent: "worse", current: outcome(1), optimized: outcome(2) }],
    defenseBenchmarks: [{ moveId: "makeitrain", moveName: "Make It Rain", moveCategory: "Special", source: "selected", relevantStat: "specialDefense", optimizedVsCurrent: "better", current: outcome(currentHits), optimized: outcome(optimizedHits, 100 / optimizedHits - 3) }],
    speedBenchmark: { current: { playerSpeed: 70, opponentSpeed: 90, relation: "slower" }, optimized: { playerSpeed: 70, opponentSpeed: 90, relation: "slower" } },
  };
}

describe("sample offensive responsibility", () => {
  it.each([[2, 2], [3, 4]])("rejects lost offensive KO performance for marginal survival (%i to %i)", (current, optimized) => {
    const value = candidate(current, optimized);
    expect(selectCandidates([value])).toEqual([]);
    expect(selectSearchFrontier([{ candidate: value, seed: { natureId: "careful", evs: { ...defaultEvs }, focuses: ["defense"], targets: {}, axes: [] } }], 3)).toEqual([]);
  });
  it.each([[1, 2], [2, 3]])("keeps a meaningful survival tradeoff (%i to %i)", (current, optimized) => {
    expect(selectCandidates([candidate(current, optimized)])).toHaveLength(1);
  });
  it("does not penalize support/bulk candidates that preserve offensive outcomes", () => {
    const value = candidate(3, 4);
    value.offenseBenchmarks[0].optimized = value.offenseBenchmarks[0].current;
    expect(selectCandidates([value])).toHaveLength(1);
  });
  it("rejects percent-only bulk gains even when offensive KO tiers are preserved", () => {
    const value = candidate(2, 2);
    value.offenseBenchmarks[0].current = outcome(1, 140.2);
    value.offenseBenchmarks[0].optimized = outcome(1, 118.3);
    value.defenseBenchmarks[0].current = outcome(2, 76.8);
    value.defenseBenchmarks[0].optimized = outcome(2, 67.6);
    expect(selectCandidates([value])).toEqual([]);
  });
  it("does not treat a raw speed change within the same turn order as a gain", () => {
    const value = candidate(2, 2);
    value.offenseBenchmarks = [];
    value.speedBenchmark.optimized.playerSpeed = 80;
    expect(selectCandidates([value])).toEqual([]);
  });
  it("does not trade damage for a distant defensive boundary with unchanged offensive KO tiers", () => {
    const value = candidate(3, 4);
    value.offenseBenchmarks[0].current = outcome(1, 140.2);
    value.offenseBenchmarks[0].optimized = outcome(1, 118.3);
    expect(selectCandidates([value])).toEqual([]);
  });
  it("retains a meaningful survival probability gain within the same possible hit count", () => {
    const value = candidate(1, 1);
    value.offenseBenchmarks[0].optimized = value.offenseBenchmarks[0].current;
    value.defenseBenchmarks[0].current.oneHitKoChance = 50;
    value.defenseBenchmarks[0].optimized.oneHitKoChance = 37.5;
    expect(selectCandidates([value])).toHaveLength(1);
  });
  it("rejects a large offensive KO loss for a smaller survival probability gain", () => {
    const value = candidate(2, 2);
    value.offenseBenchmarks[0].optimized = { ...outcome(2, 113), oneHitKoChance: 75, koHits: 1, koChance: 75, possibleKoHits: 1 };
    value.defenseBenchmarks[0].optimized = { ...outcome(2, 58), koChance: 89.45, guaranteedKoHits: 3 };
    expect(selectCandidates([value])).toEqual([]);
  });
});
