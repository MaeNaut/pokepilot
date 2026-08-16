import { useCallback, useEffect, useState } from "react";
import { fetchPokemonIndex } from "../api/pokemonIndex";
import { fetchAbilityIndex, fetchItemIndex } from "../api/showdownCatalog";
import {
  loadShowdownLegality,
  type ShowdownLegalitySnapshot,
} from "../api/showdownLegality";
import type {
  DataLoadStatus,
  ItemIndexEntry,
  PokemonAbility,
  PokemonIndexEntry,
} from "../types";

const regulationFormat = "gen9-regulation-mb";

function useCatalogData<T>(loadCatalog: () => Promise<T>, initialData: T) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState<DataLoadStatus>("idle");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    setStatus("loading");
    void loadCatalog()
      .then((nextData) => {
        if (isCurrent) {
          setData(nextData);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (isCurrent) {
          setStatus("error");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [loadAttempt, loadCatalog]);

  const retry = useCallback(
    () => setLoadAttempt((attempt) => attempt + 1),
    [],
  );

  return { data, status, retry };
}

export function useBuilderData() {
  const pokemonCatalog = useCatalogData<PokemonIndexEntry[]>(
    fetchPokemonIndex,
    [],
  );
  const itemCatalog = useCatalogData<ItemIndexEntry[]>(fetchItemIndex, []);
  const abilityCatalog = useCatalogData<PokemonAbility[]>(fetchAbilityIndex, []);
  const [showdownLegality, setShowdownLegality] =
    useState<ShowdownLegalitySnapshot | null>(null);
  const [showdownLegalityStatus, setShowdownLegalityStatus] =
    useState<DataLoadStatus>("idle");
  const [showdownLegalityError, setShowdownLegalityError] = useState<string | null>(
    null,
  );
  const [showdownLoadAttempt, setShowdownLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadLegality() {
      setShowdownLegalityStatus("loading");
      setShowdownLegalityError(null);

      try {
        const legality = await loadShowdownLegality(regulationFormat);

        if (!isCurrent) {
          return;
        }

        setShowdownLegality((current) =>
          legality.error && current && !current.error ? current : legality,
        );
        setShowdownLegalityError(legality.error ?? null);
        setShowdownLegalityStatus(legality.error ? "error" : "ready");
      } catch (error) {
        if (isCurrent) {
          setShowdownLegalityStatus("error");
          setShowdownLegalityError(
            error instanceof Error
              ? error.message
              : "Showdown legality load failed.",
          );
        }
      }
    }

    void loadLegality();

    return () => {
      isCurrent = false;
    };
  }, [showdownLoadAttempt]);

  const retryShowdownLegality = useCallback(
    () => setShowdownLoadAttempt((attempt) => attempt + 1),
    [],
  );

  return {
    pokemonIndex: pokemonCatalog.data,
    itemIndex: itemCatalog.data,
    abilityIndex: abilityCatalog.data,
    showdownLegality,
    pokemonIndexStatus: pokemonCatalog.status,
    itemIndexStatus: itemCatalog.status,
    abilityIndexStatus: abilityCatalog.status,
    showdownLegalityStatus,
    showdownLegalityError,
    retryPokemonIndex: pokemonCatalog.retry,
    retryItemIndex: itemCatalog.retry,
    retryShowdownLegality,
  };
}
