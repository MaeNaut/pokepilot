import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotApiError, requestHostedCopilotAnalysis } from "../api/copilotApi";
import type { CopilotAnalysisRequest, CopilotAnalysisResponse } from "./copilotContracts";
import { executeCopilotAnalysis } from "./copilotAnalysisExecution";

vi.mock("../api/copilotApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/copilotApi")>(),
  requestHostedCopilotAnalysis: vi.fn(),
}));

const request = { scope: "team" } as CopilotAnalysisRequest;
const hosted: CopilotAnalysisResponse = {
  version: 2, scope: "team", source: "hosted", title: "Team",
  paragraphs: ["Team analysis."], recommendations: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requestHostedCopilotAnalysis).mockResolvedValue({ analysis: hosted });
});

describe("analysis execution", () => {
  it("forwards effort and returns only the hosted result", async () => {
    const cooldown = vi.fn();
    const result = await executeCopilotAnalysis(request, cooldown, "medium");
    expect(requestHostedCopilotAnalysis).toHaveBeenCalledExactlyOnceWith(request, undefined, "medium", "gpt-6-luna");
    expect(result).toEqual({ response: hosted, usedFallback: false, fallbackReason: undefined });
    expect(cooldown).not.toHaveBeenCalled();
  });

  it("forwards a personal Sol low selection", async () => {
    await executeCopilotAnalysis(request, vi.fn(), "low", "gpt-6-sol");
    expect(requestHostedCopilotAnalysis).toHaveBeenCalledExactlyOnceWith(request, undefined, "low", "gpt-6-sol");
  });

  it("preserves a renderable answer with private quality warnings", async () => {
    vi.mocked(requestHostedCopilotAnalysis).mockResolvedValue({
      analysis: hosted, qualityWarnings: ["grounding-incomplete"],
    });
    expect((await executeCopilotAnalysis(request, vi.fn())).response).toEqual({
      ...hosted, qualityWarnings: ["grounding-incomplete"],
    });
  });

  it.each([
    ["INVALID_REQUEST", false],
    ["AI_NOT_CONFIGURED", false],
    ["NETWORK_ERROR", undefined],
    ["AI_INVALID_RESPONSE", undefined],
    ["INVALID_RESPONSE", undefined],
    ["AI_UPSTREAM_ERROR", undefined],
    ["PERSONAL_KEY_INVALID", undefined],
  ] as const)("does not generate analysis after %s", async (code, providerAttempted) => {
    const error = new CopilotApiError("failed", code, 502, undefined, providerAttempted);
    vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(error);
    await expect(executeCopilotAnalysis(request, vi.fn())).rejects.toBe(error);
  });

  it("notifies cooldown even when no analysis is returned", async () => {
    const error = new CopilotApiError("wait", "ANALYSIS_COOLDOWN", 429, 120, false);
    vi.mocked(requestHostedCopilotAnalysis).mockRejectedValue(error);
    const cooldown = vi.fn();
    await expect(executeCopilotAnalysis(request, cooldown)).rejects.toBe(error);
    expect(cooldown).toHaveBeenCalledExactlyOnceWith(120);
  });

  it("attaches only selected optimization candidate snapshots", async () => {
    const optimizationRequest = {
      scope: "optimization",
      optimization: { candidates: [{ id: "a" }, { id: "b" }, { id: "c" }] },
    } as CopilotAnalysisRequest;
    const response = {
      ...hosted, scope: "optimization" as const,
      recommendations: ["c", "a", "unknown"].map((id) => ({
        id, title: id, reason: "Candidate reason.", priority: "medium" as const,
      })),
    };
    vi.mocked(requestHostedCopilotAnalysis).mockResolvedValue({ analysis: response });
    const result = await executeCopilotAnalysis(optimizationRequest, vi.fn());
    expect(result.response.optimizationCandidates).toEqual([
      optimizationRequest.optimization!.candidates[0],
      optimizationRequest.optimization!.candidates[2],
    ]);
    expect(response).not.toHaveProperty("optimizationCandidates");
  });
});
