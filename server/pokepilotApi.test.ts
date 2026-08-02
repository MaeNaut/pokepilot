import { describe, expect, it, vi } from "vitest";
import type { CopilotAnalysisRequest } from "../src/utils/copilotAnalysis";
import type { LunaAnalysisResult } from "./openAiLuna";
import { handlePokePilotAnalysis } from "./pokepilotApi";

const validRequest = {
  version: 9,
  locale: "ko",
  scope: "team",
  battleFormat: "doubles",
  teamName: "Test Team",
  selectedSlot: 0,
  sets: [],
  megaOptions: [],
  candidateFilters: [],
  mechanics: {
    moves: [],
    abilities: [],
    items: [],
  },
  diagnostics: {
    filledSlots: 0,
    coverageCount: 0,
    coverageGaps: [],
    defensiveMatchups: [],
    alerts: [],
    roleCounts: {
      "physical-attacker": 0,
      "special-attacker": 0,
      "physical-wall": 0,
      "special-wall": 0,
      supporter: 0,
      setter: 0,
    },
    moveSources: {},
    defensiveProfile: {
      weakTo: {},
      resists: {},
      immuneTo: {},
    },
    offensiveProfile: {
      physicalMoveCount: 0,
      specialMoveCount: 0,
      spreadMoveCount: 0,
      physicalSources: {},
      specialSources: {},
      spreadSources: {},
    },
    concepts: [],
    validity: {
      status: "valid",
      errorCount: 0,
      unavailableCount: 0,
    },
  },
} satisfies CopilotAnalysisRequest;

const modelOutput = {
  version: 1,
  scope: "team",
  title: "Test Team",
  summary: "Summary",
  playstyle: "Balanced",
  strengths: [],
  weaknesses: [],
  recommendations: [],
};

const groundedModelOutput = {
  analysis: modelOutput,
  strategyAudit: {
    plans: [],
    interactions: [],
    facts: [],
    recommendationEvidence: [],
  },
};

function createModelResult(output: unknown): LunaAnalysisResult {
  return {
    output,
    usage: {
      inputTokens: 100,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 50,
      reasoningTokens: 10,
      totalTokens: 150,
      costUsd: 0.00008,
    },
    responseMetadata: {
      responseId: "resp_test",
      serviceTier: "default",
      reasoningEffort: "low",
      promptVersion: 25,
    },
  };
}

describe("PokePilot server API", () => {
  it("rejects malformed request contracts before calling the model", async () => {
    const analyze = vi.fn();
    const result = await handlePokePilotAnalysis(
      { ...validRequest, version: 4 },
      { analyze },
    );

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("reports a missing server key without attempting an OpenAI request", async () => {
    const result = await handlePokePilotAnalysis(validRequest);

    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "AI_NOT_CONFIGURED" },
    });
  });

  it("returns only validated structured model output", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const result = await handlePokePilotAnalysis(validRequest, { analyze });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      analysis: modelOutput,
      metadata: {
        model: "gpt-5.6-luna",
        promptVersion: 25,
      },
    });
    expect(analyze).toHaveBeenCalledWith(validRequest);
  });

  it("rejects a structured response for the wrong analysis scope", async () => {
    const result = await handlePokePilotAnalysis(validRequest, {
      analyze: async () =>
        createModelResult({
          ...groundedModelOutput,
          analysis: { ...modelOutput, scope: "pokemon" },
        }),
    });

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "AI_INVALID_RESPONSE" },
    });
  });

  it("rejects a response without the private strategy audit", async () => {
    const result = await handlePokePilotAnalysis(validRequest, {
      analyze: async () => createModelResult(modelOutput),
    });

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "AI_INVALID_RESPONSE" },
    });
  });

  it("rejects the legacy plans-only strategy audit contract", async () => {
    const result = await handlePokePilotAnalysis(validRequest, {
      analyze: async () =>
        createModelResult({
          analysis: modelOutput,
          strategyAudit: { plans: [] },
        }),
    });

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "AI_INVALID_RESPONSE" },
    });
  });

  it("preserves upstream rate limiting as a retryable API status", async () => {
    const onUpstreamError = vi.fn();
    const result = await handlePokePilotAnalysis(validRequest, {
      analyze: async () => {
        throw Object.assign(new Error("rate limited"), { status: 429 });
      },
      onUpstreamError,
    });

    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "AI_RATE_LIMITED" },
    });
    expect(onUpstreamError).toHaveBeenCalledOnce();
  });
});
