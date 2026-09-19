import { useCallback, useEffect, useRef, useState } from "react";
import { nextAnimationFrame, runWorkerTask, waitForTask } from "../utils/workerTask";
import { loadShowdownData } from "../api/showdownData";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import { loadSmogonUsageSets } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  createMetaThreatAnalysisInput,
  type MetaThreatAnalysisPlan,
} from "../calculator/metaThreatAnalysis";
import type {
  ItemIndexEntry,
  PokemonAbility,
  PokemonIndexEntry,
  TeamSlot,
} from "../types";
import { useLocalization } from "../i18n/useLocalization";
import {
  createPokemonRecommendationOptions,
  createPokemonRecommendationTargets,
  rankUniversalPokemonRecommendationCandidates,
} from "../utils/pokemonRecommendations";
import {
  selectMetaThreatReplacementCandidates,
  type MetaThreatReplacementCandidate,
} from "../utils/metaThreatRecommendations";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import {
  getPokemonNameFallback,
} from "../utils/pokemonDisplay";

type Result = {
  team: TeamSlot[];
  buildState: TeamBuildState;
  battleFormat: BattleFormat;
  plan: MetaThreatAnalysisPlan | null;
  replacementCandidates: MetaThreatReplacementCandidate[];
  status: "loading" | "ready" | "error";
};

export type MetaThreatAnalysisRunResult = {
  plan: MetaThreatAnalysisPlan;
  replacementCandidates: MetaThreatReplacementCandidate[];
};

export function useMetaThreatAnalysisPlan({
  team,
  buildState,
  battleFormat,
  pokemonIndex,
  itemIndex,
  abilityIndex,
  diagnostics,
  showdownLegality,
  enabled,
}: {
  team: TeamSlot[];
  buildState: TeamBuildState;
  battleFormat: BattleFormat;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  abilityIndex: PokemonAbility[];
  diagnostics: TeamDiagnosticsResult;
  showdownLegality: ShowdownLegalitySnapshot | null;
  enabled: boolean;
}) {
  const { gameName, pokemonName } = useLocalization();
  const [result, setResult] = useState<Result | null>(null);
  const cancelRef = useRef<AbortController | null>(null);
  const active = enabled && team.some(Boolean);

  useEffect(
    () => () => {
      cancelRef.current?.abort();
      setResult((current) => current?.status === "loading" ? null : current);
    },
    [
      active,
      abilityIndex,
      battleFormat,
      buildState,
      diagnostics,
      gameName,
      itemIndex,
      pokemonIndex,
      pokemonName,
      showdownLegality,
      team,
    ],
  );

  const run = useCallback(async (): Promise<MetaThreatAnalysisRunResult | null> => {
    cancelRef.current?.abort();
    if (!active) return null;
    const controller = new AbortController();
    cancelRef.current = controller;
    const { signal } = controller;
    const identity = { team, buildState, battleFormat };
    setResult({ ...identity, plan: null, replacementCandidates: [], status: "loading" });

    try {
      if (!await nextAnimationFrame(signal)) return null;
      const loaded = await waitForTask(Promise.all([
        loadSmogonUsageSets(battleFormat),
        loadShowdownData(),
      ]), signal);
      if (signal.aborted || !loaded) return null;
      const [usageSets, showdownData] = loaded;
      const input = createMetaThreatAnalysisInput({
        battleFormat, team, buildState, pokemonIndex, itemIndex, usageSets, showdownData,
      });
      const plan = await runWorkerTask<MetaThreatAnalysisPlan & { error?: boolean }>(
        () => new Worker(new URL("../calculator/metaThreatAnalysis.worker.ts", import.meta.url), { type: "module" }),
        input,
        signal,
      );
      if (signal.aborted || !plan) return null;
      if (plan.error) throw new Error("Meta threat analysis failed");
      if (!await nextAnimationFrame(signal)) return null;

      let replacementCandidates: MetaThreatReplacementCandidate[] = [];
      try {
        const options = createPokemonRecommendationOptions({
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
          getTypeDisplayName: (type) =>
            gameName("types", type, type),
          getAbilityDisplayName: (id, fallback) =>
            gameName("abilities", id, fallback),
        });
        const targets = createPokemonRecommendationTargets({
          team,
          selectedSlot: Math.max(0, team.findIndex(Boolean)),
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
        const rankedCandidates =
          rankUniversalPokemonRecommendationCandidates({
            options,
            targets,
            usageIds: usageSets.map(({ pokemonId }) => pokemonId),
            usageSets,
            showdownData,
            limit: 60,
          });
        replacementCandidates =
          selectMetaThreatReplacementCandidates({
            plan,
            candidates: rankedCandidates,
            usageSets,
            showdownData,
            itemIndex,
          });
      } catch {
        // The matchup plan is still usable when replacement ranking fails.
      }
      setResult({ ...identity, plan, replacementCandidates, status: "ready" });
      return { plan, replacementCandidates };
    } catch {
      if (!signal.aborted) {
        setResult({ ...identity, plan: null, replacementCandidates: [], status: "error" });
      }
      return null;
    }
  }, [
    active,
    abilityIndex,
    battleFormat,
    buildState,
    diagnostics,
    gameName,
    itemIndex,
    pokemonIndex,
    pokemonName,
    showdownLegality,
    team,
  ]);

  const current =
    active &&
    result?.team === team &&
    result.buildState === buildState &&
    result.battleFormat === battleFormat
      ? result
      : null;

  return {
    run,
    plan: current?.plan ?? null,
    replacementCandidates: current?.replacementCandidates ?? [],
    loading: current?.status === "loading",
    error: current?.status === "error",
  };
}
