import type OpenAI from "openai";
import {
  analyzeWithOpenAiLuna,
  createLunaStandardUsage,
  OPENAI_LUNA_MODEL_ID,
  POKEPILOT_AI_PROMPT_VERSION,
  type LunaReasoningEffort,
} from "../../../server/openAiLuna";
import type { AiEvaluationModelAdapter } from "./aiModelEvaluation";

type LunaResponsesClient = Pick<OpenAI, "responses">;

type CreateOpenAiLunaAdapterOptions = {
  client?: LunaResponsesClient;
  apiKey?: string;
  reasoningEffort?: LunaReasoningEffort;
};

export {
  createLunaStandardUsage,
  OPENAI_LUNA_MODEL_ID,
  POKEPILOT_AI_PROMPT_VERSION,
};
export type { LunaReasoningEffort };

export function createOpenAiLunaAdapter({
  client,
  apiKey,
  reasoningEffort = "low",
}: CreateOpenAiLunaAdapterOptions = {}): AiEvaluationModelAdapter {
  return {
    modelId: OPENAI_LUNA_MODEL_ID,
    analyze: (request) =>
      analyzeWithOpenAiLuna(request, {
        client,
        apiKey,
        cacheNamespace: "evaluation",
        reasoningEffort,
      }),
  };
}
