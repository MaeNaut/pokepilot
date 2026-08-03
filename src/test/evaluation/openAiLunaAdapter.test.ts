import { describe, expect, it, vi } from "vitest";
import type { ResponseUsage } from "openai/resources/responses/responses";
import {
  getPokePilotScopeInstructions,
  pokepilotCommonInstructions,
} from "../../../server/openAiLuna";
import {
  createCopilotTypeLabels,
  type CopilotAnalysisRequest,
} from "../../utils/copilotAnalysis";
import {
  createLunaStandardUsage,
  createOpenAiLunaAdapter,
} from "./openAiLunaAdapter";

const request = {
  version: 12,
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

const teamInstructions = `${pokepilotCommonInstructions}

${getPokePilotScopeInstructions("team")}`;

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
        prompt_cache_key: "pokepilot-evaluation-core-v1-low",
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
                text: pokepilotCommonInstructions,
                prompt_cache_breakpoint: { mode: "explicit" },
              },
            ],
          },
          {
            type: "message",
            role: "developer",
            content: [
              {
                type: "input_text",
                text: getPokePilotScopeInstructions("team"),
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
        promptVersion: 34,
      },
      usage: {
        totalTokens: 150,
      },
    });
    expect(teamInstructions).toContain(
      "Every proposed Singles lineup must contain exactly three Pokemon",
    );
    expect(teamInstructions).toContain(
      "inspect every unordered pair of filled sets",
    );
    expect(teamInstructions).toContain(
      "Complete two mandatory cross-set passes before assigning the team an archetype",
    );
    expect(teamInstructions).toContain(
      "Group all filled sets by canonical selected move id",
    );
    expect(teamInstructions).toContain(
      "enumerate every ordered active pair",
    );
    expect(teamInstructions).toContain(
      "rank that transformed response rather than treating every owner as interchangeable",
    );
    expect(teamInstructions).toContain(
      "changes a Pokemon's apparent identity or conceals its set",
    );
    expect(teamInstructions).toContain(
      "evaluate denial as the first interpretation",
    );
    expect(teamInstructions).toContain(
      "Trick Room reverses move order within priority brackets",
    );
    expect(teamInstructions).toContain(
      "validityStatus is not valid must not appear in a recommended lineup",
    );
    expect(teamInstructions).toContain(
      "silently simulate the opening turn",
    );
    expect(teamInstructions).toContain(
      "Return a top-level object with analysis and strategyAudit",
    );
    expect(teamInstructions).toContain(
      "Record every concrete cross-set interaction used by analysis",
    );
    expect(teamInstructions).toContain(
      "Every bound move must have a matching action",
    );
    expect(teamInstructions).toContain(
      "Create exactly one recommendationEvidence entry per recommendation",
    );
    expect(teamInstructions).toContain(
      "Resistance is not immunity",
    );
    expect(teamInstructions).not.toMatch(
      /Charm|Contrary|Staraptor|Zoroark|Gardevoir|Round/,
    );
  });

  it("keeps common cache content stable while selecting a scope prompt", async () => {
    const create = vi.fn(
      async (requestOptions: {
        prompt_cache_key: string;
        input: Array<{ content: Array<{ text: string }> }>;
      }) => {
        void requestOptions;
        return {
          id: "resp_pokemon",
          service_tier: "default",
          output_text: JSON.stringify({
            ...groundedModelOutput,
            analysis: { ...modelOutput, scope: "pokemon" },
          }),
          usage: null,
        };
      },
    );
    const adapter = createOpenAiLunaAdapter({
      client: { responses: { create } } as never,
    });
    const pokemonRequest = {
      ...request,
      scope: "pokemon",
    } satisfies CopilotAnalysisRequest;

    await adapter.analyze(pokemonRequest);

    expect(create).toHaveBeenCalledOnce();
    const modelRequest = create.mock.calls[0]![0];
    expect(modelRequest.prompt_cache_key).toBe(
      "pokepilot-evaluation-core-v1-low",
    );
    expect(modelRequest.input[0].content[0].text).toBe(
      pokepilotCommonInstructions,
    );
    expect(modelRequest.input[1].content[0].text).toBe(
      getPokePilotScopeInstructions("pokemon"),
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "resistance still takes damage",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "Create exactly one recommendationEvidence entry per recommendation",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "compare every legal presented teammate on four points",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "Assign each candidate a concrete decision delta",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "Either candidate may win when the supplied facts justify it",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "needs to mention that runner-up only when the tradeoff is materially useful",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "Never add a defensive fact merely to prove that a candidate exists",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "Each named cover partner must have a supplied current or projected-Mega resistance or immunity",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "request.typeLabels maps every canonical defensive type",
    );
    expect(getPokePilotScopeInstructions("pokemon")).toContain(
      "scan the current defensiveProfile of every other supplied set",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "Never name or recommend a Pokemon outside that array",
    );
    expect(getPokePilotScopeInstructions("recommendation")).not.toContain(
      "inspect every unordered pair of filled sets",
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
