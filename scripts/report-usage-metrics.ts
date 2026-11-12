import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizeUsageMetrics, type UsageMetricRow } from "./usageMetricsSummary";

const args = process.argv.slice(2);
const days = Number(args.find((arg) => arg.startsWith("--days="))?.slice(7) ?? "7");
if (!Number.isInteger(days) || days < 1 || days > 90
  || args.some((arg) => arg !== "--remote" && !arg.startsWith("--days="))) {
  throw new Error("Usage: npm run usage:report -- [--remote] [--days=7]; days must be 1..90");
}
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const sql = `SELECT * FROM service_usage_metrics WHERE day >= date('now', '-${days - 1} days') ORDER BY day,operation,status,latency_bucket`;
const output = execFileSync(process.execPath, [wrangler, "d1", "execute", "pokepilot",
  args.includes("--remote") ? "--remote" : "--local", "--command", sql, "--json"],
{ encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const result = JSON.parse(output) as Array<{ success: boolean; results: UsageMetricRow[] }>;
if (!result.length || result.some((entry) => !entry.success)) throw new Error("Usage metrics query failed");
const rows = result.flatMap((entry) => entry.results);
console.log(JSON.stringify({
  schemaVersion: 1, kind: "product-usage", generatedAt: new Date().toISOString(), timezone: "UTC",
  source: args.includes("--remote") ? "remote" : "local", days,
  summary: summarizeUsageMetrics(rows),
  caveats: [
    "Actual functional API request counts, not unique people, sessions, return visits or browser clicks.",
    "Each request is counted; retries, autosaves, focus reads and bots can increase counts. No page-load deduplication.",
    "Only UTC day, fixed operation, HTTP status, latency bucket and numeric totals are stored.",
    "A successful response confirms server handling, not a new signup, valid provider key or use of the displayed AI result.",
    "Browser-only team editing, damage calculation and static guide views are not measured by this report.",
    "Opt-outs, privacy signals, lost writes and current incomplete UTC day affect counts. This table has no AI tokens/costs.",
    "Use metrics:report for model/scope/effort, cache outcomes, tokens and costs; don't add overlapping reports together.",
    "Compare with Search Console (Google search clicks only), Web Analytics and API operational metrics; totals need not match.",
  ], rows,
}, null, 2));
