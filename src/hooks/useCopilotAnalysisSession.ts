import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopilotHistory } from "./useCopilotHistory";
import { executeCopilotAnalysis } from "../utils/copilotAnalysisExecution";
import { CopilotApiError } from "../api/copilotApi";
import {
  consumeAnalysisReveal,
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
  type CopilotHistoryEntry,
} from "../utils/copilotHistory";

type UseCopilotAnalysisSessionOptions = {
  accountId: string | null;
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
  accountId,
  savedTeamId,
  request,
  locale,
  battleFormat,
  failedMessage,
}: UseCopilotAnalysisSessionOptions) {
  const [analysisByContext, setAnalysisByContext] = useState<
    Record<string, AnalysisState>
  >({});
  const { items: analysisHistory, current: historyRef, commit: commitHistory, isHydrated } =
    useCopilotHistory(accountId);
  const accountGeneration = useRef(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownClock, setCooldownClock] = useState(Date.now);
  useEffect(() => {
    accountGeneration.current += 1;
    setAnalysisByContext({});
    setCooldownUntil(null);
    return () => { accountGeneration.current += 1; };
  }, [accountId]);
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
    if (!isHydrated) return;
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
    isHydrated,
    locale,
    request.scope,
    requestFingerprint,
  ]);

  async function analyze(submittedRequest: CopilotAnalysisRequest = request) {
    const generation = accountGeneration.current;
    const isCurrentAccount = () => generation === accountGeneration.current;
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
          if (isCurrentAccount()) setCooldownUntil(Date.now() + seconds * 1_000);
        });

      if (!isCurrentAccount()) return;
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

      commitHistory(addCopilotHistoryEntry(historyRef.current, historyEntry));
      setAnalysisByContext((current) => ({
        ...current,
        [analysisContextKey]: createReadyAnalysisState(historyEntry, "analysis"),
      }));
    } catch (error) {
      if (!isCurrentAccount()) return;
      setAnalysisByContext((current) => ({
        ...current,
        [analysisContextKey]: {
          ...current[analysisContextKey],
          status: "error",
          error: error instanceof CopilotApiError && error.code === "AUTH_REQUIRED"
            ? (locale === "ko" ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : "Your session expired. Please sign in again.")
            : error instanceof CopilotApiError && error.code === "AUTH_UNAVAILABLE"
              ? (locale === "ko" ? "인증 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요." : "Authentication is unavailable. Please try again shortly.")
              : error instanceof Error ? error.message : failedMessage,
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
    commitHistory(
      clearCopilotHistoryForTeam(historyRef.current, historyTeamKey),
    );
  }

  const consumeReveal = useCallback(() => {
    const historyEntryId = analysisState.historyEntryId;
    if (!historyEntryId) return;
    setAnalysisByContext((current) =>
      consumeAnalysisReveal(current, analysisContextKey, historyEntryId),
    );
  }, [analysisContextKey, analysisState.historyEntryId]);

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
    consumeReveal,
    selectHistory,
  };
}
