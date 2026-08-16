import type { CSSProperties, ReactNode } from "react";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  getMaxAllowedStatPoints,
  getNatureStatShift,
  statKeys,
  type Nature,
} from "../data/natures";
import { useLocalization } from "../i18n/useLocalization";
import type { StatBlock, StatKey } from "../types";

type PokemonStatsEditorProps = {
  baseStats: StatBlock;
  evs: StatBlock;
  calculatedStats?: StatBlock | null;
  nature: Nature;
  isTouchLayout: boolean;
  header?: ReactNode;
  stageLabel?: string;
  renderStageControl?: (stat: StatKey) => ReactNode;
  onEvChange: (stat: StatKey, value: string) => void;
};

export function PokemonStatsEditor({
  baseStats,
  evs,
  calculatedStats,
  nature,
  isTouchLayout,
  header,
  stageLabel,
  renderStageControl,
  onEvChange,
}: PokemonStatsEditorProps) {
  const { t } = useLocalization();

  return (
    <section className="stats-editor" aria-label={t("builder.pokemonStats")}>
      {header}
      <div className="stats-editor-body">
        <div className="stat-axis-labels" aria-hidden="true">
          <span className="is-base">{t("builder.base")}</span>
          <span className="is-ev">{t("builder.ev")}</span>
          <span className="is-stat">{t("builder.stat")}</span>
          {stageLabel ? <span className="is-stage">{stageLabel}</span> : null}
        </div>

        <div className="stats-editor-grid">
          {statKeys.map((stat) => {
            const statLabel = t(`stat.${stat}`);
            const natureShift = getNatureStatShift(nature, stat);

            return (
              <div className="stat-editor-column" key={stat}>
                <strong className="stat-editor-label">{statLabel}</strong>
                <span className="stat-base-value">{baseStats[stat]}</span>

                <div className="ev-vertical-track">
                  <input
                    className="ev-vertical-range"
                    type="range"
                    aria-label={t("builder.evSlider", { stat: statLabel })}
                    min={0}
                    max={CHAMPIONS_MAX_EV_PER_STAT}
                    step={1}
                    value={evs[stat]}
                    style={
                      {
                        "--ev-fill": `${
                          (evs[stat] / CHAMPIONS_MAX_EV_PER_STAT) * 100
                        }%`,
                      } as CSSProperties
                    }
                    onChange={(event) => onEvChange(stat, event.target.value)}
                  />
                </div>

                <label className="ev-number-field">
                  <span className="sr-only">
                    {statLabel} {t("builder.ev")}
                  </span>
                  <input
                    className="ev-number-input"
                    inputMode="numeric"
                    min={0}
                    max={getMaxAllowedStatPoints(evs, stat)}
                    value={evs[stat]}
                    onChange={(event) => onEvChange(stat, event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => {
                      if (isTouchLayout) {
                        event.currentTarget.select();
                      }
                    }}
                  />
                </label>

                <span className="stat-result-value">
                  <span className="stat-value">
                    {calculatedStats?.[stat] ?? 0}
                    {natureShift ? (
                      <span
                        className={`stat-nature-arrow is-${natureShift}`}
                        aria-label={
                          natureShift === "up"
                            ? t("builder.natureIncreases")
                            : t("builder.natureDecreases")
                        }
                      />
                    ) : null}
                  </span>
                </span>

                {renderStageControl?.(stat)}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
