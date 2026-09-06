import type { CopilotAnalysisRequest } from "../src/utils/copilotContracts.js";
import { validateCopilotGroundedModelOutput } from "../src/utils/copilotModelValidation.js";
import type { CopilotModelOutput } from "../src/utils/copilotModelTypes.js";
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

function validateOptimizationIds(
  analysis: CopilotModelOutput,
  request: CopilotAnalysisRequest,
) {
  if (request.scope !== "optimization") {
    return;
  }

  const candidateIds = new Set(
    request.optimization?.candidates.map((candidate) => candidate.id) ?? [],
  );
  const recommendationIds = analysis.recommendations.map(
    (recommendation) => recommendation.id,
  );
  const hasInvalidRecommendationList =
    recommendationIds.length < 1 ||
    recommendationIds.length > Math.min(3, candidateIds.size) ||
    new Set(recommendationIds).size !== recommendationIds.length ||
    recommendationIds.some((id) => !candidateIds.has(id));

  if (hasInvalidRecommendationList) {
    throw invalidAnalysis(
      "Hosted optimization returned an invalid candidate list.",
    );
  }
}

const optimizationOutcomePattern = new RegExp(
  [
    String.raw`\d+(?:\.\d+)?\s*%`,
    String.raw`(?:확정\s*)?\d+(?:\s*[-~–]\s*\d+)?\s*타`,
    String.raw`\b(?:OHKO|\d+\s*HKO)\b`,
    String.raw`\b(?:guaranteed|possible)\s+(?:(?:one|two|three|four|five|six|seven|eight|nine|ten)[- ]?)?(?:hit|hits|HKO)\b`,
    String.raw`\bKO\s*(?:chance|odds|probability)\b`,
    String.raw`(?:KO|기절)\s*(?:확률|가능성)`,
  ].join("|"),
  "iu",
);

function removeRepeatedOptimizationOutcomes(value: string) {
  const sentences = value.split(/(?<=[.!?。])\s+/u);

  return sentences
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence.length > 0 && !optimizationOutcomePattern.test(sentence),
    )
    .join(" ")
    .trim();
}

function sanitizeOptimizationNarrative(
  analysis: CopilotModelOutput,
  request: CopilotAnalysisRequest,
): CopilotModelOutput {
  if (request.scope !== "optimization") return analysis;

  const isKorean = request.locale === "ko";
  const fallbackSummary = isKorean
    ? "표시된 계산 결과와 현재 팀 역할을 함께 고려한 상대 조정이다."
    : "This matchup tuning weighs the displayed calculator results against the set's current team role.";
  const fallbackTitle = isKorean
    ? "검증된 상대 조정"
    : "Verified matchup option";
  const fallbackReason = isKorean
    ? "카드에 표시된 계산 결과와 나머지 능력치의 균형을 고려한 선택이다."
    : "This option balances the calculator results shown on the card with the remaining stats.";
  const sanitizedSummary = removeRepeatedOptimizationOutcomes(
    analysis.summary,
  );

  return {
    ...analysis,
    summary: sanitizedSummary || fallbackSummary,
    playstyle:
      removeRepeatedOptimizationOutcomes(analysis.playstyle) ||
      (isKorean ? "정확한 상대 조정" : "Exact matchup tuning"),
    strengths: analysis.strengths
      .map(removeRepeatedOptimizationOutcomes)
      .filter(Boolean),
    weaknesses: analysis.weaknesses
      .map(removeRepeatedOptimizationOutcomes)
      .filter(Boolean),
    recommendations: analysis.recommendations.map((recommendation) => ({
      ...recommendation,
      title:
        removeRepeatedOptimizationOutcomes(recommendation.title) ||
        fallbackTitle,
      reason:
        removeRepeatedOptimizationOutcomes(recommendation.reason) ||
        fallbackReason,
    })),
  };
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
  validateOptimizationIds(groundedOutput.analysis, request);

  const strategyAuditErrors = validateCopilotStrategyAuditForRequest(
    groundedOutput,
    request,
  );

  if (strategyAuditErrors.length > 0) {
    throw invalidAnalysis("Hosted analysis returned an invalid response.");
  }

  return sanitizeOptimizationNarrative(groundedOutput.analysis, request);
}
