import { useMemo, type Dispatch, type SetStateAction } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowLeft,
  faArrowRight,
  faRightLeft,
} from "@fortawesome/free-solid-svg-icons";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { DamageDirection } from "../calculator/calculatorViewModel";
import type {
  CalculatorField,
  DamageCalculationResult,
} from "../calculator/damageCalculator";
import { useLocalization } from "../i18n/useLocalization";
import type { PokemonMove } from "../types";
import { TypeBadge } from "./TypeBadge";

type CalculationRow = {
  move: PokemonMove | undefined;
  result: DamageCalculationResult | null;
};

type CalculatorToggleField =
  | "isCritical"
  | "isHelpingHand"
  | "isTailwind"
  | "isFriendGuard"
  | "isWall"
  | "isPlusMinus";

type CalculatorResultPanelProps = {
  battleFormat: BattleFormat;
  direction: DamageDirection;
  calculations: CalculationRow[];
  field: CalculatorField;
  hasBothPokemon: boolean;
  canActivatePlusMinus: boolean;
  playerSpeed: number | null;
  opponentSpeed: number | null;
  fasterSide: "player" | "opponent" | null;
  onReverseDirection: () => void;
  onFieldChange: Dispatch<SetStateAction<CalculatorField>>;
};

function formatChance(value: number) {
  if (value === 0 || value === 100) {
    return `${value}%`;
  }

  return `${value.toFixed(1)}%`;
}

function getEffectivenessPresentation(effectiveness: number) {
  if (effectiveness === 0) {
    return {
      className: "is-immune",
      label: "x0",
    };
  }

  if (effectiveness < 1) {
    return {
      className: "is-resisted",
      label: `x${effectiveness}`,
    };
  }

  if (effectiveness > 1) {
    return {
      className: "is-weak",
      label: `x${effectiveness}`,
    };
  }

  return {
    className: "is-neutral",
    label: "x1",
  };
}

export function CalculatorResultPanel({
  battleFormat,
  direction,
  calculations,
  field,
  hasBothPokemon,
  canActivatePlusMinus,
  playerSpeed,
  opponentSpeed,
  fasterSide,
  onReverseDirection,
  onFieldChange,
}: CalculatorResultPanelProps) {
  const { gameName, locale, t } = useLocalization();
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US"),
    [locale],
  );

  function updateField<Key extends keyof CalculatorField>(
    key: Key,
    value: CalculatorField[Key],
  ) {
    onFieldChange((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function getKoSummary(
    result: Extract<DamageCalculationResult, { status: "ready" }>,
  ) {
    if (result.oneHitKoChance === 100) {
      return t("calculator.guaranteedOhko");
    }

    if (result.oneHitKoChance > 0) {
      return t("calculator.chanceOhko", {
        chance: formatChance(result.oneHitKoChance),
      });
    }

    if (result.koHits <= 0) {
      return t("calculator.noKo");
    }

    if (result.koChance === 100) {
      return t("calculator.guaranteedHitsKo", { hits: result.koHits });
    }

    if (result.koChance !== null && result.koChance > 0) {
      return t("calculator.chanceHitsKo", {
        chance: formatChance(result.koChance),
        hits: result.koHits,
      });
    }

    return t("calculator.possibleHitsKo", { hits: result.koHits });
  }

  function getCalculationLabel(
    move: PokemonMove | undefined,
    result: DamageCalculationResult | null,
  ) {
    if (!move) {
      return t("builder.emptyMove");
    }

    if (!hasBothPokemon) {
      return t("calculator.chooseBothPokemon");
    }

    if (result?.status === "ready") {
      return getKoSummary(result);
    }

    return result?.reason === "status-move"
      ? t("calculator.statusMoveShort")
      : t("calculator.unsupported");
  }

  const toggleOptions: Array<
    [CalculatorToggleField, Parameters<typeof t>[0]]
  > = [
    ["isCritical", "calculator.critical"],
  ];

  if (battleFormat === "doubles") {
    toggleOptions.push(
      ["isHelpingHand", "calculator.helpingHand"],
      ["isTailwind", "calculator.tailwind"],
      ["isFriendGuard", "calculator.friendGuard"],
      ["isWall", "calculator.wall"],
    );

    if (canActivatePlusMinus) {
      toggleOptions.push(["isPlusMinus", "calculator.plusMinus"]);
    }
  } else {
    toggleOptions.push(
      ["isTailwind", "calculator.tailwind"],
      ["isWall", "calculator.wall"],
    );
  }

  return (
    <section
      id="calculator-mobile-panel-damage"
      className="calculator-result-panel"
      role="tabpanel"
      aria-labelledby="calculator-mobile-tab-damage"
    >
      <div className="calculator-direction-control">
        <span
          className={`calculator-speed-indicator ${
            fasterSide === "player" ? "is-active" : ""
          }`}
          aria-label={
            fasterSide === "player"
              ? t("calculator.fasterPokemon", {
                  speed: playerSpeed ?? 0,
                })
              : undefined
          }
          title={
            fasterSide === "player"
              ? t("calculator.fasterPokemon", {
                  speed: playerSpeed ?? 0,
                })
              : undefined
          }
        >
          {fasterSide === "player" ? (
            <FontAwesomeIcon icon={faAnglesLeft} aria-hidden="true" />
          ) : null}
        </span>

        <button
          className="calculator-direction-button"
          type="button"
          aria-label={t("calculator.reverseDirection")}
          onClick={onReverseDirection}
        >
          <FontAwesomeIcon
            icon={
              direction === "player-to-opponent"
                ? faArrowRight
                : faArrowLeft
            }
            aria-hidden="true"
          />
          <FontAwesomeIcon icon={faRightLeft} aria-hidden="true" />
        </button>

        <span
          className={`calculator-speed-indicator ${
            fasterSide === "opponent" ? "is-active" : ""
          }`}
          aria-label={
            fasterSide === "opponent"
              ? t("calculator.fasterPokemon", {
                  speed: opponentSpeed ?? 0,
                })
              : undefined
          }
          title={
            fasterSide === "opponent"
              ? t("calculator.fasterPokemon", {
                  speed: opponentSpeed ?? 0,
                })
              : undefined
          }
        >
          {fasterSide === "opponent" ? (
            <FontAwesomeIcon icon={faAnglesRight} aria-hidden="true" />
          ) : null}
        </span>
      </div>

      <div className="calculator-result">
        <div
          className="calculator-move-results-table"
          role="table"
          aria-label={t("calculator.moveResults")}
        >
          {calculations.map(({ move, result }, moveIndex) => {
            const readyResult =
              result?.status === "ready" ? result : null;
            const effectiveness =
              readyResult?.offensivePower !== null &&
              readyResult?.offensivePower !== undefined
                ? getEffectivenessPresentation(readyResult.effectiveness)
                : null;
            const percentText = readyResult
              ? `${readyResult.minPercent.toFixed(1)}\u2013${readyResult.maxPercent.toFixed(1)}%`
              : "-";
            const damageText = readyResult
              ? `${readyResult.minDamage}\u2013${readyResult.maxDamage}`
              : "-";
            const offensivePowerText =
              readyResult?.offensivePower === null ||
              readyResult?.offensivePower === undefined
                ? "-"
                : numberFormatter.format(readyResult.offensivePower);

            return (
              <div
                className={`calculator-move-result-row ${
                  readyResult ? "" : "is-unavailable"
                }`}
                role="row"
                key={`${moveIndex}-${move?.id ?? "empty"}`}
              >
                <div
                  className="calculator-move-result-primary"
                  role="rowheader"
                >
                  <span className="calculator-result-move-name">
                    {move ? <TypeBadge type={move.type} /> : null}
                    <strong>
                      {move
                        ? gameName("moves", move.id, move.name)
                        : t("calculator.moveSlot", {
                            slot: moveIndex + 1,
                          })}
                    </strong>
                    {effectiveness ? (
                      <span
                        className={`calculator-effectiveness ${effectiveness.className}`}
                      >
                        {effectiveness.label}
                      </span>
                    ) : null}
                  </span>
                </div>

                <span className="calculator-result-verdict">
                  {getCalculationLabel(move, result)}
                </span>

                <div className="calculator-damage-summary" role="cell">
                  <strong
                    className="calculator-primary-percent"
                    aria-label={`${t("calculator.percent")} ${percentText}`}
                  >
                    {percentText}
                  </strong>
                  <span
                    className="calculator-raw-damage"
                    aria-label={`${t("calculator.damage")} ${damageText}`}
                  >
                    {readyResult ? `(${damageText})` : "-"}
                  </span>
                </div>

                <div className="calculator-offensive-power" role="cell">
                  <span>{t("calculator.offensivePower")}</span>
                  <strong>{offensivePowerText}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`calculator-field-controls is-${battleFormat}${
          canActivatePlusMinus ? " has-plus-minus" : ""
        }`}
      >
        <div className="calculator-field-heading">
          {t("calculator.battleConditions")}
        </div>
        <label>
          <span className="sr-only">{t("calculator.weather")}</span>
          <select
            value={field.weather}
            onChange={(event) =>
              updateField(
                "weather",
                event.target.value as CalculatorField["weather"],
              )
            }
          >
            <option value="none">{t("calculator.weather")}</option>
            <option value="sun">{t("calculator.sun")}</option>
            <option value="rain">{t("calculator.rain")}</option>
            <option value="sand">{t("calculator.sand")}</option>
            <option value="snow">{t("calculator.snow")}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">{t("calculator.terrain")}</span>
          <select
            value={field.terrain}
            onChange={(event) =>
              updateField(
                "terrain",
                event.target.value as CalculatorField["terrain"],
              )
            }
          >
            <option value="none">{t("calculator.terrain")}</option>
            <option value="electric">
              {t("calculator.electricTerrain")}
            </option>
            <option value="grassy">
              {t("calculator.grassyTerrain")}
            </option>
            <option value="psychic">
              {t("calculator.psychicTerrain")}
            </option>
            <option value="misty">
              {t("calculator.mistyTerrain")}
            </option>
          </select>
        </label>
        <label>
          <span className="sr-only">{t("calculator.roomGravity")}</span>
          <select
            value={field.room}
            onChange={(event) =>
              updateField(
                "room",
                event.target.value as CalculatorField["room"],
              )
            }
          >
            <option value="none">{t("calculator.roomGravity")}</option>
            <option value="magic">{t("calculator.magicRoom")}</option>
            <option value="wonder">{t("calculator.wonderRoom")}</option>
            <option value="gravity">{t("calculator.gravity")}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">{t("calculator.aura")}</span>
          <select
            value={field.aura}
            onChange={(event) =>
              updateField(
                "aura",
                event.target.value as CalculatorField["aura"],
              )
            }
          >
            <option value="none">{t("calculator.aura")}</option>
            <option value="fairy">{t("calculator.fairyAura")}</option>
          </select>
        </label>
        {toggleOptions.map(([fieldKey, labelKey]) => (
          <label className="calculator-toggle" key={fieldKey}>
            <input
              type="checkbox"
              checked={Boolean(field[fieldKey])}
              onChange={(event) =>
                updateField(fieldKey, event.target.checked)
              }
            />
            <span>{t(labelKey)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
