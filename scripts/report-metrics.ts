import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizeMetrics } from "./metricsSummary";

const args = process.argv.slice(2);
const daysArg = args.find((arg) => arg.startsWith("--days="))?.slice(7) ?? "7";
const days = Number(daysArg);
if (!Number.isInteger(days) || days < 1 || days > 90 || args.some((arg) => arg !== "--remote" && !arg.startsWith("--days="))) {
  throw new Error("Usage: npm run metrics:report -- [--remote] [--days=7]; days must be 1..90");
}
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const sql = `SELECT * FROM operational_metrics WHERE day >= date('now', '-${days - 1} days') ORDER BY day,route,status,scope,cache_status,model,prompt_version,latency_bucket`;
const output = execFileSync(process.execPath, [wrangler, "d1", "execute", "pokepilot", args.includes("--remote") ? "--remote" : "--local", "--command", sql, "--json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const result = JSON.parse(output) as Array<{ success: boolean; results: Array<Record<string, string | number>> }>;
if (!result.length || result.some((entry) => !entry.success)) throw new Error("Metrics query failed");
const rows = result.flatMap((entry) => entry.results);
console.log(JSON.stringify({
  schemaVersion: 1, generatedAt: new Date().toISOString(), timezone: "UTC",
  source: args.includes("--remote") ? "remote" : "local", days,
  summary: summarizeMetrics(rows),
  caveats: ["Best-effort server aggregates, not unique users or page views.", "Cost uses the application estimate, not billing invoices; failed upstream call usage is not included.", "Latency buckets are histograms, not exact percentiles. Current UTC day may be incomplete."],
  rows,
}, null, 2));
