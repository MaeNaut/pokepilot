import { describe, expect, it } from "vitest";
import {
  classifyHostedAnalysisFailure,
  isHostedAnalysisFailureReason,
} from "./copilotFailure";

describe("hosted analysis failure classification", () => {
  it.each([
    ["ANALYSIS_COOLDOWN", "cooldown"],
    ["NETWORK_ERROR", "connection"],
    ["AI_NOT_CONFIGURED", "not-configured"],
    ["AI_INVALID_RESPONSE", "invalid-response"],
    ["INVALID_RESPONSE", "invalid-response"],
    ["AI_RATE_LIMITED", "rate-limited"],
    ["AI_UPSTREAM_ERROR", "service-unavailable"],
  ] as const)("maps %s to %s", (code, expectedReason) => {
    expect(classifyHostedAnalysisFailure({ code, status: 400 })).toBe(
      expectedReason,
    );
  });

  it("uses the HTTP status when an unknown server code is returned", () => {
    expect(
      classifyHostedAnalysisFailure({ code: "UNKNOWN", status: 503 }),
    ).toBe("service-unavailable");
    expect(classifyHostedAnalysisFailure({ status: 0 })).toBe("connection");
    expect(classifyHostedAnalysisFailure({ status: 400 })).toBe("unavailable");
  });

  it("validates reasons restored from analysis history", () => {
    expect(isHostedAnalysisFailureReason("rate-limited")).toBe(true);
    expect(isHostedAnalysisFailureReason("mystery-error")).toBe(false);
    expect(isHostedAnalysisFailureReason(undefined)).toBe(false);
  });
});
