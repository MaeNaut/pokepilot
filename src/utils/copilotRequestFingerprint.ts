import type { CopilotAnalysisRequest } from "./copilotAnalysis.js";

export function getCopilotRequestFingerprint(request: CopilotAnalysisRequest) {
  if (request.scope === "team") {
    return JSON.stringify({ ...request, selectedSlot: -1 });
  }

  if (request.scope === "recommendation") {
    return JSON.stringify(request);
  }

  return JSON.stringify({ ...request, teamName: "" });
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
