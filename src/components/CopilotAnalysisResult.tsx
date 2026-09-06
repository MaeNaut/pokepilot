import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBoxArchive,
  faCheck,
  faCrosshairs,
  faLightbulb,
  faPersonRunning,
  faShieldHalved,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";
import type { TranslationKey } from "../i18n/translations";
import type {
  CopilotAnalysisResponse,
  CopilotAnalysisScope,
  CopilotSetOptimizationCandidateSnapshot,
} from "../utils/copilotAnalysis";
import { getNatureById, statKeys, statLabels } from "../data/natures";
import { statTranslationKeys } from "../i18n/statTranslations";
import type { CopilotRecommendationCandidateSnapshot } from "../utils/pokemonRecommendations";
import type { RecommendedPokemonApplyResult } from "../utils/recommendedPokemonApplication";
import { TypeBadge } from "./TypeBadge";

type CandidateApplyFailureReason = Extract<
  RecommendedPokemonApplyResult,
  { status: "blocked" }
>["reason"];

type OptimizationActionStatus =
  | "applied"
  | "saved"
  | "bench-full"
  | "stale";

function formatChance(value: number) {
  if (value === 0 || value === 100) return `${value}%`;

  return `${value.toFixed(1)}%`;
}

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
  optimizationCandidates: CopilotSetOptimizationCandidateSnapshot[];
  optimizationActionStatus: OptimizationActionStatus | null;
  onAnalyze: () => void;
  onSelectCandidate: (pokemonId: string) => void;
  onApplyOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => void;
  onSaveOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => void;
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

const optimizationActionTranslationKeys: Record<
  OptimizationActionStatus,
  TranslationKey
> = {
  applied: "copilot.optimization.applied",
  saved: "copilot.optimization.saved",
  "bench-full": "copilot.optimization.bench-full",
  stale: "copilot.optimization.stale",
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
  optimizationCandidates,
  optimizationActionStatus,
  onAnalyze,
  onSelectCandidate,
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

  function formatSpread(candidate: CopilotSetOptimizationCandidateSnapshot) {
    return statKeys
      .filter((stat) => candidate.evs[stat] > 0)
      .map((stat) => `${statLabels[stat]} ${candidate.evs[stat]}`)
      .join(" / ");
  }

  function getOptimizationOutcome(
    benchmark: CopilotSetOptimizationCandidateSnapshot[
      "offenseBenchmarks"
    ][number]["optimized"],
  ) {
    if (benchmark.guaranteedKoHits === 1) {
      return t("copilot.guaranteedKo");
    }
    if (
      benchmark.possibleKoHits === null ||
      benchmark.guaranteedKoHits === null
    ) {
      return t("calculator.noKo");
    }
    if (benchmark.possibleKoHits === benchmark.guaranteedKoHits) {
      return t("calculator.guaranteedHitsKo", {
        hits: benchmark.guaranteedKoHits,
      });
    }
    if (benchmark.koHits > 0 && benchmark.koChance !== null) {
      return t("copilot.koHitRangeWithChance", {
        chance: formatChance(benchmark.koChance),
        guaranteed: benchmark.guaranteedKoHits,
        possible: benchmark.possibleKoHits,
      });
    }

    return t("copilot.koHitRange", {
      guaranteed: benchmark.guaranteedKoHits,
      possible: benchmark.possibleKoHits,
    });
  }

  function getSpeedRelationLabel(
    relation: CopilotSetOptimizationCandidateSnapshot[
      "speedBenchmark"
    ]["optimized"]["relation"],
  ) {
    return t(`copilot.optimization.speed-${relation}` as TranslationKey);
  }

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
                  : scope === "recommendation"
                    ? t("copilot.recommendationChanged")
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
        }${scope === "optimization" ? " is-optimization" : ""}`}
      >
        <div className="copilot-section-heading copilot-reveal is-recommendations-heading">
          <FontAwesomeIcon icon={faLightbulb} aria-hidden="true" />
          <h3>
            {scope === "recommendation"
              ? t("copilot.candidates")
              : scope === "optimization"
                ? t("copilot.optimizedSamples")
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
        {scope === "optimization" && optimizationActionStatus ? (
          <div
            className={`copilot-optimization-status${
              optimizationActionStatus === "bench-full" ||
              optimizationActionStatus === "stale"
                ? " is-error"
                : ""
            }`}
            role="status"
          >
            <FontAwesomeIcon
              icon={
                optimizationActionStatus === "bench-full" ||
                optimizationActionStatus === "stale"
                  ? faTriangleExclamation
                  : faCheck
              }
              aria-hidden="true"
            />
            <span>
              {t(optimizationActionTranslationKeys[optimizationActionStatus])}
            </span>
          </div>
        ) : null}
        <ol>
          {response.recommendations.map((recommendation) => {
            const candidate =
              scope === "recommendation"
                ? candidatesById.get(recommendation.id)
                : undefined;
            const optimizationCandidate =
              scope === "optimization"
                ? optimizationCandidatesById.get(recommendation.id)
                : undefined;
            const optimizationNature = optimizationCandidate
              ? getNatureById(optimizationCandidate.natureId)
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
                ) : optimizationCandidate ? (
                  <>
                    <div className="copilot-optimization-heading">
                      <strong>{recommendation.title}</strong>
                    </div>
                    <div className="copilot-optimization-set">
                      <span className="copilot-optimization-nature">
                        <span>{optimizationCandidate.natureDisplayName}</span>
                        {optimizationNature?.up === optimizationNature?.down ? (
                          <span className="copilot-optimization-nature-neutral">
                            {t("copilot.neutralNature")}
                          </span>
                        ) : optimizationNature ? (
                          <span className="copilot-optimization-nature-shifts">
                            <span className="is-up">
                              {t(statTranslationKeys[optimizationNature.up])} ↑
                            </span>
                            <span className="is-down">
                              {t(statTranslationKeys[optimizationNature.down])} ↓
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span>
                        {optimizationCandidate.itemDisplayName ??
                          t("copilot.noItem")}
                      </span>
                    </div>
                    <p className="copilot-optimization-spread">
                      {formatSpread(optimizationCandidate)}
                    </p>
                    <div className="copilot-optimization-benchmarks">
                      {optimizationCandidate.offenseBenchmarks.map(
                        (benchmark) => (
                          <div
                            className="copilot-optimization-benchmark"
                            key={`offense-${benchmark.moveId}`}
                          >
                            <span className="copilot-optimization-metric-label">
                              <FontAwesomeIcon
                                icon={faCrosshairs}
                                aria-hidden="true"
                              />
                              <span>
                                {t("copilot.optimization.offense")} ·{" "}
                                {benchmark.moveDisplayName}
                                {benchmark.source === "usage" ? (
                                  <small className="copilot-optimization-usage-source">
                                    {t("copilot.optimization.usage-move")}
                                  </small>
                                ) : null}
                              </span>
                              <strong>
                                {getOptimizationOutcome(benchmark.optimized)}
                              </strong>
                            </span>
                            <span className="copilot-optimization-range">
                              <span>
                                {benchmark.current.minPercent.toFixed(1)}-
                                {benchmark.current.maxPercent.toFixed(1)}%
                              </span>
                              <FontAwesomeIcon
                                icon={faArrowRight}
                                aria-hidden="true"
                              />
                              <strong>
                                {benchmark.optimized.minPercent.toFixed(1)}-
                                {benchmark.optimized.maxPercent.toFixed(1)}%
                              </strong>
                            </span>
                          </div>
                        ),
                      )}
                      {optimizationCandidate.defenseBenchmarks.map(
                        (benchmark) => (
                          <div
                            className="copilot-optimization-benchmark"
                            key={`defense-${benchmark.moveId}`}
                          >
                            <span className="copilot-optimization-metric-label">
                              <FontAwesomeIcon
                                icon={faShieldHalved}
                                aria-hidden="true"
                              />
                              <span>
                                {t("copilot.optimization.defense")} ·{" "}
                                {benchmark.moveDisplayName}
                                {benchmark.source === "usage" ? (
                                  <small className="copilot-optimization-usage-source">
                                    {t("copilot.optimization.usage-move")}
                                  </small>
                                ) : null}
                              </span>
                              <strong>
                                {getOptimizationOutcome(benchmark.optimized)}
                              </strong>
                            </span>
                            <span className="copilot-optimization-range">
                              <span>
                                {benchmark.current.minPercent.toFixed(1)}-
                                {benchmark.current.maxPercent.toFixed(1)}%
                              </span>
                              <FontAwesomeIcon
                                icon={faArrowRight}
                                aria-hidden="true"
                              />
                              <strong>
                                {benchmark.optimized.minPercent.toFixed(1)}-
                                {benchmark.optimized.maxPercent.toFixed(1)}%
                              </strong>
                            </span>
                          </div>
                        ),
                      )}
                      <div className="copilot-optimization-benchmark is-speed">
                        <span className="copilot-optimization-metric-label">
                          <FontAwesomeIcon
                            icon={faPersonRunning}
                            aria-hidden="true"
                          />
                          <span>{t("copilot.optimization.speed")}</span>
                          <strong>
                            {getSpeedRelationLabel(
                              optimizationCandidate.speedBenchmark.optimized
                                .relation,
                            )}
                          </strong>
                        </span>
                        <span className="copilot-optimization-range">
                          <span>
                            {
                              optimizationCandidate.speedBenchmark.current
                                .playerSpeed
                            }
                          </span>
                          <FontAwesomeIcon
                            icon={faArrowRight}
                            aria-hidden="true"
                          />
                          <strong>
                            {
                              optimizationCandidate.speedBenchmark.optimized
                                .playerSpeed
                            }
                          </strong>
                          <span className="copilot-optimization-opponent-speed">
                            {t("copilot.optimization.opponent-speed", {
                              speed:
                                optimizationCandidate.speedBenchmark.optimized
                                  .opponentSpeed,
                            })}
                          </span>
                        </span>
                      </div>
                    </div>
                  </>
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
                {optimizationCandidate ? (
                  <div className="copilot-optimization-actions">
                    <button
                      type="button"
                      disabled={isStale}
                      onClick={() =>
                        onApplyOptimizationCandidate(optimizationCandidate)
                      }
                    >
                      <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                      {t("copilot.applySample")}
                    </button>
                    <button
                      type="button"
                      disabled={isStale}
                      onClick={() =>
                        onSaveOptimizationCandidate(optimizationCandidate)
                      }
                    >
                      <FontAwesomeIcon icon={faBoxArchive} aria-hidden="true" />
                      {t("copilot.saveToBench")}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
