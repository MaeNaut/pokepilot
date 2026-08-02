import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faClockRotateLeft,
  faLightbulb,
  faRotateRight,
  faSpinner,
  faTrash,
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

type CopilotPanelProps = {
  savedTeamId: string | null;
  teamName: string;
  battleFormat: BattleFormat;
  team: TeamSlot[];
  pokemonIndex: PokemonIndexEntry[];
  abilityIndex: PokemonAbility[];
  abilityIndexStatus: DataLoadStatus;
  selectedSlot: number;
  buildState: TeamBuildState;
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
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

type HistoryMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const idleAnalysisState: AnalysisState = { status: "idle" };
const historyMenuWidth = 340;
const historyMenuViewportMargin = 12;
const historyMenuAnchorGap = 9;

function formatCooldown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getHistoryMenuPosition(anchor: HTMLElement): HistoryMenuPosition {
  const anchorRect = anchor.getBoundingClientRect();
  const width = Math.min(
    historyMenuWidth,
    Math.max(0, window.innerWidth - historyMenuViewportMargin * 2),
  );
  const left = Math.min(
    Math.max(historyMenuViewportMargin, anchorRect.right - width),
    window.innerWidth - width - historyMenuViewportMargin,
  );
  const top = anchorRect.bottom + historyMenuAnchorGap;

  return {
    top,
    left,
    width,
    maxHeight: Math.max(180, window.innerHeight - top - historyMenuViewportMargin),
  };
}

function getAnalysisContextKey(
  teamKey: string,
  scope: CopilotAnalysisScope,
) {
  return `${teamKey}:${scope}`;
}

const priorityTranslationKeys: Record<
  CopilotAnalysisResponse["recommendations"][number]["priority"],
  TranslationKey
> = {
  high: "copilot.priorityHigh",
  medium: "copilot.priorityMedium",
  low: "copilot.priorityLow",
};

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

  console.warn("[PokePilot] Hosted analysis fallback.", {
    reason,
    ...(error instanceof CopilotApiError
      ? {
          code: error.code,
          status: error.status,
          retryAfterSeconds: error.retryAfterSeconds,
        }
      : {
          errorName: error instanceof Error ? error.name : typeof error,
        }),
  });
}

export function CopilotPanel({
  savedTeamId,
  teamName,
  battleFormat,
  team,
  pokemonIndex,
  abilityIndex,
  abilityIndexStatus,
  selectedSlot,
  buildState,
  diagnostics,
  validity,
}: CopilotPanelProps) {
  const { locale, pokemonName, t } = useLocalization();
  const [scope, setScope] = useState<CopilotAnalysisScope>("team");
  const [analysisByContext, setAnalysisByContext] = useState<
    Record<string, AnalysisState>
  >({});
  const [analysisHistory, setAnalysisHistory] = useState(
    getStoredCopilotHistory,
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryDeletePending, setIsHistoryDeletePending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownClock, setCooldownClock] = useState(Date.now);
  const [historyMenuPosition, setHistoryMenuPosition] =
    useState<HistoryMenuPosition | null>(null);
  const historyControlRef = useRef<HTMLDivElement | null>(null);
  const historyMenuRef = useRef<HTMLDivElement | null>(null);
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
  const historyDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
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
            : t("copilot.analyzePokemon");
  const isAnalyzeDisabled =
    analysisState.status === "loading" ||
    abilityIndexStatus === "loading" ||
    cooldownRemainingSeconds > 0;

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

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        historyControlRef.current?.contains(target) ||
        historyMenuRef.current?.contains(target)
      ) {
        return;
      }

      setIsHistoryOpen(false);
      setIsHistoryDeletePending(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsHistoryOpen(false);
        setIsHistoryDeletePending(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isHistoryOpen]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    function updatePosition() {
      if (historyControlRef.current) {
        setHistoryMenuPosition(getHistoryMenuPosition(historyControlRef.current));
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [isHistoryOpen]);

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
    setIsHistoryOpen(false);
    setIsHistoryDeletePending(false);
  }

  function handleClearHistory() {
    setAnalysisHistory((current) => {
      const nextHistory = clearCopilotHistoryForTeam(current, historyTeamKey);
      storeCopilotHistory(nextHistory);
      return nextHistory;
    });
    setIsHistoryOpen(false);
    setIsHistoryDeletePending(false);
  }

  function handleToggleHistory() {
    if (isHistoryOpen) {
      setIsHistoryOpen(false);
      setIsHistoryDeletePending(false);
      return;
    }

    if (historyControlRef.current) {
      setHistoryMenuPosition(getHistoryMenuPosition(historyControlRef.current));
    }
    setIsHistoryOpen(true);
  }

  return (
    <aside className="copilot-panel" aria-labelledby="copilot-title">
      <header className="copilot-header">
        <h2 id="copilot-title">PokePilot</h2>
        <div className="copilot-header-actions">
          <div className="copilot-history-control" ref={historyControlRef}>
            <button
              className="copilot-history-button"
              type="button"
              aria-label={t("copilot.history")}
              aria-expanded={isHistoryOpen}
              title={t("copilot.history")}
              onClick={handleToggleHistory}
            >
              <FontAwesomeIcon icon={faClockRotateLeft} aria-hidden="true" />
            </button>

            {isHistoryOpen && historyMenuPosition && typeof document !== "undefined"
              ? createPortal(
                  <div
                    className="copilot-history-menu"
                    role="dialog"
                    aria-label={t("copilot.history")}
                    ref={historyMenuRef}
                    style={historyMenuPosition}
                  >
                    <header>
                      <strong>{t("copilot.history")}</strong>
                      {teamHistory.length > 0 ? (
                        <button
                          className="copilot-history-delete-button"
                          type="button"
                          aria-label={t("copilot.clearHistory")}
                          aria-expanded={isHistoryDeletePending}
                          title={t("copilot.clearHistory")}
                          onClick={() => setIsHistoryDeletePending(true)}
                        >
                          <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                        </button>
                      ) : null}
                    </header>

                    {isHistoryDeletePending ? (
                      <div
                        className="clear-pokemon-confirm copilot-history-delete-confirm"
                        role="alertdialog"
                        aria-label={t("copilot.confirmClearHistory")}
                      >
                        <strong>{t("copilot.confirmClearHistory")}</strong>
                        <span>{t("toolbar.deleteWarning")}</span>
                        <div className="clear-pokemon-confirm-actions">
                          <button
                            className="clear-pokemon-confirm-button"
                            type="button"
                            onClick={() => setIsHistoryDeletePending(false)}
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            className="clear-pokemon-confirm-button is-danger"
                            type="button"
                            onClick={handleClearHistory}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {teamHistory.length > 0 ? (
                      <div className="copilot-history-list">
                        {teamHistory.map((entry) => (
                          <button
                            className={
                              analysisState.historyEntryId === entry.id
                                ? "is-current"
                                : ""
                            }
                            type="button"
                            key={entry.id}
                            onClick={() => handleSelectHistory(entry)}
                          >
                            <span className="copilot-history-meta">
                              {t(
                                entry.scope === "team"
                                  ? "copilot.team"
                                  : "copilot.pokemon",
                              )}
                              {" · "}
                              {t(
                                entry.locale === "ko"
                                  ? "language.korean"
                                  : "language.english",
                              )}
                              {" · "}
                              <time dateTime={entry.createdAt}>
                                {historyDateFormatter.format(
                                  new Date(entry.createdAt),
                                )}
                              </time>
                            </span>
                            <strong>{entry.response.title}</strong>
                            <span className="copilot-history-summary">
                              {entry.response.summary}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p>{t("copilot.historyEmpty")}</p>
                    )}
                  </div>,
                  document.body,
                )
              : null}
          </div>

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
      </div>

      <div className="copilot-content" aria-live="polite">
        {analysisState.status === "error" ? (
          <div className="copilot-empty-state is-error">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            <strong>{t("copilot.unavailable")}</strong>
            <span>{analysisState.error}</span>
          </div>
        ) : response ? (
          <div
            className={`copilot-result${
              analysisState.shouldReveal ? " is-revealing" : ""
            }`}
            key={
              analysisState.historyEntryId ??
              `${analysisContextKey}:${analysisState.fingerprint ?? "analysis"}`
            }
          >
            {analysisState.usedFallback ? (
              <div className="copilot-fallback-notice" role="status">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  aria-hidden="true"
                />
                <span>{fallbackMessage}</span>
              </div>
            ) : null}

            {isStale || isLanguageMismatch ? (
              <div className="copilot-stale-notice">
                <span>
                  {isLanguageMismatch
                    ? t("copilot.languageChanged")
                    : scope === "team"
                      ? t("copilot.teamChanged")
                      : t("copilot.setChanged")}
                </span>
                <button
                  type="button"
                  disabled={isAnalyzeDisabled}
                  onClick={() => void handleAnalyze()}
                >
                  {t("copilot.refreshAnalysis")}
                </button>
              </div>
            ) : null}

            <section className="copilot-summary copilot-reveal is-summary">
              <div className="copilot-summary-heading">
                <h3>{response.title}</h3>
                <span>{response.playstyle}</span>
              </div>
              <p>{response.summary}</p>
            </section>

            {response.strengths.length > 0 ? (
              <section className="copilot-section copilot-reveal is-strengths">
                <div className="copilot-section-heading">
                  <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                  <h3>{t("copilot.strengths")}</h3>
                </div>
                <ul className="copilot-insight-list is-strength">
                  {response.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="copilot-section copilot-reveal is-focus">
              <div className="copilot-section-heading">
                <FontAwesomeIcon
                  icon={response.weaknesses.length > 0 ? faTriangleExclamation : faCheck}
                  aria-hidden="true"
                />
                <h3>{t("copilot.focus")}</h3>
              </div>
              {response.weaknesses.length > 0 ? (
                <ul className="copilot-insight-list is-focus">
                  {response.weaknesses.map((weakness) => (
                    <li key={weakness}>{weakness}</li>
                  ))}
                </ul>
              ) : (
                <p className="copilot-clear-message">{t("copilot.noConcerns")}</p>
              )}
            </section>

            <section className="copilot-section copilot-recommendations">
              <div className="copilot-section-heading copilot-reveal is-recommendations-heading">
                <FontAwesomeIcon icon={faLightbulb} aria-hidden="true" />
                <h3>{t("copilot.nextSteps")}</h3>
              </div>
              <ol>
                {response.recommendations.map((recommendation) => (
                  <li
                    className={`is-${recommendation.priority} copilot-reveal is-recommendation`}
                    key={recommendation.id}
                  >
                    <div>
                      <strong>{recommendation.title}</strong>
                      <span>{t(priorityTranslationKeys[recommendation.priority])}</span>
                    </div>
                    <p>{recommendation.reason}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        ) : (
          <div className="copilot-empty-state">
            <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" />
            <strong>{t("copilot.noAnalysis")}</strong>
            <span>
              {scope === "team"
                ? t("copilot.activeSets", { count: diagnostics.filledSlots })
                : selectedSet
                  ? pokemonName({
                      id: selectedSet.pokemonId,
                      fallback: selectedSet.pokemonName,
                      includeForm: false,
                    })
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
