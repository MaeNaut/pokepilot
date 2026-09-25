import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { latencyBucket, metricRoute, metricValues, pruneMetrics, recordMetric } from "./metrics";
import type { WorkerEnvironment } from "./env";
import type { PokePilotOperationalEvent } from "../server/pokepilotApi";

const event: PokePilotOperationalEvent = {
  type: "analysis", scope: "team", cacheStatus: "miss", requestKey: "private-fingerprint",
  safeguardMode: "enforced", durationMs: 50, inputTokens: 100, outputTokens: 20,
  cachedInputTokens: 10, cacheWriteTokens: 5, costUsd: 0.01,
};
function database(enabled = "true") {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind, run });
  return { env: { DB: { prepare }, POKEPILOT_METRICS_ENABLED: enabled } as unknown as WorkerEnvironment, prepare, bind, run };
}
describe("private operational aggregates", () => {
  it("executes the migration and accumulates repeated requests atomically", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(readFileSync(new URL("../migrations/0003_operational_metrics.sql", import.meta.url), "utf8"));
      const db = database();
      await recordMetric(db.env,"/api/pokepilot/analyze",200,50,event);
      const statement = sqlite.prepare(db.prepare.mock.calls[0][0]);
      const values = metricValues("/api/pokepilot/analyze",200,50,event);
      statement.run(...values);
      statement.run(...values);
      expect(sqlite.prepare("SELECT requests,input_tokens,duration_ms FROM operational_metrics").get()).toMatchObject({ requests: 2, input_tokens: 200, duration_ms: 100 });
    } finally { sqlite.close(); }
  });
  it("only records known API routes", () => {
    expect(metricRoute("/api/pokepilot/analyze")).toBeTruthy();
    expect(metricRoute("/api/private-user-input")).toBeNull();
    expect(metricRoute("/")).toBeNull();
  });
  it.each([[0,"lt_500ms"],[500,"lt_2s"],[2000,"lt_10s"],[10000,"lt_30s"],[30000,"gte_30s"]])("buckets %s", (ms, bucket) => {
    expect(latencyBucket(Number(ms))).toBe(bucket);
  });
  it("omits fingerprints and uses UTC dates", () => {
    const values = metricValues("/api/pokepilot/analyze",200,50,event,new Date("2026-09-19T00:00:00Z"));
    expect(values[0]).toBe("2026-09-19");
    expect(values).not.toContain("private-fingerprint");
    expect(values.slice(-5)).toEqual([100,20,10,5,0.01]);
  });
  it("attributes Sol usage to Sol rather than the Luna default", () => {
    const values = metricValues("/api/pokepilot/analyze", 200, 50, { ...event, modelId: "gpt-6-sol" });
    expect(values[5]).toBe("gpt-6-sol");
  });
  it("counts tokens and cost when a paid model response cannot be displayed", () => {
    const failed: PokePilotOperationalEvent = {
      type: "analysis-failure", scope: "team", billingSource: "personal",
      reasoningEffort: "medium", requestKey: "private-fingerprint", safeguardMode: "ai-fresh",
      usage: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 10,
        cacheWriteTokens: 5, reasoningTokens: 2, totalTokens: 120, costUsd: 0.01 },
    };
    const values = metricValues("/api/pokepilot/analyze", 502, 50, failed);
    expect(values[4]).toBe("personal-medium-failed");
    expect(values.slice(-5)).toEqual([100, 20, 10, 5, 0.01]);
    expect(values).not.toContain("private-fingerprint");
  });
  it.each(["hit","shared"] as const)("does not double count %s token usage", (cacheStatus) => {
    expect(metricValues("/api/pokepilot/analyze",200,20,{ ...event,cacheStatus }).slice(-5)).toEqual([0,0,0,0,0]);
  });
  it("writes a bounded aggregate with bound values", async () => {
    const db = database();
    await recordMetric(db.env,"/api/pokepilot/analyze",200,50,event);
    expect(db.prepare.mock.calls[0][0]).toContain("ON CONFLICT");
    expect(db.bind.mock.calls[0]).toHaveLength(14);
    expect(db.run).toHaveBeenCalledOnce();
  });
  it("supports a kill switch", async () => {
    const db = database("false");
    await recordMetric(db.env,"/api/pokepilot/account",200,1);
    expect(db.prepare).not.toHaveBeenCalled();
  });
  it("does not propagate database failures or log their details", async () => {
    const db = database();
    db.run.mockRejectedValue(new Error("private details"));
    const warn = vi.spyOn(console,"warn").mockImplementation(() => {});
    try {
      await expect(recordMetric(db.env,"/api/pokepilot/account",200,1)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith("[PokePilot metrics] Aggregate write failed.");
    } finally { warn.mockRestore(); }
  });
  it("prunes only expired aggregate rows", async () => {
    const db = database();
    await pruneMetrics(db.env);
    expect(db.prepare).toHaveBeenCalledWith("DELETE FROM operational_metrics WHERE day < date('now', '-90 days')");
  });
});
