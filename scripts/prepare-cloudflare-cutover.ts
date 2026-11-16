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

export function activeVersionIds(result: unknown): string[] {
  const deployments = (result as { deployments?: { versions?: unknown }[] } | null)?.deployments;
  const versions = deployments?.[0]?.versions;
  if (!Array.isArray(versions) || !versions.length ||
      versions.some((version) => typeof version.version_id !== "string" || !/^[a-f0-9-]{36}$/.test(version.version_id) ||
        typeof version.percentage !== "number" || !Number.isFinite(version.percentage) || version.percentage < 0) ||
      Math.abs(versions.reduce((sum, version) => sum + version.percentage, 0) - 100) > 0.001) {
    throw new Error("Cloudflare did not report an unambiguous active deployment.");
  }
  return versions.filter((version) => version.percentage > 0).map((version) => version.version_id);
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const output = process.env.GITHUB_OUTPUT;
  if (!token || !account || !output) throw new Error("Missing deployment environment.");
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/pokepilot`;
  async function read(path: string) {
    const response = await fetch(base + path, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Cannot inspect active deployment (HTTP ${response.status}).`);
    const envelope = await response.json() as { success?: boolean; result?: unknown };
    if (!envelope.success) throw new Error("Cloudflare deployment lookup failed.");
    return envelope.result;
  }
  // Script settings may describe the latest upload, including an undeployed QA version.
  const ids = activeVersionIds(await read("/deployments"));
  const versions = await Promise.all(ids.map((id) => read(`/versions/${id}`)));
  const drain = versions.some((version) => requiresAnalysisDrain((version as { resources?: unknown } | null)?.resources));
  appendFileSync(output, `drain=${drain}\n`);
  console.log(drain ? "Initial gate cutover or interrupted maintenance: analysis drain required." : "Cloudflare analysis gate already active: ordinary deployment.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Deployment preflight failed.");
    process.exitCode = 1;
  });
}
