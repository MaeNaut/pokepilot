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
  reasoningEffort?: "low" | "medium";
  modelId?: "gpt-6-luna" | "gpt-6-sol";
};

const idleAnalysisState: AnalysisState = { status: "idle" };

function getAnalysisContextKey(
  teamKey: string,
  scope: CopilotAnalysisScope,
  reasoningEffort: "low" | "medium",
  modelId: "gpt-6-luna" | "gpt-6-sol",
) {
  return `${teamKey}:${scope}:${modelId}:${reasoningEffort}`;
}

export function useCopilotAnalysisSession({
  accountId,
  savedTeamId,
  request,
  locale,
  battleFormat,
  failedMessage,
  reasoningEffort = "low",
  modelId = "gpt-6-luna",
}: UseCopilotAnalysisSessionOptions) {
  const [analysisByContext, setAnalysisByContext] = useState<
    Record<string, AnalysisState>
  >({});
  const { items: analysisHistory, current: historyRef, commit: commitHistory, isHydrated } =
    useCopilotHistory(accountId);
  const accountGeneration = useRef(0);
  useEffect(() => {
    accountGeneration.current += 1;
    setAnalysisByContext({});
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
    reasoningEffort,
    modelId,
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
  useEffect(() => {
    if (!isHydrated) return;
    const matchingEntry = findMatchingCopilotHistoryEntry(
      analysisHistory,
      historyTeamKey,
      request.scope,
      locale,
      requestFingerprint,
      reasoningEffort,
      modelId,
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
    reasoningEffort,
    modelId,
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
        await executeCopilotAnalysis(submittedRequest, reasoningEffort, modelId);

      if (!isCurrentAccount()) return;
      const historyEntry = createCopilotHistoryEntry({
        teamKey: historyTeamKey,
        locale,
        scope: submittedRequest.scope,
        battleFormat,
        reasoningEffort,
        modelId,
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
          errorCode: error instanceof CopilotApiError ? error.code : undefined,
          providerAttempted: error instanceof CopilotApiError ? error.providerAttempted : undefined,
          error: error instanceof CopilotApiError && error.code === "AUTH_REQUIRED"
            ? (locale === "ko" ? "로그인이 만료되었습니다. 다시 로그인하시기 바랍니다." : "Your session expired. Please sign in again.")
            : error instanceof CopilotApiError && error.code === "AUTH_UNAVAILABLE"
              ? (locale === "ko" ? "인증 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하시기 바랍니다." : "Authentication is unavailable. Please try again shortly.")
              : error instanceof CopilotApiError && error.code === "PERSONAL_KEY_INVALID"
                ? (locale === "ko" ? "개인 API 키가 유효하지 않습니다. 계정 설정에서 확인하시기 바랍니다." : "Your personal API key is invalid. Check it in account settings.")
                : error instanceof CopilotApiError && error.code === "PERSONAL_KEY_REQUIRED"
                  ? (locale === "ko" ? "PokePilot 분석에는 개인 API 키가 필요합니다. 계정 설정에서 등록할 수 있습니다." : "PokePilot analysis requires a personal API key. Add one in account settings.")
              : error instanceof Error ? error.message : failedMessage,
        },
      }));
    }
  }

  function selectHistory(entry: CopilotHistoryEntry, displayEffort = entry.reasoningEffort ?? "low", displayModel = entry.modelId ?? "gpt-6-luna") {
    const entryContextKey = getAnalysisContextKey(historyTeamKey, entry.scope, displayEffort, displayModel);

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
