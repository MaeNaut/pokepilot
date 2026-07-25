import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faLightbulb,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
  faUser,
  faUsers,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { PokemonIndexEntry, TeamSlot } from "../types";
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

type CopilotPanelProps = {
  teamName: string;
  battleFormat: BattleFormat;
  team: TeamSlot[];
  pokemonIndex: PokemonIndexEntry[];
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
};

const initialAnalysisState: Record<CopilotAnalysisScope, AnalysisState> = {
  team: { status: "idle" },
  pokemon: { status: "idle" },
};

const priorityTranslationKeys: Record<
  CopilotAnalysisResponse["recommendations"][number]["priority"],
  TranslationKey
> = {
  high: "copilot.priorityHigh",
  medium: "copilot.priorityMedium",
  low: "copilot.priorityLow",
};

export function CopilotPanel({
  teamName,
  battleFormat,
  team,
  pokemonIndex,
  selectedSlot,
  buildState,
  diagnostics,
  validity,
}: CopilotPanelProps) {
  const { locale, pokemonName, t } = useLocalization();
  const [scope, setScope] = useState<CopilotAnalysisScope>("team");
  const [analysisByScope, setAnalysisByScope] = useState(initialAnalysisState);
  const request = useMemo(
    () =>
      createCopilotAnalysisRequest({
        scope,
        battleFormat,
        teamName,
        team,
        pokemonIndex,
        selectedSlot,
        buildState,
        diagnostics,
        validity,
      }),
    [
      battleFormat,
      buildState,
      diagnostics,
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
  const selectedSet = request.sets.find((set) => set.slotIndex === selectedSlot);
  const analysisState = analysisByScope[scope];
  const isStale = Boolean(
    analysisState.response && analysisState.fingerprint !== requestFingerprint,
  );
  const response = analysisState.response;
  const analyzeLabel =
    analysisState.status === "loading"
      ? t("copilot.analyzing")
      : response
        ? t("copilot.refresh")
        : scope === "team"
          ? t("copilot.analyze")
          : t("copilot.analyzePokemon");

  useEffect(() => {
    setAnalysisByScope(initialAnalysisState);
  }, [locale]);

  async function handleAnalyze() {
    setAnalysisByScope((current) => ({
      ...current,
      [scope]: {
        ...current[scope],
        status: "loading",
        error: undefined,
      },
    }));

    try {
      const nextResponse = await Promise.resolve(
        createLocalCopilotAnalysis(request, locale),
      );

      setAnalysisByScope((current) => ({
        ...current,
        [scope]: {
          status: "ready",
          fingerprint: requestFingerprint,
          response: nextResponse,
        },
      }));
    } catch (error) {
      setAnalysisByScope((current) => ({
        ...current,
        [scope]: {
          ...current[scope],
          status: "error",
          error: error instanceof Error ? error.message : t("copilot.failed"),
        },
      }));
    }
  }

  return (
    <aside className="copilot-panel" aria-labelledby="copilot-title">
      <header className="copilot-header">
        <h2 id="copilot-title">PokePilot</h2>
        <button
          className="copilot-analyze-button"
          type="button"
          disabled={analysisState.status === "loading"}
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
          <>
            {isStale ? (
              <div className="copilot-stale-notice">
                <span>
                  {scope === "team"
                    ? t("copilot.teamChanged")
                    : t("copilot.setChanged")}
                </span>
                <button type="button" onClick={() => void handleAnalyze()}>
                  {t("copilot.refreshAnalysis")}
                </button>
              </div>
            ) : null}

            <section className="copilot-summary">
              <div className="copilot-summary-heading">
                <h3>{response.title}</h3>
                <span>{response.playstyle}</span>
              </div>
              <p>{response.summary}</p>
            </section>

            {response.strengths.length > 0 ? (
              <section className="copilot-section">
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

            <section className="copilot-section">
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
              <div className="copilot-section-heading">
                <FontAwesomeIcon icon={faLightbulb} aria-hidden="true" />
                <h3>{t("copilot.nextSteps")}</h3>
              </div>
              <ol>
                {response.recommendations.map((recommendation) => (
                  <li className={`is-${recommendation.priority}`} key={recommendation.id}>
                    <div>
                      <strong>{recommendation.title}</strong>
                      <span>{t(priorityTranslationKeys[recommendation.priority])}</span>
                    </div>
                    <p>{recommendation.reason}</p>
                  </li>
                ))}
              </ol>
            </section>
          </>
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
        <span>{t("copilot.rulesPreview")}</span>
      </footer>
    </aside>
  );
}
