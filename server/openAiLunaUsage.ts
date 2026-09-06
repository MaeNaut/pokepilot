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
