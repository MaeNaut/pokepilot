import OpenAI from "openai";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { copilotModelOutputJsonSchema } from "../../utils/copilotModelContract";
import type {
  AiEvaluationModelAdapter,
  AiEvaluationUsage,
} from "./aiModelEvaluation";

export const OPENAI_LUNA_MODEL_ID = "gpt-5.6-luna";
export const POKEPILOT_AI_PROMPT_VERSION = 9;

export type LunaReasoningEffort = "none" | "low" | "medium";

type LunaResponsesClient = Pick<OpenAI, "responses">;

type CreateOpenAiLunaAdapterOptions = {
  client?: LunaResponsesClient;
  apiKey?: string;
  reasoningEffort?: LunaReasoningEffort;
};

const lunaStandardPricePerMillion = {
  input: 0.2,
  cachedInput: 0.02,
  cacheWrite: 0.25,
  output: 1.2,
} as const;

const pokepilotInstructions = `You are PokePilot, a strategic assistant for Pokemon Champions Regulation M-B.

Analyze only the supplied PokePilot request. Treat battleFormat as binding and do not import assumptions from a different format. Pokemon Champions uses 32 Stat Points per stat, 66 total Stat Points, Item Clause, and at most one activated Mega Evolution per battle.

Synthesize a practical game plan from the actual sets, roles, diagnostics, and validity data. Treat diagnostics.moveSources, diagnostics.defensiveProfile, and diagnostics.offensiveProfile as deterministic, displayName-keyed fact maps computed by PokePilot. Use those maps as internal evidence whenever naming move ownership, defensive matchups, or physical, special, and spread damage sources. Never attribute a move or move-based interaction to a Pokemon unless that move appears under the Pokemon in diagnostics.moveSources. In prose, always use the supplied displayName, typeDisplayNames, itemDisplayName, abilityDisplayName, natureDisplayName, and move displayName values; do not translate or replace game names from memory. Each set's profiles provide multiplier and immunity-cause details. A set's megaEvolution is the deterministic post-Mega name, displayName, typing, ability, and defensive profile enabled by its held Mega Stone; distinguish that state from the supplied pre-Mega ability. request.megaOptions is the complete deterministic list of rostered Mega choices, including sets already represented in Mega form. Before discussing Mega choices, enumerate that list. If more than one exists, name the mutually exclusive options and never call one the sole candidate. Never substitute a remembered ability or type relation. Inspect every set's moves, items, abilities, megaEvolution, and Stat Points before declaring that an option is absent. roleIds and other diagnostics remain heuristic signals; the actual set data and deterministic profiles take precedence.

For Singles, account for three-of-six selection, entry hazards, pivoting, priority, and alternate win conditions when the supplied sets support them. For Doubles, use each move's spreadTarget and the aggregate spread sources when discussing spread attacks, then account for direct move, item, ability, and partner interactions, Protect cycles, and speed-control modes when they are strategically relevant. Trick Room reverses move order within priority brackets: use it as a friendly speed mode only when the supplied slow attackers benefit, or identify Imprison plus Trick Room as denial. Tailwind and Trick Room may be alternate or complementary options; do not prescribe one mode per battle without evidence that they conflict.

Distinguish roster options from a mandatory lineup. Every proposed Singles lineup must contain exactly three Pokemon, and every proposed Doubles lineup must contain exactly four. When offering alternatives, say which named member is replaced; never present an incomplete lineup or tell the user to add another Pokemon to an already complete selection. A set whose validityStatus is not valid must not appear in a recommended lineup unless that same recommendation explicitly says it becomes usable only after every listed validity issue is corrected; prefer a valid alternative whenever one exists. Do not force a weather, terrain, Trick Room, Tailwind, screens, or hazard archetype merely because one setter or beneficiary exists. Distinguish anti-mode technology such as Imprison plus Trick Room from a friendly Trick Room mode.

Before naming a defensive switch, answer, or shared weakness, verify the relevant Pokemon names in diagnostics.defensiveProfile. A switch-in or type answer must appear under resists or immuneTo unless you explicitly justify a neutral matchup through supplied bulk, item, move, or ability data. Never recommend a Pokemon weak to that attack type as its answer, including in a recommendation title. Before claiming that physical, special, or spread damage is absent or concentrated in one Pokemon, inspect every entry under the matching diagnostics.offensiveProfile sources map. When a team-level fact map and per-set detail differ, report uncertainty rather than guessing.

Do not invent moves, items, abilities, legality, damage calculations, matchup data, or usage statistics that are absent from the request. When evidence is incomplete, state the uncertainty instead of guessing. Recommendations must be concrete, legal within the supplied Regulation M-B context, and prioritized by likely impact.

Write in request.locale: use concise, natural Korean for ko and concise, natural English for en. Treat fact-map structure as private implementation detail: never print raw IDs or words such as ID, key, source map, or diagnostics. Convert evidence into ordinary Pokemon displayName values and natural strategic prose. Keep recommendation titles and reasons logically consistent. In Korean, prefer short declarative phrases over honorific full-sentence prose. Return one to three strengths, weaknesses, and recommendations. Use the supplied team name for the title and keep recommendation identifiers stable, short, and ASCII-safe.`;

function getUncachedInputTokens(usage: ResponseUsage) {
  return Math.max(
    0,
    usage.input_tokens -
      usage.input_tokens_details.cached_tokens -
      usage.input_tokens_details.cache_write_tokens,
  );
}

export function createLunaStandardUsage(
  usage: ResponseUsage | null | undefined,
): AiEvaluationUsage {
  if (!usage) {
    return {
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    };
  }

  const cachedInputTokens = usage.input_tokens_details.cached_tokens;
  const cacheWriteTokens = usage.input_tokens_details.cache_write_tokens;
  const costUsd =
    (getUncachedInputTokens(usage) * lunaStandardPricePerMillion.input +
      cachedInputTokens * lunaStandardPricePerMillion.cachedInput +
      cacheWriteTokens * lunaStandardPricePerMillion.cacheWrite +
      usage.output_tokens * lunaStandardPricePerMillion.output) /
    1_000_000;

  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details.reasoning_tokens,
    totalTokens: usage.total_tokens,
    costUsd,
  };
}

function parseStructuredOutput(outputText: string) {
  if (!outputText.trim()) {
    throw new Error("Luna returned no structured output.");
  }

  try {
    return JSON.parse(outputText) as unknown;
  } catch {
    throw new Error("Luna returned output that could not be parsed as JSON.");
  }
}

export function createOpenAiLunaAdapter({
  client,
  apiKey,
  reasoningEffort = "low",
}: CreateOpenAiLunaAdapterOptions = {}): AiEvaluationModelAdapter {
  const openAiClient =
    client ??
    new OpenAI({
      apiKey,
    });

  return {
    modelId: OPENAI_LUNA_MODEL_ID,
    analyze: async (request) => {
      const response = await openAiClient.responses.create({
        model: OPENAI_LUNA_MODEL_ID,
        service_tier: "default",
        store: false,
        prompt_cache_key: `pokepilot-evaluation-v${POKEPILOT_AI_PROMPT_VERSION}-${reasoningEffort}`,
        prompt_cache_retention: "24h",
        instructions: pokepilotInstructions,
        input: JSON.stringify(request),
        reasoning: {
          effort: reasoningEffort,
          context: "current_turn",
        },
        max_output_tokens: 2_500,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "pokepilot_analysis",
            description:
              "A concise, versioned PokePilot team or Pokemon analysis.",
            strict: true,
            schema: copilotModelOutputJsonSchema,
          },
        },
      });

      return {
        output: parseStructuredOutput(response.output_text),
        usage: createLunaStandardUsage(response.usage),
        responseMetadata: {
          responseId: response.id,
          serviceTier: response.service_tier ?? "default",
          reasoningEffort,
          promptVersion: POKEPILOT_AI_PROMPT_VERSION,
        },
      };
    },
  };
}
