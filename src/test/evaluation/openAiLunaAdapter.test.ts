import { describe, expect, it, vi } from "vitest";
import type { ResponseUsage } from "openai/resources/responses/responses";
import type { CopilotAnalysisRequest } from "../../utils/copilotAnalysis";
import {
  createLunaStandardUsage,
  createOpenAiLunaAdapter,
} from "./openAiLunaAdapter";

const request = {
  version: 1,
  scope: "team",
  battleFormat: "doubles",
  teamName: "Test Team",
  selectedSlot: 0,
  sets: [],
  candidateFilters: [],
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

describe("OpenAI Luna evaluation adapter", () => {
  it("calculates Standard cost without double-counting reasoning tokens", () => {
    const usage = {
      input_tokens: 1_000,
      input_tokens_details: {
        cached_tokens: 200,
        cache_write_tokens: 100,
      },
      output_tokens: 300,
      output_tokens_details: {
        reasoning_tokens: 120,
      },
      total_tokens: 1_300,
    } satisfies ResponseUsage;

    expect(createLunaStandardUsage(usage)).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: 200,
      cacheWriteTokens: 100,
      outputTokens: 300,
      reasoningTokens: 120,
      totalTokens: 1_300,
      costUsd: 0.000529,
    });
  });

  it("forces Standard service and returns structured output with usage", async () => {
    const create = vi.fn(async () => ({
      id: "resp_test",
      service_tier: "default",
      output_text: JSON.stringify(modelOutput),
      usage: {
        input_tokens: 100,
        input_tokens_details: {
          cached_tokens: 0,
          cache_write_tokens: 0,
        },
        output_tokens: 50,
        output_tokens_details: {
          reasoning_tokens: 10,
        },
        total_tokens: 150,
      },
    }));
    const adapter = createOpenAiLunaAdapter({
      client: {
        responses: {
          create,
        },
      } as never,
      reasoningEffort: "low",
    });
    const result = await adapter.analyze(request);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        service_tier: "default",
        store: false,
        prompt_cache_key: "pokepilot-evaluation-v2-low",
        prompt_cache_retention: "24h",
        reasoning: {
          effort: "low",
          context: "current_turn",
        },
      }),
    );
    expect(result).toMatchObject({
      output: modelOutput,
      responseMetadata: {
        responseId: "resp_test",
        serviceTier: "default",
        reasoningEffort: "low",
        promptVersion: 2,
      },
      usage: {
        totalTokens: 150,
      },
    });
  });
});
