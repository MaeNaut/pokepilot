import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import { useLocalization } from "../i18n/useLocalization";
import { TypeBadge } from "./TypeBadge";

type TeamDiagnosticsProps = {
  diagnostics: TeamDiagnosticsResult;
};

export function TeamDiagnostics({
  diagnostics,
}: TeamDiagnosticsProps) {
  const { gameName, t } = useLocalization();
  const coveragePercent = Math.round(
    (diagnostics.coveredDefendingTypes.length / 18) * 100,
  );
  const coverageColor = `hsl(${Math.round(coveragePercent * 1.25)} 68% 42%)`;

  return (
    <aside className="team-diagnostics" aria-label={t("diagnostics.aria")}>
      <div className="diagnostics-layout">
        <section className="diagnostics-section diagnostics-matchups">
          <div className="diagnostics-section-heading">
            <h3>{t("diagnostics.defensive")}</h3>
            <div className="matchup-legend" aria-hidden="true">
              <span className="is-weak">{t("diagnostics.weak")}</span>
              <span className="is-resist" title={t("diagnostics.resistHint")}>{t("diagnostics.resist")}</span>
            </div>
          </div>
          <div className="matchup-matrix" aria-label={t("diagnostics.matchupAria")}>
            {diagnostics.defensiveMatchups.map((matchup) => {
              const resistCount = matchup.resistCount + matchup.immuneCount;
              const isExposed =
                matchup.weakCount >= 2 && matchup.weakCount > resistCount;
              const typeName = gameName(
                "types",
                matchup.type,
                matchup.type.charAt(0).toUpperCase() + matchup.type.slice(1),
              );

              return (
                <div
                  className={`matchup-matrix-cell ${isExposed ? "is-exposed" : ""}`}
                  aria-label={t("diagnostics.matchupCell", {
                    type: typeName,
                    weak: matchup.weakCount,
                    resist: resistCount,
                  })}
                  key={matchup.type}
                >
                  <TypeBadge type={matchup.type} />
                  <span className="matchup-value is-weak">{matchup.weakCount}</span>
                  <span className="matchup-value is-resist">{resistCount}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="diagnostics-section diagnostics-coverage">
          <div className="diagnostics-section-heading">
            <h3>{t("diagnostics.coverage")}</h3>
          </div>
          <div className="coverage-content">
            <div
              className="coverage-ring"
              role="progressbar"
              aria-label={t("diagnostics.coverageAria")}
              aria-valuemin={0}
              aria-valuemax={18}
              aria-valuenow={diagnostics.coveredDefendingTypes.length}
              style={{
                background: `conic-gradient(${coverageColor} ${coveragePercent}%, #dedede ${coveragePercent}% 100%)`,
              }}
            >
              <span>
                <strong>{diagnostics.coveredDefendingTypes.length}</strong>
                <small>/18</small>
              </span>
            </div>

            <div className="coverage-gap-summary">
              {diagnostics.uncoveredDefendingTypes.length > 0 ? (
                <>
                  <span>{t("diagnostics.notCovered")}</span>
                  <div className="coverage-gap-types" aria-label={t("diagnostics.typesNotCovered")}>
                    {diagnostics.uncoveredDefendingTypes.map((type) => (
                      <TypeBadge type={type} key={type} />
                    ))}
                  </div>
                </>
              ) : (
                <span className="is-complete">{t("diagnostics.fullCoverage")}</span>
              )}
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
