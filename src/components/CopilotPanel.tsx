import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faLock,
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
  ItemIndexEntry,
  TeamSlot,
} from "../types";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import {
  loadShowdownData,
  type ShowdownDataSnapshot,
} from "../api/showdownData";
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
import type { useAccount } from "../hooks/useAccount";
import {
  isVisibleCopilotScope,
  usesHistoricalUsageData,
} from "../utils/copilotScopeAvailability";
import { getCopilotScopeRequirement } from "../utils/copilotScopeRequirements";
import { getCopilotFailureMessage, getCopilotNoCostMessage } from "../utils/copilotFailureMessage";

type CopilotPanelProps = {
  account: ReturnType<typeof useAccount>;
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

const analysisEstimates: Partial<Record<
  CopilotAnalysisScope,
  Record<"luna-low" | "luna-medium" | "sol-low", { seconds: number; cost: string }>
>> = {
  team: { "luna-low": { seconds: 16, cost: "0.0018" }, "luna-medium": { seconds: 75, cost: "0.0048" }, "sol-low": { seconds: 24, cost: "0.036" } },
  pokemon: { "luna-low": { seconds: 10, cost: "0.0015" }, "luna-medium": { seconds: 31, cost: "0.0024" }, "sol-low": { seconds: 15, cost: "0.026" } },
  recommendation: { "luna-low": { seconds: 12, cost: "0.0027" }, "luna-medium": { seconds: 52, cost: "0.0041" }, "sol-low": { seconds: 23, cost: "0.054" } },
};

export function CopilotPanel({
  account,
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
  const [reasoningEffort, setReasoningEffort] = useState<"low" | "medium">("low");
  const [modelId, setModelId] = useState<"gpt-6-luna" | "gpt-6-sol">("gpt-6-luna");
  const [isReasoningMenuOpen, setIsReasoningMenuOpen] = useState(false);
  const reasoningMenuRef = useRef<HTMLDivElement>(null);
  const [isAnalyzeConfirmationOpen, setIsAnalyzeConfirmationOpen] = useState(false);
  const analyzeControlRef = useRef<HTMLDivElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  const analyzeConfirmationHeadingRef = useRef<HTMLElement>(null);
  const [showdownData, setShowdownData] = useState<ShowdownDataSnapshot | null>(null);
  const [isShowdownDataLoading, setIsShowdownDataLoading] = useState(true);
  const [isLoginGateRevealed, setIsLoginGateRevealed] = useState(false);
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

  useEffect(() => {
    if (!account.hasPersonalApiKey) {
      setReasoningEffort("low");
      setModelId("gpt-6-luna");
    }
  }, [account.hasPersonalApiKey]);

  useEffect(() => {
    if (!isReasoningMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!reasoningMenuRef.current?.contains(event.target as Node)) {
        setIsReasoningMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReasoningMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isReasoningMenuOpen]);

  useEffect(() => {
    if (!isAnalyzeConfirmationOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!analyzeControlRef.current?.contains(event.target as Node)) {
        setIsAnalyzeConfirmationOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    analyzeConfirmationHeadingRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [isAnalyzeConfirmationOpen]);

  useEffect(() => {
    let isCurrent = true;

    void loadShowdownData()
      .then((data) => {
        if (isCurrent) setShowdownData(data);
      })
      .catch(() => {
        // Existing request data remains a best-effort fallback when the catalog is unavailable.
      })
      .finally(() => {
        if (isCurrent) setIsShowdownDataLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

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
    abilityIndex,
    diagnostics,
    showdownLegality,
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
        showdownData,
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
      showdownData,
    ],
  );
  const request = useMemo(() => createCopilotAnalysisRequest({
    ...requestInput,
    optimizationPlan:
      scope === "matchup" ? null : optimizationState.plan,
    threatPlan: matchupState.plan,
    threatReplacementCandidates: matchupState.replacementCandidates,
  }), [
    requestInput,
    scope,
    optimizationState.plan,
    matchupState.plan,
    matchupState.replacementCandidates,
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
    matchupState.loading ||
    isShowdownDataLoading;
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
    accountId: account.status === "ready" ? account.user?.id ?? null : null,
    savedTeamId,
    request,
    locale,
    battleFormat,
    failedMessage: t("copilot.failed"),
    reasoningEffort,
    modelId,
    usingPersonalApiKey: account.hasPersonalApiKey,
  });
  const modelChoice = modelId === "gpt-6-sol" ? "sol-low" : reasoningEffort === "medium" ? "luna-medium" : "luna-low";
  const modelLabel = modelId === "gpt-6-sol" ? "Sol low" : reasoningEffort === "medium" ? "Luna medium" : "Luna low";
  const isPersonalModelAvailable = account.hasPersonalApiKey && account.personalApiKeyStatus === "ready";
  const keyRequiredMessage = locale === "ko" ? "개인 OpenAI API 키가 필요합니다." : "Requires your OpenAI API key.";
  const cooldownLabel = formatCooldown(cooldownRemainingSeconds);
  const isUsageDataScope = usesHistoricalUsageData(scope);
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
    (account.enabled && account.status === "ready" && account.personalApiKeyStatus !== "ready") ||
    ((reasoningEffort === "medium" || modelId === "gpt-6-sol") && !account.hasPersonalApiKey) ||
    (scope === "recommendation" &&
      showdownLegalityStatus === "loading") ||
    Boolean(scopeRequirement) ||
    (scope === "optimization" &&
      !optimizationInput) ||
    (scope === "matchup" && !team.some(Boolean));

  useEffect(() => {
    setIsAnalyzeConfirmationOpen(false);
  }, [scope, modelChoice, isAnalyzeDisabled]);

  useEffect(() => {
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
  }, [requestFingerprint, scope]);

  useEffect(() => {
    setOptimizationActionStatus(null);
  }, [scope]);

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
    if (isAnalyzeDisabled) return;
    setIsAnalyzeConfirmationOpen(false);
    if (!(await account.ensureAuthenticated())) return;
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
      const result = await matchupState.run();
      if (!result || result.plan.status !== "ready") return;
      await analyze(createCopilotAnalysisRequest({
        ...requestInput,
        optimizationPlan: null,
        threatPlan: result.plan,
        threatReplacementCandidates: result.replacementCandidates,
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
      const candidate = request.recommendationCandidates.find(
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
      const candidate = request.recommendationCandidates.find(
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
    const displayEffort = entry.reasoningEffort ?? "low";
    const displayModel = entry.modelId ?? "gpt-6-luna";
    setReasoningEffort(displayEffort);
    setModelId(displayModel);
    selectHistory(entry, displayEffort, displayModel);
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

          <div
            className="copilot-analyze-control"
            ref={analyzeControlRef}
            onKeyDown={(event) => {
              if (isAnalyzeConfirmationOpen && event.key === "Escape") {
                event.stopPropagation();
                setIsAnalyzeConfirmationOpen(false);
                analyzeButtonRef.current?.focus();
              }
            }}
          >
            <button
              ref={analyzeButtonRef}
              className="copilot-analyze-button"
              type="button"
              disabled={isAnalyzeDisabled}
              onClick={requestAnalyze}
              aria-haspopup="dialog"
              aria-expanded={isAnalyzeConfirmationOpen}
              aria-controls={isAnalyzeConfirmationOpen ? "copilot-analyze-confirmation" : undefined}
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
            {isAnalyzeConfirmationOpen ? (
              <div
                className="copilot-analyze-confirmation"
                id="copilot-analyze-confirmation"
                role="dialog"
                aria-label={t("copilot.confirmAnalysis")}
              >
                <strong ref={analyzeConfirmationHeadingRef} tabIndex={-1}>
                  {t("copilot.confirmAnalysis")}
                </strong>
                <span className="copilot-analyze-confirmation-model">{modelLabel}</span>
                <p>
                  {analysisEstimates[scope]
                    ? t(account.hasPersonalApiKey ? "copilot.estimate" : "copilot.estimateSite", {
                        seconds: analysisEstimates[scope][modelChoice].seconds,
                        cost: analysisEstimates[scope][modelChoice].cost,
                      })
                    : t("copilot.estimateUnavailable")}
                </p>
                <small>{t(account.hasPersonalApiKey ? "copilot.estimateNote" : "copilot.estimateNoteSite")}</small>
                <div className="copilot-analyze-confirmation-actions">
                  <button type="button" onClick={() => {
                    setIsAnalyzeConfirmationOpen(false);
                    analyzeButtonRef.current?.focus();
                  }}>
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={() => void handleAnalyze()}>
                    {t("copilot.startAnalysis")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
        {scopeRequirement ? (
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
              isUsageDataScope ? " is-usage-warning" : ""
            }`}
          >
            {isUsageDataScope ? (
              <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            ) : (
              <PokePilotMark aria-hidden="true" />
            )}
            <strong>{t(emptyStateCopy[scope].title)}</strong>
            <span>{t(emptyStateCopy[scope].description)}</span>
          </div>
        )}
      </div>

      <footer className="copilot-footer">
        <span>
          {t(isUsageDataScope ? "copilot.regulationMB" : "toolbar.regulation")} ·{" "}
          {t(
            battleFormat === "singles"
              ? "battleFormat.singles"
              : "battleFormat.doubles",
          )}
        </span>
        <div className="copilot-reasoning-control" ref={reasoningMenuRef}>
          <button
            type="button"
            className="copilot-reasoning-trigger"
            aria-label={`${locale === "ko" ? "모델" : "Model"}: ${modelLabel}`}
            aria-expanded={isReasoningMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsReasoningMenuOpen((open) => !open)}
          >
            <span>GPT 6</span>
            <span className="copilot-reasoning-current">{modelLabel}</span>
            <FontAwesomeIcon icon={isReasoningMenuOpen ? faChevronDown : faChevronUp} aria-hidden="true" />
          </button>
          {isReasoningMenuOpen ? (
            <div className="copilot-reasoning-menu" role="menu" aria-label={locale === "ko" ? "모델" : "Model"}>
              <strong>{locale === "ko" ? "모델" : "Model"}</strong>
              {([
                { choice: "sol-low", label: "Sol low", id: "gpt-6-sol", effort: "low", requiresKey: true },
                { choice: "luna-medium", label: "Luna medium", id: "gpt-6-luna", effort: "medium", requiresKey: true },
                { choice: "luna-low", label: "Luna low", id: "gpt-6-luna", effort: "low", requiresKey: false },
              ] as const).map((option) => {
                const locked = option.requiresKey && !isPersonalModelAvailable;
                return (
                  <div className="copilot-reasoning-option" key={option.choice} tabIndex={locked ? 0 : undefined} aria-describedby={locked ? `copilot-${option.choice}-lock` : undefined}>
                    <button type="button" role="menuitemradio" aria-checked={modelChoice === option.choice} className={modelChoice === option.choice ? "is-active" : ""} disabled={locked} onClick={() => { setModelId(option.id); setReasoningEffort(option.effort); setIsReasoningMenuOpen(false); }}>
                      {option.label}
                      {locked ? <FontAwesomeIcon icon={faLock} aria-hidden="true" /> : null}
                    </button>
                    {locked ? <span className="copilot-reasoning-lock-popover" id={`copilot-${option.choice}-lock`} role="tooltip">{keyRequiredMessage}</span> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
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
          </div>
        </div>
      ) : null}
    </aside>
  );
}
