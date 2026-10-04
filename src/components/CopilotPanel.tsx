import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AnalysisPreference } from "../utils/accountPreferences";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faMagnifyingGlass,
  faRotateRight,
  faSliders,
  faTriangleExclamation,
  faUser,
  faUsers,
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
import {
  loadBattleUsageSource,
  type BattleUsageSource,
} from "../api/battleUsage";
import type {
  CopilotAnalysisScope,
} from "../utils/copilotContracts";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { TeamValidityResult } from "../utils/teamValidity";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { HostedAnalysisFailureReason } from "../api/copilotFailure";
import type { CopilotHistoryEntry } from "../utils/copilotHistory";
import { useCopilotRequestPreparation } from "../hooks/useCopilotRequestPreparation";
import { useCopilotCandidateActions, type CopilotCandidateCallbacks } from "../hooks/useCopilotCandidateActions";
import { useCopilotAnalysisSession } from "../hooks/useCopilotAnalysisSession";
import { CopilotAnalysisResult } from "./CopilotAnalysisResult";
import { CopilotHistoryControl } from "./CopilotHistoryControl";
import { CopilotAnalyzeControl } from "./CopilotAnalyzeControl";
import { CopilotModelControl } from "./CopilotModelControl";
import { PokePilotMark } from "./PokePilotMark";
import type { useAccount } from "../hooks/useAccount";
import {
  isVisibleCopilotScope,
  usesUsageData,
} from "../utils/copilotScopeAvailability";
import { getCopilotScopeRequirement } from "../utils/copilotScopeRequirements";
import { getCopilotFailureMessage, getCopilotNoCostMessage } from "../utils/copilotFailureMessage";

type CopilotPanelProps = CopilotCandidateCallbacks & {
  analysisPreference: AnalysisPreference;
  setAnalysisPreference: Dispatch<SetStateAction<AnalysisPreference>>;
  account: ReturnType<typeof useAccount>;
  savedTeamId: string | null;
  onSaveTeamForAnalysis: () => Promise<{ teamId: string; isCurrent: () => boolean } | null>;
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
};

const fallbackTranslationKeys: Record<
  HostedAnalysisFailureReason,
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
  analysisPreference,
  setAnalysisPreference,
  account,
  savedTeamId,
  onSaveTeamForAnalysis,
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
  const { scope, reasoningEffort } = analysisPreference;
  const modelId = "gpt-6-luna";
  const setScope = (next: CopilotAnalysisScope) =>
    setAnalysisPreference((current) => ({ ...current, scope: next }));
  const setReasoningEffort = (next: "low" | "medium") =>
    setAnalysisPreference((current) => ({ ...current, reasoningEffort: next }));
  const [isAnalyzeConfirmationOpen, setIsAnalyzeConfirmationOpen] = useState(false);
  const [isAnalysisStarting, setIsAnalysisStarting] = useState(false);
  const [analysisStartError, setAnalysisStartError] = useState(false);
  const startingAnalysisRef = useRef(false);
  const closeAnalyzeConfirmation = useCallback(() => setIsAnalyzeConfirmationOpen(false), []);
  const [usageSourceState, setUsageSourceState] = useState<{
    battleFormat: BattleFormat;
    source: BattleUsageSource | null;
  } | null>(null);
  const [isLoginGateRevealed, setIsLoginGateRevealed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usesUsageData(scope)) return;

    let cancelled = false;
    void loadBattleUsageSource(battleFormat)
      .then((source) => {
        if (!cancelled) setUsageSourceState({ battleFormat, source });
      })
      .catch(() => {
        if (!cancelled) setUsageSourceState({ battleFormat, source: null });
      });
    return () => { cancelled = true; };
  }, [battleFormat, scope]);

  const { request, prepareRequest, isAnalysisPreparing, recommendationState, optimizationState, matchupState } = useCopilotRequestPreparation({
    scope, locale, battleFormat, teamName, team, pokemonIndex, itemIndex,
    abilityIndex, abilityIndexStatus, showdownLegality, showdownLegalityStatus,
    selectedSlot, buildState, diagnostics, validity,
  });
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
  const {
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
  } = useCopilotAnalysisSession({
    accountId: account.status === "ready" ? account.user?.id ?? null : null,
    accountResolved: account.status !== "loading" && account.status !== "error",
    savedTeamId,
    request,
    locale,
    battleFormat,
    failedMessage: t("copilot.failed"),
    reasoningEffort,
    modelId,
  });
  const recommendationCandidates = response?.recommendationCandidates ?? request.recommendationCandidates;
  const submissionContext = JSON.stringify([requestFingerprint, scope, reasoningEffort, locale, account.user?.id]);
  const latestSubmissionContext = useRef(submissionContext);
  latestSubmissionContext.current = submissionContext;
  useEffect(() => { setAnalysisStartError(false); }, [submissionContext, savedTeamId]);
  const {
    selectingCandidateId, savingCandidateId, candidateApplyFailure, candidateSaveStatus,
    optimizationActionStatus, setOptimizationActionStatus,
    handleSelectCandidate, handleSaveCandidate,
    handleApplyOptimizationCandidate, handleSaveOptimizationCandidate,
  } = useCopilotCandidateActions({
    scope, request: { ...request, recommendationCandidates }, requestFingerprint, isStale, setScope,
    onSelectRecommendedPokemon, onSaveRecommendedPokemon,
    onApplyOptimizationCandidate, onSaveOptimizationCandidate,
  });
  const isPersonalModelAvailable = account.hasPersonalApiKey && account.personalApiKeyStatus === "ready";
  const keyRequiredMessage = locale === "ko" ? "개인 OpenAI API 키가 필요합니다." : "Requires your OpenAI API key.";
  const isUsageDataScope = usesUsageData(scope);
  const usageSourceLoaded = usageSourceState?.battleFormat === battleFormat;
  const usageSource = usageSourceLoaded ? usageSourceState.source : null;
  const isHistoricalUsage = isUsageDataScope && usageSource?.stale === true;
  const isUsageWarning = isHistoricalUsage || (isUsageDataScope && usageSourceLoaded && !usageSource);
  const usageDescriptionKey: TranslationKey = !isUsageDataScope
    ? emptyStateCopy[scope].description
    : isHistoricalUsage
      ? "copilot.usageStale"
      : !usageSource && usageSourceLoaded
      ? "copilot.usageUnavailable"
      : scope === "recommendation"
        ? "copilot.empty.recommendationCurrentDescription"
        : "copilot.empty.optimizationCurrentDescription";
  const displayedUsageSource = response ? analysisState.usageSource : usageSource;
  const usageLabel = response
    ? displayedUsageSource
      ? t("copilot.analysisUsage", { season: displayedUsageSource.season, date: displayedUsageSource.sourceDate })
      : t("copilot.analysisUsageUnknown")
    : usageSource ? `${usageSource.season} · ${usageSource.sourceDate}`
      : t(usageSourceLoaded ? "copilot.usageUnavailable" : "copilot.usageChecking");
  const hasNewerUsage = Boolean(response && displayedUsageSource && usageSource &&
    (displayedUsageSource.season !== usageSource.season || displayedUsageSource.sourceDate !== usageSource.sourceDate));
  const isAccountGateLocked = account.enabled && account.status === "guest";
  const scopeRequirement = getCopilotScopeRequirement({
    scope,
    battleFormat,
    team,
    selectedSlot,
  });
  const visibleTeamHistory = teamHistory.filter((entry) =>
    isVisibleCopilotScope(entry.scope),
  );
  const fallbackMessage = t(fallbackTranslationKeys[analysisState.fallbackReason ?? "unavailable"]);
  const analyzeLabel =
    analysisState.status === "loading" || isAnalysisPreparing || isAnalysisStarting
      ? t("copilot.analyzing")
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
    isAnalysisStarting ||
    isAnalysisPreparing ||
    abilityIndexStatus === "loading" ||
    (account.enabled && account.status === "ready" && account.personalApiKeyStatus !== "ready") ||
    !isPersonalModelAvailable ||
    (scope === "recommendation" &&
      showdownLegalityStatus === "loading") ||
    Boolean(scopeRequirement) ||
    (scope === "optimization" &&
      !team[selectedSlot]) ||
    (scope === "matchup" && !team.some(Boolean));



  useEffect(() => {
    if (!isAccountGateLocked) {
      setIsLoginGateRevealed(false);
    }
  }, [isAccountGateLocked]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [analysisState.fingerprint, analysisState.historyEntryId, response, scope]);

  function requestAnalyze() {
    if (!isAnalyzeDisabled) setIsAnalyzeConfirmationOpen(true);
  }

  async function handleAnalyze() {
    if (isAnalyzeDisabled || startingAnalysisRef.current) return;
    startingAnalysisRef.current = true;
    setIsAnalysisStarting(true);
    setAnalysisStartError(false);
    setIsAnalyzeConfirmationOpen(false);
    const isCurrent = () => submissionContext === latestSubmissionContext.current;
    try {
      if (!(await account.ensureAuthenticated()) || !isCurrent()) return;
      const saved = await onSaveTeamForAnalysis();
      if (!saved) { if (isCurrent()) setAnalysisStartError(true); return; }
      if (!saved.isCurrent() || !isCurrent()) return;
      setOptimizationActionStatus(null);
      const source = usesUsageData(scope) ? await loadBattleUsageSource(battleFormat) : null;
      const preparedRequest = await prepareRequest();
      if (!preparedRequest || !saved.isCurrent() || !isCurrent()) return;
      if (usesUsageData(scope)) {
        const latestSource = await loadBattleUsageSource(battleFormat);
        setUsageSourceState({ battleFormat, source: latestSource });
        if (source?.season !== latestSource?.season || source?.sourceDate !== latestSource?.sourceDate ||
          source?.generatedAt !== latestSource?.generatedAt) {
          setAnalysisStartError(true);
          return;
        }
      }
      if (!saved.isCurrent() || !isCurrent()) return;
      await analyze(preparedRequest, { teamId: saved.teamId, ...(source ? { usageSource: source } : {}) });
    } catch {
      if (isCurrent()) setAnalysisStartError(true);
    } finally {
      startingAnalysisRef.current = false;
      setIsAnalysisStarting(false);
    }
  }


  function handleSelectHistory(entry: CopilotHistoryEntry) {
    setScope(entry.scope);
    const displayEffort = entry.reasoningEffort ?? "low";
    setReasoningEffort(displayEffort);
    selectHistory(entry, displayEffort);
  }

  function handleClearHistory() {
    clearHistory();
  }

  function handleSignIn() {
    void account.act("login");
  }

  return (
    <aside
      className={`copilot-panel${
        isAccountGateLocked ? " is-account-locked" : ""
      }${isLoginGateRevealed ? " is-login-gate-revealed" : ""}`}
      aria-labelledby="copilot-title"
      onPointerEnter={() => {
        if (isAccountGateLocked) setIsLoginGateRevealed(true);
      }}
      onPointerLeave={() => {
        if (isAccountGateLocked) setIsLoginGateRevealed(false);
      }}
    >
      <div
        className="copilot-panel-content"
        inert={isAccountGateLocked || undefined}
      >
      <header className="copilot-header">
        <h2 id="copilot-title">PokePilot</h2>
        <div className="copilot-header-actions">
          <CopilotHistoryControl
            entries={visibleTeamHistory}
            activeEntryId={analysisState.historyEntryId}
            onSelect={handleSelectHistory}
            onClear={handleClearHistory}
          />

          <CopilotAnalyzeControl
            scope={scope}
            reasoningEffort={reasoningEffort}
            isAnalyzeConfirmationOpen={isAnalyzeConfirmationOpen}
            isAnalyzeDisabled={isAnalyzeDisabled}
            isBusy={analysisState.status === "loading" || isAnalysisPreparing || isAnalysisStarting}
            hasResponse={Boolean(response)}
            hasPersonalApiKey={account.hasPersonalApiKey}
            analyzeLabel={analyzeLabel}
            onRequest={requestAnalyze}
            onClose={closeAnalyzeConfirmation}
            onConfirm={handleAnalyze}
          />
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
        {analysisStartError ? <p role="alert">{t("copilot.autoSaveFailed")}</p> : null}
        {isUsageDataScope && hasNewerUsage ? <p role="status">{t("copilot.usageChanged")}</p> : null}
        {recommendationNotice ? <p role="status">{recommendationNotice}</p> : null}
        {optimizationNotice ? <p role="status">{optimizationNotice}</p> : null}
        {matchupNotice ? <p role="status">{matchupNotice}</p> : null}
        {account.status === "ready" && !account.hasPersonalApiKey ? (
          <div className="copilot-empty-state" role="status">
            <FontAwesomeIcon icon={faLock} aria-hidden="true" />
            <strong>{keyRequiredMessage}</strong>
            <span>{locale === "ko" ? "우측 상단 계정 설정에서 키를 등록하면 분석을 사용할 수 있습니다." : "Add your key in account settings at the top right to use analysis."}</span>
            <a className="copilot-example-link" href={`/help/kabamanda-${locale}.html`} target="_blank" rel="noopener noreferrer">
              {locale === "ko" ? "PokePilot 분석 예시 보기 (키 없이)" : "See PokePilot analysis examples (no key needed)"}
            </a>
          </div>
        ) : scopeRequirement ? (
          <div className="copilot-empty-state is-requirement">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            <strong>
              {t(
                scopeRequirement.kind === "minimum-team-size"
                  ? "copilot.requirement.teamTitle"
                  : "copilot.requirement.pokemonTitle",
              )}
            </strong>
            <span>
              {scopeRequirement.kind === "minimum-team-size"
                ? t("copilot.requirement.teamDescription", {
                    required: scopeRequirement.requiredCount,
                    remaining:
                      scopeRequirement.requiredCount - scopeRequirement.activeCount,
                    format: t(
                      battleFormat === "singles"
                        ? "battleFormat.singles"
                        : "battleFormat.doubles",
                    ),
                  })
                : t("copilot.requirement.pokemonDescription")}
            </span>
          </div>
        ) : analysisState.status === "error" ? (
          <div className="copilot-empty-state is-error">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            <strong>{t("copilot.unavailable")}</strong>
            <span>{getCopilotFailureMessage(analysisState.errorCode, locale, analysisState.error ?? t("copilot.failed"))}</span>
            {analysisState.errorCode === "AI_QUOTA_EXCEEDED" ? <>
              <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer">OpenAI Billing</a>
              <a href="https://platform.openai.com/settings/organization/limits" target="_blank" rel="noopener noreferrer">OpenAI Limits</a>
            </> : null}
            {["PERSONAL_KEY_REQUIRED", "PERSONAL_KEY_INVALID", "PERSONAL_KEY_FORBIDDEN", "AI_QUOTA_EXCEEDED", "AI_MODEL_UNAVAILABLE"].includes(analysisState.errorCode ?? "") ? (
              <a href={`/help/api-key-${locale}.html#troubleshoot`} target="_blank" rel="noopener noreferrer">
                {locale === "ko" ? "API 키 문제 해결 가이드 (새 탭)" : "API key troubleshooting (new tab)"}
              </a>
            ) : null}
            {analysisState.providerAttempted === false ? (
              <span>{getCopilotNoCostMessage(locale)}</span>
            ) : null}
            <button type="button" onClick={requestAnalyze} disabled={isAnalyzeDisabled}>
              <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
              {t("copilot.refresh")}
            </button>
          </div>
        ) : response ? (
          <CopilotAnalysisResult
            key={
              analysisState.historyEntryId ??
              `${analysisContextKey}:${analysisState.fingerprint ?? "analysis"}`
            }
            response={response}
            execution={analysisState.execution}
            scope={scope}
            usedFallback={Boolean(analysisState.usedFallback)}
            fallbackMessage={fallbackMessage}
            isStale={isStale}
            isLanguageMismatch={isLanguageMismatch}
            isAnalyzeDisabled={isAnalyzeDisabled}
            shouldReveal={Boolean(analysisState.shouldReveal)}
            onRevealStart={consumeReveal}
            recommendationCandidates={recommendationCandidates}
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
            onAnalyze={requestAnalyze}
            onSelectCandidate={(pokemonId) =>
              void handleSelectCandidate(pokemonId)
            }
            onSaveCandidate={(pokemonId) => void handleSaveCandidate(pokemonId)}
            onApplyOptimizationCandidate={handleApplyOptimizationCandidate}
            onSaveOptimizationCandidate={handleSaveOptimizationCandidate}
          />
        ) : (
          <div
            className={`copilot-empty-state${
              isUsageWarning ? " is-usage-warning" : ""
            }`}
          >
            {isUsageWarning ? (
              <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            ) : (
              <PokePilotMark aria-hidden="true" />
            )}
            <strong>{t(emptyStateCopy[scope].title)}</strong>
            <span>{t(usageDescriptionKey)}</span>
          </div>
        )}
      </div>

      <footer className="copilot-footer">
        <span>
          {isUsageDataScope ? usageLabel : t("toolbar.regulation")} ·{" "}
          {t(
            battleFormat === "singles"
              ? "battleFormat.singles"
              : "battleFormat.doubles",
          )}
        </span>
        <CopilotModelControl
          reasoningEffort={reasoningEffort}
          isPersonalModelAvailable={isPersonalModelAvailable}
          onChange={(effort) => setAnalysisPreference((current) => ({
            ...current, modelId: "gpt-6-luna", reasoningEffort: effort,
          }))}
        />
      </footer>
      </div>

      {isAccountGateLocked ? (
        <div
          className="copilot-login-gate"
          role="group"
          aria-label={t("account.loginRequired")}
          onFocus={() => setIsLoginGateRevealed(true)}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse") {
              setIsLoginGateRevealed(true);
            }
          }}
        >
          <div className="copilot-login-gate-card">
            <FontAwesomeIcon icon={faUser} aria-hidden="true" />
            <strong>{t("account.loginRequired")}</strong>
            <span>{t("account.signInDescription")}</span>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={account.busy}
            >
              {t("account.signIn")}
            </button>
            <a className="copilot-example-link" href={`/help/kabamanda-${locale}.html`} target="_blank" rel="noopener noreferrer">
              {locale === "ko" ? "PokePilot 분석 예시 보기 (로그인 없이)" : "See PokePilot analysis examples (no sign-in)"}
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
