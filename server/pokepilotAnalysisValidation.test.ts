import { describe, expect, it } from "vitest";
import type { CopilotAnalysisRequest } from "../src/utils/copilotAnalysis";
import {
  reviewHostedCopilotAnalysis,
  validateHostedCopilotAnalysis,
} from "./pokepilotAnalysisValidation";

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
      version: 2,
      scope: "optimization",
      title: "Garchomp vs. Incineroar",
      paragraphs: ["This is verified exact-target tuning."],
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

  it("ignores unused private audit entries for optimization analysis", () => {
    const output = createOutput(["set-balanced"]);
    output.strategyAudit.plans.push({
      id: "unused-model-plan",
      lineupSlotIndexes: [],
      leadSlotIndexes: [],
      backlineSlotIndexes: [],
      actions: [],
    } as never);

    expect(validateHostedCopilotAnalysis(output, request)).toMatchObject({
      scope: "optimization",
      recommendations: [{ id: "set-balanced" }],
    });
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

  it("rejects a move explanation that names a different replacement", () => {
    const output = createOutput(["set-move"]);
    output.analysis.recommendations[0].title = "Use Superpower in this matchup.";
    output.analysis.recommendations[0].reason =
      "Superpower provides the strongest direct pressure.";
    const moveRequest = {
      ...request,
      optimization: {
        candidates: [{
          id: "set-move",
          moveChanges: [{ optimizedMoveDisplayName: "High Horsepower" }],
        }],
      },
    } as unknown as CopilotAnalysisRequest;

    expect(() => validateHostedCopilotAnalysis(output, moveRequest)).toThrow(
      "move explanation does not match its candidate",
    );
  });

  it("accepts a move explanation that names its applied replacement", () => {
    const output = createOutput(["set-move"]);
    output.analysis.recommendations[0].title =
      "Use High Horsepower in this matchup.";
    const moveRequest = {
      ...request,
      optimization: {
        candidates: [{
          id: "set-move",
          moveChanges: [{ optimizedMoveDisplayName: "High Horsepower" }],
        }],
      },
    } as CopilotAnalysisRequest;

    expect(validateHostedCopilotAnalysis(output, moveRequest)).toMatchObject({
      recommendations: [{ id: "set-move" }],
    });
  });

  it("replaces affected blocks without leaving detached conclusions or only drawbacks", () => {
    const output = createOutput(["set-balanced"]);
    output.analysis.paragraphs = [
      "Guaranteed 2HKO after investment. Keeps the support role intact.",
      "Bug Bite becomes a guaranteed 2HKO. Preserves reserve special bulk.",
    ];
    output.analysis.recommendations[0].reason =
      "Takes 34.4% to 41.4% from the target. Preserves the verified survival threshold with reserve bulk.";

    const analysis = validateHostedCopilotAnalysis(output, request);

    expect(analysis.paragraphs).toEqual([
      "This matchup tuning weighs the displayed calculator results against the set's current team role.",
    ]);
    expect(analysis.recommendations[0].reason).toContain("limited to the configured opponent");
    expect(analysis.recommendations[0].reason).not.toContain("34.4%");
  });

  it("removes Korean hit-count paraphrases from optimization prose", () => {
    const output = createOutput(["set-balanced"]);
    const koreanRequest = { ...request, locale: "ko" } as CopilotAnalysisRequest;
    output.analysis.recommendations[0].reason =
      "벌레먹기를 확정 2타로 견딘다. 남는 투자는 반대쪽 내구에 배분한다.";

    const analysis = validateHostedCopilotAnalysis(output, koreanRequest);

    expect(analysis.recommendations[0].reason).toContain("다른 상대에 대한 성능은 검증하지 않았습니다.");
    expect(analysis.recommendations[0].reason).not.toContain("남는 투자는");
  });

  it("removes unsupported qualitative KO-probability claims", () => {
    const output = createOutput(["set-balanced"]);
    const koreanRequest = { ...request, locale: "ko" } as CopilotAnalysisRequest;
    output.analysis.paragraphs = [
      "This option keeps the requested matchup role. Its KO probability rises significantly.",
    ];
    output.analysis.recommendations[0].reason =
      "밀로틱보다 빠르게 움직인다. 에너지볼의 KO 확률이 크게 상승한다.";

    const analysis = validateHostedCopilotAnalysis(output, koreanRequest);

    expect(analysis.paragraphs.join(" ")).not.toContain("KO probability");
    expect(analysis.recommendations[0].reason).not.toContain("밀로틱보다");
  });

  it("retains the verified benefit and stat cost when replacing a numeric reason", () => {
    const output = createOutput(["set-adjusted"]);
    output.analysis.recommendations[0].reason =
      "Drain Punch gains an OHKO chance. However, special bulk falls.";
    const stats = { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 };
    const groundedRequest = { ...request, optimization: {
      currentBuild: { finalStats: stats },
      candidates: [{ id: "set-adjusted", finalStats: { ...stats, attack: 120, specialDefense: 80 },
        offenseBenchmarks: [{ moveDisplayName: "Drain Punch", optimizedVsCurrent: "better" }],
        defenseBenchmarks: [{ moveDisplayName: "Shadow Ball", optimizedVsCurrent: "same" }],
      }],
    } } as CopilotAnalysisRequest;
    const reason = validateHostedCopilotAnalysis(output, groundedRequest).recommendations[0].reason;
    expect(reason).toContain("offensive outcome for Drain Punch improves");
    expect(reason).toContain("lower Special Defense");
    expect(reason).not.toContain("Shadow Ball");
    expect(reason).not.toContain("OHKO");
  });

  it("preserves an intact qualitative explanation and current-only recommendation", () => {
    const output = createOutput(["set-current"]);
    const currentRequest = { ...request, optimization: { candidates: [{ id: "set-current" }] } } as CopilotAnalysisRequest;
    expect(validateHostedCopilotAnalysis(output, currentRequest)).toEqual(output.analysis);
    output.analysis.recommendations[0].reason = "It already reaches a guaranteed 2HKO.";
    const result = validateHostedCopilotAnalysis(output, currentRequest);
    expect(result.recommendations[0].reason).toContain("preserves its damage, Speed, bulk, item, and moves");
  });
});

describe("hosted Pokemon recommendation validation", () => {
  const recommendationCandidate = {
    pokemonId: "rotom-wash",
    target: {
      mode: "replacement",
      slotIndex: 2,
      currentPokemonId: "pelipper",
      currentDisplayName: "Pelipper",
    },
  } as CopilotAnalysisRequest["recommendationCandidates"][number];

  function createRecommendationOutput() {
    const output = createOutput([]);
    output.analysis.scope = "recommendation";
    output.analysis.title = "Keep the current six";
    output.analysis.paragraphs = [
      "None of the supplied exchanges is a clear team-level improvement.",
    ];
    return output;
  }

  it("accepts keeping a complete team when no replacement is worthwhile", () => {
    expect(
      validateHostedCopilotAnalysis(createRecommendationOutput(), {
        locale: "en",
        scope: "recommendation",
        recommendationCandidates: [recommendationCandidate],
        diagnostics: { concepts: [] },
      } as unknown as CopilotAnalysisRequest),
    ).toMatchObject({
      scope: "recommendation",
      recommendations: [],
    });
  });

  it("still requires candidate cards when filling an empty slot", () => {
    expect(() =>
      validateHostedCopilotAnalysis(createRecommendationOutput(), {
        locale: "en",
        scope: "recommendation",
        diagnostics: { concepts: [] },
        recommendationCandidates: [
          {
            ...recommendationCandidate,
            target: {
              mode: "addition",
              slotIndex: 2,
              currentPokemonId: null,
              currentDisplayName: null,
            },
          },
        ],
      } as unknown as CopilotAnalysisRequest),
    ).toThrow("invalid candidate list");
  });
});

describe("recoverable hosted analysis review", () => {
  it("deduplicates non-actionable strategy cards without discarding the analysis", () => {
    const output = createOutput(["one", "one", "two", "three", "four"]);
    output.analysis.scope = "team";
    const teamRequest = {
      ...request,
      scope: "team",
      sets: [],
    } as CopilotAnalysisRequest;

    const reviewed = reviewHostedCopilotAnalysis(output, teamRequest);

    expect(reviewed.analysis.recommendations.map(({ id }) => id)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(reviewed.qualityWarnings).toContain("recommendations-adjusted");
  });

  it("keeps a valid public analysis when the private audit is missing", () => {
    expect(
      reviewHostedCopilotAnalysis(createOutput(["set-balanced"]).analysis, request),
    ).toMatchObject({
      analysis: { recommendations: [{ id: "set-balanced" }] },
      qualityWarnings: ["grounding-incomplete"],
    });
  });

  it("removes only unknown actionable candidates when a valid option remains", () => {
    const reviewed = reviewHostedCopilotAnalysis(
      createOutput(["set-balanced", "invented-spread"]),
      request,
    );

    expect(reviewed.analysis.recommendations.map(({ id }) => id)).toEqual([
      "set-balanced",
    ]);
    expect(reviewed.qualityWarnings).toContain("recommendations-adjusted");
  });

  it("still rejects an actionable response with no usable candidate", () => {
    expect(() =>
      reviewHostedCopilotAnalysis(
        createOutput(["invented-spread"]),
        request,
      ),
    ).toThrow("no usable candidate");
  });

  it("repairs a move explanation that names a different replacement", () => {
    const output = createOutput(["set-move"]);
    output.analysis.recommendations[0].title = "Use Superpower.";
    output.analysis.recommendations[0].reason = "Superpower is stronger.";
    const moveRequest = {
      ...request,
      optimization: {
        currentBuild: {
          finalStats: {
            hp: 100,
            attack: 100,
            defense: 100,
            specialAttack: 100,
            specialDefense: 100,
            speed: 100,
          },
        },
        candidates: [{
          id: "set-move",
          finalStats: {
            hp: 100,
            attack: 100,
            defense: 100,
            specialAttack: 100,
            specialDefense: 100,
            speed: 100,
          },
          offenseBenchmarks: [],
          defenseBenchmarks: [],
          itemChanged: false,
          moveChanges: [{
            currentMoveDisplayName: "Ice Punch",
            optimizedMoveDisplayName: "High Horsepower",
          }],
        }],
      },
    } as unknown as CopilotAnalysisRequest;

    const reviewed = reviewHostedCopilotAnalysis(output, moveRequest);
    expect(reviewed.analysis.recommendations[0]).toMatchObject({
      title: expect.stringContaining("High Horsepower"),
      reason: expect.stringContaining("High Horsepower replaces Ice Punch"),
    });
    expect(reviewed.qualityWarnings).toContain("content-repaired");
  });
});
