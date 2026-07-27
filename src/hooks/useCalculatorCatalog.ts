import { useEffect, useMemo, useState } from "react";
import { formatIdLabel } from "../api/showdownIds";
import {
  getLegalMoves,
  getPokemonCandidateAbilities,
  isItemLegal,
  isPokemonLegal,
  type ShowdownLegalitySnapshot,
} from "../api/showdownLegality";
import { loadShowdownData } from "../api/showdownData";
import { loadSmogonUsagePokemonIds } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { CalculatorPokemonOption } from "../calculator/calculatorEditorTypes";
import { useLocalization } from "../i18n/useLocalization";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  PokemonMove,
} from "../types";
import { orderPokemonOptionsByUsage } from "../utils/pokemonUsageOrder";

type UseCalculatorCatalogOptions = {
  battleFormat: BattleFormat;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  showdownLegality: ShowdownLegalitySnapshot | null;
};

export function useCalculatorCatalog({
  battleFormat,
  pokemonIndex,
  itemIndex,
  showdownLegality,
}: UseCalculatorCatalogOptions) {
  const { gameName, pokemonName } = useLocalization();
  const [usagePokemonIds, setUsagePokemonIds] = useState<string[] | null>(
    null,
  );
  const [candidateMoveIndex, setCandidateMoveIndex] = useState<PokemonMove[]>(
    [],
  );

  useEffect(() => {
    let isCurrent = true;
    setUsagePokemonIds(null);

    void loadSmogonUsagePokemonIds(battleFormat)
      .then((ids) => {
        if (isCurrent) {
          setUsagePokemonIds(ids);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setUsagePokemonIds([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [battleFormat]);

  useEffect(() => {
    let isCurrent = true;

    void loadShowdownData()
      .then((snapshot) => {
        if (isCurrent) {
          setCandidateMoveIndex(Object.values(snapshot.movesById));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setCandidateMoveIndex([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const basePokemonOptions = useMemo<CalculatorPokemonOption[]>(
    () =>
      pokemonIndex
        .filter((entry) => entry.isSelectorOption)
        .filter((entry) =>
          isPokemonLegal(
            showdownLegality,
            entry.showdownId,
            entry.speciesKey,
          ),
        )
        .map((entry) => {
          const candidateAbilities = getPokemonCandidateAbilities(
            showdownLegality,
            entry,
            pokemonIndex,
          );
          const moveIds = getLegalMoves(
            showdownLegality,
            entry.showdownId,
            entry.speciesKey,
          );
          const includeForm =
            entry.formKind === "gender" ||
            entry.formKind === "regional" ||
            entry.displayName !== formatIdLabel(entry.speciesKey);

          return {
            id: entry.name,
            label: pokemonName({
              id: entry.name,
              speciesId: entry.speciesKey,
              fallback: entry.displayName,
              includeForm,
              formLabel: entry.formLabel,
              formKind: entry.formKind,
            }),
            englishName: entry.displayName,
            number: entry.sortNumber,
            types: entry.types,
            entry,
            abilityOptions: candidateAbilities.map((ability) => ({
              id: ability.id,
              name: gameName(
                "abilities",
                ability.id,
                ability.name,
              ),
            })),
            moveIds: [...(moveIds ?? [])],
          };
        }),
    [gameName, pokemonIndex, pokemonName, showdownLegality],
  );

  const pokemonOptions = useMemo(() => {
    const { orderedOptions, rankByOptionId } = orderPokemonOptionsByUsage(
      basePokemonOptions,
      usagePokemonIds,
    );

    return orderedOptions.map((option) => ({
      ...option,
      usageRank: rankByOptionId.get(option.id),
    }));
  }, [basePokemonOptions, usagePokemonIds]);

  const selectableItems = useMemo(
    () =>
      itemIndex.filter((entry) =>
        isItemLegal(showdownLegality, entry.showdownId ?? entry.name),
      ),
    [itemIndex, showdownLegality],
  );

  const knownMegaStoneNames = useMemo(
    () =>
      new Set(
        selectableItems
          .filter((entry) => entry.isMegaStone)
          .map((entry) => entry.name),
      ),
    [selectableItems],
  );

  return {
    candidateMoveIndex,
    knownMegaStoneNames,
    pokemonOptions,
    selectableItems,
  };
}
