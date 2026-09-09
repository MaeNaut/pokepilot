import { createSetOptimizationPlan } from "./setOptimizer/plan";
import {
  createGeneralSetOptimizationPlan,
  mergeGeneralAndMatchupPlans,
} from "./setOptimizer/generalPlan";
import type {
  CalculatorAnalysisContext,
  GeneralSetOptimizationContext,
} from "./setOptimizer/types";

type SetOptimizationWorkerRequest = {
  generalContext: GeneralSetOptimizationContext;
  matchupContext: CalculatorAnalysisContext | null;
};

self.onmessage = (event: MessageEvent<SetOptimizationWorkerRequest>) => {
  try {
    const general = createGeneralSetOptimizationPlan(event.data.generalContext);
    const matchup = event.data.matchupContext
      ? createSetOptimizationPlan(event.data.matchupContext)
      : null;
    self.postMessage({ plan: mergeGeneralAndMatchupPlans(general, matchup) });
  } catch {
    self.postMessage({ error: true });
  }
};
