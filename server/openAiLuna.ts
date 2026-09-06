import OpenAI from "openai";
import type { CopilotAnalysisRequest } from "../src/utils/copilotContracts.js";
import { copilotGroundedModelOutputJsonSchema } from "../src/utils/copilotModelSchema.js";
import {
  getPokePilotLocaleInstructions,
  getPokePilotScopeInstructions,
  POKEPILOT_AI_CORE_PROMPT_VERSION,
  POKEPILOT_AI_PROMPT_VERSION,
  pokepilotCommonInstructions,
} from "./pokepilotPrompts.js";
import {
  createLunaStandardUsage,
  type LunaUsage,
} from "./openAiLunaUsage.js";

export {
  getPokePilotLocaleInstructions,
  getPokePilotScopeInstructions,
  POKEPILOT_AI_PROMPT_VERSION,
  pokepilotCommonInstructions,
} from "./pokepilotPrompts.js";
export {
  createLunaStandardUsage,
  type LunaUsage,
} from "./openAiLunaUsage.js";

export const OPENAI_LUNA_MODEL_ID = "gpt-5.6-luna";
const POKEPILOT_AI_MAX_OUTPUT_TOKENS = 3_500;

export type LunaReasoningEffort = "none" | "low" | "medium";
export const POKEPILOT_AI_DEFAULT_REASONING_EFFORT: LunaReasoningEffort =
  "low";

export type LunaAnalysisResult = {
  output: unknown;
  usage: LunaUsage;
  responseMetadata: {
    responseId: string;
    serviceTier: string;
    reasoningEffort: LunaReasoningEffort;
    promptVersion: number;
  };
};

export class LunaStructuredOutputError extends Error {
  constructor(
    message: string,
    readonly usage: LunaUsage,
    readonly responseMetadata: LunaAnalysisResult["responseMetadata"],
  ) {
    super(message);
    this.name = "LunaStructuredOutputError";
  }
}

type LunaResponsesClient = Pick<OpenAI, "responses">;

type AnalyzeWithOpenAiLunaOptions = {
  client?: LunaResponsesClient;
  apiKey?: string;
  cacheNamespace?: "evaluation" | "production";
  reasoningEffort?: LunaReasoningEffort;
  safetyIdentifier?: string;
};

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

export async function analyzeWithOpenAiLuna(
  request: CopilotAnalysisRequest,
  {
    client,
    apiKey,
    cacheNamespace = "production",
    reasoningEffort = POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
    safetyIdentifier,
  }: AnalyzeWithOpenAiLunaOptions = {},
): Promise<LunaAnalysisResult> {
  const openAiClient =
    client ??
    new OpenAI({
      apiKey,
      maxRetries: 1,
      timeout: 60_000,
    });
  const response = await openAiClient.responses.create({
    model: OPENAI_LUNA_MODEL_ID,
    service_tier: "default",
    store: false,
    ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
    prompt_cache_key: `pokepilot-${cacheNamespace}-core-v${POKEPILOT_AI_CORE_PROMPT_VERSION}-${reasoningEffort}`,
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
            text: getPokePilotScopeInstructions(request.scope),
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
            text: getPokePilotLocaleInstructions(request.locale),
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
      effort: reasoningEffort,
      context: "current_turn",
    },
    max_output_tokens: POKEPILOT_AI_MAX_OUTPUT_TOKENS,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "pokepilot_grounded_analysis",
        description:
          "A concise PokePilot analysis with a private, machine-verifiable strategy audit.",
        strict: true,
        schema: copilotGroundedModelOutputJsonSchema,
      },
    },
  });

  const usage = createLunaStandardUsage(response.usage);
  const responseMetadata = {
    responseId: response.id,
    serviceTier: response.service_tier ?? "default",
    reasoningEffort,
    promptVersion: POKEPILOT_AI_PROMPT_VERSION,
  };
  let output: unknown;

  try {
    output = parseStructuredOutput(response.output_text);
  } catch (error) {
    throw new LunaStructuredOutputError(
      error instanceof Error ? error.message : "Luna returned invalid output.",
      usage,
      responseMetadata,
    );
  }

  return {
    output,
    usage,
    responseMetadata,
  };
}
