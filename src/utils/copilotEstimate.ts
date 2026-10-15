import type { CopilotAnalysisRequest } from "./copilotContracts";
import { runWorkerTask } from "./workerTask";

export type CopilotEstimate = {
  inputTokens: number;
  totalTokens: [number, number];
  seconds: [number, number];
  costUsd: [number, number];
};

export async function estimateCopilotAnalysis(
  request: CopilotAnalysisRequest,
  reasoningEffort: "low" | "medium",
  signal: AbortSignal,
): Promise<CopilotEstimate | null> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 15000);
  try {
    const result = await runWorkerTask<CopilotEstimate | { error: true }>(
      () => new Worker(new URL("./copilotEstimate.worker.ts", import.meta.url), { type: "module" }),
      { request, reasoningEffort },
      controller.signal,
    );
    return result && !("error" in result) ? result : null;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
