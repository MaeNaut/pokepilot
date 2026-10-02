import type { CopilotAnalysisRequest } from "./copilotContracts.js";

export function getCopilotRequestFingerprint(request: CopilotAnalysisRequest) {
  // General sample candidates are computed on demand, not edited by the user.
  if (request.scope === "optimization" && request.optimization?.mode !== "matchup") {
    return JSON.stringify({ ...request, teamName: "", optimization: null });
  }

  if (request.scope === "team") {
    return JSON.stringify({ ...request, selectedSlot: -1 });
  }

  if (request.scope === "recommendation") {
    return JSON.stringify({ ...request, recommendationCandidates: [] });
  }

  return JSON.stringify({ ...request, teamName: "" });
}

export function normalizeCopilotRequestFingerprint(fingerprint: string) {
  try {
    const request = JSON.parse(fingerprint) as CopilotAnalysisRequest | null;
    return request?.scope === "recommendation" ||
      (request?.scope === "optimization" && request.optimization?.mode !== "matchup")
      ? getCopilotRequestFingerprint(request)
      : fingerprint;
  } catch {
    return fingerprint;
  }
}

export function getCopilotAnalysisCacheFingerprint(
  request: CopilotAnalysisRequest,
) {
  return JSON.stringify(
    request.scope === "team"
      ? { ...request, selectedSlot: -1 }
      : request,
  );
}
