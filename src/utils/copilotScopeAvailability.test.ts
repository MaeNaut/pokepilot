import { describe, expect, it } from "vitest";
import {
  isVisibleCopilotScope,
  usesUsageData,
} from "./copilotScopeAvailability";

describe("PokePilot scope availability", () => {
  it("keeps threat analysis out of the public scope list", () => {
    for (const scope of [
      "team",
      "pokemon",
      "recommendation",
      "optimization",
    ] as const) {
      expect(isVisibleCopilotScope(scope)).toBe(true);
    }
    expect(isVisibleCopilotScope("matchup")).toBe(false);
  });

  it("marks the analyses that depend on usage statistics", () => {
    expect(usesUsageData("recommendation")).toBe(true);
    expect(usesUsageData("optimization")).toBe(true);
    expect(usesUsageData("team")).toBe(false);
    expect(usesUsageData("pokemon")).toBe(false);
  });
});
