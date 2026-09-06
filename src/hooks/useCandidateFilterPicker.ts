import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalization } from "../i18n/useLocalization";
import type {
  PokemonCandidateFilterValue,
  PokemonCandidateFilters,
  PokemonMove,
  PokemonType,
} from "../types";
import {
  filterCandidateOptionsByQuery,
  getCandidateAbilityOptions,
  getCandidateMoveOptions,
  getSelectedCandidateMoveOptions,
  indexCandidateMoves,
  type CandidateFilterOption,
  type CandidateFilterPicker,
} from "../utils/candidateFilterOptions";
import {
  matchesPokemonCandidateFilters,
  togglePokemonTypeFilter,
} from "../utils/pokemonCandidateFilters";
import { getNextCircularIndex } from "../utils/optionNavigation";
import { useDismissOnOutsidePointer } from "./useDismissOnOutsidePointer";
import { useIncrementalOptions } from "./useIncrementalOptions";

export type CandidateFilterPokemonOption = {
  types: PokemonType[];
  abilityOptions: PokemonCandidateFilterValue[];
  moveIds: string[];
};

type UseCandidateFilterPickerOptions<
  PokemonOption extends CandidateFilterPokemonOption,
> = {
  pokemonOptions: PokemonOption[];
  candidateMoveIndex: PokemonMove[];
  filters: PokemonCandidateFilters;
  isTouchLayout: boolean;
  resetKey?: string | number;
  closeOtherPicker: () => void;
  onFiltersChange: (filters: PokemonCandidateFilters) => void;
};

export function useCandidateFilterPicker<
  PokemonOption extends CandidateFilterPokemonOption,
>({
  pokemonOptions,
  candidateMoveIndex,
  filters,
  isTouchLayout,
  resetKey,
  closeOtherPicker,
  onFiltersChange,
}: UseCandidateFilterPickerOptions<PokemonOption>) {
  const { gameName } = useLocalization();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [openPicker, setOpenPicker] =
    useState<CandidateFilterPicker | null>(null);
  const [moveFilterSlot, setMoveFilterSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);

  const filteredPokemonOptions = useMemo(
    () =>
      pokemonOptions.filter((option) =>
        matchesPokemonCandidateFilters(
          {
            types: option.types,
            abilityIds: option.abilityOptions.map((ability) => ability.id),
            moveIds: option.moveIds,
          },
          filters,
        ),
      ),
    [filters, pokemonOptions],
  );

  const abilityOptions = useMemo(
    () => getCandidateAbilityOptions(pokemonOptions, filters),
    [filters, pokemonOptions],
  );
  const moveById = useMemo(
    () => indexCandidateMoves(candidateMoveIndex),
    [candidateMoveIndex],
  );
  const selectedMoveOptions = useMemo(
    () => getSelectedCandidateMoveOptions(filters, moveById),
    [filters, moveById],
  );
  const moveOptions = useMemo(
    () =>
      getCandidateMoveOptions(
        pokemonOptions,
        filters,
        moveFilterSlot,
        moveById,
        (moveId, fallback) => gameName("moves", moveId, fallback),
      ),
    [filters, gameName, moveById, moveFilterSlot, pokemonOptions],
  );
  const matchingOptions = useMemo(() => {
    const options: CandidateFilterOption[] =
      openPicker === "ability" ? abilityOptions : moveOptions;

    return filterCandidateOptionsByQuery(options, query);
  }, [abilityOptions, moveOptions, openPicker, query]);
  const {
    limit,
    reset: resetOptions,
    ensureIndexVisible,
    handleScroll,
  } = useIncrementalOptions(matchingOptions.length);
  const visibleOptions = matchingOptions.slice(0, limit);

  useDismissOnOutsidePointer(
    panelRef,
    openPicker !== null && !isTouchLayout,
    closePicker,
  );

  useEffect(() => {
    resetOptions();
    setActiveOptionIndex(matchingOptions.length > 0 ? 0 : -1);
  }, [
    matchingOptions.length,
    moveFilterSlot,
    openPicker,
    query,
    resetOptions,
  ]);

  useEffect(() => {
    setOpenPicker(null);
    setMoveFilterSlot(null);
    setQuery("");
  }, [resetKey]);

  function closePicker() {
    setOpenPicker(null);
    setMoveFilterSlot(null);
    setQuery("");
  }

  function toggleType(type: PokemonType) {
    onFiltersChange({
      ...filters,
      types: togglePokemonTypeFilter(filters.types, type),
    });
  }

  function openFilterPicker(picker: CandidateFilterPicker) {
    const shouldClose = openPicker === picker;

    closeOtherPicker();
    setMoveFilterSlot(null);
    setOpenPicker(shouldClose ? null : picker);
    setQuery("");
    resetOptions();
    setActiveOptionIndex(0);
  }

  function openMovePicker(slotIndex: number) {
    const shouldClose =
      openPicker === "move" && moveFilterSlot === slotIndex;

    closeOtherPicker();
    setOpenPicker(shouldClose ? null : "move");
    setMoveFilterSlot(shouldClose ? null : slotIndex);
    setQuery("");
    resetOptions();
    setActiveOptionIndex(0);
  }

  function selectOption(option: CandidateFilterOption) {
    if (openPicker === "ability") {
      onFiltersChange({
        ...filters,
        ability: { id: option.id, name: option.name },
      });
      closePicker();
      return;
    }

    if (openPicker === "move") {
      const targetIndex = Math.min(
        moveFilterSlot ?? filters.moves.length,
        filters.moves.length,
      );
      const nextMoves = [...filters.moves];
      nextMoves[targetIndex] = { id: option.id, name: option.name };

      onFiltersChange({ ...filters, moves: nextMoves });
      closePicker();
    }
  }

  function moveActiveOption(direction: 1 | -1) {
    const hasClearMoveOption =
      openPicker === "move" &&
      moveFilterSlot !== null &&
      Boolean(filters.moves[moveFilterSlot]);

    setActiveOptionIndex((current) => {
      const nextIndex = getNextCircularIndex(
        current,
        matchingOptions.length + (hasClearMoveOption ? 1 : 0),
        direction,
      );
      const optionIndex = nextIndex - (hasClearMoveOption ? 1 : 0);

      ensureIndexVisible(optionIndex);
      return nextIndex;
    });
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    resetOptions();
  }

  function clearFilters() {
    onFiltersChange({ types: [], ability: null, moves: [] });
    closePicker();
  }

  function removeAbility() {
    onFiltersChange({ ...filters, ability: null });
  }

  function removeMove(moveIndex: number) {
    onFiltersChange({
      ...filters,
      moves: filters.moves.filter((_, index) => index !== moveIndex),
    });
    closePicker();
  }

  return {
    activeOptionIndex,
    filteredPokemonOptions,
    moveFilterSlot,
    openPicker,
    panelRef,
    query,
    selectedMoveOptions,
    visibleOptions,
    changeQuery,
    clearFilters,
    closePicker,
    handleResultsScroll: handleScroll,
    moveActiveOption,
    openFilterPicker,
    openMovePicker,
    removeAbility,
    removeMove,
    selectOption,
    setActiveOptionIndex,
    toggleType,
  };
}
