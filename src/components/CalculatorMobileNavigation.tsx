import type { KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import {
  calculatorMobilePageOrder,
  type CalculatorMobilePage,
} from "../calculator/calculatorUi";
import type { DamageDirection } from "../calculator/calculatorViewModel";
import { useLocalization } from "../i18n/useLocalization";

type CalculatorMobileTabsProps = {
  mobilePage: CalculatorMobilePage;
  direction: DamageDirection;
  onSelectPage: (page: CalculatorMobilePage) => void;
  onTabKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    page: CalculatorMobilePage,
  ) => void;
};

export function CalculatorMobileTabs({
  mobilePage,
  direction,
  onSelectPage,
  onTabKeyDown,
}: CalculatorMobileTabsProps) {
  const { t } = useLocalization();

  return (
    <div
      className="calculator-mobile-tabs"
      role="tablist"
      aria-label={t("calculator.title")}
    >
      {calculatorMobilePageOrder.map((page) => {
        const label =
          page === "player"
            ? t("calculator.yourPokemon")
            : page === "damage"
              ? t("calculator.damage")
              : t("calculator.mobileOpponent");
        const isPokemonPage = page !== "damage";
        const isAttackingSide =
          (page === "player" && direction === "player-to-opponent") ||
          (page === "opponent" && direction === "opponent-to-player");
        const roleLabel = isAttackingSide
          ? t("calculator.attacking")
          : t("calculator.defending");

        return (
          <button
            id={`calculator-mobile-tab-${page}`}
            className={`${mobilePage === page ? "is-active" : ""}${
              isPokemonPage
                ? isAttackingSide
                  ? " is-attacking-side"
                  : " is-defending-side"
                : " is-damage-direction"
            }`}
            type="button"
            role="tab"
            aria-controls={`calculator-mobile-panel-${page}`}
            aria-selected={mobilePage === page}
            aria-label={isPokemonPage ? `${label}, ${roleLabel}` : label}
            tabIndex={mobilePage === page ? 0 : -1}
            key={page}
            onClick={() => onSelectPage(page)}
            onKeyDown={(event) => onTabKeyDown(event, page)}
          >
            <span className="calculator-mobile-tab-label">{label}</span>
            {isPokemonPage ? (
              <span className="calculator-mobile-tab-role">
                {roleLabel}
              </span>
            ) : (
              <FontAwesomeIcon
                className="calculator-mobile-tab-arrow"
                icon={
                  direction === "player-to-opponent"
                    ? faArrowRight
                    : faArrowLeft
                }
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
