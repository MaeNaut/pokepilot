import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculatorAnalysisContext } from "../calculator/setOptimizer/types";
import type { TeamMatchupAnalysisPlans } from "../calculator/teamMatchup";

type Result = {
  context: CalculatorAnalysisContext;
  plans: TeamMatchupAnalysisPlans | null;
  status: "loading" | "ready" | "error";
};

export function useTeamMatchupPlan(
  context: CalculatorAnalysisContext | null,
  enabled: boolean,
) {
  const [result, setResult] = useState<Result | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const active = enabled && Boolean(context?.opponent.member && context.roster?.length);

  useEffect(() => () => cancel.current?.(), [active, context]);

  const run = useCallback((): Promise<TeamMatchupAnalysisPlans | null> => {
    cancel.current?.();
    if (!active || !context) return Promise.resolve(null);
    setResult({ context, plans: null, status: "loading" });

    return new Promise((resolve) => {
      let settled = false;
      let worker: Worker | undefined;
      const finish = (
        plans: TeamMatchupAnalysisPlans | null,
        status?: "ready" | "error",
      ) => {
        if (settled) return;
        settled = true;
        worker?.terminate();
        setResult(status ? { context, plans, status } : null);
        resolve(plans);
      };
      cancel.current = () => finish(null);

      try {
        worker = new Worker(
          new URL("../calculator/teamMatchup.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.onmessage = (
          event: MessageEvent<TeamMatchupAnalysisPlans & { error?: boolean }>,
        ) => finish(
          event.data.error ? null : event.data,
          event.data.error ? "error" : "ready",
        );
        worker.onerror = () => finish(null, "error");
        worker.postMessage(context);
      } catch {
        finish(null, "error");
      }
    });
  }, [active, context]);

  const current = active && result?.context === context ? result : null;
  return {
    run,
    matchupPlan: current?.plans?.matchupPlan ?? null,
    optimizationPlan: current?.plans?.optimizationPlan ?? null,
    loading: current?.status === "loading",
    error: current?.status === "error",
  };
}
