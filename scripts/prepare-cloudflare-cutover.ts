import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function requiresAnalysisDrain(settings: unknown): boolean {
  const bindings = (settings as { bindings?: unknown } | null)?.bindings;
  if (!Array.isArray(bindings)) throw new Error("Cloudflare settings did not contain bindings.");
  const gate = bindings.some((binding) => binding.name === "POKEPILOT_ANALYSIS_GATE" && binding.type === "durable_object_namespace");
  const scoped = bindings.some((binding) => binding.name === "POKEPILOT_ANALYSIS_GATE_SCOPE" && binding.type === "plain_text" && binding.text === "production");
  const paused = bindings.some((binding) => binding.name === "POKEPILOT_ANALYSIS_PAUSED" && binding.type === "plain_text" && binding.text === "true");
  return !gate || !scoped || paused;
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const output = process.env.GITHUB_OUTPUT;
  if (!token || !account || !output) throw new Error("Missing deployment environment.");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/pokepilot/settings`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Cannot inspect deployment settings (HTTP ${response.status}).`);
  const envelope = await response.json() as { success?: boolean; result?: unknown };
  if (!envelope.success) throw new Error("Cloudflare settings lookup failed.");
  const drain = requiresAnalysisDrain(envelope.result);
  appendFileSync(output, `drain=${drain}\n`);
  console.log(drain ? "Initial gate cutover or interrupted maintenance: analysis drain required." : "Cloudflare analysis gate already active: ordinary deployment.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Deployment preflight failed.");
    process.exitCode = 1;
  });
}
