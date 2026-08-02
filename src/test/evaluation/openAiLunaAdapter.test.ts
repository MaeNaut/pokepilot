import { describe, expect, it, vi } from "vitest";
import type { ResponseUsage } from "openai/resources/responses/responses";
import type { CopilotAnalysisRequest } from "../../utils/copilotAnalysis";
import {
  createLunaStandardUsage,
  createOpenAiLunaAdapter,
} from "./openAiLunaAdapter";

const request = {
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
  strategyAudit: { plans: [] },
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
    const create = vi.fn(async (requestOptions: { instructions?: string }) => {
      void requestOptions;

      return {
        id: "resp_test",
        service_tier: "default",
        output_text: JSON.stringify(groundedModelOutput),
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
      };
    });
    const adapter = createOpenAiLunaAdapter({
      client: {
        responses: {
          create,
        },
      } as never,
    });
    const result = await adapter.analyze(request);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        service_tier: "default",
        store: false,
        prompt_cache_key: "pokepilot-evaluation-v18-low",
        prompt_cache_retention: "24h",
        reasoning: {
          effort: "low",
          context: "current_turn",
        },
        max_output_tokens: 3_500,
      }),
    );
    expect(result).toMatchObject({
      output: modelOutput,
      responseMetadata: {
        responseId: "resp_test",
        serviceTier: "default",
        reasoningEffort: "low",
        promptVersion: 18,
      },
      usage: {
        totalTokens: 150,
      },
    });
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Every proposed Singles lineup must contain exactly three Pokemon",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "verify the relevant Pokemon names in diagnostics.defensiveProfile",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "never print raw IDs or words such as ID, key, source map, diagnostics, or strategy audit",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "megaEvolution is the deterministic post-Mega name",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "always use the supplied displayName, typeDisplayNames",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "request.megaOptions is the complete deterministic list",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Trick Room reverses move order within priority brackets",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Do not frame multiple Mega options as an inherent flaw",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "combine exact speed values with supplied mechanics",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "differ by exactly one speed point",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "medium to a matchup-dependent branch",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "unless that move appears under the Pokemon in diagnostics.moveSources",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "validityStatus is not valid must not appear in a recommended lineup",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "A matchup-dependent Mega selection is not automatically a different field or speed-control plan",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "do not force that set into a late-game-only role",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "explicitly test each faster set as a possible opening partner",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Do not default to the Trick Room setter plus the slowest attacker",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "share a move whose effect changes when an ally uses it during the same turn",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "mechanics.items are a neutral reference dictionary",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "inspect every unordered pair of filled sets",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Derive relationships from the current request",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "explicitly distinguish the two-Pokemon lead pair from the two backline members",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "silently simulate the opening turn",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "provide at least one legal lineup that actually includes it",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Preserve flexible final-slot branches",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "Return a top-level object with analysis and strategyAudit",
    );
    expect(create.mock.calls[0]![0].instructions).toContain(
      "actorSlotIndex must be one of those active slots",
    );
  });

  it("preserves usage when Luna returns malformed structured output", async () => {
    const create = vi.fn(async () => ({
      id: "resp_incomplete",
      service_tier: "default",
      output_text: '{"analysis":',
      usage: {
        input_tokens: 1_000,
        input_tokens_details: {
          cached_tokens: 800,
          cache_write_tokens: 0,
        },
        output_tokens: 500,
        output_tokens_details: {
          reasoning_tokens: 300,
        },
        total_tokens: 1_500,
      },
    }));
    const adapter = createOpenAiLunaAdapter({
      client: {
        responses: { create },
      } as never,
      reasoningEffort: "medium",
    });

    await expect(adapter.analyze(request)).resolves.toMatchObject({
      output: null,
      validationErrors: [
        "Luna returned output that could not be parsed as JSON.",
      ],
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 800,
        outputTokens: 500,
        reasoningTokens: 300,
        totalTokens: 1_500,
        costUsd: 0.000656,
      },
      responseMetadata: {
        responseId: "resp_incomplete",
        reasoningEffort: "medium",
      },
    });
  });
});
