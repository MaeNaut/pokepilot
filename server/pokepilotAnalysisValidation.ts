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

function verifiedOptimizationReason(id: string, request: CopilotAnalysisRequest) {
  const candidate = request.optimization?.candidates.find((entry) => entry.id === id);
  const ko = request.locale === "ko";
  if (id === "set-current") {
    return ko
      ? "현재 샘플의 화력, 스피드와 내구를 그대로 유지하는 선택입니다. 확인한 조정안의 이득과 기존 성능을 바꾸는 비용을 비교할 수 있으며, 다른 상대까지 검증한 결과는 아닙니다."
      : "Keeping the current sample preserves its damage, Speed, and bulk. The checked adjustments can be weighed against the cost of changing that performance; other opponents have not been verified.";
  }

  const parts: string[] = [];
  for (const [direction, benchmarks] of [
    ["offense", candidate?.offenseBenchmarks ?? []],
    ["defense", candidate?.defenseBenchmarks ?? []],
  ] as const) {
    for (const comparison of ["better", "worse"] as const) {
      const names = benchmarks.filter((entry) => entry.optimizedVsCurrent === comparison)
        .map((entry) => entry.source === "usage"
          ? `${entry.moveDisplayName} (${ko ? "기술 교체 후보" : "optional move replacement"})`
          : entry.moveDisplayName).join(", ");
      if (!names) continue;
      parts.push(ko
        ? `${names}의 ${direction === "offense" ? "공격" : "피격 시 생존"} 결과는 현재 샘플보다 ${comparison === "better" ? "좋아집니다" : "불리해집니다"}.`
        : `The checked ${direction === "offense" ? "offensive" : "survival"} outcome for ${names} ${comparison === "better" ? "improves" : "worsens"} compared with the current sample.`);
    }
  }
  const baseline = request.optimization?.currentBuild?.finalStats;
  const labels = {
    hp: ko ? "체력" : "HP", attack: ko ? "공격" : "Attack",
    defense: ko ? "방어" : "Defense", specialAttack: ko ? "특수공격" : "Special Attack",
    specialDefense: ko ? "특수방어" : "Special Defense", speed: ko ? "스피드" : "Speed",
  };
  const lowerStats = baseline && candidate?.finalStats
    ? (Object.keys(labels) as Array<keyof typeof labels>)
      .filter((stat) => candidate.finalStats[stat] < baseline[stat]).map((stat) => labels[stat])
    : [];
  if (lowerStats.length) {
    parts.push(ko
      ? `대신 현재 샘플보다 ${lowerStats.join(", ")} 실수치가 낮아지는 점을 고려해야 합니다.`
      : `The tradeoff is lower ${lowerStats.join(", ")} than the current sample.`);
  }
  parts.push(ko
    ? "이 결과는 설정된 상대와 전투 조건에 한정되며, 다른 상대에 대한 성능은 검증하지 않았습니다."
    : "These results are limited to the configured opponent and battle conditions; performance against other opponents has not been verified.");
  return parts.join(" ");
}

function sanitizeOptimizationNarrative(
  analysis: CopilotModelOutput,
  request: CopilotAnalysisRequest,
): CopilotModelOutput {
  if (request.scope !== "optimization") return analysis;

  const isKorean = request.locale === "ko";
  const fallbackParagraph = isKorean
    ? "표시된 계산 결과와 현재 팀에서 맡는 역할을 함께 고려한 상대 조정입니다."
    : "This matchup tuning weighs the displayed calculator results against the set's current team role.";
  const fallbackTitle = isKorean
    ? "검증된 상대 조정을 사용해 보세요."
    : "Use the verified matchup option.";
  // Sentence deletion can leave a conclusion without its premise or only a drawback.
  // Replace the complete affected block with calculator-grounded prose instead.
  const hasRepeatedOutcomes = analysis.paragraphs.some((paragraph) => optimizationOutcomePattern.test(paragraph));

  return {
    ...analysis,
    paragraphs:
      hasRepeatedOutcomes ? [fallbackParagraph] : analysis.paragraphs,
    recommendations: analysis.recommendations.map((recommendation) => ({
      ...recommendation,
      title:
        optimizationOutcomePattern.test(recommendation.title) ? fallbackTitle : recommendation.title,
      reason:
        optimizationOutcomePattern.test(recommendation.reason)
          ? verifiedOptimizationReason(recommendation.id, request)
          : recommendation.reason,
    })),
  };
}

function normalizeOptimizationAudit(
  output: ReturnType<typeof completeCopilotStrategyAudit>,
  request: CopilotAnalysisRequest,
) {
  if (request.scope !== "optimization") return output;

  return {
    ...output,
    strategyAudit: {
      plans: [],
      interactions: [],
      facts: [],
      candidateFacts: [],
      recommendationEvidence: [],
    },
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

  const groundedOutput = normalizeOptimizationAudit(
    completeCopilotStrategyAudit(outputValidation.data, request),
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
