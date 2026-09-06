import { useEffect, useState } from "react";
import type { CalculatorPokemonOption } from "../calculator/calculatorEditorTypes";
import type { PokemonCandidateFilters, PokemonMove } from "../types";
import { createEmptyPokemonCandidateFilters } from "../utils/pokemonCandidateFilters";
import { useCandidateFilterPicker } from "./useCandidateFilterPicker";

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
  const [filters, setFilters] = useState<PokemonCandidateFilters>(
    createEmptyPokemonCandidateFilters,
  );
  const picker = useCandidateFilterPicker({
    pokemonOptions,
    candidateMoveIndex,
    filters,
    isTouchLayout,
    resetKey,
    closeOtherPicker,
    onFiltersChange: setFilters,
  });

  useEffect(() => {
    setFilters(createEmptyPokemonCandidateFilters());
  }, [resetKey]);

  return {
    ...picker,
    filters,
  };
}
