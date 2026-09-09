import { useCallback, useEffect, useRef, useState } from "react";
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
  const cancelRef = useRef<(() => void) | null>(null);
  const active = enabled && team.some(Boolean);

  useEffect(
    () => () => cancelRef.current?.(),
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

  const run = useCallback((): Promise<MetaThreatAnalysisRunResult | null> => {
    cancelRef.current?.();
    if (!active) return Promise.resolve(null);
    setResult({
      team,
      buildState,
      battleFormat,
      plan: null,
      replacementCandidates: [],
      status: "loading",
    });

    return new Promise<MetaThreatAnalysisRunResult | null>((resolve) => {
      let settled = false;
      let worker: Worker | undefined;
      const finish = (
        plan: MetaThreatAnalysisPlan | null,
        status?: "ready" | "error",
        replacementCandidates: MetaThreatReplacementCandidate[] = [],
      ) => {
        if (settled) return;
        settled = true;
        worker?.terminate();
        setResult(status
          ? {
              team,
              buildState,
              battleFormat,
              plan,
              replacementCandidates,
              status,
            }
          : null);
        resolve(
          plan && status === "ready"
            ? { plan, replacementCandidates }
            : null,
        );
      };
      cancelRef.current = () => finish(null);

      window.requestAnimationFrame(() => {
        void Promise.all([
          loadSmogonUsageSets(battleFormat),
          loadShowdownData(),
        ]).then(([usageSets, showdownData]) => {
          if (settled) return;
          const input = createMetaThreatAnalysisInput({
            battleFormat,
            team,
            buildState,
            pokemonIndex,
            itemIndex,
            usageSets,
            showdownData,
          });

          try {
            worker = new Worker(
              new URL(
                "../calculator/metaThreatAnalysis.worker.ts",
                import.meta.url,
              ),
              { type: "module" },
            );
            worker.onmessage = (
              event: MessageEvent<MetaThreatAnalysisPlan & { error?: boolean }>,
            ) => {
              if (event.data.error) {
                finish(null, "error");
                return;
              }

              const plan = event.data;
              window.requestAnimationFrame(() => {
                try {
                  const options = createPokemonRecommendationOptions({
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
                    getCurrentPokemonDisplayName: (member, entry) =>
                      pokemonName({
                        id: entry?.name ?? member.id,
                        speciesId: entry?.speciesKey,
                        fallback: entry?.displayName ?? member.name,
                        includeForm: false,
                        formLabel: entry?.formLabel,
                        formKind: entry?.formKind,
                      }),
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
                  const replacementCandidates =
                    selectMetaThreatReplacementCandidates({
                      plan,
                      candidates: rankedCandidates,
                      usageSets,
                      showdownData,
                      itemIndex,
                    });
                  finish(plan, "ready", replacementCandidates);
                } catch {
                  finish(plan, "ready");
                }
              });
            };
            worker.onerror = () => finish(null, "error");
            worker.postMessage(input);
          } catch {
            finish(null, "error");
          }
        }).catch(() => finish(null, "error"));
      });
    });
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
