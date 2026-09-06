import { useEffect, useMemo, useState } from "react";
import {
  CopilotApiError,
  requestHostedCopilotAnalysis,
} from "../api/copilotApi";
import {
  classifyHostedAnalysisFailure,
  type HostedAnalysisFailureReason,
} from "../api/copilotFailure";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { Locale } from "../i18n/gameTranslations";
import { createLocalCopilotAnalysis } from "../utils/copilotLocalAnalysis";
import { getCopilotRequestFingerprint } from "../utils/copilotRequestFingerprint";
import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
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

type AnalysisState = {
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

    setAnalysisByContext((current) => {
      const currentState = current[analysisContextKey];

      if (
        currentState?.status === "loading" ||
        currentState?.isHistorySelection ||
        currentState?.historyEntryId === matchingEntry.id
      ) {
        return current;
      }

      return {
        ...current,
        [analysisContextKey]: {
          status: "ready",
          fingerprint: matchingEntry.requestFingerprint,
          response: matchingEntry.response,
          usedFallback: matchingEntry.usedFallback,
          fallbackReason: matchingEntry.fallbackReason,
          historyEntryId: matchingEntry.id,
          locale: matchingEntry.locale,
          isHistorySelection: false,
          shouldReveal: false,
        },
      };
    });
  }, [
    analysisContextKey,
    analysisHistory,
    historyTeamKey,
    locale,
    request.scope,
    requestFingerprint,
  ]);

  async function analyze() {
    setAnalysisByContext((current) => ({
      ...current,
      [analysisContextKey]: {
        ...current[analysisContextKey],
        status: "loading",
        error: undefined,
      },
    }));

    try {
      let nextResponse: CopilotAnalysisResponse;
      let usedFallback = false;
      let fallbackReason: AnalysisState["fallbackReason"];

      try {
        const hostedResult = await requestHostedCopilotAnalysis(request);
        nextResponse = hostedResult.analysis;
        if (hostedResult.retryAfterSeconds) {
          setCooldownUntil(
            Date.now() + hostedResult.retryAfterSeconds * 1_000,
          );
        }
      } catch (error) {
        fallbackReason = classifyHostedAnalysisFailure(error);
        logHostedAnalysisFallback(error, fallbackReason);

        if (
          fallbackReason === "cooldown" &&
          error instanceof CopilotApiError &&
          error.retryAfterSeconds
        ) {
          setCooldownUntil(Date.now() + error.retryAfterSeconds * 1_000);
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

      const historyEntry = createCopilotHistoryEntry({
        teamKey: historyTeamKey,
        locale,
        scope: request.scope,
        battleFormat,
        requestFingerprint,
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
        [analysisContextKey]: {
          status: "ready",
          fingerprint: requestFingerprint,
          response: nextResponse,
          fallbackReason,
          usedFallback,
          historyEntryId: historyEntry.id,
          locale,
          isHistorySelection: false,
          shouldReveal: true,
        },
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
      [entryContextKey]: {
        status: "ready",
        fingerprint: entry.requestFingerprint,
        response: entry.response,
        fallbackReason: entry.fallbackReason,
        usedFallback: entry.usedFallback,
        historyEntryId: entry.id,
        locale: entry.locale,
        isHistorySelection: true,
        shouldReveal: false,
      },
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
