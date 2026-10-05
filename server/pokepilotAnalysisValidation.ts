import type {
  CopilotAnalysisRequest,
  CopilotQualityWarningCode,
} from "../src/utils/copilotContracts.js";
import {
  validateCopilotGroundedModelOutput,
  validateCopilotModelOutput,
} from "../src/utils/copilotModelValidation.js";
import type { CopilotModelOutput } from "../src/utils/copilotModelTypes.js";
import {
  completeCopilotStrategyAudit,
  validateCopilotStrategyAuditForRequest,
} from "../src/utils/copilotStrategyAudit.js";
import { isRecord } from "../src/utils/typeGuards.js";

function invalidAnalysis(message: string): Error & { code: "AI_INVALID_RESPONSE" } {
  return Object.assign(new Error(message), { code: "AI_INVALID_RESPONSE" as const });
}

function getActionableCandidateIds(request: CopilotAnalysisRequest) {
  if (request.scope === "recommendation") {
    return new Set(request.recommendationCandidates.map((candidate) => candidate.pokemonId));
  }
  if (request.scope === "optimization") {
    return new Set(request.optimization?.candidates.map((candidate) => candidate.id) ?? []);
  }
  return null;
}

function permitsKeepingCurrentTeam(request: CopilotAnalysisRequest) {
  return request.scope === "recommendation" &&
    request.recommendationCandidates.length > 0 &&
    request.recommendationCandidates.every((candidate) => candidate.target.mode === "replacement");
}

function validateRecommendationIds(analysis: CopilotModelOutput, request: CopilotAnalysisRequest) {
  const candidateIds = getActionableCandidateIds(request);
  if (!candidateIds) return;
  const ids = analysis.recommendations.map((recommendation) => recommendation.id);
  const minimum = request.scope === "optimization"
    ? 1
    : permitsKeepingCurrentTeam(request) ? 0 : Math.min(3, candidateIds.size);
  if (
    ids.length < minimum || ids.length > Math.min(3, candidateIds.size) ||
    new Set(ids).size !== ids.length || ids.some((id) => !candidateIds.has(id))
  ) {
    throw invalidAnalysis(`Hosted ${request.scope} returned an invalid candidate list.`);
  }
}

function recoverActionableRecommendations(analysis: CopilotModelOutput, request: CopilotAnalysisRequest) {
  const candidateIds = getActionableCandidateIds(request);
  const seen = new Set<string>();
  const recommendations = analysis.recommendations.filter(({ id }) => {
    if (seen.size >= 3 || seen.has(id) || (candidateIds && !candidateIds.has(id))) return false;
    seen.add(id);
    return true;
  });
  // An intentional keep-current answer is different from discarding every invalid action.
  const intentionallyEmpty = analysis.recommendations.length === 0 && permitsKeepingCurrentTeam(request);
  if (candidateIds && recommendations.length === 0 && !intentionallyEmpty) {
    throw invalidAnalysis(`Hosted ${request.scope} returned no usable candidate.`);
  }
  const incompleteAddition = request.scope === "recommendation" && !permitsKeepingCurrentTeam(request) &&
    recommendations.length < Math.min(3, candidateIds?.size ?? 0);
  const adjusted = recommendations.length !== analysis.recommendations.length || incompleteAddition;
  return { analysis: adjusted ? { ...analysis, recommendations } : analysis, adjusted };
}

export type HostedAnalysisDiagnostics = {
  rawAuditErrors: string[];
  auditErrors: string[];
  auditNormalized: boolean;
  suppliedRecommendations: number;
  retainedRecommendations: number;
  // Deterministic fact/ID validation does not establish natural-language accuracy.
  proseVerified: false;
};

function inspectAudit(output: unknown, request: CopilotAnalysisRequest, analysis: CopilotModelOutput) {
  const validation = validateCopilotGroundedModelOutput(output);
  if (!validation.success) {
    return { rawAuditErrors: validation.errors, auditErrors: validation.errors, auditNormalized: false };
  }
  const rawAuditErrors = validateCopilotStrategyAuditForRequest(validation.data, request);
  const completed = completeCopilotStrategyAudit(validation.data, request);
  return {
    rawAuditErrors,
    auditErrors: validateCopilotStrategyAuditForRequest({ ...completed, analysis }, request),
    auditNormalized: JSON.stringify(validation.data.strategyAudit) !== JSON.stringify(completed.strategyAudit),
  };
}

/** Strict structural/audit evaluation, not a factual-accuracy certification. Never rewrites prose. */
export function validateHostedCopilotAnalysis(output: unknown, request: CopilotAnalysisRequest): CopilotModelOutput {
  const validation = validateCopilotGroundedModelOutput(output);
  if (!validation.success || validation.data.analysis.scope !== request.scope) {
    throw invalidAnalysis("Hosted analysis returned an invalid response.");
  }
  const analysis = validation.data.analysis;
  validateRecommendationIds(analysis, request);
  const audit = inspectAudit(output, request, analysis);
  if (audit.auditErrors.length) throw invalidAnalysis("Hosted analysis returned an invalid response.");
  return analysis;
}

export type ReviewedHostedCopilotAnalysis = {
  analysis: CopilotModelOutput;
  qualityWarnings: CopilotQualityWarningCode[];
  diagnostics: HostedAnalysisDiagnostics;
};

/** Keep renderable prose unchanged; only invalid or duplicate action cards may be removed. */
export function reviewHostedCopilotAnalysis(output: unknown, request: CopilotAnalysisRequest): ReviewedHostedCopilotAnalysis {
  const publicOutput = isRecord(output) && "analysis" in output ? output.analysis : output;
  const validation = validateCopilotModelOutput(publicOutput);
  if (!validation.success || validation.data.scope !== request.scope) {
    throw invalidAnalysis("Hosted analysis returned an invalid response.");
  }

  const recovered = recoverActionableRecommendations(validation.data, request);
  const audit = inspectAudit(output, request, recovered.analysis);
  const warnings = new Set<CopilotQualityWarningCode>();
  if (recovered.adjusted) warnings.add("recommendations-adjusted");
  if (audit.auditErrors.length) warnings.add("grounding-incomplete");
  return {
    analysis: recovered.analysis,
    qualityWarnings: [...warnings],
    diagnostics: {
      ...audit,
      suppliedRecommendations: validation.data.recommendations.length,
      retainedRecommendations: recovered.analysis.recommendations.length,
      proseVerified: false,
    },
  };
}
