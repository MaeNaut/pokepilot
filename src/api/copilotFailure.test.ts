import { describe, expect, it } from "vitest";
import { isHostedAnalysisFailureReason } from "./copilotFailure";

describe("hosted analysis failure classification", () => {
  it("validates reasons restored from analysis history", () => {
    expect(isHostedAnalysisFailureReason("rate-limited")).toBe(true);
    expect(isHostedAnalysisFailureReason("mystery-error")).toBe(false);
    expect(isHostedAnalysisFailureReason(undefined)).toBe(false);
  });
});
