import type { CopilotAnalysisScope } from "./copilotContracts";

export function isVisibleCopilotScope(
  scope: CopilotAnalysisScope,
): scope is Exclude<CopilotAnalysisScope, "matchup"> {
  return scope !== "matchup";
}

export function usesHistoricalUsageData(scope: CopilotAnalysisScope) {
  return scope === "recommendation" || scope === "optimization";
}
