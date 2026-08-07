import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
  faUser,
  faUsers,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import type { TeamBuildState } from "../utils/teamBuildState";
import type {
  DataLoadStatus,
  PokemonAbility,
  PokemonIndexEntry,
  TeamSlot,
} from "../types";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import {
  createCopilotAnalysisRequest,
  createLocalCopilotAnalysis,
  getCopilotRequestFingerprint,
  type CopilotAnalysisResponse,
  type CopilotAnalysisScope,
} from "../utils/copilotAnalysis";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { TeamValidityResult } from "../utils/teamValidity";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  CopilotApiError,
  requestHostedCopilotAnalysis,
} from "../api/copilotApi";
import {
  classifyHostedAnalysisFailure,
  type HostedAnalysisFailureReason,
} from "../api/copilotFailure";
import type { Locale } from "../i18n/gameTranslations";
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
import type { RecommendedPokemonApplyResult } from "../utils/recommendedPokemonApplication";
import { useCopilotRecommendationCandidates } from "../hooks/useCopilotRecommendationCandidates";
import { CopilotAnalysisResult } from "./CopilotAnalysisResult";
import { CopilotHistoryControl } from "./CopilotHistoryControl";

type CopilotPanelProps = {
  savedTeamId: string | null;
  teamName: string;
  battleFormat: BattleFormat;
  team: TeamSlot[];
  pokemonIndex: PokemonIndexEntry[];
  abilityIndex: PokemonAbility[];
  abilityIndexStatus: DataLoadStatus;
  showdownLegality: ShowdownLegalitySnapshot | null;
  showdownLegalityStatus: DataLoadStatus;
  selectedSlot: number;
  buildState: TeamBuildState;
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
  onSelectRecommendedPokemon: (
    slotIndex: number,
    pokemonId: string,
  ) => Promise<RecommendedPokemonApplyResult>;
};

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

const idleAnalysisState: AnalysisState = { status: "idle" };

function formatCooldown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getAnalysisContextKey(
  teamKey: string,
  scope: CopilotAnalysisScope,
) {
  return `${teamKey}:${scope}`;
}

const fallbackTranslationKeys: Record<
  Exclude<HostedAnalysisFailureReason, "cooldown">,
  TranslationKey
> = {
  connection: "copilot.connectionFallback",
  "not-configured": "copilot.notConfiguredFallback",
  "invalid-response": "copilot.invalidResponseFallback",
  "rate-limited": "copilot.rateLimitedFallback",
  "service-unavailable": "copilot.serviceUnavailableFallback",
  unavailable: "copilot.hostedUnavailableFallback",
};

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

export function CopilotPanel({
  savedTeamId,
  teamName,
  battleFormat,
  team,
  pokemonIndex,
  abilityIndex,
  abilityIndexStatus,
  showdownLegality,
  showdownLegalityStatus,
  selectedSlot,
  buildState,
  diagnostics,
  validity,
  onSelectRecommendedPokemon,
}: CopilotPanelProps) {
  const { locale, pokemonName, t } = useLocalization();
  const [scope, setScope] = useState<CopilotAnalysisScope>("team");
  const [analysisByContext, setAnalysisByContext] = useState<
    Record<string, AnalysisState>
  >({});
  const [analysisHistory, setAnalysisHistory] = useState(
    getStoredCopilotHistory,
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(
    null,
  );
  const [candidateApplyFailure, setCandidateApplyFailure] = useState<
    Extract<RecommendedPokemonApplyResult, { status: "blocked" }>["reason"] | null
  >(null);
  const [cooldownClock, setCooldownClock] = useState(Date.now);
  const selectedMember = team[selectedSlot];
  const recommendationState = useCopilotRecommendationCandidates({
    scope,
    selectedSlot,
    team,
    buildState,
    battleFormat,
    diagnostics,
    pokemonIndex,
    abilityIndex,
    abilityIndexStatus,
    showdownLegality,
    showdownLegalityStatus,
  });

  const request = useMemo(
    () =>
      createCopilotAnalysisRequest({
        scope,
        locale,
        battleFormat,
        teamName,
        team,
        pokemonIndex,
        abilityIndex,
        selectedSlot,
        buildState,
        diagnostics,
        validity,
        recommendationCandidates: recommendationState.candidates,
      }),
    [
      battleFormat,
      abilityIndex,
      buildState,
      diagnostics,
      locale,
      pokemonIndex,
      scope,
      selectedSlot,
      team,
      teamName,
      validity,
      recommendationState.candidates,
    ],
  );
  const requestFingerprint = useMemo(
    () => getCopilotRequestFingerprint(request),
    [request],
  );
  const historyTeamKey = useMemo(
    () => createCopilotHistoryTeamKey(savedTeamId, request),
    [request, savedTeamId],
  );
  const analysisContextKey = getAnalysisContextKey(historyTeamKey, scope);
  const selectedSet = request.sets.find((set) => set.slotIndex === selectedSlot);
  const analysisState = analysisByContext[analysisContextKey] ?? idleAnalysisState;
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
  const cooldownLabel = formatCooldown(cooldownRemainingSeconds);
  const fallbackMessage =
    analysisState.fallbackReason === "cooldown"
      ? cooldownRemainingSeconds > 0
        ? t("copilot.cooldownFallback", { time: cooldownLabel })
        : t("copilot.cooldownReadyFallback")
      : t(
          fallbackTranslationKeys[
            analysisState.fallbackReason ?? "unavailable"
          ],
        );
  const analyzeLabel =
    analysisState.status === "loading"
      ? t("copilot.analyzing")
      : cooldownRemainingSeconds > 0
        ? t("copilot.cooldownButton", { time: cooldownLabel })
        : response
          ? t("copilot.refresh")
          : scope === "team"
            ? t("copilot.analyze")
            : scope === "pokemon"
              ? t("copilot.analyzePokemon")
              : t("copilot.findRecommendations");
  const isAnalyzeDisabled =
    analysisState.status === "loading" ||
    abilityIndexStatus === "loading" ||
    cooldownRemainingSeconds > 0 ||
    (scope === "recommendation" &&
      (Boolean(selectedMember) ||
        recommendationState.status !== "ready" ||
        recommendationState.candidates.length === 0));

  useEffect(() => {
    setCandidateApplyFailure(null);
  }, [requestFingerprint, scope]);

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
      scope,
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
    requestFingerprint,
    scope,
  ]);

  async function handleAnalyze() {
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
        nextResponse = await requestHostedCopilotAnalysis(request);
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

      const historyEntry = createCopilotHistoryEntry({
        teamKey: historyTeamKey,
        locale,
        scope,
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
          error: error instanceof Error ? error.message : t("copilot.failed"),
        },
      }));
    }
  }

  async function handleSelectCandidate(pokemonId: string) {
    if (selectingCandidateId) {
      return;
    }

    if (isStale) {
      setCandidateApplyFailure("stale");
      return;
    }

    setSelectingCandidateId(pokemonId);
    setCandidateApplyFailure(null);
    try {
      const result = await onSelectRecommendedPokemon(selectedSlot, pokemonId);

      if (result.status === "blocked") {
        setCandidateApplyFailure(result.reason);
        return;
      }

      setScope("pokemon");
    } catch {
      setCandidateApplyFailure("load-failed");
    } finally {
      setSelectingCandidateId(null);
    }
  }

  function handleSelectHistory(entry: CopilotHistoryEntry) {
    const entryContextKey = getAnalysisContextKey(historyTeamKey, entry.scope);

    setScope(entry.scope);
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

  function handleClearHistory() {
    setAnalysisHistory((current) => {
      const nextHistory = clearCopilotHistoryForTeam(current, historyTeamKey);
      storeCopilotHistory(nextHistory);
      return nextHistory;
    });
  }

  return (
    <aside className="copilot-panel" aria-labelledby="copilot-title">
      <header className="copilot-header">
        <h2 id="copilot-title">PokePilot</h2>
        <div className="copilot-header-actions">
          <CopilotHistoryControl
            entries={teamHistory}
            activeEntryId={analysisState.historyEntryId}
            onSelect={handleSelectHistory}
            onClear={handleClearHistory}
          />

          <button
            className="copilot-analyze-button"
            type="button"
            disabled={isAnalyzeDisabled}
            onClick={() => void handleAnalyze()}
          >
            <FontAwesomeIcon
              icon={
                analysisState.status === "loading"
                  ? faSpinner
                  : response
                    ? faRotateRight
                    : faWandMagicSparkles
              }
              spin={analysisState.status === "loading"}
              aria-hidden="true"
            />
            {analyzeLabel}
          </button>
        </div>
      </header>

      <div
        className="copilot-scope-tabs"
        role="tablist"
        aria-label={t("copilot.scope")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={scope === "team"}
          className={scope === "team" ? "is-active" : ""}
          onClick={() => setScope("team")}
        >
          <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
          {t("copilot.team")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "pokemon"}
          className={scope === "pokemon" ? "is-active" : ""}
          onClick={() => setScope("pokemon")}
        >
          <FontAwesomeIcon icon={faUser} aria-hidden="true" />
          {t("copilot.pokemon")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "recommendation"}
          className={scope === "recommendation" ? "is-active" : ""}
          onClick={() => setScope("recommendation")}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          {t("copilot.recommend")}
        </button>
      </div>

      <div className="copilot-content" aria-live="polite">
        {analysisState.status === "error" ? (
          <div className="copilot-empty-state is-error">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            <strong>{t("copilot.unavailable")}</strong>
            <span>{analysisState.error}</span>
          </div>
        ) : response ? (
          <CopilotAnalysisResult
            key={
              analysisState.historyEntryId ??
              `${analysisContextKey}:${analysisState.fingerprint ?? "analysis"}`
            }
            response={response}
            scope={scope}
            usedFallback={Boolean(analysisState.usedFallback)}
            fallbackMessage={fallbackMessage}
            isStale={isStale}
            isLanguageMismatch={isLanguageMismatch}
            isAnalyzeDisabled={isAnalyzeDisabled}
            shouldReveal={Boolean(analysisState.shouldReveal)}
            recommendationCandidates={request.recommendationCandidates}
            selectingCandidateId={selectingCandidateId}
            candidateApplyFailure={candidateApplyFailure}
            onAnalyze={() => void handleAnalyze()}
            onSelectCandidate={(pokemonId) =>
              void handleSelectCandidate(pokemonId)
            }
          />
        ) : (
          <div className="copilot-empty-state">
            <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
            <strong>{t("copilot.noAnalysis")}</strong>
            <span>
              {scope === "team"
                ? t("copilot.activeSets", { count: diagnostics.filledSlots })
                : scope === "pokemon" && selectedSet
                  ? pokemonName({
                      id: selectedSet.pokemonId,
                      fallback: selectedSet.pokemonName,
                      includeForm: false,
                    })
                  : scope === "recommendation"
                    ? selectedMember
                      ? t("copilot.chooseEmptySlot")
                      : recommendationState.status === "loading"
                        ? t("copilot.loadingCandidates")
                        : recommendationState.status === "error"
                          ? t("copilot.candidateLoadFailed")
                          : recommendationState.candidates.length > 0
                            ? t("copilot.candidatePoolReady", {
                                count: recommendationState.candidates.length,
                              })
                            : t("copilot.noCandidates")
                    : t("copilot.emptySlot", { slot: selectedSlot + 1 })}
            </span>
          </div>
        )}
      </div>

      <footer className="copilot-footer">
        <span>
          {t("toolbar.regulation")} ·{" "}
          {t(
            battleFormat === "singles"
              ? "battleFormat.singles"
              : "battleFormat.doubles",
          )}
        </span>
        <span>
          {response?.source === "hosted"
            ? t("copilot.hostedAnalysis")
            : response
              ? t("copilot.rulesFallback")
              : t("copilot.aiReady")}
        </span>
      </footer>
    </aside>
  );
}
