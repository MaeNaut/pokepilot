import type { HostedAnalysisFailureReason } from "../api/copilotFailure";
import type { Locale } from "../i18n/gameTranslations";
import type { CopilotAnalysisResponse, CopilotExecutionInfo } from "./copilotContracts";
import type { CopilotHistoryEntry } from "./copilotHistory";
import type { BattleUsageSource } from "../api/battleUsageData";

export type AnalysisState = {
  status: "idle" | "loading" | "ready" | "error";
  fingerprint?: string;
  response?: CopilotAnalysisResponse;
  execution?: CopilotExecutionInfo;
  usageSource?: BattleUsageSource;
  error?: string;
  errorCode?: string;
  providerAttempted?: false;
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
    ...(entry.execution ? { execution: entry.execution } : {}),
    ...(entry.usageSource ? { usageSource: entry.usageSource } : {}),
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

export function consumeAnalysisReveal(
  current: Record<string, AnalysisState>,
  contextKey: string,
  historyEntryId: string,
) {
  const state = current[contextKey];
  if (state?.historyEntryId !== historyEntryId || !state.shouldReveal) {
    return current;
  }

  return {
    ...current,
    [contextKey]: { ...state, shouldReveal: false },
  };
}
