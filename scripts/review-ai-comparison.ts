import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { validateHostedCopilotAnalysis } from "../server/pokepilotAnalysisValidation";
import type { CopilotAnalysisRequest } from "../src/utils/copilotContracts";
import type { runAiTeamEvaluationCase } from "../src/test/evaluation/aiModelEvaluation";

type RecordEntry = {
  configuration: { modelId: string; effort: string };
  repeat: number;
  result: Awaited<ReturnType<typeof runAiTeamEvaluationCase>>;
};
const directories = process.argv.slice(2);
if (!directories.length) throw new Error("Supply comparison artifact directories.");
const groups = new Map<string, RecordEntry[]>();
const replayChanges: { file: string; originallyAccepted: boolean; accepted: boolean }[] = [];
const unicodeControl: { file: string; configuration: string; baselineAccepted: boolean; normalizedAccepted: boolean }[] = [];
for (const directory of directories) {
  for (const file of (await readdir(directory)).filter((name) => /^\d{3}\.json$/.test(name)).sort()) {
    const path = resolve(directory, file);
    const record = JSON.parse(await readFile(path, "utf8")) as RecordEntry;
    const key = `${record.configuration.modelId}/${record.configuration.effort}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
    if (!record.result.debugOutput) continue;
    const request = JSON.parse(record.result.requestFingerprint) as CopilotAnalysisRequest;
    const accepts = (input: CopilotAnalysisRequest) => {
      try {
        validateHostedCopilotAnalysis(record.result.debugOutput, input);
        return true;
      } catch {
        return false;
      }
    };
    const baselineAccepted = accepts(request);
    const originallyAccepted = record.result.status === "complete";
    if (originallyAccepted !== baselineAccepted) {
      replayChanges.push({ file: path, originallyAccepted, accepted: baselineAccepted });
    }
    // Offline diagnostic only: neither saved inputs nor model outputs are changed.
    let changed = false;
    for (const item of request.mechanics.items) {
      if (item.effect?.includes("\u00d7")) {
        item.effect = item.effect.replace(/\u00d7/g, "x");
        changed = true;
      }
    }
    if (changed) {
      const normalizedAccepted = accepts(request);
      if (baselineAccepted !== normalizedAccepted) {
        unicodeControl.push({ file: path, configuration: key, baselineAccepted, normalizedAccepted });
      }
    }
  }
}
const summary = [...groups.entries()].map(([configuration, group]) => {
  const latencies = group.map(({ result }) => result.latencyMs).sort((a, b) => a - b);
  const middle = Math.floor(latencies.length / 2);
  const cost = group.reduce((sum, { result }) => sum + result.usage.costUsd, 0);
  return {
    configuration,
    count: group.length,
    strictPass: group.filter(({ result }) => result.status === "complete").length,
    requestErrors: group.filter(({ result }) => result.status === "request-error").length,
    medianSeconds: (latencies.length % 2 ? latencies[middle] : (latencies[middle - 1] + latencies[middle]) / 2) / 1000,
    p95Seconds: latencies[Math.ceil(latencies.length * 0.95) - 1] / 1000,
    over60Seconds: latencies.filter((value) => value > 60000).length,
    costUsd: cost,
    averageCostUsd: cost / group.length,
    outputTokens: group.reduce((sum, { result }) => sum + result.usage.outputTokens, 0),
    reasoningTokens: group.reduce((sum, { result }) => sum + result.usage.reasoningTokens, 0),
  };
});
console.log(JSON.stringify({ summary, unicodeControl, replayChanges }, null, 2));
