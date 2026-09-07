import { useEffect, useMemo, useState } from "react";
import { executeCopilotAnalysis } from "../utils/copilotAnalysisExecution";
import {
  createReadyAnalysisState,
  restoreAnalysisHistory,
  type AnalysisState,
} from "../utils/copilotAnalysisState";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { Locale } from "../i18n/gameTranslations";
import { getCopilotRequestFingerprint } from "../utils/copilotRequestFingerprint";
import type {
  CopilotAnalysisRequest,
  CopilotAnalysisScope,
} from "../utils/copilotContracts";
import {
  addCopilotHistoryEntry,
  clearCopilotHistoryForTeam,
  createCopilotHistoryEntry,
  createCopilotHistoryTeamKey,
  findMatchingCopilotHistoryEntry,
  getCopilotHistoryForTeam,
  getStoredCopilotHistory,
  storeCopilotHistory,
  type CopilotHistoryEntry,
} from "../utils/copilotHistory";

type UseCopilotAnalysisSessionOptions = {
  savedTeamId: string | null;
  request: CopilotAnalysisRequest;
  locale: Locale;
  battleFormat: BattleFormat;
  failedMessage: string;
};

const idleAnalysisState: AnalysisState = { status: "idle" };

function getAnalysisContextKey(
  teamKey: string,
  scope: CopilotAnalysisScope,
) {
  return `${teamKey}:${scope}`;
}

export function useCopilotAnalysisSession({
  savedTeamId,
  request,
  locale,
  battleFormat,
  failedMessage,
}: UseCopilotAnalysisSessionOptions) {
  const [analysisByContext, setAnalysisByContext] = useState<
    Record<string, AnalysisState>
  >({});
  const [analysisHistory, setAnalysisHistory] = useState(
    getStoredCopilotHistory,
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownClock, setCooldownClock] = useState(Date.now);
  const requestFingerprint = useMemo(
    () => getCopilotRequestFingerprint(request),
    [request],
  );
  const historyTeamKey = useMemo(
    () => createCopilotHistoryTeamKey(savedTeamId, request),
    [request, savedTeamId],
  );
  const analysisContextKey = getAnalysisContextKey(
    historyTeamKey,
    request.scope,
  );
  const analysisState =
    analysisByContext[analysisContextKey] ?? idleAnalysisState;
  const response = analysisState.response;
  const isLanguageMismatch = Boolean(
    response && analysisState.locale && analysisState.locale !== locale,
  );
  const isStale = Boolean(
    response && analysisState.fingerprint !== requestFingerprint,
  );
  const teamHistory = useMemo(
    () => getCopilotHistoryForTeam(analysisHistory, historyTeamKey),
    [analysisHistory, historyTeamKey],
  );
  const cooldownRemainingSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - cooldownClock) / 1_000))
    : 0;

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }

    setCooldownClock(Date.now());
    const interval = window.setInterval(() => {
      const now = Date.now();
      setCooldownClock(now);
      if (now >= cooldownUntil) {
        setCooldownUntil(null);
        window.clearInterval(interval);
      }
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    const matchingEntry = findMatchingCopilotHistoryEntry(
      analysisHistory,
      historyTeamKey,
      request.scope,
      locale,
      requestFingerprint,
    );

    if (!matchingEntry) {
      return;
    }

    setAnalysisByContext((current) =>
      restoreAnalysisHistory(current, analysisContextKey, matchingEntry),
    );
  }, [
    analysisContextKey,
    analysisHistory,
    historyTeamKey,
    locale,
    request.scope,
    requestFingerprint,
  ]);

  async function analyze(submittedRequest: CopilotAnalysisRequest = request) {
    const submittedFingerprint = getCopilotRequestFingerprint(submittedRequest);
    setAnalysisByContext((current) => ({
      ...current,
      [analysisContextKey]: {
        ...current[analysisContextKey],
        status: "loading",
        error: undefined,
      },
    }));

    try {
      const { response: nextResponse, usedFallback, fallbackReason } =
        await executeCopilotAnalysis(submittedRequest, locale, (seconds) => {
          setCooldownUntil(Date.now() + seconds * 1_000);
        });

      const historyEntry = createCopilotHistoryEntry({
        teamKey: historyTeamKey,
        locale,
        scope: submittedRequest.scope,
        battleFormat,
        requestFingerprint: submittedFingerprint,
        response: nextResponse,
        usedFallback,
        fallbackReason,
      });

      setAnalysisHistory((current) => {
        const nextHistory = addCopilotHistoryEntry(current, historyEntry);
        storeCopilotHistory(nextHistory);
        return nextHistory;
      });
      setAnalysisByContext((current) => ({
        ...current,
        [analysisContextKey]: createReadyAnalysisState(historyEntry, "analysis"),
      }));
    } catch (error) {
      setAnalysisByContext((current) => ({
        ...current,
        [analysisContextKey]: {
          ...current[analysisContextKey],
          status: "error",
          error: error instanceof Error ? error.message : failedMessage,
        },
      }));
    }
  }

  function selectHistory(entry: CopilotHistoryEntry) {
    const entryContextKey = getAnalysisContextKey(historyTeamKey, entry.scope);

    setAnalysisByContext((current) => ({
      ...current,
      [entryContextKey]: createReadyAnalysisState(entry, "selection"),
    }));
  }

  function clearHistory() {
    setAnalysisHistory((current) => {
      const nextHistory = clearCopilotHistoryForTeam(current, historyTeamKey);
      storeCopilotHistory(nextHistory);
      return nextHistory;
    });
  }

  return {
    analysisContextKey,
    analysisState,
    cooldownRemainingSeconds,
    isLanguageMismatch,
    isStale,
    requestFingerprint,
    response,
    teamHistory,
    analyze,
    clearHistory,
    selectHistory,
  };
}
