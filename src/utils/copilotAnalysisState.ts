import type { HostedAnalysisFailureReason } from "../api/copilotFailure";
import type { Locale } from "../i18n/gameTranslations";
import type { CopilotAnalysisResponse } from "./copilotContracts";
import type { CopilotHistoryEntry } from "./copilotHistory";

export type AnalysisState = {
  status: "idle" | "loading" | "ready" | "error";
  fingerprint?: string;
  response?: CopilotAnalysisResponse;
  error?: string;
  fallbackReason?: HostedAnalysisFailureReason;
  usedFallback?: boolean;
  historyEntryId?: string;
  locale?: Locale;
  isHistorySelection?: boolean;
  shouldReveal?: boolean;
};

export function createReadyAnalysisState(
  entry: CopilotHistoryEntry,
  source: "analysis" | "restore" | "selection",
): AnalysisState {
  return {
    status: "ready",
    fingerprint: entry.requestFingerprint,
    response: entry.response,
    fallbackReason: entry.fallbackReason,
    usedFallback: entry.usedFallback,
    historyEntryId: entry.id,
    locale: entry.locale,
    isHistorySelection: source === "selection",
    shouldReveal: source === "analysis",
  };
}

export function restoreAnalysisHistory(
  current: Record<string, AnalysisState>,
  contextKey: string,
  entry: CopilotHistoryEntry,
) {
  const state = current[contextKey];
  if (
    state?.status === "loading" ||
    state?.isHistorySelection ||
    state?.historyEntryId === entry.id
  ) {
    return current;
  }

  return {
    ...current,
    [contextKey]: createReadyAnalysisState(entry, "restore"),
  };
}
