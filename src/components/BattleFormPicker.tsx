import type { KeyboardEvent, RefObject } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import type { BattleFormGroup } from "../data/battleForms";
import { useLocalization } from "../i18n/useLocalization";

type BattleFormPickerProps = {
  group: BattleFormGroup;
  selectedPokemonId: string;
  selectedOptionIndex: number;
  activeOptionIndex: number;
  isOpen: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  onOpenChange: (isOpen: boolean) => void;
  onActiveOptionIndexChange: (optionIndex: number) => void;
  onSelect: (pokemonId: string) => void | Promise<void>;
};

export function BattleFormPicker({
  group,
  selectedPokemonId,
  selectedOptionIndex,
  activeOptionIndex,
  isOpen,
  containerRef,
  onOpenChange,
  onActiveOptionIndexChange,
  onSelect,
}: BattleFormPickerProps) {
  const { pokemonFormName, t } = useLocalization();
  const selectedOption =
    group.options[selectedOptionIndex] ?? group.options[0];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      onOpenChange(false);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      void onSelect(group.options[activeOptionIndex].pokemonId);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();

    if (!isOpen) {
      onActiveOptionIndexChange(selectedOptionIndex);
      onOpenChange(true);
      return;
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    onActiveOptionIndexChange(
      (activeOptionIndex + direction + group.options.length) %
        group.options.length,
    );
  }

  return (
    <div className="form-picker" ref={containerRef}>
      <button
        className="form-picker-trigger"
        type="button"
        aria-label={t("builder.form", {
          form: pokemonFormName(selectedOption.pokemonId, selectedOption.label),
        })}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          onActiveOptionIndexChange(selectedOptionIndex);
          onOpenChange(!isOpen);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>
          {pokemonFormName(selectedOption.pokemonId, selectedOption.label)}
        </span>
        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          className="form-picker-menu"
          role="listbox"
          aria-label={t("builder.battleForm")}
        >
          {group.options.map((option, optionIndex) => (
            <button
              className={`form-picker-option ${
                activeOptionIndex === optionIndex ? "is-active" : ""
              }`}
              type="button"
              role="option"
              aria-selected={selectedPokemonId === option.pokemonId}
              key={option.pokemonId}
              onMouseEnter={() => onActiveOptionIndexChange(optionIndex)}
              onClick={() => void onSelect(option.pokemonId)}
            >
              {pokemonFormName(option.pokemonId, option.label)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
