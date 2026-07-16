import { useCallback, useEffect, useState } from "react";
import { fetchPokemonIndex } from "../api/pokemonIndex";
import { fetchItemIndex } from "../api/showdownCatalog";
import {
  loadShowdownLegality,
  type ShowdownLegalitySnapshot,
} from "../api/showdownLegality";
import type {
  DataLoadStatus,
  ItemIndexEntry,
  PokemonIndexEntry,
} from "../types";

const regulationFormat = "gen9-regulation-mb";

export function useBuilderData() {
  const [pokemonIndex, setPokemonIndex] = useState<PokemonIndexEntry[]>([]);
  const [itemIndex, setItemIndex] = useState<ItemIndexEntry[]>([]);
  const [showdownLegality, setShowdownLegality] =
    useState<ShowdownLegalitySnapshot | null>(null);
  const [pokemonIndexStatus, setPokemonIndexStatus] =
    useState<DataLoadStatus>("idle");
  const [itemIndexStatus, setItemIndexStatus] =
    useState<DataLoadStatus>("idle");
  const [showdownLegalityStatus, setShowdownLegalityStatus] =
    useState<DataLoadStatus>("idle");
  const [showdownLegalityError, setShowdownLegalityError] = useState<string | null>(
    null,
  );
  const [pokemonIndexLoadAttempt, setPokemonIndexLoadAttempt] = useState(0);
  const [itemIndexLoadAttempt, setItemIndexLoadAttempt] = useState(0);
  const [showdownLoadAttempt, setShowdownLoadAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadPokemonIndex() {
      setPokemonIndexStatus("loading");

      try {
        const index = await fetchPokemonIndex();

        if (isCurrent) {
          setPokemonIndex(index);
          setPokemonIndexStatus("ready");
        }
      } catch {
        if (isCurrent) {
          setPokemonIndexStatus("error");
        }
      }
    }

    void loadPokemonIndex();

    return () => {
      isCurrent = false;
    };
  }, [pokemonIndexLoadAttempt]);

  useEffect(() => {
    let isCurrent = true;

    async function loadItemIndex() {
      setItemIndexStatus("loading");

      try {
        const index = await fetchItemIndex();

        if (isCurrent) {
          setItemIndex(index);
          setItemIndexStatus("ready");
        }
      } catch {
        if (isCurrent) {
          setItemIndexStatus("error");
        }
      }
    }

    void loadItemIndex();

    return () => {
      isCurrent = false;
    };
  }, [itemIndexLoadAttempt]);

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

  const retryPokemonIndex = useCallback(
    () => setPokemonIndexLoadAttempt((attempt) => attempt + 1),
    [],
  );
  const retryItemIndex = useCallback(
    () => setItemIndexLoadAttempt((attempt) => attempt + 1),
    [],
  );
  const retryShowdownLegality = useCallback(
    () => setShowdownLoadAttempt((attempt) => attempt + 1),
    [],
  );

  return {
    pokemonIndex,
    itemIndex,
    showdownLegality,
    pokemonIndexStatus,
    itemIndexStatus,
    showdownLegalityStatus,
    showdownLegalityError,
    retryPokemonIndex,
    retryItemIndex,
    retryShowdownLegality,
  };
}
