import { useCallback, useEffect, useRef, useState } from "react";
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
  const cancel = useRef<(() => void) | null>(null);
  const active = enabled && Boolean(context?.member);

  useEffect(
    () => () => cancel.current?.(),
    [active, battleFormat, context, itemOptions],
  );

  const run = useCallback((): Promise<SetOptimizationPlan | null> => {
    cancel.current?.();
    if (!active || !context) return Promise.resolve(null);
    setResult({
      context,
      battleFormat,
      itemOptions,
      plan: null,
      status: "loading",
    });
    return new Promise((resolve) => {
      let settled = false;
      let worker: Worker | undefined;
      const finish = (plan: SetOptimizationPlan | null, status?: "ready" | "error") => {
        if (settled) return;
        settled = true;
        worker?.terminate();
        if (status) {
          setResult({
            context,
            battleFormat,
            itemOptions,
            plan,
            status,
          });
        }
        else setResult(null);
        resolve(plan);
      };
      cancel.current = () => finish(null);
      void loadPopularSmogonSet(context.member.id, battleFormat)
        .catch(() => null)
        .then((usageSet) => {
          if (settled) return;
          try {
            worker = new Worker(new URL("../calculator/setOptimizer.worker.ts", import.meta.url), { type: "module" });
            worker.onmessage = (event: MessageEvent<{ plan?: SetOptimizationPlan; error?: boolean }>) => {
              finish(event.data.plan ?? null, event.data.error ? "error" : "ready");
            };
            worker.onerror = () => finish(null, "error");
            worker.postMessage({
              generalContext: {
                ...context,
                usageSet,
                usageItems: usageSet
                  ? resolveUsageCalculatorItems(usageSet, itemOptions, 4)
                  : [],
              },
            });
          } catch {
            finish(null, "error");
          }
        });
    });
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
