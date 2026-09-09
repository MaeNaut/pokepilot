import { useCallback, useEffect, useRef, useState } from "react";
import { loadShowdownData } from "../api/showdownData";
import { loadSmogonUsageSets } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  createMetaThreatAnalysisInput,
  type MetaThreatAnalysisPlan,
} from "../calculator/metaThreatAnalysis";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  TeamSlot,
} from "../types";
import type { TeamBuildState } from "../utils/teamBuildState";

type Result = {
  team: TeamSlot[];
  buildState: TeamBuildState;
  battleFormat: BattleFormat;
  plan: MetaThreatAnalysisPlan | null;
  status: "loading" | "ready" | "error";
};

export function useMetaThreatAnalysisPlan({
  team,
  buildState,
  battleFormat,
  pokemonIndex,
  itemIndex,
  enabled,
}: {
  team: TeamSlot[];
  buildState: TeamBuildState;
  battleFormat: BattleFormat;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  enabled: boolean;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const active = enabled && team.some(Boolean);

  useEffect(
    () => () => cancelRef.current?.(),
    [active, battleFormat, buildState, itemIndex, pokemonIndex, team],
  );

  const run = useCallback((): Promise<MetaThreatAnalysisPlan | null> => {
    cancelRef.current?.();
    if (!active) return Promise.resolve(null);
    setResult({
      team,
      buildState,
      battleFormat,
      plan: null,
      status: "loading",
    });

    return new Promise((resolve) => {
      let settled = false;
      let worker: Worker | undefined;
      const finish = (
        plan: MetaThreatAnalysisPlan | null,
        status?: "ready" | "error",
      ) => {
        if (settled) return;
        settled = true;
        worker?.terminate();
        setResult(status
          ? { team, buildState, battleFormat, plan, status }
          : null);
        resolve(plan);
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
            ) => finish(
              event.data.error ? null : event.data,
              event.data.error ? "error" : "ready",
            );
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
    battleFormat,
    buildState,
    itemIndex,
    pokemonIndex,
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
    loading: current?.status === "loading",
    error: current?.status === "error",
  };
}
