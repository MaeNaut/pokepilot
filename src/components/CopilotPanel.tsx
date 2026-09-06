import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faRotateRight,
  faSliders,
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
import { createCopilotAnalysisRequest } from "../utils/copilotRequestBuilder";
import type {
  CopilotAnalysisScope,
  CopilotSetOptimizationCandidateSnapshot,
} from "../utils/copilotContracts";
import type { CalculatorAnalysisContext } from "../calculator/setOptimizer";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { TeamValidityResult } from "../utils/teamValidity";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { HostedAnalysisFailureReason } from "../api/copilotFailure";
import type { CopilotHistoryEntry } from "../utils/copilotHistory";
import type { RecommendedPokemonApplyResult } from "../utils/recommendedPokemonApplication";
import { useCopilotRecommendationCandidates } from "../hooks/useCopilotRecommendationCandidates";
import { useCopilotAnalysisSession } from "../hooks/useCopilotAnalysisSession";
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
  isCalculatorActive: boolean;
  calculatorContext: CalculatorAnalysisContext | null;
  onSelectRecommendedPokemon: (
    slotIndex: number,
    pokemonId: string,
  ) => Promise<RecommendedPokemonApplyResult>;
  onApplyOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => void;
  onSaveOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => boolean;
};

function formatCooldown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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
  isCalculatorActive,
  calculatorContext,
  onSelectRecommendedPokemon,
  onApplyOptimizationCandidate,
  onSaveOptimizationCandidate,
}: CopilotPanelProps) {
  const { locale, pokemonName, t } = useLocalization();
  const [scope, setScope] = useState<CopilotAnalysisScope>("team");
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(
    null,
  );
  const [candidateApplyFailure, setCandidateApplyFailure] = useState<
    Extract<RecommendedPokemonApplyResult, { status: "blocked" }>["reason"] | null
  >(null);
  const [optimizationActionStatus, setOptimizationActionStatus] = useState<
    "applied" | "saved" | "bench-full" | "stale" | null
  >(null);
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
        calculatorContext,
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
      calculatorContext,
    ],
  );
  const {
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
  } = useCopilotAnalysisSession({
    savedTeamId,
    request,
    locale,
    battleFormat,
    failedMessage: t("copilot.failed"),
  });
  const selectedSet = request.sets.find((set) => set.slotIndex === selectedSlot);
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
              : scope === "recommendation"
                ? t("copilot.findRecommendations")
                : t("copilot.optimizeSet");
  const isAnalyzeDisabled =
    analysisState.status === "loading" ||
    abilityIndexStatus === "loading" ||
    cooldownRemainingSeconds > 0 ||
    (scope === "recommendation" &&
      (Boolean(selectedMember) ||
        recommendationState.status !== "ready" ||
        recommendationState.candidates.length === 0)) ||
    (scope === "optimization" &&
      (!isCalculatorActive ||
        !request.optimization ||
        request.optimization.candidates.length === 0));

  useEffect(() => {
    setCandidateApplyFailure(null);
  }, [requestFingerprint, scope]);

  useEffect(() => {
    setOptimizationActionStatus(null);
  }, [scope]);

  function handleAnalyze() {
    setOptimizationActionStatus(null);
    void analyze();
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

  function handleApplyOptimizationCandidate(
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) {
    if (isStale) {
      setOptimizationActionStatus("stale");
      return;
    }

    onApplyOptimizationCandidate(candidate);
    setOptimizationActionStatus("applied");
  }

  function handleSaveOptimizationCandidate(
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) {
    if (isStale) {
      setOptimizationActionStatus("stale");
      return;
    }

    setOptimizationActionStatus(
      onSaveOptimizationCandidate(candidate) ? "saved" : "bench-full",
    );
  }

  function handleSelectHistory(entry: CopilotHistoryEntry) {
    setScope(entry.scope);
    selectHistory(entry);
  }

  function handleClearHistory() {
    clearHistory();
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
            onClick={handleAnalyze}
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
        <button
          type="button"
          role="tab"
          aria-selected={scope === "optimization"}
          className={scope === "optimization" ? "is-active" : ""}
          onClick={() => setScope("optimization")}
        >
          <FontAwesomeIcon icon={faSliders} aria-hidden="true" />
          {t("copilot.sample")}
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
            optimizationCandidates={
              response.optimizationCandidates ??
              request.optimization?.candidates ??
              []
            }
            optimizationActionStatus={optimizationActionStatus}
            onAnalyze={() => void handleAnalyze()}
            onSelectCandidate={(pokemonId) =>
              void handleSelectCandidate(pokemonId)
            }
            onApplyOptimizationCandidate={handleApplyOptimizationCandidate}
            onSaveOptimizationCandidate={handleSaveOptimizationCandidate}
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
                    : scope === "optimization"
                      ? !isCalculatorActive
                        ? t("copilot.openCalculatorForOptimization")
                        : request.optimization
                          ? t("copilot.optimizationReady", {
                              count: request.optimization.candidates.length,
                            })
                          : t("copilot.configureOptimization")
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
