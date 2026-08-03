import { describe, expect, it, vi } from "vitest";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { pokepilotInstructions } from "../../../server/openAiLuna";
import type { CopilotAnalysisRequest } from "../../utils/copilotAnalysis";
import {
  createLunaStandardUsage,
  createOpenAiLunaAdapter,
} from "./openAiLunaAdapter";

const request = {
  version: 11,
  locale: "ko",
  scope: "team",
  battleFormat: "doubles",
  teamName: "Test Team",
  selectedSlot: 0,
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
        prompt_cache_key: "pokepilot-evaluation-v28-low",
        prompt_cache_options: {
          mode: "explicit",
          ttl: "30m",
        },
        input: [
          {
            type: "message",
            role: "developer",
            content: [
              {
                type: "input_text",
                text: pokepilotInstructions,
                prompt_cache_breakpoint: { mode: "explicit" },
              },
            ],
          },
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(request),
              },
            ],
          },
        ],
        reasoning: {
          effort: "low",
          context: "current_turn",
        },
        max_output_tokens: 3_500,
      }),
    );
    expect(result).toMatchObject({
      output: modelOutput,
      debugOutput: groundedModelOutput,
      responseMetadata: {
        responseId: "resp_test",
        serviceTier: "default",
        reasoningEffort: "low",
        promptVersion: 28,
      },
      usage: {
        totalTokens: 150,
      },
    });
    expect(pokepilotInstructions).toContain(
      "Every proposed Singles lineup must contain exactly three Pokemon",
    );
    expect(pokepilotInstructions).toContain(
      "verify the relevant Pokemon names in diagnostics.defensiveProfile",
    );
    expect(pokepilotInstructions).toContain(
      "never print raw IDs or words such as ID, key, source map, diagnostics, or strategy audit",
    );
    expect(pokepilotInstructions).toContain(
      "megaEvolution is the deterministic post-Mega name",
    );
    expect(pokepilotInstructions).toContain(
      "always use the supplied displayName, typeDisplayNames",
    );
    expect(pokepilotInstructions).toContain(
      "request.megaOptions is the complete deterministic list",
    );
    expect(pokepilotInstructions).toContain(
      "Trick Room reverses move order within priority brackets",
    );
    expect(pokepilotInstructions).toContain(
      "Do not frame multiple Mega options as an inherent flaw",
    );
    expect(pokepilotInstructions).toContain(
      "combine exact speed values with supplied mechanics",
    );
    expect(pokepilotInstructions).toContain(
      "differ by exactly one speed point",
    );
    expect(pokepilotInstructions).toContain(
      "medium to a matchup-dependent branch",
    );
    expect(pokepilotInstructions).toContain(
      "unless that move appears under the Pokemon in diagnostics.moveSources",
    );
    expect(pokepilotInstructions).toContain(
      "validityStatus is not valid must not appear in a recommended lineup",
    );
    expect(pokepilotInstructions).toContain(
      "A matchup-dependent Mega selection is not automatically a different field or speed-control plan",
    );
    expect(pokepilotInstructions).toContain(
      "do not force that set into a late-game-only role",
    );
    expect(pokepilotInstructions).toContain(
      "explicitly test each faster set as a possible opening partner",
    );
    expect(pokepilotInstructions).toContain(
      "Do not default to the Trick Room setter plus the slowest attacker",
    );
    expect(pokepilotInstructions).toContain(
      "share a move whose effect changes when an ally uses it during the same turn",
    );
    expect(pokepilotInstructions).toContain(
      "mechanics.items are a neutral reference dictionary",
    );
    expect(pokepilotInstructions).toContain(
      "inspect every unordered pair of filled sets",
    );
    expect(pokepilotInstructions).toContain(
      "Derive relationships from the current request",
    );
    expect(pokepilotInstructions).toContain(
      "Complete two mandatory cross-set passes before assigning the team an archetype",
    );
    expect(pokepilotInstructions).toContain(
      "Do not assume that a stat-lowering or hostile-looking move must target an opponent",
    );
    expect(pokepilotInstructions).toContain(
      "Group all filled sets by canonical selected move id",
    );
    expect(pokepilotInstructions).toContain(
      "enumerate every ordered active pair",
    );
    expect(pokepilotInstructions).toContain(
      "treat that pair as a candidate default opening rather than optional cleanup",
    );
    expect(pokepilotInstructions).toContain(
      "calculate each owner's effective Speed",
    );
    expect(pokepilotInstructions).toContain(
      "rank that transformed response rather than treating every owner as interchangeable",
    );
    expect(pokepilotInstructions).toContain(
      "do not prefer the next-fastest responder merely because it would otherwise move sooner",
    );
    expect(pokepilotInstructions).toContain(
      "changes a Pokemon's apparent identity or conceals its set",
    );
    expect(pokepilotInstructions).toContain(
      "never from the other currently active lead",
    );
    expect(pokepilotInstructions).toContain(
      "evaluate denial as the first interpretation",
    );
    expect(pokepilotInstructions).toContain(
      "explicitly distinguish the two-Pokemon lead pair from the two backline members",
    );
    expect(pokepilotInstructions).toContain(
      "silently simulate the opening turn",
    );
    expect(pokepilotInstructions).toContain(
      "provide at least one legal lineup that actually includes it",
    );
    expect(pokepilotInstructions).toContain(
      "Preserve flexible final-slot branches",
    );
    expect(pokepilotInstructions).toContain(
      "Return a top-level object with analysis and strategyAudit",
    );
    expect(pokepilotInstructions).toContain(
      "actorSlotIndex must be one of those active slots",
    );
    expect(pokepilotInstructions).toContain(
      "Record every concrete cross-set interaction used by analysis",
    );
    expect(pokepilotInstructions).toContain(
      "Every bound move must have a matching action",
    );
    expect(pokepilotInstructions).toContain(
      "Create exactly one recommendationEvidence entry per user-facing recommendation",
    );
    expect(pokepilotInstructions).toContain(
      "Never merge distinct weather names",
    );
    expect(pokepilotInstructions).not.toMatch(
      /Charm|Contrary|Staraptor|Zoroark|Gardevoir|Round/,
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
