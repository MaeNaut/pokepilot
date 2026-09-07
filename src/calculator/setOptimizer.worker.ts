import { createSetOptimizationPlan } from "./setOptimizer/plan";
import type { CalculatorAnalysisContext } from "./setOptimizer/types";

self.onmessage = (event: MessageEvent<CalculatorAnalysisContext>) => {
  try {
    self.postMessage({ plan: createSetOptimizationPlan(event.data) });
  } catch {
    self.postMessage({ error: true });
  }
};
