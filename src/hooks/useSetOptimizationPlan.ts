import { useCallback, useEffect, useRef, useState } from "react";
import { runWorkerTask, waitForTask } from "../utils/workerTask";
import { loadPopularSmogonSet } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { resolveUsageCalculatorItems } from "../calculator/calculatorUsageBuild";
import type { ItemIndexEntry } from "../types";
import type {
  GeneralSetOptimizationContext,
  SetOptimizationPlan,
} from "../calculator/setOptimizer/types";

type GeneralInput = Omit<GeneralSetOptimizationContext, "usageSet" | "usageItems">;
type Result = {
  context: GeneralInput;
  battleFormat: BattleFormat;
  itemOptions: readonly ItemIndexEntry[];
  plan: SetOptimizationPlan | null;
  status: "loading" | "ready" | "error";
};

export function useSetOptimizationPlan(
  context: GeneralInput | null,
  battleFormat: BattleFormat,
  itemOptions: readonly ItemIndexEntry[],
  enabled: boolean,
) {
  const [result, setResult] = useState<Result | null>(null);
  const cancel = useRef<AbortController | null>(null);
  const active = enabled && Boolean(context?.member);

  useEffect(
    () => () => {
      cancel.current?.abort();
      setResult((current) => current?.status === "loading" ? null : current);
    },
    [active, battleFormat, context, itemOptions],
  );

  const run = useCallback(async (): Promise<SetOptimizationPlan | null> => {
    cancel.current?.abort();
    if (!active || !context) return null;
    const controller = new AbortController();
    cancel.current = controller;
    const { signal } = controller;
    const identity = { context, battleFormat, itemOptions };
    setResult({ ...identity, plan: null, status: "loading" });
    try {
      const usageSet = await waitForTask(
        loadPopularSmogonSet(context.member.id, battleFormat).catch(() => null), signal,
      );
      if (signal.aborted) return null;
      const output = await runWorkerTask<{ plan?: SetOptimizationPlan; error?: boolean }>(
        () => new Worker(new URL("../calculator/setOptimizer.worker.ts", import.meta.url), { type: "module" }),
        {
          generalContext: {
            ...context,
            usageSet,
            usageItems: usageSet ? resolveUsageCalculatorItems(usageSet, itemOptions, 4) : [],
          },
        },
        signal,
      );
      if (signal.aborted || !output) return null;
      const plan = output.plan ?? null;
      setResult({ ...identity, plan, status: output.error ? "error" : "ready" });
      return plan;
    } catch {
      if (!signal.aborted) setResult({ ...identity, plan: null, status: "error" });
      return null;
    }
  }, [active, battleFormat, context, itemOptions]);

  const current =
    active &&
    result?.context === context &&
    result.battleFormat === battleFormat &&
    result.itemOptions === itemOptions
      ? result
      : null;
  return { run, plan: current?.plan ?? null, loading: current?.status === "loading", error: current?.status === "error" };
}
