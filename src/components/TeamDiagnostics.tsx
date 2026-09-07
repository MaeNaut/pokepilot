import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import { useLocalization } from "../i18n/useLocalization";
import { TypeBadge } from "./TypeBadge";

type TeamDiagnosticsProps = {
  diagnostics: TeamDiagnosticsResult;
};

export function TeamDiagnostics({
  diagnostics,
}: TeamDiagnosticsProps) {
  const { t } = useLocalization();
  const matchupGroups = [
    diagnostics.defensiveMatchups,
    diagnostics.defensiveMatchups.slice(0, 9),
    diagnostics.defensiveMatchups.slice(9),
  ];
  const exposedTypes = new Set(diagnostics.defensiveMatchups
    .filter(({ weakCount, resistCount, immuneCount }) =>
      weakCount >= 2 && weakCount > resistCount + immuneCount)
    .map(({ type }) => type));
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
          </div>
          <div className="matchup-tables">
            {matchupGroups.map((group, index) => (
              <table className={`matchup-table ${index === 0 ? "is-wide" : "is-narrow"}`} aria-label={t("diagnostics.matchupAria")} key={index}>
                <colgroup>
                  <col className="matchup-label-column" />
                  {group.map(({ type }) => <col key={type} />)}
                </colgroup>
                <thead>
                  <tr>
                    <td />
                    {group.map(({ type }) => (
                      <th scope="col" className={exposedTypes.has(type) ? "is-exposed" : undefined} key={type}><TypeBadge type={type} /></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="is-weak">
                    <th scope="row">{t("diagnostics.weak")}</th>
                    {group.map(({ type, weakCount }) => (
                      <td className={exposedTypes.has(type) ? "is-exposed" : weakCount === 0 ? "is-zero" : undefined} key={type}>{weakCount}</td>
                    ))}
                  </tr>
                  <tr className="is-resist">
                    <th scope="row" title={t("diagnostics.resistHint")}>{t("diagnostics.resist")}</th>
                    {group.map(({ type, resistCount, immuneCount }) => (
                      <td className={resistCount + immuneCount === 0 ? "is-zero" : undefined} key={type}>
                        {resistCount + immuneCount}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
          <p className="matchup-note">{t("diagnostics.resist")}: {t("diagnostics.resistHint")}</p>
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
