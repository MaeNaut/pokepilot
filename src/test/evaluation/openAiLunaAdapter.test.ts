import { describe, expect, it, vi } from "vitest";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { copilotGroundedModelOutputJsonSchema } from "../../utils/copilotModelSchema";
import {
  analyzeWithOpenAiLuna,
  getPokePilotLocaleInstructions,
  getPokePilotScopeInstructions,
  pokepilotCommonInstructions,
} from "../../../server/openAiLuna";
import {
  createCopilotTypeLabels,
  type CopilotAnalysisRequest,
} from "../../utils/copilotAnalysis";
import { createCopilotResponsibilityCounts } from "../../utils/copilotResponsibilities";
import {
  createLunaStandardUsage,
  createOpenAiLunaAdapter,
} from "./openAiLunaAdapter";

const request = {
  version: 28,
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

const teamInstructions = `${pokepilotCommonInstructions}

${getPokePilotScopeInstructions("team")}`;

const modelOutput = {
  version: 2,
  scope: "team",
  title: "Test Team",
  paragraphs: ["This is a complete analysis paragraph."],
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

describe("OpenAI Luna evaluation adapter", () => {
  it.each(["team", "pokemon", "recommendation", "optimization", "matchup"] as const)(
    "keeps the original output schema and shared cache key for %s", async (scope) => {
      const create = vi.fn(async () => ({ output_text: JSON.stringify(groundedModelOutput) }));
      const result = await analyzeWithOpenAiLuna({ ...request, scope }, {
        client: { responses: { create } } as never,
      });
      expect(result.output).toEqual(groundedModelOutput);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        prompt_cache_key: "pokepilot-production-core-v4-low",
        text: expect.objectContaining({ format: expect.objectContaining({
          schema: copilotGroundedModelOutputJsonSchema,
        }) }),
      }));
    },
  );
  it("rejects a missing current-sample card just like the production validator", async () => {
    const create = vi.fn(async () => ({
      id: "resp_empty_optimization", service_tier: "default",
      output_text: JSON.stringify({ ...groundedModelOutput,
        analysis: { ...modelOutput, scope: "optimization" },
      }),
    }));
    const result = await createOpenAiLunaAdapter({
      client: { responses: { create } } as never,
    }).analyze({ ...request, scope: "optimization", optimization: {
      candidates: [{ id: "set-current", offenseBenchmarks: [], defenseBenchmarks: [],
        speedBenchmark: { current: {}, optimized: {} } }],
    } } as unknown as CopilotAnalysisRequest);
    expect(result.output).toBeNull();
    expect(result.validationErrors).toContain("Hosted optimization returned an invalid candidate list.");
    expect(result.debugOutput).toBeDefined();
  });
  it("forwards a privacy-preserving safety identifier when supplied", async () => {
    const create = vi.fn(async () => ({
      id: "resp_safety_identifier",
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
    }));

    await analyzeWithOpenAiLuna(request, {
      client: {
        responses: {
          create,
        },
      } as never,
      safetyIdentifier: "anonymous-client-a",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        safety_identifier: "anonymous-client-a",
      }),
    );
  });

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
        prompt_cache_key: "pokepilot-evaluation-core-v4-low",
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
            role: "developer",
            content: [
              {
                type: "input_text",
                text: getPokePilotLocaleInstructions("ko"),
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
        promptVersion: 81,
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
      "unless priority, effective Speed, and the field state",
    );
    expect(teamInstructions).toContain(
      "Trick Room ordering applies only after Trick Room resolves",
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
      "pokepilot-evaluation-core-v4-low",
    );
    expect(modelRequest.input[0].content[0].text).toBe(
      pokepilotCommonInstructions,
    );
    expect(modelRequest.input[1].content[0].text).toBe(
      getPokePilotScopeInstructions("pokemon"),
    );
    expect(modelRequest.input[2].content[0].text).toBe(
      getPokePilotLocaleInstructions("ko"),
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
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "create at least two minimal candidateFacts",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "one concrete fit fact and one concrete tradeoff fact",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "For addition mode, rank exactly three unique candidates",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "return an empty recommendations array when no supplied exchange is clearly worthwhile",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "Every replacement recommendation must name target.currentDisplayName",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "scan its exact supplied ability and common-move display names",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "must name at least one exact supplied commonSet ability or move",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "reconstruct the current team's central game plan",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "Complete three private passes",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "diagnostics.responsibilityCounts",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "weak-to to weakTo",
    );
    expect(getPokePilotScopeInstructions("recommendation")).toContain(
      "Use responsibility only for an exact candidate.responsibilityIds value",
    );
    expect(getPokePilotScopeInstructions("recommendation")).not.toContain(
      "inspect every unordered pair of filled sets",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "evaluated in both directions",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "usage means it came from the observed high-usage move list",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "When it does not appear in moveChanges, it is calculation-only evidence",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "look up both move ids in optimization.moveMechanics",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Infer each move's offensive and strategic responsibilities directly",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Complete a mandatory replacement-slot audit",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "compare every supplied slot sibling",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "rather than a fixed list",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "whose type, category, target, and strategic purpose overlap with it most",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "generic stability or unchanged-results language is insufficient",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "chance-based secondary effect alone is not enough",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Preserve the set's only supplied spread-target attack",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Do not discard a deterministic utility effect or STAB attack",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "do not translate them back into English competitive jargon",
    );
    expect(getPokePilotScopeInstructions("optimization")).not.toContain(
      "currentResponsibilityIds",
    );
    expect(getPokePilotScopeInstructions("optimization")).not.toContain(
      "roleLossCost",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "candidate.itemChanged states whether the held item differs",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Return one to three unique, genuinely useful",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Do not fill three slots merely because three candidates are available",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Evaluate each candidate as one complete set",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "a meaningfully higher koChance or oneHitKoChance is still a real probabilistic gain",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "minimum Stat Points that reach each supplied probability boundary",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "while also retaining alternatives that keep more of the starting investment",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "it is a comparison baseline, not a user-locked constraint",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Maximum Speed investment together with a Speed-raising nature",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "already preserves a full-HP user from a one-hit knockout",
    );
    expect(getPokePilotScopeInstructions("optimization")).not.toContain(
      "Prefer reallocating unnecessary offense",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "optimizedVsCurrent is the calculator's authoritative comparison",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "candidate.maxedStats is the exact list",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Never describe a lower defensive hit count as an improvement",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "do not establish move frequency",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "must outrank an otherwise equivalent candidate that raises it",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "A priority move alone is not evidence",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "A Speed tie is nondeterministic",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "candidate.profiles records verified outcome shapes",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "never copy an id or the English word breakpoint",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "selecting at least one from each profile is required",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "general reserve bulk",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Omit unrelated whole-team coverage",
    );
    expect(getPokePilotScopeInstructions("optimization")).toContain(
      "Do not repeat any exact damage percentage, hit-count classification",
    );
  });

  it("uses one explicit output language without adding Hangul to English prompts", () => {
    const englishInstructions = getPokePilotLocaleInstructions("en");
    const koreanInstructions = getPokePilotLocaleInstructions("ko");

    expect(englishInstructions).toContain("English only");
    expect(englishInstructions).not.toMatch(/[\uac00-\ud7a3]/u);
    expect(koreanInstructions).toContain("Korean only");
    expect(koreanInstructions).toContain("확정 N타");
    expect(koreanInstructions).toContain("polite honorific prose");
    expect(koreanInstructions).toContain("-습니다");
    expect(koreanInstructions).toContain("branch as 선택지");
    expect(koreanInstructions).toContain("role as 역할");
    expect(koreanInstructions).not.toContain("English only");
    expect(pokepilotCommonInstructions).toContain(
      "title, paragraphs, and recommendations",
    );
    expect(pokepilotCommonInstructions).toContain(
      "instead of separately labeled strengths, weaknesses, checks",
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
