import { useEffect, useMemo, useState } from "react";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { useLocalization } from "../i18n/useLocalization";
import type {
  DataLoadStatus,
  PokemonAbility,
  PokemonIndexEntry,
  TeamSlot,
} from "../types";
import { emptyPokemonCandidateFilters } from "../utils/pokemonCandidateFilters";
import {
  countTeamMegaOptions,
  createPokemonRecommendationCandidates,
  createPokemonRecommendationOptions,
  getOccupiedPokemonSpeciesKeys,
  type CopilotRecommendationCandidateSnapshot,
  type PokemonRecommendationOption,
} from "../utils/pokemonRecommendations";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { CopilotAnalysisScope } from "../utils/copilotAnalysis";

type RecommendationCandidateState = {
  status: "idle" | "loading" | "ready" | "error";
  candidates: CopilotRecommendationCandidateSnapshot[];
};

type UseCopilotRecommendationCandidatesInput = {
  scope: CopilotAnalysisScope;
  selectedSlot: number;
  team: TeamSlot[];
  buildState: TeamBuildState;
  battleFormat: BattleFormat;
  diagnostics: TeamDiagnosticsResult;
  pokemonIndex: PokemonIndexEntry[];
  abilityIndex: PokemonAbility[];
  abilityIndexStatus: DataLoadStatus;
  showdownLegality: ShowdownLegalitySnapshot | null;
  showdownLegalityStatus: DataLoadStatus;
};

const idleRecommendationState: RecommendationCandidateState = {
  status: "idle",
  candidates: [],
};

export function useCopilotRecommendationCandidates({
  scope,
  selectedSlot,
  team,
  buildState,
  battleFormat,
  diagnostics,
  pokemonIndex,
  abilityIndex,
  abilityIndexStatus,
  showdownLegality,
  showdownLegalityStatus,
}: UseCopilotRecommendationCandidatesInput) {
  const { gameName, pokemonName } = useLocalization();
  const [state, setState] = useState<RecommendationCandidateState>(
    idleRecommendationState,
  );
  const selectedMember = team[selectedSlot];
  const activeCandidateFilters =
    buildState.candidateFiltersBySlot[selectedSlot] ??
    emptyPokemonCandidateFilters;
  const options = useMemo<PokemonRecommendationOption[]>(
    () =>
      createPokemonRecommendationOptions({
        pokemonIndex,
        abilityIndex,
        legality: showdownLegality,
        getPokemonDisplayName: (entry, includeForm) =>
          pokemonName({
            id: entry.name,
            speciesId: entry.speciesKey,
            fallback: entry.displayName,
            includeForm,
            formLabel: entry.formLabel,
            formKind: entry.formKind,
          }),
        getTypeDisplayName: (type) => gameName("types", type, type),
        getAbilityDisplayName: (id, fallback) =>
          gameName("abilities", id, fallback),
      }),
    [abilityIndex, gameName, pokemonIndex, pokemonName, showdownLegality],
  );
  const occupiedSpeciesKeys = useMemo(
    () => getOccupiedPokemonSpeciesKeys(team, pokemonIndex),
    [pokemonIndex, team],
  );
  const existingMegaOptionCount = useMemo(
    () => countTeamMegaOptions(team, buildState.itemBySlot, pokemonIndex),
    [buildState.itemBySlot, pokemonIndex, team],
  );

  useEffect(() => {
    if (scope !== "recommendation" || selectedMember) {
      setState(idleRecommendationState);
      return;
    }
    if (
      abilityIndexStatus === "loading" ||
      showdownLegalityStatus === "loading"
    ) {
      setState({ status: "loading", candidates: [] });
      return;
    }

    let isCancelled = false;
    setState({ status: "loading", candidates: [] });
    void createPokemonRecommendationCandidates({
      options,
      filters: activeCandidateFilters,
      occupiedSpeciesKeys,
      diagnostics,
      battleFormat,
      existingMegaOptionCount,
    })
      .then((candidates) => {
        if (!isCancelled) {
          setState({ status: "ready", candidates });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setState({ status: "error", candidates: [] });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    abilityIndexStatus,
    activeCandidateFilters,
    battleFormat,
    diagnostics,
    existingMegaOptionCount,
    occupiedSpeciesKeys,
    options,
    scope,
    selectedMember,
    showdownLegalityStatus,
  ]);

  return state;
}
