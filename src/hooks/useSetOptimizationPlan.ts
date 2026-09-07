import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculatorAnalysisContext, SetOptimizationPlan } from "../calculator/setOptimizer/types";

type Result = { context: CalculatorAnalysisContext; plan: SetOptimizationPlan | null; status: "loading" | "ready" | "error" };

export function useSetOptimizationPlan(context: CalculatorAnalysisContext | null, enabled: boolean) {
  const [result, setResult] = useState<Result | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const active = enabled && Boolean(context?.player.member && context.opponent.member);

  useEffect(() => () => cancel.current?.(), [active, context]);

  const run = useCallback((): Promise<SetOptimizationPlan | null> => {
    cancel.current?.();
    if (!active || !context) return Promise.resolve(null);
    setResult({ context, plan: null, status: "loading" });
    return new Promise((resolve) => {
      let settled = false;
      let worker: Worker | undefined;
      const finish = (plan: SetOptimizationPlan | null, status?: "ready" | "error") => {
        if (settled) return;
        settled = true;
        worker?.terminate();
        if (status) setResult({ context, plan, status });
        else setResult(null);
        resolve(plan);
      };
      cancel.current = () => finish(null);
      try {
        worker = new Worker(new URL("../calculator/setOptimizer.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ plan?: SetOptimizationPlan; error?: boolean }>) => {
          finish(event.data.plan ?? null, event.data.error ? "error" : "ready");
        };
        worker.onerror = () => finish(null, "error");
        worker.postMessage(context);
      } catch {
        finish(null, "error");
      }
    });
  }, [active, context]);

  const current = active && result?.context === context ? result : null;
  return { run, plan: current?.plan ?? null, loading: current?.status === "loading", error: current?.status === "error" };
}
