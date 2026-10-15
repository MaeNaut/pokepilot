/// <reference lib="webworker" />
import type { CopilotAnalysisRequest } from "./copilotContracts";
import { calculateCopilotEstimate } from "./copilotEstimateEngine";

self.onmessage = (event: MessageEvent<{
  request: CopilotAnalysisRequest;
  reasoningEffort: "low" | "medium";
}>) => {
  try {
    self.postMessage(calculateCopilotEstimate(event.data.request, event.data.reasoningEffort));
  } catch {
    self.postMessage({ error: true });
  }
};
