import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCircleInfo,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { TeamBuildState } from "../hooks/useTeamBuildState";
import type { TeamMember, TeamSlot } from "../types";
import { analyzeTeam } from "../utils/teamDiagnostics";
import { PokemonIcon } from "./PokemonIcon";
import { TypeBadge } from "./TypeBadge";

type TeamDiagnosticsProps = {
  team: TeamSlot[];
  moveSources: TeamMember[];
  buildState: Pick<
    TeamBuildState,
    | "moveIdsBySlot"
    | "evsBySlot"
    | "natureBySlot"
    | "abilityBySlot"
  >;
};

const alertIcons = {
  danger: faTriangleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
  success: faCheck,
};

export function TeamDiagnostics({
  team,
  moveSources,
  buildState,
}: TeamDiagnosticsProps) {
  const diagnostics = useMemo(
    () => analyzeTeam(team, buildState, moveSources),
    [buildState, moveSources, team],
  );
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
          <h3>Type Matchups</h3>
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
          <h3>Offensive Coverage</h3>
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

        <div className="coverage-details">
          <div className="coverage-detail-row">
            <span>Move types</span>
            <div className="diagnostic-type-list">
              {diagnostics.attackingTypes.length > 0 ? (
                diagnostics.attackingTypes.map((type) => (
                  <TypeBadge type={type} key={type} />
                ))
              ) : (
                <em>None</em>
              )}
            </div>
          </div>
          <div className="coverage-detail-row">
            <span>Coverage gaps</span>
            <div className="diagnostic-type-list is-muted">
              {diagnostics.uncoveredDefendingTypes.length > 0 ? (
                diagnostics.uncoveredDefendingTypes.map((type) => (
                  <TypeBadge type={type} key={type} />
                ))
              ) : (
                <em>None</em>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="diagnostics-section team-roles-section">
        <div className="diagnostics-section-heading">
          <h3>Team Roles</h3>
        </div>
        <div className="team-role-list">
          {diagnostics.roles.map((role) => (
            <div
              className={`team-role-row is-${role.id} ${
                role.slotIndexes.length === 0 ? "is-empty" : ""
              }`}
              key={role.id}
            >
              <div className="team-role-label" title={role.description}>
                <span>{role.label}</span>
                <strong>{role.slotIndexes.length}</strong>
              </div>
              <div className="team-role-members">
                {role.slotIndexes.map((slotIndex) => {
                  const member = team[slotIndex];

                  return member ? (
                    <span
                      className="team-role-member"
                      title={member.name}
                      key={`${role.id}-${slotIndex}`}
                    >
                      <PokemonIcon pokemon={member} />
                    </span>
                  ) : null;
                })}
                {role.slotIndexes.length === 0 ? (
                  <span className="team-role-empty">None</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="diagnostics-section diagnostics-alerts">
        <div className="diagnostics-section-heading">
          <h3>Team Alerts</h3>
          <span className="diagnostics-heading-metric">
            <strong>{diagnostics.alerts.length}</strong>
          </span>
        </div>
        <ul>
          {diagnostics.alerts.map((alert) => (
            <li className={`is-${alert.tone}`} key={alert.id}>
              <FontAwesomeIcon icon={alertIcons[alert.tone]} aria-hidden="true" />
              <span>{alert.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
