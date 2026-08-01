import type { CopilotModelOutput } from "../src/utils/copilotModelContract";
import { validateCopilotModelOutput } from "../src/utils/copilotModelContract";
import { validateCopilotAnalysisRequest } from "../src/utils/copilotRequestContract";
import {
  analyzeWithOpenAiLuna,
  OPENAI_LUNA_MODEL_ID,
  POKEPILOT_AI_PROMPT_VERSION,
  type LunaAnalysisResult,
} from "./openAiLuna";

export const POKEPILOT_API_MAX_BODY_BYTES = 256_000;

export type PokePilotApiErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_REQUEST"
  | "AI_NOT_CONFIGURED"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_RESPONSE"
  | "AI_UPSTREAM_ERROR";

export type PokePilotApiResponse =
  | {
      ok: true;
      analysis: CopilotModelOutput;
      metadata: {
        model: typeof OPENAI_LUNA_MODEL_ID;
        promptVersion: number;
      };
    }
  | {
      ok: false;
      error: {
        code: PokePilotApiErrorCode;
        message: string;
      };
    };

export type PokePilotApiResult = {
  status: number;
  body: PokePilotApiResponse;
};

type AnalyzeRequest = (
  request: Parameters<typeof analyzeWithOpenAiLuna>[0],
) => Promise<LunaAnalysisResult>;

type HandlePokePilotAnalysisOptions = {
  analyze?: AnalyzeRequest;
  apiKey?: string;
  onUpstreamError?: (error: unknown) => void;
};

function errorResult(
  status: number,
  code: PokePilotApiErrorCode,
  message: string,
): PokePilotApiResult {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
}

function getUpstreamStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

export async function handlePokePilotAnalysis(
  value: unknown,
  { analyze, apiKey, onUpstreamError }: HandlePokePilotAnalysisOptions = {},
): Promise<PokePilotApiResult> {
  const requestValidation = validateCopilotAnalysisRequest(value);
  if (!requestValidation.success) {
    return errorResult(
      400,
      "INVALID_REQUEST",
      requestValidation.errors.join(" "),
    );
  }

  if (!analyze && !apiKey) {
    return errorResult(
      503,
      "AI_NOT_CONFIGURED",
      "Hosted analysis is not configured.",
    );
  }

  try {
    const result = analyze
      ? await analyze(requestValidation.data)
      : await analyzeWithOpenAiLuna(requestValidation.data, {
          apiKey,
          cacheNamespace: "production",
          reasoningEffort: "low",
        });
    const outputValidation = validateCopilotModelOutput(result.output);

    if (
      !outputValidation.success ||
      outputValidation.data.scope !== requestValidation.data.scope
    ) {
      return errorResult(
        502,
        "AI_INVALID_RESPONSE",
        "Hosted analysis returned an invalid response.",
      );
    }

    return {
      status: 200,
      body: {
        ok: true,
        analysis: outputValidation.data,
        metadata: {
          model: OPENAI_LUNA_MODEL_ID,
          promptVersion: POKEPILOT_AI_PROMPT_VERSION,
        },
      },
    };
  } catch (error) {
    onUpstreamError?.(error);

    if (getUpstreamStatus(error) === 429) {
      return errorResult(
        429,
        "AI_RATE_LIMITED",
        "Hosted analysis is temporarily rate limited.",
      );
    }

    return errorResult(
      502,
      "AI_UPSTREAM_ERROR",
      "Hosted analysis is temporarily unavailable.",
    );
  }
}
