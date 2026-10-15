import { Tiktoken } from "js-tiktoken/lite";
import o200kBase from "js-tiktoken/ranks/o200k_base";
import { createPokePilotPromptParts } from "../../server/pokepilotPromptParts";
import { createLunaStandardUsage } from "../../server/openAiLunaUsage";
import type { CopilotAnalysisRequest } from "./copilotContracts";
import { copilotGroundedModelOutputJsonSchema } from "./copilotModelSchema";
import type { CopilotEstimate } from "./copilotEstimate";
import { copilotEstimateProfiles } from "./copilotEstimateProfiles";

const tokenizer = new Tiktoken(o200kBase);
const count = (text: string) => tokenizer.encode(text, [], []).length;

export function calculateCopilotEstimate(
  request: CopilotAnalysisRequest,
  effort: "low" | "medium",
): CopilotEstimate | null {
  if (request.scope === "matchup" || !request.sets.length) return null;
  const prompt = createPokePilotPromptParts(request);
  // Local encoding plus message framing is an estimate, not provider billing.
  const inputTokens = Object.values(prompt).reduce((sum, text) => sum + count(text), 0)
    + count(JSON.stringify(copilotGroundedModelOutputJsonSchema)) + 4 * 4 + 3;
  const cachePrefixTokens = count(prompt.common) + count(prompt.scope);
  const profile = copilotEstimateProfiles[effort][request.scope][request.battleFormat];
  const memberRatio = Math.min(1.2, request.sets.length / profile.members);
  const outputScale = request.scope === "team" ? 0.5 + memberRatio * 0.5 : 0.8 + memberRatio * 0.2;
  const outputLimit = effort === "medium" ? 16000 : 8000;
  // Sparse historical samples need a generous margin; this is not an SLA.
  const output = [
    Math.round(profile.output[0] * outputScale * 0.75),
    Math.min(outputLimit, Math.round(profile.output[1] * outputScale * 1.5)),
  ];
  const timeScale = 0.15 * inputTokens / profile.input + 0.85 * outputScale;
  const seconds: [number, number] = [
    Math.max(1, Math.floor(profile.seconds[0] * timeScale * 0.75)),
    Math.max(2, Math.ceil(profile.seconds[1] * timeScale * 1.5)),
  ];
  const cost = (outputTokens: number, cacheWriteTokens: number) => createLunaStandardUsage({
    input_tokens: inputTokens,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: cacheWriteTokens },
    output_tokens: outputTokens,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: inputTokens + outputTokens,
  }).costUsd;
  return {
    inputTokens,
    totalTokens: [inputTokens + output[0], inputTokens + output[1]],
    seconds,
    costUsd: [cost(output[0], 0), cost(output[1], Math.min(inputTokens, cachePrefixTokens))],
  };
}
