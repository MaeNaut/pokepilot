/// <reference lib="webworker" />
import { createTeamMatchupAnalysisPlans } from "./teamMatchup";
import type { CalculatorAnalysisContext } from "./setOptimizer/types";

self.onmessage = (event: MessageEvent<CalculatorAnalysisContext>) => {
  try {
    self.postMessage(createTeamMatchupAnalysisPlans(event.data));
  } catch {
    self.postMessage({ error: true });
  }
};

export {};
