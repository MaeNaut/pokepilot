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
import type { BattleUsageSource } from "../api/battleUsageData";

type UseCopilotAnalysisSessionOptions = {
  accountId: string | null;
  accountResolved?: boolean;
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
  accountResolved = true,
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
    useCopilotHistory(accountId, accountResolved);
  const accountGeneration = useRef(0);
  const displayGenerationByContext = useRef<Record<string, number>>({});
  useEffect(() => {
    accountGeneration.current += 1;
    displayGenerationByContext.current = {};
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

  async function analyze(submittedRequest: CopilotAnalysisRequest = request,
    savedTarget: { teamId: string; usageSource?: BattleUsageSource } | undefined = savedTeamId ? { teamId: savedTeamId } : undefined) {
    // Never infer a draft's identity from its roster or a later team selection.
    if (!savedTarget?.teamId) return;
    const teamKey = createCopilotHistoryTeamKey(savedTarget.teamId, submittedRequest);
    const submittedContextKey = getAnalysisContextKey(teamKey, submittedRequest.scope, reasoningEffort, modelId);
    const generation = accountGeneration.current;
    const isCurrentAccount = () => generation === accountGeneration.current;
    const displayGeneration = (displayGenerationByContext.current[submittedContextKey] ?? 0) + 1;
    displayGenerationByContext.current[submittedContextKey] = displayGeneration;
    const isCurrentDisplay = () =>
      displayGenerationByContext.current[submittedContextKey] === displayGeneration;
    const submittedFingerprint = getCopilotRequestFingerprint(submittedRequest);
    setAnalysisByContext((current) => ({
      ...current,
      [submittedContextKey]: {
        ...current[submittedContextKey],
        status: "loading",
        error: undefined,
      },
    }));

    try {
      const { response: nextResponse, execution, usedFallback, fallbackReason } =
        await executeCopilotAnalysis(submittedRequest, reasoningEffort, modelId, accountId ?? undefined);

      if (!isCurrentAccount()) return;
      const historyEntry = createCopilotHistoryEntry({
        teamKey,
        locale,
        scope: submittedRequest.scope,
        battleFormat,
        reasoningEffort,
        modelId,
        requestFingerprint: submittedFingerprint,
        ...(savedTarget.usageSource ? { usageSource: savedTarget.usageSource } : {}),
        response: {
          ...nextResponse,
          ...(submittedRequest.recommendationCandidates?.length ? {
            recommendationCandidates: submittedRequest.recommendationCandidates.filter(
              (candidate) => nextResponse.recommendations.some((entry) => entry.id === candidate.pokemonId),
            ),
          } : {}),
        },
        ...(execution ? { execution } : {}),
        usedFallback,
        fallbackReason,
      });

      commitHistory(addCopilotHistoryEntry(historyRef.current, historyEntry));
      if (!isCurrentDisplay()) return;
      setAnalysisByContext((current) => ({
        ...current,
        [submittedContextKey]: createReadyAnalysisState(historyEntry, "analysis"),
      }));
    } catch (error) {
      if (!isCurrentAccount() || !isCurrentDisplay()) return;
      setAnalysisByContext((current) => ({
        ...current,
        [submittedContextKey]: {
          ...current[submittedContextKey],
          status: "error",
          errorCode: error instanceof CopilotApiError ? error.code : undefined,
          providerAttempted: error instanceof CopilotApiError ? error.providerAttempted : undefined,
          error: error instanceof Error ? error.message : failedMessage,
        },
      }));
    }
  }

  function selectHistory(entry: CopilotHistoryEntry, displayEffort = entry.reasoningEffort ?? "low", displayModel = modelId) {
    const entryContextKey = getAnalysisContextKey(historyTeamKey, entry.scope, displayEffort, displayModel);
    displayGenerationByContext.current[entryContextKey] =
      (displayGenerationByContext.current[entryContextKey] ?? 0) + 1;

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
