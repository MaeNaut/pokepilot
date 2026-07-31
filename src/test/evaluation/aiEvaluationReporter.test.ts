import { describe, expect, it } from "vitest";
import {
  createAiEvaluationReport,
  formatAiEvaluationReportMarkdown,
} from "./aiEvaluationReporter";
import type {
  AiEvaluationRunResult,
  AiTeamEvaluationCase,
} from "./aiModelEvaluation";

const evaluationCase = {
  schemaVersion: 1,
  fixtureId: "fixture-1",
  title: "Fixture One",
  request: {
    battleFormat: "singles",
  },
  evaluatorContext: {
    source: {
      origin: "constructed",
      name: "Test",
      retrievedAt: "2026-07-30",
    },
    expectations: {
      teamIdentities: ["balance"],
      criticalObservations: ["Observation"],
      forbiddenConclusions: ["Forbidden"],
    },
  },
} as AiTeamEvaluationCase;

const result = {
  schemaVersion: 1,
  fixtureId: "fixture-1",
  modelId: "gpt-5.6-luna",
  requestFingerprint: "fingerprint",
  status: "complete",
  output: {
    version: 1,
    scope: "team",
    title: "Fixture One",
    summary: "Summary",
    playstyle: "Balance",
    strengths: ["Strength"],
    weaknesses: ["Weakness"],
    recommendations: [],
  },
  validationErrors: [],
  error: null,
  latencyMs: 1_000,
  usage: {
    inputTokens: 1_000,
    cachedInputTokens: 100,
    cacheWriteTokens: 200,
    outputTokens: 300,
    reasoningTokens: 120,
    totalTokens: 1_300,
    costUsd: 0.001,
  },
  responseMetadata: {
    serviceTier: "default",
    reasoningEffort: "low",
  },
} satisfies AiEvaluationRunResult;

describe("AI evaluation reporter", () => {
  it("aggregates usage and keeps evaluator expectations outside model output", () => {
    const report = createAiEvaluationReport({
      startedAt: "2026-07-30T00:00:00.000Z",
      completedAt: "2026-07-30T00:00:01.000Z",
      evaluationCases: [evaluationCase],
      results: [result],
    });
    const markdown = formatAiEvaluationReportMarkdown(report);

    expect(report.summary).toMatchObject({
      completeCount: 1,
      singlesCount: 1,
      doublesCount: 0,
      usage: {
        totalTokens: 1_300,
        costUsd: 0.001,
      },
    });
    expect(report.cases[0].manualReview.status).toBe("pending");
    expect(markdown).toContain("Estimated Standard API cost: $0.001000");
    expect(markdown).toContain("### Evaluator Expectations");
    expect(markdown).toContain("- Forbidden");
  });
});
