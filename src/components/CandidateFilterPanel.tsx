import type { KeyboardEvent, RefObject, UIEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faPlus,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { formatIdLabel } from "../api/showdownIds";
import { pokemonTypes } from "../types";
import type {
  PokemonCandidateFilters,
  PokemonCandidateFilterValue,
  PokemonType,
} from "../types";
import { hasPokemonCandidateFilters } from "../utils/pokemonCandidateFilters";
import { TypeBadge } from "./TypeBadge";

export type CandidateFilterPicker = "ability" | "move";

export type CandidateFilterOption = PokemonCandidateFilterValue & {
  type?: PokemonType;
  power?: number | null;
};

type CandidateFilterPanelProps = {
  filters: PokemonCandidateFilters;
  matchingCount: number;
  totalCount: number;
  openPicker: CandidateFilterPicker | null;
  query: string;
  options: CandidateFilterOption[];
  selectedMoves: CandidateFilterOption[];
  activeMoveSlot: number | null;
  activeOptionIndex: number;
  panelRef: RefObject<HTMLDivElement | null>;
  onToggleType: (type: PokemonType) => void;
  onClearFilters: () => void;
  onOpenPicker: (picker: CandidateFilterPicker) => void;
  onOpenMovePicker: (slotIndex: number) => void;
  onClosePicker: () => void;
  onQueryChange: (query: string) => void;
  onResultsScroll: (event: UIEvent<HTMLDivElement>) => void;
  onMoveActiveOption: (direction: 1 | -1) => void;
  onActiveOptionChange: (index: number) => void;
  onSelectOption: (option: CandidateFilterOption) => void;
  onRemoveAbility: () => void;
  onRemoveMove: (slotIndex: number) => void;
};

export function CandidateFilterPanel({
  filters,
  matchingCount,
  totalCount,
  openPicker,
  query,
  options,
  selectedMoves,
  activeMoveSlot,
  activeOptionIndex,
  panelRef,
  onToggleType,
  onClearFilters,
  onOpenPicker,
  onOpenMovePicker,
  onClosePicker,
  onQueryChange,
  onResultsScroll,
  onMoveActiveOption,
  onActiveOptionChange,
  onSelectOption,
  onRemoveAbility,
  onRemoveMove,
}: CandidateFilterPanelProps) {
  const hasFilters = hasPokemonCandidateFilters(filters);

  function handlePickerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      onClosePicker();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onMoveActiveOption(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" && activeOptionIndex >= 0) {
      const hasClearMoveOption =
        openPicker === "move" &&
        activeMoveSlot !== null &&
        Boolean(filters.moves[activeMoveSlot]);

      if (hasClearMoveOption && activeOptionIndex === 0) {
        event.preventDefault();
        onRemoveMove(activeMoveSlot);
        return;
      }

      const option = options[
        activeOptionIndex - (hasClearMoveOption ? 1 : 0)
      ];
      if (option) {
        event.preventDefault();
        onSelectOption(option);
      }
    }
  }

  function renderPicker(picker: CandidateFilterPicker, moveSlot?: number) {
    if (
      openPicker !== picker ||
      (picker === "move" && activeMoveSlot !== moveSlot)
    ) {
      return null;
    }

    const hasClearMoveOption =
      picker === "move" &&
      moveSlot !== undefined &&
      Boolean(filters.moves[moveSlot]);
    const optionOffset = hasClearMoveOption ? 1 : 0;

    return (
      <div
        className={`candidate-filter-menu${
          picker === "move" ? " candidate-filter-move-menu" : ""
        }`}
      >
        <input
          className={picker === "move" ? "move-search-input" : "candidate-filter-search"}
          aria-label={`Search ${picker === "ability" ? "abilities" : "moves"}`}
          autoFocus
          value={query}
          placeholder={picker === "ability" ? "Search abilities" : "Search moves"}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handlePickerKeyDown}
        />
        <div
          className={picker === "move" ? "move-results" : "candidate-filter-results"}
          role="listbox"
          onScroll={onResultsScroll}
        >
          {hasClearMoveOption && moveSlot !== undefined ? (
            <button
              className={`move-option move-clear-option ${
                activeOptionIndex === 0 ? "is-keyboard-active" : ""
              }`}
              type="button"
              role="option"
              aria-selected={activeOptionIndex === 0}
              onMouseEnter={() => onActiveOptionChange(0)}
              onClick={() => onRemoveMove(moveSlot)}
            >
              <span className="move-clear-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faXmark} />
              </span>
              <span>Remove Move Filter</span>
            </button>
          ) : null}
          {options.map((option, optionIndex) =>
            picker === "move" ? (
              <button
                className={`move-option ${option.type ? `type-${option.type}` : ""} ${
                  activeOptionIndex === optionIndex + optionOffset
                    ? "is-keyboard-active"
                    : ""
                }`}
                type="button"
                role="option"
                aria-selected={activeOptionIndex === optionIndex + optionOffset}
                key={option.id}
                onMouseEnter={() => onActiveOptionChange(optionIndex + optionOffset)}
                onClick={() => onSelectOption(option)}
              >
                <span className="move-type-mark">
                  {option.type ? <TypeBadge type={option.type} /> : null}
                </span>
                <span className="move-name">{option.name}</span>
                <span className="move-power-panel">{option.power ?? "-"}</span>
              </button>
            ) : (
              <button
                className="candidate-filter-option"
                type="button"
                role="option"
                aria-selected={activeOptionIndex === optionIndex}
                key={option.id}
                onMouseEnter={() => onActiveOptionChange(optionIndex)}
                onClick={() => onSelectOption(option)}
              >
                <span>{option.name}</span>
              </button>
            ),
          )}
          {query && options.length === 0 ? (
            <div className="candidate-filter-empty">No matches</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section className="candidate-filter-panel" aria-label="Pokemon filters" ref={panelRef}>
      <header className="candidate-filter-heading">
        <div>
          <h2>Filter</h2>
          <span>{matchingCount} of {totalCount}</span>
        </div>
        {hasFilters ? (
          <button
            className="candidate-filter-clear"
            type="button"
            aria-label="Clear candidate filters"
            title="Clear filters"
            onClick={onClearFilters}
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="candidate-filter-group">
        <span className="candidate-filter-label">Type</span>
        <div className="candidate-type-grid" role="group" aria-label="Pokemon types">
          {pokemonTypes.map((type) => {
            const isSelected = filters.types.includes(type);
            const isUnavailable = filters.types.length >= 2 && !isSelected;

            return (
              <button
                className="candidate-type-button"
                type="button"
                aria-label={`${isSelected ? "Remove" : "Add"} ${formatIdLabel(type)} type filter`}
                aria-pressed={isSelected}
                disabled={isUnavailable}
                title={isUnavailable ? "Remove a selected type first" : formatIdLabel(type)}
                key={type}
                onClick={() => onToggleType(type)}
              >
                <TypeBadge type={type} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="candidate-filter-row">
        <span className="candidate-filter-label">Ability</span>
        <div className="candidate-filter-picker-shell">
          <button
            className={`candidate-filter-trigger ${filters.ability ? "has-value" : ""}`}
            type="button"
            aria-expanded={openPicker === "ability"}
            aria-haspopup="listbox"
            onClick={() => onOpenPicker("ability")}
          >
            <span>{filters.ability?.name ?? "Any ability"}</span>
            <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
          </button>
          {filters.ability ? (
            <button
              className="candidate-filter-remove"
              type="button"
              aria-label={`Remove ${filters.ability.name} ability filter`}
              title="Remove ability"
              onClick={onRemoveAbility}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            </button>
          ) : null}
          {renderPicker("ability")}
        </div>
      </div>

      <div className="candidate-filter-group candidate-move-group">
        <span className="candidate-filter-label">Moves</span>
        <div className="candidate-filter-move-grid">
          {Array.from({ length: 4 }, (_, slotIndex) => {
            const move = selectedMoves[slotIndex];

            return (
              <div className="candidate-filter-move-picker" key={slotIndex}>
                <button
                  className={`move-pill candidate-filter-move-pill ${
                    move?.type ? `type-${move.type}` : "is-empty"
                  }`}
                  type="button"
                  aria-expanded={
                    openPicker === "move" && activeMoveSlot === slotIndex
                  }
                  aria-haspopup="listbox"
                  aria-label={
                    move
                      ? `Change ${move.name} move filter`
                      : `Add move filter ${slotIndex + 1}`
                  }
                  onClick={() => onOpenMovePicker(slotIndex)}
                >
                  {move ? (
                    <>
                      <span className="move-type-mark">
                        {move.type ? <TypeBadge type={move.type} /> : null}
                      </span>
                      <span className="move-name">{move.name}</span>
                      <span className="move-power-panel">{move.power ?? "-"}</span>
                    </>
                  ) : (
                    <span className="empty-move-label">
                      <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                      Add Move
                    </span>
                  )}
                </button>
                {renderPicker("move", slotIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
