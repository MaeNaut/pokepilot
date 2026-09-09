/// <reference lib="webworker" />

import {
  createMetaThreatAnalysisPlan,
  type MetaThreatAnalysisInput,
} from "./metaThreatAnalysis";

self.onmessage = (event: MessageEvent<MetaThreatAnalysisInput>) => {
  try {
    self.postMessage(createMetaThreatAnalysisPlan(event.data));
  } catch {
    self.postMessage({ error: true });
  }
};

export {};
