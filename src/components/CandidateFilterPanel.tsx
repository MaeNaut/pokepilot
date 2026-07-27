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
import { useLocalization } from "../i18n/useLocalization";
import {
  TouchPickerSearchInput,
  TouchSelectionDialog,
} from "./TouchSelectionDialog";
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
  isTouchLayout: boolean;
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
  isTouchLayout,
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
  const { gameName, t } = useLocalization();
  const hasFilters = hasPokemonCandidateFilters(filters);

  function hasClearMoveOption(moveSlot = activeMoveSlot) {
    return (
      openPicker === "move" &&
      moveSlot !== null &&
      moveSlot !== undefined &&
      Boolean(filters.moves[moveSlot])
    );
  }

  function selectActivePickerOption() {
    if (activeOptionIndex < 0) {
      return;
    }

    const hasClearOption = hasClearMoveOption();
    if (hasClearOption && activeOptionIndex === 0 && activeMoveSlot !== null) {
      onRemoveMove(activeMoveSlot);
      return;
    }

    const option = options[activeOptionIndex - (hasClearOption ? 1 : 0)];
    if (option) {
      onSelectOption(option);
    }
  }

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
      event.preventDefault();
      selectActivePickerOption();
    }
  }

  function renderPickerOptions(
    picker: CandidateFilterPicker,
    moveSlot?: number,
  ) {
    const hasClearOption = hasClearMoveOption(moveSlot);
    const optionOffset = hasClearOption ? 1 : 0;

    return (
      <>
        {hasClearOption && moveSlot !== undefined ? (
          <button
            className={`move-option move-clear-option ${
              activeOptionIndex === 0 ? "is-keyboard-active" : ""
            }`}
            type="button"
            role="option"
            aria-selected={activeOptionIndex === 0}
            onFocus={() => onActiveOptionChange(0)}
            onMouseEnter={() => onActiveOptionChange(0)}
            onClick={() => onRemoveMove(moveSlot)}
          >
            <span className="move-clear-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faXmark} />
            </span>
            <span>{t("filter.removeMove")}</span>
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
              onFocus={() =>
                onActiveOptionChange(optionIndex + optionOffset)
              }
              onMouseEnter={() =>
                onActiveOptionChange(optionIndex + optionOffset)
              }
              onClick={() => onSelectOption(option)}
            >
              <span className="move-type-mark">
                {option.type ? <TypeBadge type={option.type} /> : null}
              </span>
              <span className="move-name">
                {gameName("moves", option.id, option.name)}
              </span>
              <span className="move-power-panel">{option.power ?? "-"}</span>
            </button>
          ) : (
            <button
              className="candidate-filter-option"
              type="button"
              role="option"
              aria-selected={activeOptionIndex === optionIndex}
              key={option.id}
              onFocus={() => onActiveOptionChange(optionIndex)}
              onMouseEnter={() => onActiveOptionChange(optionIndex)}
              onClick={() => onSelectOption(option)}
            >
              <span>
                {gameName("abilities", option.id, option.name)}
              </span>
            </button>
          ),
        )}
        {query && options.length === 0 ? (
          <div className="candidate-filter-empty">{t("filter.noMatches")}</div>
        ) : null}
      </>
    );
  }

  function renderInlinePicker(
    picker: CandidateFilterPicker,
    moveSlot?: number,
  ) {
    if (
      isTouchLayout ||
      openPicker !== picker ||
      (picker === "move" && activeMoveSlot !== moveSlot)
    ) {
      return null;
    }

    return (
      <div
        className={`candidate-filter-menu${
          picker === "move" ? " candidate-filter-move-menu" : ""
        }`}
      >
        <input
          className={
            picker === "move"
              ? "move-search-input"
              : "candidate-filter-search"
          }
          aria-label={t(
            picker === "ability"
              ? "filter.searchAbilities"
              : "filter.searchMoves",
          )}
          autoFocus
          value={query}
          placeholder={t(
            picker === "ability"
              ? "filter.searchAbilities"
              : "filter.searchMoves",
          )}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handlePickerKeyDown}
        />
        <div
          className={
            picker === "move"
              ? "move-results"
              : "candidate-filter-results"
          }
          role="listbox"
          onScroll={onResultsScroll}
        >
          {renderPickerOptions(picker, moveSlot)}
        </div>
      </div>
    );
  }

  function renderTouchPicker() {
    if (!isTouchLayout || !openPicker) {
      return null;
    }

    const picker = openPicker;
    const moveSlot = picker === "move" ? (activeMoveSlot ?? 0) : undefined;

    return (
      <TouchSelectionDialog
        kind={picker}
        title={
          picker === "ability"
            ? t("builder.selectAbility")
            : t("builder.selectMove", { slot: (moveSlot ?? 0) + 1 })
        }
        showActions={false}
        search={
          <TouchPickerSearchInput
            value={query}
            label={t(
              picker === "ability"
                ? "filter.searchAbilities"
                : "filter.searchMoves",
            )}
            placeholder={t(
              picker === "ability"
                ? "filter.searchAbilities"
                : "filter.searchMoves",
            )}
            onChange={onQueryChange}
            onMove={onMoveActiveOption}
            onSubmit={selectActivePickerOption}
          />
        }
        onClose={onClosePicker}
      >
        <div
          className={`touch-picker-option-list ${
            picker === "move"
              ? "move-results"
              : "touch-ability-options candidate-filter-touch-options"
          }`}
          role="listbox"
          onScroll={onResultsScroll}
        >
          {renderPickerOptions(picker, moveSlot)}
        </div>
      </TouchSelectionDialog>
    );
  }

  return (
    <>
      <section
        className="candidate-filter-panel"
        aria-label={t("filter.aria")}
        ref={panelRef}
      >
        <header className="candidate-filter-heading">
          <div>
            <h2>{t("filter.title")}</h2>
            <span>
              {t("filter.count", {
                matching: matchingCount,
                total: totalCount,
              })}
            </span>
          </div>
          {hasFilters ? (
            <button
              className="candidate-filter-clear"
              type="button"
              aria-label={t("filter.clear")}
              title={t("filter.clearTitle")}
              onClick={onClearFilters}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className="candidate-filter-group">
          <span className="candidate-filter-label">{t("filter.type")}</span>
          <div
            className="candidate-type-grid"
            role="group"
            aria-label={t("filter.typesAria")}
          >
            {pokemonTypes.map((type) => {
              const isSelected = filters.types.includes(type);
              const isUnavailable = filters.types.length >= 2 && !isSelected;

              return (
                <button
                  className="candidate-type-button"
                  type="button"
                  aria-label={t(
                    isSelected ? "filter.removeType" : "filter.addType",
                    {
                      type: gameName("types", type, formatIdLabel(type)),
                    },
                  )}
                  aria-pressed={isSelected}
                  disabled={isUnavailable}
                  title={
                    isUnavailable
                      ? t("filter.removeTypeFirst")
                      : gameName("types", type, formatIdLabel(type))
                  }
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
          <span className="candidate-filter-label">
            {t("filter.ability")}
          </span>
          <div className="candidate-filter-picker-shell">
            <button
              className={`candidate-filter-trigger ${
                filters.ability ? "has-value" : ""
              }`}
              type="button"
              aria-expanded={openPicker === "ability"}
              aria-haspopup={isTouchLayout ? "dialog" : "listbox"}
              onClick={() => onOpenPicker("ability")}
            >
              <span>
                {filters.ability
                  ? gameName(
                      "abilities",
                      filters.ability.id,
                      filters.ability.name,
                    )
                  : t("filter.anyAbility")}
              </span>
              <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
            </button>
            {filters.ability ? (
              <button
                className="candidate-filter-remove"
                type="button"
                aria-label={t("filter.removeAbilityNamed", {
                  ability: gameName(
                    "abilities",
                    filters.ability.id,
                    filters.ability.name,
                  ),
                })}
                title={t("filter.removeAbility")}
                onClick={onRemoveAbility}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            ) : null}
            {renderInlinePicker("ability")}
          </div>
        </div>

        <div className="candidate-filter-group candidate-move-group">
          <span className="candidate-filter-label">
            {t("filter.moves")}
          </span>
          <div className="candidate-filter-move-grid">
            {Array.from({ length: 4 }, (_, slotIndex) => {
              const move = selectedMoves[slotIndex];

              return (
                <div
                  className="candidate-filter-move-picker"
                  key={slotIndex}
                >
                  <button
                    className={`move-pill candidate-filter-move-pill ${
                      move?.type ? `type-${move.type}` : "is-empty"
                    }`}
                    type="button"
                    aria-expanded={
                      openPicker === "move" && activeMoveSlot === slotIndex
                    }
                    aria-haspopup={isTouchLayout ? "dialog" : "listbox"}
                    aria-label={
                      move
                        ? t("filter.changeMove", {
                            move: gameName("moves", move.id, move.name),
                          })
                        : t("filter.addMoveSlot", { slot: slotIndex + 1 })
                    }
                    onClick={() => onOpenMovePicker(slotIndex)}
                  >
                    {move ? (
                      <>
                        <span className="move-type-mark">
                          {move.type ? <TypeBadge type={move.type} /> : null}
                        </span>
                        <span className="move-name">
                          {gameName("moves", move.id, move.name)}
                        </span>
                        <span className="move-power-panel">
                          {move.power ?? "-"}
                        </span>
                      </>
                    ) : (
                      <span className="empty-move-label">
                        <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                        {t("filter.addMove")}
                      </span>
                    )}
                  </button>
                  {renderInlinePicker("move", slotIndex)}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {renderTouchPicker()}
    </>
  );
}
