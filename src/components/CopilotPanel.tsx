import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faRotateRight,
  faSliders,
  faShieldHalved,
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
  ItemIndexEntry,
  TeamSlot,
} from "../types";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import { createCopilotAnalysisRequest } from "../utils/copilotRequestBuilder";
import type {
  CopilotAnalysisScope,
  CopilotSetOptimizationCandidateSnapshot,
} from "../utils/copilotContracts";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { TeamValidityResult } from "../utils/teamValidity";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { HostedAnalysisFailureReason } from "../api/copilotFailure";
import type { CopilotHistoryEntry } from "../utils/copilotHistory";
import type {
  RecommendedPokemonApplyResult,
  RecommendedPokemonSaveResult,
} from "../utils/recommendedPokemonApplication";
import { useCopilotRecommendationCandidates } from "../hooks/useCopilotRecommendationCandidates";
import { useCopilotAnalysisSession } from "../hooks/useCopilotAnalysisSession";
import { useSetOptimizationPlan } from "../hooks/useSetOptimizationPlan";
import { useMetaThreatAnalysisPlan } from "../hooks/useMetaThreatAnalysisPlan";
import { CopilotAnalysisResult } from "./CopilotAnalysisResult";
import { CopilotHistoryControl } from "./CopilotHistoryControl";
import { defaultEvs } from "../data/natures";
import { normalizeShowdownId } from "../api/showdownIds";
import { PokePilotMark } from "./PokePilotMark";

type CopilotPanelProps = {
  savedTeamId: string | null;
  teamName: string;
  battleFormat: BattleFormat;
  team: TeamSlot[];
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
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
    expectedCurrentPokemonId: string | null,
  ) => Promise<RecommendedPokemonApplyResult>;
  onSaveRecommendedPokemon: (
    slotIndex: number,
    pokemonId: string,
  ) => Promise<RecommendedPokemonSaveResult>;
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

const emptyStateCopy: Record<
  CopilotAnalysisScope,
  { title: TranslationKey; description: TranslationKey }
> = {
  team: {
    title: "copilot.empty.teamTitle",
    description: "copilot.empty.teamDescription",
  },
  pokemon: {
    title: "copilot.empty.pokemonTitle",
    description: "copilot.empty.pokemonDescription",
  },
  recommendation: {
    title: "copilot.empty.recommendationTitle",
    description: "copilot.empty.recommendationDescription",
  },
  matchup: {
    title: "copilot.empty.matchupTitle",
    description: "copilot.empty.matchupDescription",
  },
  optimization: {
    title: "copilot.empty.optimizationTitle",
    description: "copilot.empty.optimizationDescription",
  },
};

export function CopilotPanel({
  savedTeamId,
  teamName,
  battleFormat,
  team,
  pokemonIndex,
  itemIndex,
  abilityIndex,
  abilityIndexStatus,
  showdownLegality,
  showdownLegalityStatus,
  selectedSlot,
  buildState,
  diagnostics,
  validity,
  onSelectRecommendedPokemon,
  onSaveRecommendedPokemon,
  onApplyOptimizationCandidate,
  onSaveOptimizationCandidate,
}: CopilotPanelProps) {
  const { locale, t } = useLocalization();
  const [scope, setScope] = useState<CopilotAnalysisScope>("team");
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(
    null,
  );
  const [candidateApplyFailure, setCandidateApplyFailure] = useState<
    Extract<RecommendedPokemonApplyResult, { status: "blocked" }>["reason"] | null
  >(null);
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(null);
  const [candidateSaveStatus, setCandidateSaveStatus] = useState<
    "saved" | "bench-full" | null
  >(null);
  const [optimizationActionStatus, setOptimizationActionStatus] = useState<
    "applied" | "saved" | "bench-full" | "stale" | null
  >(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

  const optimizationInput = useMemo(() => {
    const member = team[selectedSlot];
    if (!member) return null;
    return {
      selectedSlot,
      member,
      build: {
        item: buildState.itemBySlot[selectedSlot] ?? null,
        ability:
          buildState.abilityBySlot[selectedSlot] ?? member.abilities?.[0] ?? "",
        natureId: buildState.natureBySlot[selectedSlot] ?? "hardy",
        evs: buildState.evsBySlot[selectedSlot] ?? { ...defaultEvs },
        moveIds: [
          ...(buildState.moveIdsBySlot[selectedSlot] ?? []),
          "",
          "",
          "",
          "",
        ].slice(0, 4),
      },
      reservedItemIds: team.flatMap((entry, slotIndex) => {
        if (!entry || slotIndex === selectedSlot) return [];
        const item = buildState.itemBySlot[slotIndex];
        const id = normalizeShowdownId(
          item?.showdownId ?? item?.id ?? item?.name ?? "",
        );
        return id ? [id] : [];
      }),
    };
  }, [buildState, selectedSlot, team]);
  const optimizationState = useSetOptimizationPlan(
    optimizationInput,
    battleFormat,
    itemIndex,
    scope === "optimization",
  );
  const matchupState = useMetaThreatAnalysisPlan({
    team,
    buildState,
    battleFormat,
    pokemonIndex,
    itemIndex,
    enabled: scope === "matchup",
  });
  const requestInput = useMemo(
    () => ({
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
  const request = useMemo(() => createCopilotAnalysisRequest({
    ...requestInput,
    optimizationPlan:
      scope === "matchup" ? null : optimizationState.plan,
    threatPlan: matchupState.plan,
  }), [
    requestInput,
    scope,
    optimizationState.plan,
    matchupState.plan,
  ]);
  const optimizationNotice = optimizationState.error
    ? t("copilot.candidateLoadFailed")
    : optimizationState.plan?.status === "unavailable"
      ? t("copilot.noOptimizationCandidates")
      : null;
  const recommendationNotice =
    recommendationState.status === "error"
      ? t("copilot.candidateLoadFailed")
      : null;
  const matchupNotice = matchupState.error
    ? t("copilot.matchupLoadFailed")
    : matchupState.plan?.status === "unavailable"
      ? t("copilot.noMetaThreats")
      : null;
  const isAnalysisPreparing =
    recommendationState.status === "loading" ||
    optimizationState.loading ||
    matchupState.loading;
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
    consumeReveal,
    selectHistory,
  } = useCopilotAnalysisSession({
    savedTeamId,
    request,
    locale,
    battleFormat,
    failedMessage: t("copilot.failed"),
  });
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
    analysisState.status === "loading" || isAnalysisPreparing
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
                : scope === "matchup"
                  ? t("copilot.analyzeMatchup")
                  : t("copilot.optimizeSet");
  const isAnalyzeDisabled =
    analysisState.status === "loading" ||
    isAnalysisPreparing ||
    abilityIndexStatus === "loading" ||
    cooldownRemainingSeconds > 0 ||
    (scope === "recommendation" &&
      showdownLegalityStatus === "loading") ||
    (scope === "optimization" &&
      !optimizationInput) ||
    (scope === "matchup" && !team.some(Boolean));

  useEffect(() => {
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
  }, [requestFingerprint, scope]);

  useEffect(() => {
    setOptimizationActionStatus(null);
  }, [scope]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [analysisState.fingerprint, analysisState.historyEntryId, response, scope]);

  async function handleAnalyze() {
    if (isAnalyzeDisabled) return;
    setOptimizationActionStatus(null);
    if (scope === "recommendation") {
      const candidates = await recommendationState.run();
      if (!candidates?.length) return;
      await analyze(createCopilotAnalysisRequest({
        ...requestInput,
        recommendationCandidates: candidates,
      }));
      return;
    }
    if (scope === "optimization") {
      const plan = await optimizationState.run();
      if (!plan || plan.status !== "ready" || plan.candidates.length === 0) return;
      await analyze(createCopilotAnalysisRequest({ ...requestInput, optimizationPlan: plan }));
      return;
    }
    if (scope === "matchup") {
      const plan = await matchupState.run();
      if (!plan || plan.status !== "ready") return;
      await analyze(createCopilotAnalysisRequest({
        ...requestInput,
        optimizationPlan: null,
        threatPlan: plan,
      }));
      return;
    }
    void analyze();
  }

  async function handleSelectCandidate(pokemonId: string) {
    if (selectingCandidateId || savingCandidateId) {
      return;
    }

    if (isStale) {
      setCandidateApplyFailure("stale");
      return;
    }

    setSelectingCandidateId(pokemonId);
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
    try {
      const candidate = recommendationState.candidates.find(
        (entry) => entry.pokemonId === pokemonId,
      );
      if (!candidate) {
        setCandidateApplyFailure("stale");
        return;
      }
      const result = await onSelectRecommendedPokemon(
        candidate.target.slotIndex,
        pokemonId,
        candidate.target.currentPokemonId,
      );

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

  async function handleSaveCandidate(pokemonId: string) {
    if (selectingCandidateId || savingCandidateId) {
      return;
    }

    if (isStale) {
      setCandidateApplyFailure("stale");
      return;
    }

    setSavingCandidateId(pokemonId);
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
    try {
      const candidate = recommendationState.candidates.find(
        (entry) => entry.pokemonId === pokemonId,
      );
      if (!candidate) {
        setCandidateApplyFailure("stale");
        return;
      }
      const result = await onSaveRecommendedPokemon(
        candidate.target.slotIndex,
        pokemonId,
      );

      if (result.status === "blocked") {
        if (result.reason === "bench-full") {
          setCandidateSaveStatus("bench-full");
        } else {
          setCandidateApplyFailure(result.reason);
        }
        return;
      }

      setCandidateSaveStatus("saved");
    } catch {
      setCandidateApplyFailure("load-failed");
    } finally {
      setSavingCandidateId(null);
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
                analysisState.status === "loading" || isAnalysisPreparing
                  ? faSpinner
                  : response
                    ? faRotateRight
                    : faWandMagicSparkles
              }
              spin={analysisState.status === "loading" || isAnalysisPreparing}
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
          aria-selected={scope === "matchup"}
          className={scope === "matchup" ? "is-active" : ""}
          onClick={() => setScope("matchup")}
        >
          <FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" />
          {t("copilot.matchup")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "recommendation"}
          className={scope === "recommendation" ? "is-active" : ""}
          onClick={() => setScope("recommendation")}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          {t("copilot.recommendTab")}
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

      <div ref={contentRef} className="copilot-content" aria-live="polite">
        {recommendationNotice ? <p role="status">{recommendationNotice}</p> : null}
        {optimizationNotice ? <p role="status">{optimizationNotice}</p> : null}
        {matchupNotice ? <p role="status">{matchupNotice}</p> : null}
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
            onRevealStart={consumeReveal}
            recommendationCandidates={request.recommendationCandidates}
            selectingCandidateId={selectingCandidateId}
            savingCandidateId={savingCandidateId}
            candidateApplyFailure={candidateApplyFailure}
            candidateSaveStatus={candidateSaveStatus}
            optimizationCandidates={
              response.optimizationCandidates ??
              request.optimization?.candidates ??
              []
            }
            optimizationCurrentItemDisplayName={
              request.optimization?.currentBuild.itemDisplayName ?? null
            }
            optimizationActionStatus={optimizationActionStatus}
            onAnalyze={() => void handleAnalyze()}
            onSelectCandidate={(pokemonId) =>
              void handleSelectCandidate(pokemonId)
            }
            onSaveCandidate={(pokemonId) => void handleSaveCandidate(pokemonId)}
            onApplyOptimizationCandidate={handleApplyOptimizationCandidate}
            onSaveOptimizationCandidate={handleSaveOptimizationCandidate}
          />
        ) : (
          <div className="copilot-empty-state">
            <PokePilotMark aria-hidden="true" />
            <strong>{t(emptyStateCopy[scope].title)}</strong>
            <span>{t(emptyStateCopy[scope].description)}</span>
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
