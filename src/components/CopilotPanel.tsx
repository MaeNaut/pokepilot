import { useMemo, useState } from "react";
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
import type { TeamBuildState } from "../hooks/useTeamBuildState";
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

type CopilotPanelProps = {
  teamName: string;
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

const priorityLabels = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function CopilotPanel({
  teamName,
  team,
  pokemonIndex,
  selectedSlot,
  buildState,
  diagnostics,
  validity,
}: CopilotPanelProps) {
  const [scope, setScope] = useState<CopilotAnalysisScope>("team");
  const [analysisByScope, setAnalysisByScope] = useState(initialAnalysisState);
  const request = useMemo(
    () =>
      createCopilotAnalysisRequest({
        scope,
        teamName,
        team,
        pokemonIndex,
        selectedSlot,
        buildState,
        diagnostics,
        validity,
      }),
    [
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
      ? "Analyzing"
      : response
        ? "Refresh"
        : scope === "team"
          ? "Analyze Team"
          : "Analyze Pokemon";

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
      const nextResponse = await Promise.resolve(createLocalCopilotAnalysis(request));

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
          error: error instanceof Error ? error.message : "Analysis failed.",
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

      <div className="copilot-scope-tabs" role="tablist" aria-label="Analysis scope">
        <button
          type="button"
          role="tab"
          aria-selected={scope === "team"}
          className={scope === "team" ? "is-active" : ""}
          onClick={() => setScope("team")}
        >
          <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
          Team
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "pokemon"}
          className={scope === "pokemon" ? "is-active" : ""}
          onClick={() => setScope("pokemon")}
        >
          <FontAwesomeIcon icon={faUser} aria-hidden="true" />
          Pokemon
        </button>
      </div>

      <div className="copilot-content" aria-live="polite">
        {analysisState.status === "error" ? (
          <div className="copilot-empty-state is-error">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            <strong>Analysis unavailable</strong>
            <span>{analysisState.error}</span>
          </div>
        ) : response ? (
          <>
            {isStale ? (
              <div className="copilot-stale-notice">
                <span>{scope === "team" ? "Team changed" : "Set changed"}</span>
                <button type="button" onClick={() => void handleAnalyze()}>
                  Refresh analysis
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
                  <h3>Strengths</h3>
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
                <h3>Focus</h3>
              </div>
              {response.weaknesses.length > 0 ? (
                <ul className="copilot-insight-list is-focus">
                  {response.weaknesses.map((weakness) => (
                    <li key={weakness}>{weakness}</li>
                  ))}
                </ul>
              ) : (
                <p className="copilot-clear-message">No priority concerns found.</p>
              )}
            </section>

            <section className="copilot-section copilot-recommendations">
              <div className="copilot-section-heading">
                <FontAwesomeIcon icon={faLightbulb} aria-hidden="true" />
                <h3>Next Steps</h3>
              </div>
              <ol>
                {response.recommendations.map((recommendation) => (
                  <li className={`is-${recommendation.priority}`} key={recommendation.id}>
                    <div>
                      <strong>{recommendation.title}</strong>
                      <span>{priorityLabels[recommendation.priority]}</span>
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
            <strong>No analysis yet</strong>
            <span>
              {scope === "team"
                ? `${diagnostics.filledSlots}/6 active sets`
                : selectedSet?.pokemonName ?? `Slot ${selectedSlot + 1} is empty`}
            </span>
          </div>
        )}
      </div>

      <footer className="copilot-footer">
        <span>Regulation M-B</span>
        <span>Rules-based preview</span>
      </footer>
    </aside>
  );
}
