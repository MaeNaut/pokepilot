import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CalculatorPokemonOption } from "../calculator/calculatorEditorTypes";
import type {
  CandidateFilterOption,
  CandidateFilterPicker,
} from "../utils/candidateFilterOptions";
import { useLocalization } from "../i18n/useLocalization";
import type {
  PokemonCandidateFilters,
  PokemonMove,
  PokemonType,
} from "../types";
import {
  createEmptyPokemonCandidateFilters,
  matchesPokemonCandidateFilters,
  togglePokemonTypeFilter,
} from "../utils/pokemonCandidateFilters";
import {
  filterCandidateOptionsByQuery,
  getCandidateAbilityOptions,
  getCandidateMoveOptions,
  getSelectedCandidateMoveOptions,
  indexCandidateMoves,
} from "../utils/candidateFilterOptions";
import { getNextCircularIndex } from "../utils/optionNavigation";
import { useDismissOnOutsidePointer } from "./useDismissOnOutsidePointer";
import { useIncrementalOptions } from "./useIncrementalOptions";

type UseCalculatorCandidateFiltersOptions = {
  pokemonOptions: CalculatorPokemonOption[];
  candidateMoveIndex: PokemonMove[];
  isTouchLayout: boolean;
  resetKey: string;
  closeOtherPicker: () => void;
};

export function useCalculatorCandidateFilters({
  pokemonOptions,
  candidateMoveIndex,
  isTouchLayout,
  resetKey,
  closeOtherPicker,
}: UseCalculatorCandidateFiltersOptions) {
  const { gameName } = useLocalization();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<PokemonCandidateFilters>(
    createEmptyPokemonCandidateFilters,
  );
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
    setFilters(createEmptyPokemonCandidateFilters());
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
    setFilters((current) => ({
      ...current,
      types: togglePokemonTypeFilter(current.types, type),
    }));
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
      setFilters((current) => ({
        ...current,
        ability: { id: option.id, name: option.name },
      }));
      closePicker();
      return;
    }

    if (openPicker === "move") {
      setFilters((current) => {
        const targetIndex = Math.min(
          moveFilterSlot ?? current.moves.length,
          current.moves.length,
        );
        const nextMoves = [...current.moves];
        nextMoves[targetIndex] = { id: option.id, name: option.name };

        return {
          ...current,
          moves: nextMoves,
        };
      });
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
    setFilters(createEmptyPokemonCandidateFilters());
    closePicker();
  }

  function removeAbility() {
    setFilters((current) => ({
      ...current,
      ability: null,
    }));
  }

  function removeMove(moveIndex: number) {
    setFilters((current) => ({
      ...current,
      moves: current.moves.filter((_, index) => index !== moveIndex),
    }));
    closePicker();
  }

  return {
    activeOptionIndex,
    filteredPokemonOptions,
    filters,
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
