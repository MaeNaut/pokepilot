import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import { TypeBadge } from "./TypeBadge";

type TeamDiagnosticsProps = {
  diagnostics: TeamDiagnosticsResult;
};

export function TeamDiagnostics({
  diagnostics,
}: TeamDiagnosticsProps) {
  const coveragePercent = Math.round(
    (diagnostics.coveredDefendingTypes.length / 18) * 100,
  );
  const coverageColor = `hsl(${Math.round(coveragePercent * 1.25)} 68% 42%)`;

  return (
    <aside className="team-diagnostics" aria-label="Team type matchups and coverage">
      <div className="diagnostics-layout">
        <section className="diagnostics-section diagnostics-matchups">
          <div className="diagnostics-section-heading">
            <h3>Defensive Matchups</h3>
            <div className="matchup-legend" aria-hidden="true">
              <span className="is-weak">Weak</span>
              <span className="is-resist" title="Includes immunities">Resist</span>
            </div>
          </div>
          <div className="matchup-matrix" aria-label="Team type matchups">
            {diagnostics.defensiveMatchups.map((matchup) => {
              const resistCount = matchup.resistCount + matchup.immuneCount;
              const isExposed =
                matchup.weakCount >= 2 && matchup.weakCount > resistCount;
              const typeName =
                matchup.type.charAt(0).toUpperCase() + matchup.type.slice(1);

              return (
                <div
                  className={`matchup-matrix-cell ${isExposed ? "is-exposed" : ""}`}
                  aria-label={`${typeName}: ${matchup.weakCount} weak, ${resistCount} resist or immune`}
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
            <h3>Coverage Gaps</h3>
          </div>
          <div className="coverage-content">
            <div
              className="coverage-ring"
              role="progressbar"
              aria-label="Single-type offensive coverage"
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
                  <span>Not covered</span>
                  <div className="coverage-gap-types" aria-label="Types not covered">
                    {diagnostics.uncoveredDefendingTypes.map((type) => (
                      <TypeBadge type={type} key={type} />
                    ))}
                  </div>
                </>
              ) : (
                <span className="is-complete">Full coverage</span>
              )}
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
