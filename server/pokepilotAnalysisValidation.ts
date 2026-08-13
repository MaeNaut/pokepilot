import type { CopilotAnalysisRequest } from "../src/utils/copilotAnalysis.js";
import {
  validateCopilotGroundedModelOutput,
  type CopilotModelOutput,
} from "../src/utils/copilotModelContract.js";
import {
  completeCopilotStrategyAudit,
  validateCopilotStrategyAuditForRequest,
} from "../src/utils/copilotStrategyAudit.js";

function invalidAnalysis(message: string): Error & {
  code: "AI_INVALID_RESPONSE";
} {
  return Object.assign(new Error(message), {
    code: "AI_INVALID_RESPONSE" as const,
  });
}

function validateRecommendationIds(
  analysis: CopilotModelOutput,
  request: CopilotAnalysisRequest,
) {
  if (request.scope !== "recommendation") {
    return;
  }

  const candidateIds = new Set(
    request.recommendationCandidates.map((candidate) => candidate.pokemonId),
  );
  const recommendationIds = analysis.recommendations.map(
    (recommendation) => recommendation.id,
  );
  const expectedMinimum = Math.min(3, candidateIds.size);
  const hasInvalidRecommendationList =
    recommendationIds.length < expectedMinimum ||
    recommendationIds.length > 3 ||
    new Set(recommendationIds).size !== recommendationIds.length ||
    recommendationIds.some((id) => !candidateIds.has(id));

  if (hasInvalidRecommendationList) {
    throw invalidAnalysis(
      "Hosted recommendation returned an invalid candidate list.",
    );
  }
}

export function validateHostedCopilotAnalysis(
  output: unknown,
  request: CopilotAnalysisRequest,
): CopilotModelOutput {
  const outputValidation = validateCopilotGroundedModelOutput(output);

  if (
    !outputValidation.success ||
    outputValidation.data.analysis.scope !== request.scope
  ) {
    throw invalidAnalysis("Hosted analysis returned an invalid response.");
  }

  const groundedOutput = completeCopilotStrategyAudit(
    outputValidation.data,
    request,
  );
  validateRecommendationIds(groundedOutput.analysis, request);

  const strategyAuditErrors = validateCopilotStrategyAuditForRequest(
    groundedOutput,
    request,
  );

  if (strategyAuditErrors.length > 0) {
    throw invalidAnalysis("Hosted analysis returned an invalid response.");
  }

  return groundedOutput.analysis;
}
