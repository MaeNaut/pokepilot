import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBoxArchive,
  faCalculator,
  faCheck,
  faChevronDown,
  faPersonRunning,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { getNatureById, statKeys, statLabels } from "../data/natures";
import { statTranslationKeys } from "../i18n/statTranslations";
import type { TranslationKey } from "../i18n/translations";
import { useLocalization } from "../i18n/useLocalization";
import type { CopilotSetOptimizationCandidateSnapshot } from "../utils/copilotContracts";
import { selectOptimizationEvidence } from "../utils/copilotOptimizationEvidence";

export type OptimizationActionStatus =
  | "applied"
  | "saved"
  | "bench-full"
  | "stale";

const actionTranslationKeys: Record<
  OptimizationActionStatus,
  TranslationKey
> = {
  applied: "copilot.optimization.applied",
  saved: "copilot.optimization.saved",
  "bench-full": "copilot.optimization.bench-full",
  stale: "copilot.optimization.stale",
};

function formatChance(value: number) {
  if (value === 0 || value === 100) return `${value}%`;
  return `${value.toFixed(1)}%`;
}

function formatSpread(candidate: CopilotSetOptimizationCandidateSnapshot) {
  return statKeys
    .filter((stat) => candidate.evs[stat] > 0)
    .map((stat) => `${statLabels[stat]} ${candidate.evs[stat]}`)
    .join(" / ");
}

type OptimizationOutcome = CopilotSetOptimizationCandidateSnapshot[
  "offenseBenchmarks"
][number]["optimized"];

type OptimizationMoveBenchmark = CopilotSetOptimizationCandidateSnapshot[
  "offenseBenchmarks"
][number];

type OptimizationMoveBenchmarkProps = {
  benchmark: OptimizationMoveBenchmark;
  focus: "offense" | "defense";
};

function CopilotOptimizationMoveBenchmark({
  benchmark,
  focus,
}: OptimizationMoveBenchmarkProps) {
  const { t } = useLocalization();
  const isMoveReplacement = benchmark.currentMoveId !== benchmark.moveId;

  function getOutcomeLabel(outcome: OptimizationOutcome) {
    if (outcome.guaranteedKoHits === 1) {
      return t("copilot.guaranteedKo");
    }
    if (
      outcome.possibleKoHits === null ||
      outcome.guaranteedKoHits === null
    ) {
      return t("calculator.noKo");
    }
    if (outcome.possibleKoHits === outcome.guaranteedKoHits) {
      return t("calculator.guaranteedHitsKo", {
        hits: outcome.guaranteedKoHits,
      });
    }
    if (outcome.koHits > 0 && outcome.koChance !== null) {
      return t("copilot.koHitRangeWithChance", {
        chance: formatChance(outcome.koChance),
        guaranteed: outcome.guaranteedKoHits,
        possible: outcome.possibleKoHits,
      });
    }

    return t("copilot.koHitRange", {
      guaranteed: outcome.guaranteedKoHits,
      possible: outcome.possibleKoHits,
    });
  }

  return (
    <div className="copilot-optimization-benchmark">
      <div className="copilot-optimization-benchmark-title">
        <strong>
          {t(
            isMoveReplacement
              ? "copilot.optimization.replacing-move"
              : focus === "offense"
              ? "copilot.optimization.attacking-move"
              : "copilot.optimization.defending-move",
            {
              current: benchmark.currentMoveDisplayName,
              move: benchmark.moveDisplayName,
            },
          )}
        </strong>
        {benchmark.source === "usage" ? (
          <small className="copilot-optimization-usage-source">
            {t("copilot.optimization.usage-move")}
          </small>
        ) : null}
      </div>
      <div className="copilot-optimization-outcomes">
        <span>{getOutcomeLabel(benchmark.current)}</span>
        <span aria-hidden="true" />
        <strong>{getOutcomeLabel(benchmark.optimized)}</strong>
      </div>
      <span className="copilot-optimization-range">
        <span>
          {benchmark.current.minPercent.toFixed(1)}%-
          {benchmark.current.maxPercent.toFixed(1)}%
        </span>
        <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
        <strong>
          {benchmark.optimized.minPercent.toFixed(1)}%-
          {benchmark.optimized.maxPercent.toFixed(1)}%
        </strong>
      </span>
    </div>
  );
}

type CopilotOptimizationStatusProps = {
  status: OptimizationActionStatus;
};

export function CopilotOptimizationStatus({
  status,
}: CopilotOptimizationStatusProps) {
  const { t } = useLocalization();
  const isError = status === "bench-full" || status === "stale";

  return (
    <div
      className={`copilot-optimization-status${isError ? " is-error" : ""}`}
      role="status"
    >
      <FontAwesomeIcon
        icon={isError ? faTriangleExclamation : faCheck}
        aria-hidden="true"
      />
      <span>{t(actionTranslationKeys[status])}</span>
    </div>
  );
}

type CopilotOptimizationRecommendationProps = {
  candidate: CopilotSetOptimizationCandidateSnapshot;
  currentItemDisplayName: string | null;
  title: string;
  reason: string;
  isStale: boolean;
  onApply: (candidate: CopilotSetOptimizationCandidateSnapshot) => void;
  onSave: (candidate: CopilotSetOptimizationCandidateSnapshot) => void;
};

export function CopilotOptimizationRecommendation({
  candidate,
  currentItemDisplayName,
  title,
  reason,
  isStale,
  onApply,
  onSave,
}: CopilotOptimizationRecommendationProps) {
  const { t } = useLocalization();
  const nature = getNatureById(candidate.natureId);
  const isCurrent = candidate.id === "set-current";
  const evidence = selectOptimizationEvidence(candidate);
  const hasEvidence = !isCurrent && (evidence.offense.length > 0 || evidence.defense.length > 0 || evidence.showSpeed);

  const speedRelationLabel = t(
    `copilot.optimization.speed-${candidate.speedBenchmark.optimized.relation}` as TranslationKey,
  );
  const currentSpeedRelationLabel = t(
    `copilot.optimization.speed-${candidate.speedBenchmark.current.relation}` as TranslationKey,
  );

  return (
    <>
      <div className="copilot-optimization-heading">
        <strong>{title}</strong>
      </div>
      <div className="copilot-optimization-set">
        <span className="copilot-optimization-nature">
          <small>{t("copilot.optimization.nature-label")}</small>
          <span className="copilot-optimization-nature-value">
            <span>{candidate.natureDisplayName}</span>
            {nature?.up === nature?.down ? (
              <span className="copilot-optimization-nature-neutral">
                {t("copilot.neutralNature")}
              </span>
            ) : nature ? (
              <span className="copilot-optimization-nature-shifts">
                <span className="is-up">
                  {t(statTranslationKeys[nature.up])} {"\u2191"}
                </span>
                <span className="is-down">
                  {t(statTranslationKeys[nature.down])} {"\u2193"}
                </span>
              </span>
            ) : null}
          </span>
        </span>
        <span className="copilot-optimization-item">
          <small>{t("copilot.optimization.item-label")}</small>
          <span className="copilot-optimization-item-value">
            {candidate.itemChanged ? (
              <>
                <span>{currentItemDisplayName ?? t("copilot.noItem")}</span>
                <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
              </>
            ) : null}
            <strong>{candidate.itemDisplayName ?? t("copilot.noItem")}</strong>
          </span>
        </span>
      </div>
      {candidate.moveChanges.length > 0 ? (
        <div className="copilot-optimization-move-change">
          <small>{t("copilot.optimization.move-change-label")}</small>
          <span>
            {candidate.moveChanges.map((change) => (
              <span key={`${change.slotIndex}-${change.optimizedMoveId}`}>
                <span>{change.currentMoveDisplayName}</span>
                <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                <strong>{change.optimizedMoveDisplayName}</strong>
              </span>
            ))}
          </span>
        </div>
      ) : null}
      <div className="copilot-optimization-spread">
        <small>{t("copilot.optimization.ev-spread-label")}</small>
        <strong>{formatSpread(candidate)}</strong>
      </div>
      <p>{reason}</p>
      {hasEvidence ? <details className="copilot-optimization-evidence">
        <summary>
          <span>
            <FontAwesomeIcon icon={faCalculator} aria-hidden="true" />
            {t("copilot.optimization.calculation-evidence")}
          </span>
          <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
        </summary>
        <div className="copilot-optimization-benchmarks">
          {evidence.offense.map((benchmark) => (
            <CopilotOptimizationMoveBenchmark
              key={`offense-${benchmark.moveId}`}
              benchmark={benchmark}
              focus="offense"
            />
          ))}
          {evidence.defense.map((benchmark) => (
            <CopilotOptimizationMoveBenchmark
              key={`defense-${benchmark.moveId}`}
              benchmark={benchmark}
              focus="defense"
            />
          ))}
          {evidence.showSpeed ? <div className="copilot-optimization-benchmark is-speed">
            <div className="copilot-optimization-benchmark-title">
              <strong>
                <FontAwesomeIcon icon={faPersonRunning} aria-hidden="true" />
                {t("copilot.optimization.speed")}
              </strong>
              <small className="copilot-optimization-opponent-speed">
                {t("copilot.optimization.opponent-speed", {
                  speed: candidate.speedBenchmark.optimized.opponentSpeed,
                })}
              </small>
            </div>
            <div className="copilot-optimization-outcomes">
              <span>{currentSpeedRelationLabel}</span>
              <span aria-hidden="true" />
              <strong>{speedRelationLabel}</strong>
            </div>
            <span className="copilot-optimization-range">
              <span>{candidate.speedBenchmark.current.playerSpeed}</span>
              <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
              <strong>{candidate.speedBenchmark.optimized.playerSpeed}</strong>
            </span>
          </div> : null}
        </div>
      </details> : null}
      <div className="copilot-optimization-actions">
        {isCurrent ? <span className="copilot-optimization-current" role="status">
          <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
          {t(isStale ? "copilot.analyzedSample" : "copilot.currentSample")}
        </span> : <button type="button" disabled={isStale} onClick={() => onApply(candidate)}>
          <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
          {t("copilot.applySample")}
        </button>}
        <button type="button" disabled={isStale} onClick={() => onSave(candidate)}>
          <FontAwesomeIcon icon={faBoxArchive} aria-hidden="true" />
          {t("copilot.saveToBench")}
        </button>
      </div>
    </>
  );
}
