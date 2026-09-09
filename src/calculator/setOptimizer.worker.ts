import { createGeneralSetOptimizationPlan } from "./setOptimizer/generalPlan";
import type { GeneralSetOptimizationContext } from "./setOptimizer/types";

type SetOptimizationWorkerRequest = {
  generalContext: GeneralSetOptimizationContext;
};

self.onmessage = (event: MessageEvent<SetOptimizationWorkerRequest>) => {
  try {
    self.postMessage({
      plan: createGeneralSetOptimizationPlan(event.data.generalContext),
    });
  } catch {
    self.postMessage({ error: true });
  }
};
