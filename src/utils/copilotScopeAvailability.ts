import type { CopilotAnalysisScope } from "./copilotContracts";

export function isVisibleCopilotScope(
  scope: CopilotAnalysisScope,
): scope is Exclude<CopilotAnalysisScope, "matchup"> {
  return scope !== "matchup";
}

export function usesUsageData(scope: CopilotAnalysisScope) {
  return scope === "recommendation" || scope === "optimization";
}
