import type OpenAI from "openai";
import {
  analyzeWithOpenAiLuna,
  createLunaStandardUsage,
  LunaStructuredOutputError,
  OPENAI_LUNA_MODEL_ID,
  POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
  POKEPILOT_AI_PROMPT_VERSION,
  type LunaReasoningEffort,
} from "../../../server/openAiLuna";
import { validateCopilotGroundedModelOutput } from "../../utils/copilotModelContract";
import {
  completeCopilotStrategyAudit,
  validateCopilotStrategyAuditForRequest,
} from "../../utils/copilotStrategyAudit";
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
  reasoningEffort = POKEPILOT_AI_DEFAULT_REASONING_EFFORT,
}: CreateOpenAiLunaAdapterOptions = {}): AiEvaluationModelAdapter {
  return {
    modelId: OPENAI_LUNA_MODEL_ID,
    analyze: async (request) => {
      let result;

      try {
        result = await analyzeWithOpenAiLuna(request, {
          client,
          apiKey,
          cacheNamespace: "evaluation",
          reasoningEffort,
        });
      } catch (error) {
        if (error instanceof LunaStructuredOutputError) {
          return {
            output: null,
            validationErrors: [error.message],
            usage: error.usage,
            responseMetadata: error.responseMetadata,
          };
        }

        throw error;
      }
      const outputValidation = validateCopilotGroundedModelOutput(result.output);

      if (!outputValidation.success) {
        return {
          ...result,
          output: null,
          debugOutput: result.output,
          validationErrors: outputValidation.errors,
        };
      }

      const groundedOutput = completeCopilotStrategyAudit(
        outputValidation.data,
        request,
      );
      const strategyAuditErrors = validateCopilotStrategyAuditForRequest(
        groundedOutput,
        request,
      );

      if (strategyAuditErrors.length > 0) {
        return {
          ...result,
          output: null,
          debugOutput: groundedOutput,
          validationErrors: strategyAuditErrors,
        };
      }

      return {
        ...result,
        output: groundedOutput.analysis,
        debugOutput: groundedOutput,
      };
    },
  };
}
