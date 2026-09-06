import { describe, expect, it } from "vitest";
import type { CopilotAnalysisRequest } from "../src/utils/copilotAnalysis";
import { validateHostedCopilotAnalysis } from "./pokepilotAnalysisValidation";

const request = {
  locale: "en",
  scope: "optimization",
  optimization: {
    candidates: [
      { id: "set-balanced" },
      { id: "set-bulky" },
      { id: "set-fast" },
      { id: "set-slow" },
    ],
  },
} as CopilotAnalysisRequest;

function createOutput(recommendationIds: string[]) {
  return {
    analysis: {
      version: 1,
      scope: "optimization",
      title: "Garchomp vs. Incineroar",
      summary: "Verified exact-target tuning.",
      playstyle: "Guaranteed-KO tuning",
      strengths: [] as string[],
      weaknesses: [] as string[],
      recommendations: recommendationIds.map((recommendationId) => ({
          id: recommendationId,
          title: "Keep the smallest verified adjustment",
          reason: "It reaches the configured target with the cleanest tradeoff.",
          priority: "high",
        })),
    },
    strategyAudit: {
      plans: [],
      interactions: [],
      facts: [],
      candidateFacts: [],
      recommendationEvidence: [],
    },
  };
}

describe("hosted optimization validation", () => {
  it("accepts fewer than three recommendations when only one is useful", () => {
    expect(
      validateHostedCopilotAnalysis(
        createOutput(["set-balanced"]),
        request,
      ),
    ).toMatchObject({ scope: "optimization" });
  });

  it("accepts up to three supplied deterministic candidate ids", () => {
    expect(
      validateHostedCopilotAnalysis(
        createOutput(["set-balanced", "set-bulky", "set-fast"]),
        request,
      ),
    ).toMatchObject({ scope: "optimization" });
  });

  it("rejects an empty optimization recommendation list", () => {
    expect(() =>
      validateHostedCopilotAnalysis(createOutput([]), request),
    ).toThrow("invalid candidate list");
  });

  it("rejects an invented optimization candidate", () => {
    expect(() =>
      validateHostedCopilotAnalysis(createOutput(["invented-spread"]), request),
    ).toThrow("invalid candidate list");
  });

  it("removes model-written numeric KO claims while preserving strategic prose", () => {
    const output = createOutput(["set-balanced"]);
    output.analysis.summary =
      "Guaranteed 2HKO after investment. Keeps the support role intact.";
    output.analysis.strengths = [
      "Bug Bite becomes a guaranteed 2HKO.",
      "Preserves reserve special bulk.",
    ];
    output.analysis.recommendations[0].reason =
      "Takes 34.4% to 41.4% from the target. Preserves the verified survival threshold with reserve bulk.";

    const analysis = validateHostedCopilotAnalysis(output, request);

    expect(analysis.summary).toBe("Keeps the support role intact.");
    expect(analysis.strengths).toEqual([
      "Preserves reserve special bulk.",
    ]);
    expect(analysis.recommendations[0].reason).toBe(
      "Preserves the verified survival threshold with reserve bulk.",
    );
  });

  it("removes Korean hit-count paraphrases from optimization prose", () => {
    const output = createOutput(["set-balanced"]);
    const koreanRequest = { ...request, locale: "ko" } as CopilotAnalysisRequest;
    output.analysis.recommendations[0].reason =
      "벌레먹기를 확정 2타로 견딘다. 남는 투자는 반대쪽 내구에 배분한다.";

    const analysis = validateHostedCopilotAnalysis(output, koreanRequest);

    expect(analysis.recommendations[0].reason).toBe(
      "남는 투자는 반대쪽 내구에 배분한다.",
    );
  });

  it("removes unsupported qualitative KO-probability claims", () => {
    const output = createOutput(["set-balanced"]);
    const koreanRequest = { ...request, locale: "ko" } as CopilotAnalysisRequest;
    output.analysis.summary =
      "This option keeps the requested matchup role. Its KO probability rises significantly.";
    output.analysis.recommendations[0].reason =
      "밀로틱보다 빠르게 움직인다. 에너지볼의 KO 확률이 크게 상승한다.";

    const analysis = validateHostedCopilotAnalysis(output, koreanRequest);

    expect(analysis.summary).toBe(
      "This option keeps the requested matchup role.",
    );
    expect(analysis.recommendations[0].reason).toBe(
      "밀로틱보다 빠르게 움직인다.",
    );
  });
});
