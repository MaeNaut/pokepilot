import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faLightbulb,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type {
  CopilotAnalysisResponse,
  CopilotAnalysisScope,
} from "../utils/copilotAnalysis";
import type { CopilotRecommendationCandidateSnapshot } from "../utils/pokemonRecommendations";
import type { RecommendedPokemonApplyResult } from "../utils/recommendedPokemonApplication";
import { TypeBadge } from "./TypeBadge";

type CandidateApplyFailureReason = Extract<
  RecommendedPokemonApplyResult,
  { status: "blocked" }
>["reason"];

type CopilotAnalysisResultProps = {
  response: CopilotAnalysisResponse;
  scope: CopilotAnalysisScope;
  usedFallback: boolean;
  fallbackMessage: string;
  isStale: boolean;
  isLanguageMismatch: boolean;
  isAnalyzeDisabled: boolean;
  shouldReveal: boolean;
  recommendationCandidates: CopilotRecommendationCandidateSnapshot[];
  selectingCandidateId: string | null;
  candidateApplyFailure: CandidateApplyFailureReason | null;
  onAnalyze: () => void;
  onSelectCandidate: (pokemonId: string) => void;
};

const priorityTranslationKeys: Record<
  CopilotAnalysisResponse["recommendations"][number]["priority"],
  TranslationKey
> = {
  high: "copilot.priorityHigh",
  medium: "copilot.priorityMedium",
  low: "copilot.priorityLow",
};

const candidateApplyFailureTranslationKeys: Record<
  CandidateApplyFailureReason,
  TranslationKey
> = {
  stale: "copilot.candidateApplyStale",
  invalid: "copilot.candidateApplyInvalid",
  "legality-unavailable": "copilot.candidateApplyUnavailable",
  "load-failed": "copilot.candidateApplyLoadFailed",
};

export function CopilotAnalysisResult({
  response,
  scope,
  usedFallback,
  fallbackMessage,
  isStale,
  isLanguageMismatch,
  isAnalyzeDisabled,
  shouldReveal,
  recommendationCandidates,
  selectingCandidateId,
  candidateApplyFailure,
  onAnalyze,
  onSelectCandidate,
}: CopilotAnalysisResultProps) {
  const { t } = useLocalization();
  const candidatesById = useMemo(
    () =>
      new Map(
        recommendationCandidates.map((candidate) => [
          candidate.pokemonId,
          candidate,
        ]),
      ),
    [recommendationCandidates],
  );

  return (
    <div className={`copilot-result${shouldReveal ? " is-revealing" : ""}`}>
      {usedFallback ? (
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
                : scope === "pokemon"
                  ? t("copilot.setChanged")
                  : t("copilot.recommendationChanged")}
          </span>
          <button
            type="button"
            disabled={isAnalyzeDisabled}
            onClick={onAnalyze}
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

      {scope !== "recommendation" || response.weaknesses.length > 0 ? (
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
      ) : null}

      <section
        className={`copilot-section copilot-recommendations${
          scope === "recommendation" ? " is-candidates" : ""
        }`}
      >
        <div className="copilot-section-heading copilot-reveal is-recommendations-heading">
          <FontAwesomeIcon icon={faLightbulb} aria-hidden="true" />
          <h3>
            {scope === "recommendation"
              ? t("copilot.candidates")
              : t("copilot.nextSteps")}
          </h3>
        </div>
        {scope === "recommendation" && candidateApplyFailure ? (
          <div className="copilot-candidate-apply-failure" role="alert">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              aria-hidden="true"
            />
            <span>{t(candidateApplyFailureTranslationKeys[candidateApplyFailure])}</span>
          </div>
        ) : null}
        <ol>
          {response.recommendations.map((recommendation) => {
            const candidate =
              scope === "recommendation"
                ? candidatesById.get(recommendation.id)
                : undefined;

            return (
              <li
                className={`is-${recommendation.priority} copilot-reveal is-recommendation`}
                key={recommendation.id}
              >
                {candidate ? (
                  <div className="copilot-candidate-heading">
                    <div>
                      <strong>{candidate.displayName}</strong>
                      <span className="copilot-candidate-types">
                        {candidate.types.map((type) => (
                          <TypeBadge type={type} key={type} />
                        ))}
                      </span>
                    </div>
                    <span>
                      {candidate.usageRank
                        ? t("copilot.usageRank", { rank: candidate.usageRank })
                        : t("copilot.unranked")}
                    </span>
                  </div>
                ) : (
                  <div>
                    <strong>{recommendation.title}</strong>
                    <span>
                      {t(priorityTranslationKeys[recommendation.priority])}
                    </span>
                  </div>
                )}
                <p>{recommendation.reason}</p>
                {candidate ? (
                  <button
                    className="copilot-candidate-select"
                    type="button"
                    disabled={Boolean(selectingCandidateId) || isStale}
                    onClick={() => onSelectCandidate(candidate.pokemonId)}
                  >
                    {selectingCandidateId === candidate.pokemonId ? (
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        aria-hidden="true"
                      />
                    ) : null}
                    {t("copilot.selectCandidate")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
