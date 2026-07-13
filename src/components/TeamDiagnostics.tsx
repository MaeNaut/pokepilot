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
    <aside className="team-diagnostics" aria-labelledby="team-diagnostics-title">
      <header className="team-diagnostics-header">
        <h2 id="team-diagnostics-title">Team Diagnostics</h2>
        <span className="diagnostics-team-count">
          <strong>{diagnostics.filledSlots}</strong>
          <span>/6</span>
        </span>
      </header>

      <section className="diagnostics-section">
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

      <section className="diagnostics-section">
        <div className="diagnostics-section-heading">
          <h3>Coverage Gaps</h3>
          <span className="diagnostics-heading-metric">
            <strong>{diagnostics.coveredDefendingTypes.length}</strong>/18
          </span>
        </div>
        <div
          className="coverage-meter"
          role="progressbar"
          aria-label="Single-type offensive coverage"
          aria-valuemin={0}
          aria-valuemax={18}
          aria-valuenow={diagnostics.coveredDefendingTypes.length}
        >
          <span
            style={{
              width: `${coveragePercent}%`,
              backgroundColor: coverageColor,
            }}
          />
        </div>

        <div className="coverage-gap-summary">
          <span>Not super effective</span>
          <div className="diagnostic-type-list">
            {diagnostics.uncoveredDefendingTypes.length > 0 ? (
              diagnostics.uncoveredDefendingTypes.map((type) => (
                <TypeBadge type={type} key={type} />
              ))
            ) : (
              <em>None</em>
            )}
          </div>
        </div>
      </section>
    </aside>
  );
}
