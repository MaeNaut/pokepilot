import { describe, expect, it } from "vitest";
import {
  isVisibleCopilotScope,
  usesHistoricalUsageData,
  visibleCopilotScopes,
} from "./copilotScopeAvailability";

describe("PokePilot scope availability", () => {
  it("keeps threat analysis out of the public scope list", () => {
    expect(visibleCopilotScopes).toEqual([
      "team",
      "pokemon",
      "recommendation",
      "optimization",
    ]);
    expect(isVisibleCopilotScope("matchup")).toBe(false);
  });

  it("marks usage-driven analyses as Regulation M-B", () => {
    expect(usesHistoricalUsageData("recommendation")).toBe(true);
    expect(usesHistoricalUsageData("optimization")).toBe(true);
    expect(usesHistoricalUsageData("team")).toBe(false);
    expect(usesHistoricalUsageData("pokemon")).toBe(false);
  });
});
