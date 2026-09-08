/// <reference lib="webworker" />
import { createTeamMatchupPlan } from "./teamMatchup";
import { createSetOptimizationPlan } from "./setOptimizer/plan";
import type { CalculatorAnalysisContext } from "./setOptimizer/types";

self.onmessage = (event: MessageEvent<CalculatorAnalysisContext>) => {
  try {
    self.postMessage({
      matchupPlan: createTeamMatchupPlan(event.data),
      optimizationPlan: createSetOptimizationPlan(event.data),
    });
  } catch {
    self.postMessage({ error: true });
  }
};

export {};
