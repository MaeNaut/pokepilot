import type { CopilotAnalysisRequest } from "./copilotAnalysis.js";

export function getCopilotRequestFingerprint(request: CopilotAnalysisRequest) {
  if (request.scope === "team") {
    return JSON.stringify({ ...request, selectedSlot: -1 });
  }

  if (request.scope === "recommendation") {
    return JSON.stringify(request);
  }

  return JSON.stringify({
    version: request.version,
    scope: request.scope,
    battleFormat: request.battleFormat,
    selectedSlot: request.selectedSlot,
    selectedSet: request.sets.find((set) => set.slotIndex === request.selectedSlot),
    selectedCandidateFilters: request.candidateFilters.find(
      (filters) => filters.slotIndex === request.selectedSlot,
    ),
  });
}
