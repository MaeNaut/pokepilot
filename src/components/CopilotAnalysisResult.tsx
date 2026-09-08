import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxArchive,
  faCheck,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type {
  CopilotAnalysisResponse,
  CopilotAnalysisScope,
  CopilotQualityWarningCode,
  CopilotSetOptimizationCandidateSnapshot,
} from "../utils/copilotContracts";
import type { CopilotRecommendationCandidateSnapshot } from "../utils/pokemonRecommendations";
import type { RecommendedPokemonApplyResult } from "../utils/recommendedPokemonApplication";
import {
  CopilotOptimizationRecommendation,
  CopilotOptimizationStatus,
  type OptimizationActionStatus,
} from "./CopilotOptimizationRecommendation";
import { fetchPokemon } from "../api/pokeApi";
import type { TeamMember } from "../types";
import { PokemonIcon } from "./PokemonIcon";
import { TypeBadge } from "./TypeBadge";
import { useSequentialTextReveal } from "../hooks/useSequentialTextReveal";

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
  savingCandidateId: string | null;
  candidateApplyFailure: CandidateApplyFailureReason | null;
  candidateSaveStatus: "saved" | "bench-full" | null;
  optimizationCandidates: CopilotSetOptimizationCandidateSnapshot[];
  optimizationCurrentItemDisplayName: string | null;
  optimizationActionStatus: OptimizationActionStatus | null;
  onAnalyze: () => void;
  onSelectCandidate: (pokemonId: string) => void;
  onSaveCandidate: (pokemonId: string) => void;
  onApplyOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => void;
  onSaveOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => void;
};

const recommendationPriorityOrder: Record<
  CopilotAnalysisResponse["recommendations"][number]["priority"],
  number
> = {
  high: 0,
  medium: 1,
  low: 2,
};

const qualityWarningTranslationKeys: Record<
  CopilotQualityWarningCode,
  TranslationKey
> = {
  "grounding-incomplete": "copilot.qualityWarningGrounding",
  "recommendations-adjusted": "copilot.qualityWarningRecommendations",
  "content-repaired": "copilot.qualityWarningRepaired",
  "service-degraded": "copilot.qualityWarningService",
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

function CopilotCandidateSprite({
  candidate,
}: {
  candidate: CopilotRecommendationCandidateSnapshot;
}) {
  const [pokemon, setPokemon] = useState<TeamMember | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setPokemon(null);

    void fetchPokemon(candidate.pokemonId)
      .then((loadedPokemon) => {
        if (!isCancelled) {
          setPokemon(loadedPokemon);
        }
      })
      .catch(() => {
        // Keep the text fallback when no sprite source is available.
      });

    return () => {
      isCancelled = true;
    };
  }, [candidate.pokemonId]);

  return (
    <span className="copilot-candidate-sprite" aria-hidden="true">
      {pokemon ? <PokemonIcon pokemon={pokemon} /> : null}
    </span>
  );
}

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
  savingCandidateId,
  candidateApplyFailure,
  candidateSaveStatus,
  optimizationCandidates,
  optimizationCurrentItemDisplayName,
  optimizationActionStatus,
  onAnalyze,
  onSelectCandidate,
  onSaveCandidate,
  onApplyOptimizationCandidate,
  onSaveOptimizationCandidate,
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
  const optimizationCandidatesById = useMemo(
    () =>
      new Map(
        optimizationCandidates.map((candidate) => [candidate.id, candidate]),
      ),
    [optimizationCandidates],
  );
  const sortedRecommendations = useMemo(
    () =>
      [...response.recommendations].sort(
        (left, right) =>
          recommendationPriorityOrder[left.priority] -
          recommendationPriorityOrder[right.priority],
      ),
    [response.recommendations],
  );
  const narrativeTexts = useMemo(
    () => [response.title, ...response.paragraphs],
    [response.paragraphs, response.title],
  );
  const narrativeReveal = useSequentialTextReveal(
    narrativeTexts,
    shouldReveal,
  );

  const renderNarrativeText = (text: string, index: number) => {
    if (!narrativeReveal.isAnimated) {
      return text;
    }

    return (
      <span aria-label={text}>
        <span aria-hidden="true">{narrativeReveal.visibleTexts[index]}</span>
        {narrativeReveal.activeIndex === index ? (
          <span
            className="copilot-typing-cursor"
            aria-hidden="true"
          />
        ) : null}
      </span>
    );
  };

  return (
    <div
      className={`copilot-result${shouldReveal ? " is-revealing" : ""}${
        narrativeReveal.isComplete ? " is-narrative-complete" : ""
      }`}
    >
      {usedFallback ? (
        <div className="copilot-fallback-notice" role="status">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            aria-hidden="true"
          />
          <span>{fallbackMessage}</span>
        </div>
      ) : null}

      {!usedFallback && response.qualityWarnings?.length ? (
        <div
          className="copilot-fallback-notice copilot-quality-notice"
          role="status"
        >
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            aria-hidden="true"
          />
          <span>
            {response.qualityWarnings
              .map((warning) => t(qualityWarningTranslationKeys[warning]))
              .join(" ")}
          </span>
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
                : scope === "recommendation"
                  ? t("copilot.recommendationChanged")
                    : scope === "matchup"
                      ? t("copilot.matchupChanged")
                      : t("copilot.optimizationChanged")}
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

      <section className="copilot-narrative">
        <h3>{renderNarrativeText(response.title, 0)}</h3>
        <div className="copilot-narrative-copy">
          {response.paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph}`}>
              {renderNarrativeText(paragraph, index + 1)}
            </p>
          ))}
        </div>
      </section>

      {narrativeReveal.isComplete ? <section
        className={`copilot-section copilot-recommendations${
          scope === "recommendation" ? " is-candidates" : ""
        }${scope === "optimization" ? " is-optimization" : ""}${
          scope === "team" || scope === "pokemon" || scope === "matchup" ? " is-strategy" : ""
        }`}
      >
        <div className="copilot-section-heading copilot-reveal is-recommendations-heading">
          <h3>
            {scope === "recommendation"
              ? t("copilot.candidates")
              : scope === "optimization"
                ? t("copilot.optimizedSamples")
                : scope === "matchup"
                  ? t("copilot.matchupRecommendations")
                  : t("copilot.nextSteps")}
          </h3>
        </div>
        {scope === "recommendation" && candidateApplyFailure ? (
          <div className="copilot-candidate-apply-failure" role="alert">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              aria-hidden="true"
            />
            <span>
              {t(candidateApplyFailureTranslationKeys[candidateApplyFailure])}
            </span>
          </div>
        ) : null}
        {scope === "recommendation" && candidateSaveStatus ? (
          <div
            className={`copilot-candidate-save-status${
              candidateSaveStatus === "bench-full" ? " is-error" : ""
            }`}
            role="status"
          >
            <FontAwesomeIcon
              icon={
                candidateSaveStatus === "bench-full"
                  ? faTriangleExclamation
                  : faCheck
              }
              aria-hidden="true"
            />
            <span>
              {t(
                candidateSaveStatus === "bench-full"
                  ? "copilot.candidateBenchFull"
                  : "copilot.candidateSaved",
              )}
            </span>
          </div>
        ) : null}
        {(scope === "optimization" || scope === "matchup") && optimizationActionStatus ? (
          <CopilotOptimizationStatus status={optimizationActionStatus} />
        ) : null}
        <ol>
          {sortedRecommendations.map((recommendation, index) => {
            const candidate =
              scope === "recommendation"
                ? candidatesById.get(recommendation.id)
                : undefined;
            const optimizationCandidate =
              scope === "optimization" || scope === "matchup"
                ? optimizationCandidatesById.get(recommendation.id)
                : undefined;

            return (
              <li
                className={`copilot-reveal is-recommendation${
                  optimizationCandidate ? " is-optimization-card" : ""
                }`}
                key={recommendation.id}
                style={
                  {
                    "--copilot-reveal-index": index,
                  } as CSSProperties
                }
              >
                {optimizationCandidate ? (
                  <CopilotOptimizationRecommendation
                    candidate={optimizationCandidate}
                    currentItemDisplayName={optimizationCurrentItemDisplayName}
                    title={recommendation.title}
                    reason={recommendation.reason}
                    isStale={isStale}
                    onApply={onApplyOptimizationCandidate}
                    onSave={onSaveOptimizationCandidate}
                  />
                ) : (
                  <>
                    {candidate ? (
                      <div className="copilot-candidate-heading">
                        <div className="copilot-candidate-identity">
                          <CopilotCandidateSprite candidate={candidate} />
                          <div className="copilot-candidate-copy">
                            <div className="copilot-candidate-name-row">
                              <strong>{candidate.displayName}</strong>
                              <span className="copilot-candidate-types">
                                {candidate.types.map((type) => (
                                  <TypeBadge type={type} key={type} />
                                ))}
                              </span>
                            </div>
                            <span className="copilot-candidate-role">
                              {recommendation.title}
                            </span>
                          </div>
                        </div>
                        <span>
                          {candidate.usageRank
                            ? t("copilot.usageRank", {
                                rank: candidate.usageRank,
                              })
                            : t("copilot.unranked")}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <strong>{recommendation.title}</strong>
                      </div>
                    )}
                    <p>{recommendation.reason}</p>
                    {candidate ? (
                      <div className="copilot-candidate-actions">
                        <button
                          className="is-primary"
                          type="button"
                          disabled={
                            Boolean(selectingCandidateId || savingCandidateId) ||
                            isStale
                          }
                          onClick={() => onSelectCandidate(candidate.pokemonId)}
                        >
                          <FontAwesomeIcon
                            icon={
                              selectingCandidateId === candidate.pokemonId
                                ? faSpinner
                                : faCheck
                            }
                            spin={selectingCandidateId === candidate.pokemonId}
                            aria-hidden="true"
                          />
                          {t("copilot.selectCandidate")}
                        </button>
                        <button
                          type="button"
                          disabled={
                            Boolean(selectingCandidateId || savingCandidateId) ||
                            isStale
                          }
                          onClick={() => onSaveCandidate(candidate.pokemonId)}
                        >
                          <FontAwesomeIcon
                            icon={
                              savingCandidateId === candidate.pokemonId
                                ? faSpinner
                                : faBoxArchive
                            }
                            spin={savingCandidateId === candidate.pokemonId}
                            aria-hidden="true"
                          />
                          {t("copilot.saveToBench")}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </section> : null}
    </div>
  );
}
