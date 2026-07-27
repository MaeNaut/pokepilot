import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { itemFromIndexEntry } from "../api/showdownCatalog";
import type { CalculatorPokemonOption } from "../calculator/calculatorEditorTypes";
import { useLocalization } from "../i18n/useLocalization";
import type {
  ItemIndexEntry,
  PokemonItem,
  PokemonMove,
} from "../types";
import { ItemSprite } from "./ItemSprite";
import { MoveSummary } from "./MoveDetails";

type PokemonPickerOptionsProps = {
  options: CalculatorPokemonOption[];
  activeIndex: number;
  previewOnly: boolean;
  onActiveChange: (
    index: number,
    option: CalculatorPokemonOption,
  ) => void;
  onPreviewClear: () => void;
  onSelect: (option: CalculatorPokemonOption) => void;
};

export function PokemonPickerOptions({
  options,
  activeIndex,
  previewOnly,
  onActiveChange,
  onPreviewClear,
  onSelect,
}: PokemonPickerOptionsProps) {
  return options.map((option, index) => (
    <button
      className="pokemon-name-option"
      type="button"
      role="option"
      aria-selected={activeIndex === index}
      key={option.id}
      onFocus={() => onActiveChange(index, option)}
      onMouseEnter={
        previewOnly ? undefined : () => onActiveChange(index, option)
      }
      onMouseLeave={previewOnly ? undefined : onPreviewClear}
      onClick={() => {
        onActiveChange(index, option);
        if (!previewOnly) {
          onSelect(option);
        }
      }}
    >
      <span>{option.label}</span>
      {option.usageRank ? <small>#{option.usageRank}</small> : null}
    </button>
  ));
}

type ItemPickerOptionsProps = {
  options: Array<ItemIndexEntry | null>;
  activeIndex: number;
  previewOnly: boolean;
  onActiveChange: (index: number, item: PokemonItem | null) => void;
  onPreviewClear: () => void;
  onSelect: (item: PokemonItem | null) => void;
};

export function ItemPickerOptions({
  options,
  activeIndex,
  previewOnly,
  onActiveChange,
  onPreviewClear,
  onSelect,
}: ItemPickerOptionsProps) {
  const { gameName, t } = useLocalization();

  return options.map((option, index) => {
    const item = option ? itemFromIndexEntry(option) : null;

    return (
      <button
        className={`item-option${option ? "" : " item-clear-option"}`}
        type="button"
        role="option"
        aria-selected={activeIndex === index}
        key={option?.name ?? "clear-item"}
        onFocus={() => onActiveChange(index, item)}
        onMouseEnter={
          previewOnly ? undefined : () => onActiveChange(index, item)
        }
        onMouseLeave={previewOnly ? undefined : onPreviewClear}
        onClick={() => {
          onActiveChange(index, item);
          if (!previewOnly) {
            onSelect(item);
          }
        }}
      >
        <span className="item-option-icon" aria-hidden="true">
          {item ? (
            <ItemSprite item={item} />
          ) : (
            <FontAwesomeIcon icon={faXmark} />
          )}
        </span>
        <span className="item-option-name">
          {option
            ? gameName("items", option.showdownId, option.displayName)
            : t("builder.removeItem")}
        </span>
      </button>
    );
  });
}

type AbilityPickerOptionsProps = {
  abilities: string[];
  activeIndex: number;
  previewOnly: boolean;
  onActiveChange: (index: number, ability: string) => void;
  onPreviewClear: () => void;
  onSelect: (ability: string) => void;
};

export function AbilityPickerOptions({
  abilities,
  activeIndex,
  previewOnly,
  onActiveChange,
  onPreviewClear,
  onSelect,
}: AbilityPickerOptionsProps) {
  const { gameName } = useLocalization();

  return abilities.map((ability, index) => (
    <button
      className="trait-option"
      type="button"
      role="option"
      aria-selected={activeIndex === index}
      key={ability}
      onFocus={() => onActiveChange(index, ability)}
      onMouseEnter={
        previewOnly ? undefined : () => onActiveChange(index, ability)
      }
      onMouseLeave={previewOnly ? undefined : onPreviewClear}
      onClick={() => {
        onActiveChange(index, ability);
        if (!previewOnly) {
          onSelect(ability);
        }
      }}
    >
      {gameName("abilities", ability, ability)}
    </button>
  ));
}

type MovePickerOptionsProps = {
  moves: PokemonMove[];
  activeIndex: number;
  previewOnly: boolean;
  onActiveChange: (index: number, move: PokemonMove | null) => void;
  onSelect: (move: PokemonMove | null) => void;
};

export function MovePickerOptions({
  moves,
  activeIndex,
  previewOnly,
  onActiveChange,
  onSelect,
}: MovePickerOptionsProps) {
  const { t } = useLocalization();

  return (
    <>
      <button
        className={`move-option move-clear-option ${
          activeIndex === 0 ? "is-keyboard-active" : ""
        }`}
        type="button"
        role="option"
        aria-selected={activeIndex === 0}
        data-option-index={0}
        onFocus={() => onActiveChange(0, null)}
        onMouseEnter={
          previewOnly ? undefined : () => onActiveChange(0, null)
        }
        onClick={() => {
          onActiveChange(0, null);
          if (!previewOnly) {
            onSelect(null);
          }
        }}
      >
        <span className="move-clear-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faXmark} />
        </span>
        <span>{t("builder.emptyMove")}</span>
      </button>
      {moves.map((move, index) => (
        <button
          className={`move-option type-${move.type} ${
            activeIndex === index + 1 ? "is-keyboard-active" : ""
          }`}
          type="button"
          role="option"
          aria-selected={activeIndex === index + 1}
          data-option-index={index + 1}
          key={move.id}
          onFocus={() => onActiveChange(index + 1, move)}
          onMouseEnter={
            previewOnly
              ? undefined
              : () => onActiveChange(index + 1, move)
          }
          onMouseLeave={
            previewOnly ? undefined : () => onActiveChange(index + 1, null)
          }
          onClick={() => {
            onActiveChange(index + 1, move);
            if (!previewOnly) {
              onSelect(move);
            }
          }}
        >
          <MoveSummary move={move} />
        </button>
      ))}
    </>
  );
}
