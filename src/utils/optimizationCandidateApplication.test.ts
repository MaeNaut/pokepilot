import { describe, expect, it } from "vitest";
import { defaultEvs } from "../data/natures";
import type { ItemIndexEntry } from "../types";
import type { CopilotSetOptimizationCandidateSnapshot } from "./copilotContracts";
import { resolveOptimizationCandidatePatch } from "./optimizationCandidateApplication";

function candidate(
  overrides: Partial<CopilotSetOptimizationCandidateSnapshot> = {},
): CopilotSetOptimizationCandidateSnapshot {
  const stats = { ...defaultEvs, hp: 2, attack: 32, speed: 32 };
  return {
    id: "candidate",
    slotIndex: 0,
    focuses: ["offense"],
    profiles: [],
    maxedStats: ["attack", "speed"],
    natureId: "jolly",
    natureDisplayName: "Jolly",
    evs: stats,
    evTotal: 66,
    finalStats: { hp: 150, attack: 150, defense: 100, specialAttack: 80, specialDefense: 100, speed: 180 },
    itemId: null,
    itemDisplayName: null,
    itemChanged: false,
    moveIds: ["earthquake", "protect", "", ""],
    moveChanges: [],
    changedStatPoints: 0,
    statPointChanges: { ...defaultEvs },
    offenseBenchmarks: [],
    defenseBenchmarks: [],
    speedBenchmark: {
      current: { playerSpeed: 180, opponentSpeed: 150, relation: "faster" },
      optimized: { playerSpeed: 180, opponentSpeed: 150, relation: "faster" },
    },
    ...overrides,
  };
}

const items: ItemIndexEntry[] = [{
  id: 1,
  name: "choiceband",
  showdownId: "choiceband",
  displayName: "Choice Band",
  isMegaStone: false,
}];

describe("optimization candidate application", () => {
  it("applies nature, points, and the complete verified move slots", () => {
    expect(resolveOptimizationCandidatePatch(candidate(), items)).toEqual({
      nature: "jolly",
      evs: { ...defaultEvs, hp: 2, attack: 32, speed: 32 },
      moveIds: ["earthquake", "protect", "", ""],
    });
  });

  it("resolves a changed item from the current legal catalog", () => {
    expect(resolveOptimizationCandidatePatch(candidate({
      itemId: "choiceband",
      itemDisplayName: "Choice Band",
      itemChanged: true,
    }), items)).toMatchObject({
      item: { showdownId: "choiceband", name: "Choice Band" },
    });
  });

  it("rejects a stale changed item instead of partially applying the sample", () => {
    expect(resolveOptimizationCandidatePatch(candidate({
      itemId: "missingitem",
      itemDisplayName: "Missing Item",
      itemChanged: true,
    }), items)).toBeNull();
  });
});
