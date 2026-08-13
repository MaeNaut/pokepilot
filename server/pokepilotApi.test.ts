import { describe, expect, it, vi } from "vitest";
import {
  createCopilotTypeLabels,
  type CopilotAnalysisRequest,
} from "../src/utils/copilotAnalysis";
import { createCopilotResponsibilityCounts } from "../src/utils/copilotResponsibilities";
import type { LunaAnalysisResult } from "./openAiLuna";
import { handlePokePilotAnalysis } from "./pokepilotApi";
import { InMemoryPokePilotOperations } from "./pokepilotOperations";

const validRequest = {
  version: 14,
  locale: "ko",
  scope: "team",
  battleFormat: "doubles",
  teamName: "Test Team",
  selectedSlot: 0,
  typeLabels: createCopilotTypeLabels("ko"),
  sets: [],
  megaOptions: [],
  candidateFilters: [],
  recommendationCandidates: [],
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
    responsibilityCounts: createCopilotResponsibilityCounts([]),
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
    candidateFacts: [],
    recommendationEvidence: [],
  },
};

const recommendationRequest = {
  ...validRequest,
  scope: "recommendation",
  recommendationCandidates: ["rotom-wash", "gastrodon", "pelipper"].map(
    (pokemonId, index) => ({
      pokemonId,
      displayName: pokemonId,
      types: [index === 2 ? "flying" : "water"],
      typeDisplayNames: [index === 2 ? "Flying" : "Water"],
      abilities: [],
      baseStats: null,
      speedTier: "unknown",
      requiresMegaStone: false,
      usageRank: index + 1,
      commonSet: null,
      responsibilityIds: [],
      fit: {
        weakTo: [],
        resistsTeamThreats: [],
        amplifiesTeamThreats: [],
        addsUnansweredWeaknesses: [],
        coversTypes: [],
        roleContributions: [],
        roleRedundancies: [],
        conceptSynergies: [],
        conflicts: [],
      },
    }),
  ),
} satisfies CopilotAnalysisRequest;

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
      promptVersion: 35,
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

  it("fails closed when shared operational storage is unavailable", async () => {
    const onUpstreamError = vi.fn();
    const operations = new InMemoryPokePilotOperations();
    vi.spyOn(operations, "getCached").mockRejectedValue(
      new Error("Redis unavailable"),
    );
    const result = await handlePokePilotAnalysis(validRequest, {
      analyze: vi.fn(async () => createModelResult(groundedModelOutput)),
      onUpstreamError,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
    });

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: "AI_UPSTREAM_ERROR" },
    });
    expect(onUpstreamError).toHaveBeenCalledOnce();
  });

  it("returns only validated structured model output", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const result = await handlePokePilotAnalysis(validRequest, { analyze });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      analysis: modelOutput,
      metadata: {
        cacheStatus: "miss",
        model: "gpt-5.6-luna",
        promptVersion: 44,
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

  it("rejects recommendation candidates that were not supplied by the client", async () => {
    const recommendationOutput = {
      ...groundedModelOutput,
      analysis: {
        ...modelOutput,
        scope: "recommendation",
        recommendations: ["rotom-wash", "gastrodon", "invented"].map(
          (id) => ({
            id,
            title: id,
            reason: "Fit",
            priority: "medium",
          }),
        ),
      },
    };
    const result = await handlePokePilotAnalysis(recommendationRequest, {
      analyze: async () => createModelResult(recommendationOutput),
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

  it("reuses an identical validated analysis without another model call", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 1_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
    };

    const first = await handlePokePilotAnalysis(validRequest, options);
    const second = await handlePokePilotAnalysis(validRequest, options);

    expect(analyze).toHaveBeenCalledOnce();
    expect(first.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "miss" },
    });
    expect(second.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "hit" },
    });
  });

  it("keeps team-scope cache identity stable when only the selected slot changes", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 1_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
    };

    await handlePokePilotAnalysis(validRequest, options);
    const second = await handlePokePilotAnalysis(
      { ...validRequest, selectedSlot: 1 },
      options,
    );

    expect(analyze).toHaveBeenCalledOnce();
    expect(second.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "hit" },
    });
  });

  it("shares an in-flight identical analysis without consuming another call", async () => {
    let completeAnalysis: ((result: LunaAnalysisResult) => void) | undefined;
    const analyze = vi.fn(
      () =>
        new Promise<LunaAnalysisResult>((resolve) => {
          completeAnalysis = resolve;
        }),
    );
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 1_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
    };

    const first = handlePokePilotAnalysis(validRequest, options);
    const second = handlePokePilotAnalysis(validRequest, options);
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledOnce());
    completeAnalysis?.(createModelResult(groundedModelOutput));

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(analyze).toHaveBeenCalledOnce();
    expect(firstResult.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "miss" },
    });
    expect(secondResult.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "shared" },
    });
  });

  it("starts a progressive client cooldown after five uncached analyses", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 10_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
    };

    for (let index = 0; index < 5; index += 1) {
      const result = await handlePokePilotAnalysis(
        { ...validRequest, teamName: `Team ${index}` },
        options,
      );
      expect(result.status).toBe(200);
    }

    const limited = await handlePokePilotAnalysis(
      { ...validRequest, teamName: "Team 6" },
      options,
    );

    expect(analyze).toHaveBeenCalledTimes(5);
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      ok: false,
      error: {
        code: "ANALYSIS_COOLDOWN",
        retryAfterSeconds: 60,
      },
    });
  });

  it("keeps cache enabled while disabling cooldown in AI test mode", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 10_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
      safeguardMode: "ai-test" as const,
    };

    for (let index = 0; index < 6; index += 1) {
      const result = await handlePokePilotAnalysis(
        { ...validRequest, teamName: `Team ${index}` },
        options,
      );
      expect(result.status).toBe(200);
    }

    const cached = await handlePokePilotAnalysis(
      { ...validRequest, teamName: "Team 0" },
      options,
    );
    expect(cached.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "hit" },
    });
    expect(analyze).toHaveBeenCalledTimes(6);
  });

  it("requests a fresh analysis without cooldown in fresh AI test mode", async () => {
    const analyze = vi.fn(async () => createModelResult(groundedModelOutput));
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 10_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
      safeguardMode: "ai-fresh" as const,
    };

    const first = await handlePokePilotAnalysis(validRequest, options);
    const second = await handlePokePilotAnalysis(validRequest, options);

    expect(first.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "miss" },
    });
    expect(second.body).toMatchObject({
      ok: true,
      metadata: { cacheStatus: "miss" },
    });
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("reproduces cooldown after one uncached analysis in cooldown test mode", async () => {
    let now = 10_000;
    const analyze = vi.fn(async () => {
      now = 18_000;
      return createModelResult(groundedModelOutput);
    });
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => now,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
      safeguardMode: "cooldown-test" as const,
    };

    const first = await handlePokePilotAnalysis(validRequest, options);
    const limited = await handlePokePilotAnalysis(validRequest, options);

    expect(first.status).toBe(200);
    expect(limited.body).toMatchObject({
      ok: false,
      error: {
        code: "ANALYSIS_COOLDOWN",
        retryAfterSeconds: 10,
      },
    });
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("does not consume cooldown capacity when hosted analysis fails", async () => {
    const analyze = vi
      .fn()
      .mockRejectedValueOnce(new Error("Temporary upstream failure"))
      .mockResolvedValue(createModelResult(groundedModelOutput));
    const operations = new InMemoryPokePilotOperations();
    const options = {
      analyze,
      clock: () => 10_000,
      operations,
      requester: { clientId: "client-a", ipHash: "ip-a" },
      safeguardMode: "cooldown-test" as const,
    };

    const failed = await handlePokePilotAnalysis(validRequest, options);
    const successful = await handlePokePilotAnalysis(validRequest, options);
    const limited = await handlePokePilotAnalysis(validRequest, options);

    expect(failed.status).toBe(502);
    expect(successful.status).toBe(200);
    expect(limited.body).toMatchObject({
      ok: false,
      error: {
        code: "ANALYSIS_COOLDOWN",
        retryAfterSeconds: 10,
      },
    });
    expect(analyze).toHaveBeenCalledTimes(2);
  });
});
