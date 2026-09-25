import { CopilotApiError, requestHostedCopilotAnalysis } from "../api/copilotApi";
import type { CopilotAnalysisRequest, CopilotAnalysisResponse } from "./copilotContracts";

export async function executeCopilotAnalysis(
  request: CopilotAnalysisRequest,
  onCooldown: (seconds: number) => void,
  reasoningEffort: "low" | "medium" = "low",
  modelId: "gpt-6-luna" | "gpt-6-sol" = "gpt-6-luna",
) {
  let nextResponse: CopilotAnalysisResponse;

  try {
    const hostedResult = await requestHostedCopilotAnalysis(request, undefined, reasoningEffort, modelId);
    nextResponse = hostedResult.qualityWarnings?.length
      ? {
          ...hostedResult.analysis,
          qualityWarnings: hostedResult.qualityWarnings,
        }
      : hostedResult.analysis;
    if (hostedResult.retryAfterSeconds) {
      onCooldown(hostedResult.retryAfterSeconds);
    }
  } catch (error) {
    if (
      error instanceof CopilotApiError &&
      error.retryAfterSeconds
    ) {
      onCooldown(error.retryAfterSeconds);
    }
    throw error;
  }

  if (
    (request.scope === "optimization" || request.scope === "matchup") &&
    request.optimization
  ) {
    const selectedCandidateIds = new Set(
      nextResponse.recommendations.map((recommendation) => recommendation.id),
    );
    nextResponse = {
      ...nextResponse,
      optimizationCandidates: request.optimization.candidates.filter(
        (candidate) => selectedCandidateIds.has(candidate.id),
      ),
    };
  }

  return { response: nextResponse, usedFallback: false, fallbackReason: undefined };
}
