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
  createPokemonRecommendationOptions,
  createPokemonRecommendationTargets,
  createUniversalPokemonRecommendationCandidates,
  type CopilotRecommendationCandidateSnapshot,
  type PokemonRecommendationOption,
} from "../utils/pokemonRecommendations";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { CopilotAnalysisScope } from "../utils/copilotContracts";
import {
  getPokemonNameFallback,
} from "../utils/pokemonDisplay";

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
  const runIdRef = useRef(0);

  useEffect(() => {
    runIdRef.current += 1;
    setState(idleRecommendationState);
  }, [
    abilityIndex,
    battleFormat,
    buildState,
    diagnostics,
    gameName,
    pokemonIndex,
    pokemonName,
    selectedSlot,
    showdownLegality,
    team,
  ]);

  const run = useCallback(async () => {
    if (
      scope !== "recommendation" ||
      abilityIndexStatus === "loading" ||
      showdownLegalityStatus === "loading"
    ) {
      return null;
    }

    const runId = ++runIdRef.current;
    setState({ status: "loading", candidates: [] });

    // Give React a frame to paint the loading state before ranking candidates.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    try {
      const options: PokemonRecommendationOption[] =
        createPokemonRecommendationOptions({
          pokemonIndex,
          abilityIndex,
          legality: showdownLegality,
          getPokemonDisplayName: (entry, includeForm) =>
            pokemonName({
              id: entry.name,
              speciesId: entry.speciesKey,
              fallback: getPokemonNameFallback(entry, includeForm),
              includeForm,
              formLabel: entry.formLabel,
              formKind: entry.formKind,
            }),
          getTypeDisplayName: (type) => gameName("types", type, type),
          getAbilityDisplayName: (id, fallback) =>
            gameName("abilities", id, fallback),
        });
      const targets = createPokemonRecommendationTargets({
        team,
        selectedSlot,
        buildState,
        diagnostics,
        pokemonIndex,
          getCurrentPokemonDisplayName: (member, entry) => {
            const includeForm = Boolean(entry);

            return pokemonName({
              id: entry?.name ?? member.id,
              speciesId: entry?.speciesKey,
              fallback: entry
                ? getPokemonNameFallback(entry, includeForm)
                : member.name,
              includeForm,
              formLabel: entry?.formLabel,
              formKind: entry?.formKind,
            });
          },
      });
      const candidates = await createUniversalPokemonRecommendationCandidates({
        options,
        targets,
        battleFormat,
      });

      if (runIdRef.current !== runId) return null;
      setState({ status: "ready", candidates });
      return candidates;
    } catch {
      if (runIdRef.current === runId) {
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
