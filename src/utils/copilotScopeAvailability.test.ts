import { describe, expect, it } from "vitest";
import {
  isVisibleCopilotScope,
  usesHistoricalUsageData,
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

  it("marks usage-driven analyses as Regulation M-B", () => {
    expect(usesHistoricalUsageData("recommendation")).toBe(true);
    expect(usesHistoricalUsageData("optimization")).toBe(true);
    expect(usesHistoricalUsageData("team")).toBe(false);
    expect(usesHistoricalUsageData("pokemon")).toBe(false);
  });
});
