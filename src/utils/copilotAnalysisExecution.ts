import { CopilotApiError, requestHostedCopilotAnalysis } from "../api/copilotApi";
import {
  classifyHostedAnalysisFailure,
  type HostedAnalysisFailureReason,
} from "../api/copilotFailure";
import type { Locale } from "../i18n/gameTranslations";
import type { CopilotAnalysisRequest, CopilotAnalysisResponse } from "./copilotContracts";
import { createLocalCopilotAnalysis } from "./copilotLocalAnalysis";

function logHostedAnalysisFallback(
  error: unknown,
  reason: HostedAnalysisFailureReason,
) {
  if (
    typeof window === "undefined" ||
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return;
  }

  const details = error instanceof CopilotApiError
    ? [
        `reason=${reason}`,
        `code=${error.code}`,
        `status=${error.status}`,
        `message=${JSON.stringify(error.message)}`,
        ...(error.retryAfterSeconds
          ? [`retryAfterSeconds=${error.retryAfterSeconds}`]
          : []),
      ]
    : [
        `reason=${reason}`,
        `error=${error instanceof Error ? error.name : typeof error}`,
      ];

  console.warn(`[PokePilot] Hosted analysis fallback: ${details.join(" ")}`);
}

// Keep cooldown notification before fallback generation, even if the fallback fails.
export async function executeCopilotAnalysis(
  request: CopilotAnalysisRequest,
  locale: Locale,
  onCooldown: (seconds: number) => void,
) {
  let nextResponse: CopilotAnalysisResponse;
  let usedFallback = false;
  let fallbackReason: HostedAnalysisFailureReason | undefined;

  try {
    const hostedResult = await requestHostedCopilotAnalysis(request);
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
    fallbackReason = classifyHostedAnalysisFailure(error);
    logHostedAnalysisFallback(error, fallbackReason);

    if (
      fallbackReason === "cooldown" &&
      error instanceof CopilotApiError &&
      error.retryAfterSeconds
    ) {
      onCooldown(error.retryAfterSeconds);
    }
    nextResponse = createLocalCopilotAnalysis(request, locale);
    usedFallback = true;
  }

  if (request.scope === "optimization" && request.optimization) {
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

  return { response: nextResponse, usedFallback, fallbackReason };
}
