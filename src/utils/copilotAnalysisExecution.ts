import { requestHostedCopilotAnalysis } from "../api/copilotApi";
import type { CopilotAnalysisRequest, CopilotAnalysisResponse } from "./copilotContracts";

export async function executeCopilotAnalysis(
  request: CopilotAnalysisRequest,
  reasoningEffort: "low" | "medium" = "low",
  modelId: "gpt-6-luna" | "gpt-6-sol" = "gpt-6-luna",
) {
  let nextResponse: CopilotAnalysisResponse;

  const hostedResult = await requestHostedCopilotAnalysis(request, undefined, reasoningEffort, modelId);
  nextResponse = hostedResult.qualityWarnings?.length
    ? {
        ...hostedResult.analysis,
        qualityWarnings: hostedResult.qualityWarnings,
      }
    : hostedResult.analysis;

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
