import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import type { CalculatorPokemonOption } from "../calculator/calculatorEditorTypes";
import type {
  CandidateFilterOption,
  CandidateFilterPicker,
} from "../components/CandidateFilterPanel";
import { useLocalization } from "../i18n/useLocalization";
import type {
  PokemonCandidateFilters,
  PokemonCandidateFilterValue,
  PokemonMove,
  PokemonType,
} from "../types";
import {
  matchesPokemonCandidateFilters,
  togglePokemonTypeFilter,
} from "../utils/pokemonCandidateFilters";
import { useDismissOnOutsidePointer } from "./useDismissOnOutsidePointer";
import { useIncrementalOptions } from "./useIncrementalOptions";

type UseCalculatorCandidateFiltersOptions = {
  pokemonOptions: CalculatorPokemonOption[];
  candidateMoveIndex: PokemonMove[];
  isTouchLayout: boolean;
  resetKey: string;
  closeOtherPicker: () => void;
};

function createEmptyCandidateFilters(): PokemonCandidateFilters {
  return {
    types: [],
    ability: null,
    moves: [],
  };
}

function getNextIndex(
  currentIndex: number,
  optionCount: number,
  direction: 1 | -1,
) {
  if (optionCount === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction > 0 ? 0 : optionCount - 1;
  }

  return (currentIndex + direction + optionCount) % optionCount;
}

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
    createEmptyCandidateFilters,
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

  const abilityOptions = useMemo(() => {
    const optionsById = new Map<string, PokemonCandidateFilterValue>();
    const filtersWithoutAbility = { ...filters, ability: null };

    for (const option of pokemonOptions) {
      if (
        !matchesPokemonCandidateFilters(
          {
            types: option.types,
            abilityIds: option.abilityOptions.map((ability) => ability.id),
            moveIds: option.moveIds,
          },
          filtersWithoutAbility,
        )
      ) {
        continue;
      }

      for (const ability of option.abilityOptions) {
        optionsById.set(ability.id, ability);
      }
    }

    return [...optionsById.values()].sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }, [filters, pokemonOptions]);

  const moveById = useMemo(
    () =>
      new Map(
        candidateMoveIndex.map((move) => [
          normalizeShowdownId(move.id),
          move,
        ]),
      ),
    [candidateMoveIndex],
  );

  const selectedMoveOptions = useMemo(
    () =>
      filters.moves.map((filter): CandidateFilterOption => {
        const move = moveById.get(filter.id);

        return {
          ...filter,
          type: move?.type,
          power: move?.power,
        };
      }),
    [filters.moves, moveById],
  );

  const moveOptions = useMemo(() => {
    const editedMoveIndex = Math.min(
      moveFilterSlot ?? filters.moves.length,
      filters.moves.length,
    );
    const retainedMoves = filters.moves.filter(
      (_, moveIndex) => moveIndex !== editedMoveIndex,
    );
    const filtersWithoutEditedMove = {
      ...filters,
      moves: retainedMoves,
    };
    const selectedMoveIds = new Set(retainedMoves.map((move) => move.id));
    const moveIds = new Set<string>();

    for (const option of pokemonOptions) {
      if (
        !matchesPokemonCandidateFilters(
          {
            types: option.types,
            abilityIds: option.abilityOptions.map((ability) => ability.id),
            moveIds: option.moveIds,
          },
          filtersWithoutEditedMove,
        )
      ) {
        continue;
      }

      for (const moveId of option.moveIds) {
        if (!selectedMoveIds.has(moveId)) {
          moveIds.add(moveId);
        }
      }
    }

    return [...moveIds]
      .map((moveId): CandidateFilterOption => {
        const move = moveById.get(moveId);

        return {
          id: moveId,
          name: gameName(
            "moves",
            moveId,
            move?.name ?? formatIdLabel(moveId),
          ),
          type: move?.type,
          power: move?.power,
        };
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [filters, gameName, moveById, moveFilterSlot, pokemonOptions]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingOptions = useMemo(() => {
    const options: CandidateFilterOption[] =
      openPicker === "ability" ? abilityOptions : moveOptions;

    return options.filter(
      (option) =>
        !normalizedQuery ||
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.id.includes(normalizedQuery),
    );
  }, [abilityOptions, moveOptions, normalizedQuery, openPicker]);

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
    normalizedQuery,
    openPicker,
    resetOptions,
  ]);

  useEffect(() => {
    setFilters(createEmptyCandidateFilters());
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
      const nextIndex = getNextIndex(
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
    setFilters(createEmptyCandidateFilters());
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
