import { useCallback, useEffect, useRef, useState } from "react";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { useLocalization } from "../i18n/useLocalization";
import type {
  DataLoadStatus,
  PokemonAbility,
  PokemonIndexEntry,
  TeamSlot,
} from "../types";
import {
  createUniversalPokemonRecommendationCandidates,
  type CopilotRecommendationCandidateSnapshot,
} from "../utils/pokemonRecommendations";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { CopilotAnalysisScope } from "../utils/copilotContracts";
import { createLocalizedRecommendationContext } from "../utils/pokemonRecommendationContext";
import { nextAnimationFrame, waitForTask } from "../utils/workerTask";

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
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setState(idleRecommendationState);
    return () => cancelRef.current?.abort();
  }, [
    abilityIndex,
    abilityIndexStatus,
    battleFormat,
    buildState,
    diagnostics,
    gameName,
    pokemonIndex,
    pokemonName,
    scope,
    selectedSlot,
    showdownLegality,
    showdownLegalityStatus,
    team,
  ]);

  const run = useCallback(async () => {
    cancelRef.current?.abort();
    if (
      scope !== "recommendation" ||
      abilityIndexStatus === "loading" ||
      showdownLegalityStatus === "loading"
    ) {
      return null;
    }

    const controller = new AbortController();
    cancelRef.current = controller;
    const { signal } = controller;
    setState({ status: "loading", candidates: [] });

    try {
      if (!await nextAnimationFrame(signal)) return null;
      const { options, targets } = createLocalizedRecommendationContext({
        pokemonIndex, abilityIndex, legality: showdownLegality, team, selectedSlot,
        buildState, diagnostics, gameName, pokemonName,
      });
      const candidates = await waitForTask(
        createUniversalPokemonRecommendationCandidates({ options, targets, battleFormat }, signal),
        signal,
      );

      if (signal.aborted || !candidates) return null;
      setState({ status: "ready", candidates });
      return candidates;
    } catch {
      if (!signal.aborted) {
        setState({ status: "error", candidates: [] });
      }
      return null;
    }
  }, [
    abilityIndex,
    abilityIndexStatus,
    battleFormat,
    buildState,
    diagnostics,
    gameName,
    pokemonIndex,
    pokemonName,
    scope,
    selectedSlot,
    showdownLegality,
    showdownLegalityStatus,
    team,
  ]);

  return { ...state, run };
}
