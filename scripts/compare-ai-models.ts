import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { resolveOpenAiEvaluationApiKey } from "../server/openAiEnvironment";
import { POKEPILOT_AI_PROMPT_VERSION, type LunaReasoningEffort, type PokePilotEvaluationModel } from "../server/openAiLuna";
import { createOpenAiLunaAdapter } from "../src/test/evaluation/openAiLunaAdapter";
import { runAiTeamEvaluationCase, type AiTeamEvaluationCase } from "../src/test/evaluation/aiModelEvaluation";
import type { AiEvaluationReport } from "../src/test/evaluation/aiEvaluationReporter";

const root = process.cwd();
const args = process.argv.slice(2);
const sources = args.filter((arg) => !arg.startsWith("--"));
const selectedFixtureIds = args.find((arg) => arg.startsWith("--fixtures="))
  ?.slice("--fixtures=".length).split(",");
if (!sources.length) throw new Error("Supply existing evaluation report JSON paths to freeze comparison inputs.");
const configurations: { modelId: PokePilotEvaluationModel; effort: LunaReasoningEffort }[] = args.includes("--sol-only")
  ? [{ modelId: "gpt-5.6-sol", effort: "medium" }]
  : args.includes("--luna-low-medium")
    ? [
      { modelId: "gpt-5.6-luna", effort: "low" },
      { modelId: "gpt-5.6-luna", effort: "medium" },
    ]
    : [
      { modelId: "gpt-5.6-luna", effort: "low" },
      { modelId: "gpt-5.6-luna", effort: "medium" },
      { modelId: "gpt-5.6-luna", effort: "high" },
      { modelId: "gpt-5.6-terra", effort: "low" },
      { modelId: "gpt-5.6-terra", effort: "medium" },
    ];
const cases = new Map<string, AiTeamEvaluationCase>();
for (const source of sources) {
  const report = JSON.parse(await readFile(resolve(root, source), "utf8")) as AiEvaluationReport;
  for (const entry of report.cases) {
    if (selectedFixtureIds && !selectedFixtureIds.includes(entry.fixtureId)) continue;
    if (entry.scope === "pokemon" && entry.fixtureId !== "pokemon-hippowdon-singles-anchor") continue;
    if (entry.scope === "recommendation" && entry.fixtureId !== "recommendation-swampert-rain-setter") continue;
    const request = JSON.parse(entry.result.requestFingerprint) as AiTeamEvaluationCase["request"];
    cases.set(entry.fixtureId, {
      schemaVersion: 1, fixtureId: entry.fixtureId, title: entry.title,
      request, requestFingerprint: entry.result.requestFingerprint,
      evaluatorContext: entry.evaluatorContext,
    });
  }
}
if (!cases.size) throw new Error("No comparison cases selected from supplied reports.");
const apiKey = resolveOpenAiEvaluationApiKey(root);
const startedAt = new Date().toISOString();
const resume = args.find((arg) => arg.startsWith("--resume="))?.slice("--resume=".length);
const output = resume ? resolve(root, resume) : resolve(root, "artifacts/ai-evaluation", `comparison-${startedAt.replace(/[:.]/g, "-")}`);
await mkdir(output, { recursive: true });
const maxOutputTokens = 16000;
const manifest = {
  startedAt, promptVersion: POKEPILOT_AI_PROMPT_VERSION,
  maxOutputTokens, timeoutMs: 180000, maxRetries: 0, repetitions: 3, concurrency: 3, configurations,
  cases: [...cases.values()].map((entry) => ({
    ...entry,
    inputSha256: createHash("sha256").update(JSON.stringify(entry.request)).digest("hex"),
  })),
};
if (resume) {
  const previousManifest = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8")) as typeof manifest;
  if (
    previousManifest.promptVersion !== manifest.promptVersion ||
    previousManifest.maxOutputTokens !== manifest.maxOutputTokens ||
    previousManifest.repetitions !== manifest.repetitions ||
    JSON.stringify(previousManifest.configurations) !== JSON.stringify(manifest.configurations) ||
    JSON.stringify(previousManifest.cases.map((entry) => entry.inputSha256)) !==
      JSON.stringify(manifest.cases.map((entry) => entry.inputSha256))
  ) throw new Error("Resume manifest mismatch: use a new run for different prompts, cases, or model settings.");
}
await writeFile(resolve(output, resume ? "resume-manifest.json" : "manifest.json"), JSON.stringify(manifest, null, 2));
const jobs: { entry: AiTeamEvaluationCase; repeat: number; configuration: typeof configurations[number] }[] = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  for (const entry of cases.values()) {
    const rotated = [...configurations.slice(repeat - 1), ...configurations.slice(0, repeat - 1)];
    for (const configuration of rotated) jobs.push({ entry, repeat, configuration });
  }
}
console.log(`Evaluation credential loaded. ${jobs.length} jobs${resume ? " (reusing completed records)" : ""}; output: ${output}`);
let cursor = 0;
const results: { configuration: typeof configurations[number]; repeat: number; result: Awaited<ReturnType<typeof runAiTeamEvaluationCase>> }[] = [];
async function worker() {
  while (cursor < jobs.length) {
    const index = cursor++;
    const { entry, repeat, configuration } = jobs[index];
    const file = resolve(output, `${String(index + 1).padStart(3, "0")}.json`);
    if (resume) {
      let previous: typeof results[number] | undefined;
      try {
        previous = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }
      if (previous) {
        if (previous.configuration.modelId !== configuration.modelId || previous.configuration.effort !== configuration.effort || previous.repeat !== repeat || previous.result.requestFingerprint !== entry.requestFingerprint) throw new Error("Resume input/configuration mismatch.");
        if (previous.result.status !== "request-error") {
          results.push(previous);
          continue;
        }
        await rename(file, `${file}.previous-${Date.now()}`);
      }
    }
    const adapter = createOpenAiLunaAdapter({ apiKey, modelId: configuration.modelId, reasoningEffort: configuration.effort, maxOutputTokens, timeoutMs: 180000, maxRetries: 0 });
    const result = await runAiTeamEvaluationCase(entry, adapter);
    const record = { configuration, repeat, result };
    results.push(record);
    await writeFile(file, JSON.stringify(record, null, 2));
    console.log(`${results.length}/${jobs.length} ${configuration.modelId}/${configuration.effort} ${entry.fixtureId} #${repeat}: ${result.status} (${Math.round(result.latencyMs)}ms)`);
  }
}
await Promise.all(Array.from({ length: 3 }, () => worker()));
const summary = configurations.map((configuration) => {
  const group = results.filter((r) => r.configuration.modelId === configuration.modelId && r.configuration.effort === configuration.effort);
  const latencies = group.map((r) => r.result.latencyMs).sort((a, b) => a - b);
  const middle = Math.floor(latencies.length / 2);
  return {
    ...configuration, count: group.length,
    strictPass: group.filter((r) => r.result.status === "complete").length,
    requestErrors: group.filter((r) => r.result.status === "request-error").length,
    medianLatencyMs: latencies.length % 2 ? latencies[middle] : (latencies[middle - 1] + latencies[middle]) / 2,
    p95LatencyMs: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)],
    totalTokens: group.reduce((sum, r) => sum + r.result.usage.totalTokens, 0),
    estimatedCostUsd: group.reduce((sum, r) => sum + r.result.usage.costUsd, 0),
  };
});
await writeFile(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
