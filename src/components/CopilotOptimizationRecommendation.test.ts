import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CopilotSetOptimizationCandidateSnapshot } from "../utils/copilotContracts";
import { selectOptimizationEvidence } from "../utils/copilotOptimizationEvidence";
import { CopilotOptimizationRecommendation } from "./CopilotOptimizationRecommendation";

vi.mock("../i18n/useLocalization", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

type Candidate = CopilotSetOptimizationCandidateSnapshot;
type Benchmark = Candidate["offenseBenchmarks"][number];
type Outcome = Benchmark["current"];

function outcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    minDamage: 50, maxDamage: 60, minPercent: 50, maxPercent: 60,
    defenderCurrentHp: 100, defenderMaxHp: 100, oneHitKoChance: 0,
    koHits: 2, koChance: 100, possibleKoHits: 2, guaranteedKoHits: 2,
    ...overrides,
  };
}

function benchmark(id: string, current = outcome(), optimized = current): Benchmark {
  return {
    moveId: id, moveDisplayName: id, currentMoveId: id, currentMoveDisplayName: id,
    moveCategory: "Physical", source: "selected",
    relevantStat: "attack", optimizedVsCurrent: "same", current, optimized,
  };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  const stats = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  return {
    id: "sample", slotIndex: 0, focuses: ["defense"], profiles: [], maxedStats: [],
    natureId: "hardy", natureDisplayName: "Hardy", evs: stats, evTotal: 0,
    finalStats: stats, itemId: null, itemDisplayName: null, itemChanged: false,
    moveIds: ["move", "", "", ""], moveChanges: [], changedStatPoints: 0,
    statPointChanges: stats, offenseBenchmarks: [], defenseBenchmarks: [],
    speedBenchmark: {
      current: { playerSpeed: 70, opponentSpeed: 100, relation: "slower" },
      optimized: { playerSpeed: 70, opponentSpeed: 100, relation: "slower" },
    },
    ...overrides,
  };
}

const lateOutcome = outcome({ minPercent: 25, maxPercent: 35, possibleKoHits: 3, guaranteedKoHits: 4, koHits: 3, koChance: 50 });
const late = benchmark("late-hit", lateOutcome, { ...lateOutcome, minPercent: 27 });
const early = benchmark("early-hit", outcome(), outcome({ minPercent: 55 }));

describe("optimization evidence selection", () => {
  it("hides unchanged results even when internal raw damage changes", () => {
    const same = benchmark("unchanged", outcome(), outcome({ minDamage: 51, minPercent: 50.01 }));
    expect(selectOptimizationEvidence(candidate({ offenseBenchmarks: [same], defenseBenchmarks: [same] })))
      .toEqual({ offense: [], defense: [], showSpeed: false });
  });

  it("keeps percentage changes without requiring a different guaranteed hit count", () => {
    expect(selectOptimizationEvidence(candidate({ offenseBenchmarks: [early] })).offense).toEqual([early]);
  });

  it("keeps probability-only changes and changes to the KO hit range", () => {
    const possible = outcome({ possibleKoHits: 1, guaranteedKoHits: 2, koHits: 1, koChance: 12.5 });
    const chance = benchmark("chance", possible, { ...possible, koChance: 25 });
    const range = benchmark("range", possible, { ...possible, guaranteedKoHits: 3 });
    expect(selectOptimizationEvidence(candidate({ offenseBenchmarks: [chance, range] })).offense).toEqual([chance, range]);
  });

  it("filters offense and defense independently and does not mutate input", () => {
    const input = candidate({ offenseBenchmarks: [late, early], defenseBenchmarks: [late] });
    const original = structuredClone(input);
    expect(selectOptimizationEvidence(input)).toEqual({ offense: [early], defense: [late], showSpeed: false });
    expect(input).toEqual(original);
    expect(selectOptimizationEvidence(candidate({ defenseBenchmarks: [late, early] })).defense).toEqual([early]);
  });

  it("does not let unchanged early-KO results suppress changed late-KO evidence", () => {
    expect(selectOptimizationEvidence(candidate({ offenseBenchmarks: [benchmark("same"), late] })).offense).toEqual([late]);
  });

  it("retains both improvements and regressions crossing the two-hit threshold", () => {
    const twoToThree = benchmark("survival", outcome(), lateOutcome);
    const threeToTwo = benchmark("damage", lateOutcome, outcome());
    expect(selectOptimizationEvidence(candidate({ defenseBenchmarks: [late, twoToThree, threeToTwo] })).defense)
      .toEqual([twoToThree, threeToTwo]);
  });

  it("keeps changed no-KO results only as fallback", () => {
    const noKo = outcome({ possibleKoHits: null, guaranteedKoHits: null, koHits: 0, koChance: null, minPercent: 1, maxPercent: 2 });
    const chip = benchmark("chip", noKo, { ...noKo, maxPercent: 3 });
    expect(selectOptimizationEvidence(candidate({ offenseBenchmarks: [chip] })).offense).toEqual([chip]);
    expect(selectOptimizationEvidence(candidate({ offenseBenchmarks: [chip, early] })).offense).toEqual([early]);
  });

  it.each([
    { playerSpeed: 80, opponentSpeed: 100, relation: "slower" as const },
    { playerSpeed: 100, opponentSpeed: 100, relation: "tie" as const },
    { playerSpeed: 70, opponentSpeed: 100, relation: "faster" as const },
  ])("shows changed speed values or turn order: %o", (optimized) => {
    const input = candidate();
    input.speedBenchmark.optimized = optimized;
    expect(selectOptimizationEvidence(input).showSpeed).toBe(true);
  });
});

function render(input: Candidate, currentItemDisplayName: string | null = null) {
  return renderToStaticMarkup(createElement(CopilotOptimizationRecommendation, {
    candidate: input, currentItemDisplayName, title: "Sample", reason: "Rationale", isStale: false,
    onApply: () => {}, onSave: () => {},
  }));
}

describe("optimization evidence card", () => {
  it("shows current sample status instead of an apply button or comparison evidence", () => {
    const html = render(candidate({ id: "set-current", offenseBenchmarks: [early] }));
    expect(html).toContain("copilot.currentSample");
    expect(html).not.toContain("copilot.applySample");
    expect(html).not.toContain("<details");
    expect(html).toContain("copilot.saveToBench");
  });
  it("omits an empty evidence disclosure while preserving sample actions", () => {
    const html = render(candidate({ offenseBenchmarks: [benchmark("unchanged")] }));
    expect(html).not.toContain("<details");
    expect(html).toContain("copilot.applySample");
    expect(html).toContain("copilot.saveToBench");
    expect(html).toContain("Rationale");
  });

  it("renders only selected move evidence and hides unchanged speed", () => {
    const html = render(candidate({ offenseBenchmarks: [late, early] }));
    expect(html.match(/class="copilot-optimization-benchmark"/g)).toHaveLength(1);
    expect(html).toContain("55.0%");
    expect(html).not.toContain("27.0%");
    expect(html).not.toContain("is-speed");
  });

  it("allows a speed-only disclosure", () => {
    const input = candidate();
    input.speedBenchmark.optimized.playerSpeed = 80;
    const html = render(input);
    expect(html).toContain("<details");
    expect(html).toContain("is-speed");
  });

  it("shows an applied move replacement and its before/after calculation", () => {
    const changedBenchmark = benchmark(
      "earthquake",
      outcome({ guaranteedKoHits: 3, possibleKoHits: 3, koHits: 3 }),
      outcome({ guaranteedKoHits: 2, possibleKoHits: 2, koHits: 2 }),
    );
    changedBenchmark.currentMoveId = "tackle";
    changedBenchmark.currentMoveDisplayName = "Tackle";
    changedBenchmark.optimizedVsCurrent = "better";
    const html = render(candidate({
      moveIds: ["earthquake", "protect", "", ""],
      moveChanges: [{
        slotIndex: 0,
        currentMoveId: "tackle",
        currentMoveDisplayName: "Tackle",
        optimizedMoveId: "earthquake",
        optimizedMoveDisplayName: "Earthquake",
        sameTypeAndCategory: false,
      }],
      offenseBenchmarks: [changedBenchmark],
    }));

    expect(html).toContain("copilot.optimization.move-change-label");
    expect(html).toContain("Tackle");
    expect(html).toContain("Earthquake");
    expect(html).toContain("copilot.optimization.replacing-move");
  });

  it("shows the current and replacement item when the candidate changes it", () => {
    const html = render(candidate({
      itemId: "choiceband",
      itemDisplayName: "Choice Band",
      itemChanged: true,
    }), "Life Orb");

    expect(html).toContain("Life Orb");
    expect(html).toContain("Choice Band");
    expect(html).toContain("copilot-optimization-item-value");
  });
});
