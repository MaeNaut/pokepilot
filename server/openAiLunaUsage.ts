import type { ResponseUsage } from "openai/resources/responses/responses";

export type LunaUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
};

const lunaStandardPricePerMillion = {
  input: 0.2,
  cachedInput: 0.02,
  cacheWrite: 0.25,
  output: 1.2,
} as const;

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
  modelId = "gpt-6-luna",
): LunaUsage {
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
  const price = modelId === "gpt-6-luna"
    ? usage.input_tokens > 272_000
      ? { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 0.75 }
      : { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 }
    : modelId === "gpt-5.6-terra"
    ? { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12 }
    : modelId === "gpt-5.6-sol"
      ? { input: 4, cachedInput: 0.4, cacheWrite: 5, output: 20 }
      : lunaStandardPricePerMillion;
  const costUsd =
    (getUncachedInputTokens(usage) * price.input +
      cachedInputTokens * price.cachedInput +
      cacheWriteTokens * price.cacheWrite +
      usage.output_tokens * price.output) /
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
