import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotApiError, requestHostedCopilotAnalysis } from "../api/copilotApi";
import type { CopilotAnalysisRequest, CopilotAnalysisResponse } from "./copilotContracts";
import { createLocalCopilotAnalysis } from "./copilotLocalAnalysis";
import { executeCopilotAnalysis } from "./copilotAnalysisExecution";

vi.mock("../api/copilotApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/copilotApi")>(),
  requestHostedCopilotAnalysis: vi.fn(),
}));
vi.mock("./copilotLocalAnalysis", () => ({ createLocalCopilotAnalysis: vi.fn() }));

// Transport and generation are mocked; the execution layer only reads these fields.
const request = { scope: "team" } as CopilotAnalysisRequest;
const hosted: CopilotAnalysisResponse = {
  version: 2, scope: "team", source: "hosted", title: "Team",
  paragraphs: ["Team analysis."], recommendations: [],
};
const local: CopilotAnalysisResponse = { ...hosted, source: "local" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requestHostedCopilotAnalysis).mockResolvedValue({ analysis: hosted });
  vi.mocked(createLocalCopilotAnalysis).mockReturnValue(local);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("analysis execution", () => {
  it("forwards the request unchanged and avoids fallback on success", async () => {
    const cooldown = vi.fn();
    const result = await executeCopilotAnalysis(request, "en", cooldown);
    expect(requestHostedCopilotAnalysis).toHaveBeenCalledExactlyOnceWith(request);
    expect(result.response).toBe(hosted);
    expect(result.usedFallback).toBe(false);
    expect(result.fallbackReason).toBeUndefined();
    expect(createLocalCopilotAnalysis).not.toHaveBeenCalled();
    expect(cooldown).not.toHaveBeenCalled();
  });

  it("reports cooldown only after the hosted request completes", async () => {
    const cooldown = vi.fn();
    vi.mocked(requestHostedCopilotAnalysis).mockImplementation(async () => {
      expect(cooldown).not.toHaveBeenCalled();
      return { analysis: hosted, retryAfterSeconds: 60 };
    });
    await executeCopilotAnalysis(request, "en", cooldown);
    expect(cooldown).toHaveBeenCalledExactlyOnceWith(60);
  });

  it.each([
    ["NETWORK_ERROR", 0, "connection"],
    ["AI_NOT_CONFIGURED", 503, "not-configured"],
    ["INVALID_RESPONSE", 200, "invalid-response"],
    ["AI_RATE_LIMITED", 429, "rate-limited"],
    ["AI_UPSTREAM_ERROR", 502, "service-unavailable"],
    ["REQUEST_FAILED", 400, "unavailable"],
  ])("preserves %s classification and uses the requested fallback language", async (code, status, reason) => {
    vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(new CopilotApiError("failed", code, status, 90));
    const cooldown = vi.fn();
    const result = await executeCopilotAnalysis(request, "ko", cooldown);
    expect(result).toEqual({ response: local, usedFallback: true, fallbackReason: reason });
    expect(createLocalCopilotAnalysis).toHaveBeenCalledExactlyOnceWith(request, "ko");
    expect(cooldown).not.toHaveBeenCalled();
    expect(requestHostedCopilotAnalysis).toHaveBeenCalledOnce();
  });

  it("notifies cooldown before generating a rule-based fallback", async () => {
    const cooldown = vi.fn();
    vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(
      new CopilotApiError("wait", "ANALYSIS_COOLDOWN", 429, 120),
    );
    vi.mocked(createLocalCopilotAnalysis).mockImplementation(() => {
      expect(cooldown).toHaveBeenCalledExactlyOnceWith(120);
      return local;
    });
    const result = await executeCopilotAnalysis(request, "en", cooldown);
    expect(result.fallbackReason).toBe("cooldown");
  });

  it("retains the cooldown notification if fallback generation itself fails", async () => {
    const cooldown = vi.fn();
    vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(
      new CopilotApiError("wait", "ANALYSIS_COOLDOWN", 429, 120),
    );
    vi.mocked(createLocalCopilotAnalysis).mockImplementation(() => { throw new Error("fallback failed"); });
    await expect(executeCopilotAnalysis(request, "en", cooldown)).rejects.toThrow("fallback failed");
    expect(cooldown).toHaveBeenCalledExactlyOnceWith(120);
  });

  it.each(["hosted", "local"] as const)("attaches only recommended optimization snapshots for %s responses", async (source) => {
    const optimizationRequest = {
      scope: "optimization",
      optimization: { candidates: [{ id: "a" }, { id: "b" }, { id: "c" }] },
    } as CopilotAnalysisRequest;
    const response: CopilotAnalysisResponse = {
      ...hosted, scope: "optimization", source,
      recommendations: ["c", "a", "unknown"].map((id) => ({
        id, title: id, reason: "Candidate reason.", priority: "medium",
      })),
    };
    if (source === "hosted") {
      vi.mocked(requestHostedCopilotAnalysis).mockResolvedValue({ analysis: response });
    } else {
      vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(new Error("offline"));
      vi.mocked(createLocalCopilotAnalysis).mockReturnValue(response);
    }
    const result = await executeCopilotAnalysis(optimizationRequest, "en", vi.fn());
    const candidates = optimizationRequest.optimization!.candidates;
    expect(result.response.optimizationCandidates).toEqual([candidates[0], candidates[2]]);
    expect(result.response.optimizationCandidates?.[0]).toBe(candidates[0]);
    expect(response.optimizationCandidates).toBeUndefined();
    expect(candidates).toHaveLength(3);
  });

  it.each(["localhost", "127.0.0.1", "pokepilot-ai.vercel.app"])("keeps diagnostic logging limited to development hosts: %s", async (hostname) => {
    vi.stubGlobal("window", { location: { hostname } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(new Error("offline"));
    await executeCopilotAnalysis(request, "en", vi.fn());
    expect(warn).toHaveBeenCalledTimes(hostname === "pokepilot-ai.vercel.app" ? 0 : 1);
  });
});
