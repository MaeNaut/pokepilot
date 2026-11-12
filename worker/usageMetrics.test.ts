import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import type { WorkerEnvironment } from "./env";
import { allowsUsageMetrics, serviceOperation, recordUsageMetric, pruneUsageMetrics, type ServiceOperation } from "./usageMetrics";

function setup() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind, run });
  const env = { POKEPILOT_USAGE_METRICS_ENABLED: "true", DB: { prepare } } as unknown as WorkerEnvironment;
  return { env, prepare, bind, run };
}

describe("actual functional API operation totals", () => {
  it.each([
    ["/api/pokepilot/personal-api-key", "GET", "key_status"],
    ["/api/pokepilot/personal-api-key", "PUT", "key_save"],
    ["/api/pokepilot/personal-api-key", "DELETE", "key_delete"],
    ["/api/pokepilot/team-library", "GET", "team_read"],
    ["/api/pokepilot/team-library", "PUT", "team_write"],
    ["/api/pokepilot/preferences", "PUT", "preferences_write"],
    ["/api/pokepilot/analysis-history", "GET", "history_read"],
    ["/api/pokepilot/analyze", "POST", "analysis"],
    ["/api/battle-usage/singles", "GET", "battle_snapshot_singles"],
    ["/api/battle-usage/doubles/secret-pokemon?private=secret", "GET", "battle_detail_doubles"],
    ["/help/api-key-ko.html", "GET", null],
    ["/api/pokepilot/usage-events", "POST", null],
    ["/api/pokepilot/account", "OPTIONS", null],
    ["/api/pokepilot/account", "constructor", null],
    ["/api/battle-usage/singles/private/extra", "GET", null],
  ])("classifies %s %s without retaining paths or queries", (path, method, operation) => {
    expect(serviceOperation(new Request(`https://pokepilot.app${path}`, { method }))).toBe(operation);
  });
  it("stores only fixed operation/status/latency totals and accumulates repeated executions", async () => {
    const db = setup();
    await recordUsageMetric(db.env, "team_update", 200, 40);
    expect(db.bind.mock.calls[0]).toEqual([expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "team_update", 200, "lt_500ms", 40]);
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(readFileSync(new URL("../migrations/0005_usage_metrics.sql", import.meta.url), "utf8"));
      const statement = sqlite.prepare(db.prepare.mock.calls[0][0]);
      statement.run(...db.bind.mock.calls[0]);
      statement.run(...db.bind.mock.calls[0]);
      expect(sqlite.prepare("SELECT requests,duration_ms FROM service_usage_metrics").get()).toEqual({ requests: 2, duration_ms: 80 });
      expect(sqlite.prepare("PRAGMA table_info(service_usage_metrics)").all().map(row => row.name))
        .toEqual(["day", "operation", "status", "latency_bucket", "requests", "duration_ms"]);
    } finally { sqlite.close(); }
  });
  it("honors the kill switch and refuses arbitrary operations/statuses", async () => {
    const db = setup();
    db.env.POKEPILOT_USAGE_METRICS_ENABLED = "false";
    await recordUsageMetric(db.env, "analysis", 200, 5);
    db.env.POKEPILOT_USAGE_METRICS_ENABLED = "true";
    await recordUsageMetric(db.env, "private-team-name" as ServiceOperation, 200, 5);
    await recordUsageMetric(db.env, "analysis", 9000, 5);
    expect(db.prepare).not.toHaveBeenCalled();
  });
  it.each(["DNT", "Sec-GPC", "X-PokePilot-Usage-Opt-Out"])("honors request privacy preference %s", name => {
    expect(allowsUsageMetrics(new Request("https://pokepilot.app/api/pokepilot/account", { headers: { [name]: "1" } }))).toBe(false);
  });
  it("excludes preview hosts and does not use cookies, IPs, user agent or referrer", () => {
    expect(allowsUsageMetrics(new Request("https://qa.example/api/pokepilot/account"))).toBe(false);
    expect(allowsUsageMetrics(new Request("https://pokepilot.app/api/pokepilot/account", {
      headers: { Cookie: "private", "User-Agent": "private", Referer: "https://private.example", "CF-Connecting-IP": "192.0.2.1" },
    }))).toBe(true);
  });
  it("does not expose or propagate database errors", async () => {
    const db = setup();
    db.run.mockRejectedValue(new Error("private database value"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(recordUsageMetric(db.env, "key_save", 204, 5)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith("[PokePilot usage metrics] Aggregate write unavailable.");
    } finally { warn.mockRestore(); }
  });
  it("keeps retention when collection is disabled", async () => {
    const db = setup();
    db.env.POKEPILOT_USAGE_METRICS_ENABLED = "false";
    await pruneUsageMetrics(db.env);
    expect(db.prepare).toHaveBeenCalledWith("DELETE FROM service_usage_metrics WHERE day < date('now', '-90 days')");
  });
});
