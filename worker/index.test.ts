import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountAuthError } from "./accountAuth";
import worker from "./index";
import type { WorkerEnvironment } from "./env";
import { battleUsageFixture } from "../src/test/fixtures/battleUsageFixture";

vi.mock("./accountAuth.js", async (original) => ({
  ...await original<typeof import("./accountAuth")>(),
  readAccountSession: vi.fn(),
  completeGoogleAuthorization: vi.fn(),
  logoutCurrentAccount: vi.fn(),
}));
import { completeGoogleAuthorization, logoutCurrentAccount, readAccountSession } from "./accountAuth";

const env = {
  ASSETS: { fetch: vi.fn().mockResolvedValue(new Response("app")) },
  POKEPILOT_AUTH_REQUIRED: "true",
} as unknown as WorkerEnvironment;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAccountSession).mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Worker routing error boundary", () => {
  it.each(["admit", "acquire", "release"])("does not expose gate %s as a public API", async (method) => {
    const getByName = vi.fn();
    const response = await worker.fetch(new Request(`https://pokepilot.app/api/pokepilot/analysis-gate/${method}`, {
      method: "POST", body: JSON.stringify({ requesterId: "a", token: "test" }),
    }), { ...env, POKEPILOT_ANALYSIS_GATE: { getByName } });
    expect(response.status).toBe(404);
    expect(getByName).not.toHaveBeenCalled();
  });
  it("exposes no client telemetry ingestion endpoint", async () => {
    const response = await worker.fetch(new Request("https://pokepilot.app/api/pokepilot/usage-events", {
      method: "POST", headers: { Origin: "https://pokepilot.app", "Content-Type": "application/json" },
      body: JSON.stringify({ events: ["page_opened"] }),
    }), env);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("Set-Cookie")).toBe(false);
    expect(readAccountSession).not.toHaveBeenCalled();
  });
  it("keeps both aggregate retention jobs running when collection is disabled", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const prepare = vi.fn().mockReturnValue({ run });
    await worker.scheduled({ cron: "17 4 * * *", scheduledTime: Date.now() }, {
      ...env, DB: { prepare } as unknown as D1Database,
      POKEPILOT_METRICS_ENABLED: "false", POKEPILOT_USAGE_METRICS_ENABLED: "false",
    });
    expect(prepare).toHaveBeenCalledWith("DELETE FROM operational_metrics WHERE day < date('now', '-90 days')");
    expect(prepare).toHaveBeenCalledWith("DELETE FROM service_usage_metrics WHERE day < date('now', '-90 days')");
  });
  it("counts actual API requests after handling without persisting accounts or URL queries", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const waitUntil = vi.fn();
    const settings = { ...env, DB: { prepare } as unknown as D1Database, POKEPILOT_USAGE_METRICS_ENABLED: "true" };
    for (let i = 0; i < 2; i += 1) {
      const response = await worker.fetch(new Request("https://pokepilot.app/api/pokepilot/account?private=secret", {
        headers: { "X-PokePilot-Account-Id": "private-account", Cookie: "private-cookie" },
      }), settings, { waitUntil });
      expect(response.status).toBe(401);
    }
    for (const [pending] of waitUntil.mock.calls) await pending;
    expect(bind).toHaveBeenCalledTimes(2);
    expect(bind.mock.calls[0]).toContain("account_read");
    expect(bind.mock.calls[0]).toContain(401);
    expect(JSON.stringify(bind.mock.calls)).not.toMatch(/private|secret|cookie/);
  });
  it("honors the opt-out header without preventing the functional API response", async () => {
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://pokepilot.app/api/pokepilot/account", {
      headers: { "X-PokePilot-Usage-Opt-Out": "1" },
    }), { ...env, POKEPILOT_USAGE_METRICS_ENABLED: "true" }, { waitUntil });
    expect(response.status).toBe(401);
    expect(waitUntil).not.toHaveBeenCalled();
  });
  it("schedules guest metrics without changing the authentication response", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const waitUntil = vi.fn();
    const response = await worker.fetch(new Request("https://pokepilot.app/api/pokepilot/analyze?private=value"), {
      ...env, DB: { prepare } as unknown as D1Database, POKEPILOT_METRICS_ENABLED: "true",
    }, { waitUntil });
    expect(response.status).toBe(401);
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
    expect(bind.mock.calls[0]).toContain("/api/pokepilot/analyze");
    expect(JSON.stringify(bind.mock.calls)).not.toContain("private=value");
  });
  it.each(["account", "teams", "analysis-history", "preferences", "analyze"])("rejects guests at %s", async (endpoint) => {
    const response = await worker.fetch(new Request(`https://pokepilot.app/api/pokepilot/${endpoint}`), env);
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it.each(["account", "teams", "analysis-history", "preferences", "analyze"])("catches asynchronous storage failures at %s", async (endpoint) => {
    vi.mocked(readAccountSession).mockRejectedValue(new Error("private database detail"));
    const response = await worker.fetch(new Request(`https://pokepilot.app/api/pokepilot/${endpoint}`), env);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false, error: { code: "AUTH_UNAVAILABLE", message: "AUTH_UNAVAILABLE" },
    });
  });

  it("preserves intentional account errors from asynchronous handlers", async () => {
    vi.mocked(readAccountSession).mockResolvedValue({ account: { id: "account-a" } });
    vi.mocked(logoutCurrentAccount).mockRejectedValue(new AccountAuthError(403, "AUTH_FORBIDDEN"));
    const response = await worker.fetch(new Request("https://pokepilot.app/api/auth/logout", {
      method: "POST", headers: { "X-PokePilot-Account-Id": "account-a" },
    }), env);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "AUTH_FORBIDDEN" } });
  });

  it("catches callback failures without exposing provider secrets", async () => {
    vi.mocked(completeGoogleAuthorization).mockRejectedValue(new Error("token details"));
    const response = await worker.fetch(new Request("https://pokepilot.app/api/auth/google/callback"), env);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("token details");
  });

  it("returns JSON 404s for unknown API paths rather than the SPA", async () => {
    const response = await worker.fetch(new Request("https://pokepilot.app/api/unknown"), env);
    expect(response.status).toBe(404);
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("rejects writes to the read-only usage proxy", async () => {
    const response = await worker.fetch(new Request("https://pokepilot.app/api/battle-usage/singles", { method: "POST" }), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("does not log out a different account from a stale tab", async () => {
    vi.mocked(readAccountSession).mockResolvedValue({ account: { id: "new-account" } });
    const response = await worker.fetch(new Request("https://pokepilot.app/api/auth/logout", {
      method: "POST", headers: { "X-PokePilot-Account-Id": "old-account" },
    }), env);
    expect(response.status).toBe(403);
    expect((await worker.fetch(new Request("https://pokepilot.app/api/auth/logout", {
      method: "POST",
    }), env)).status).toBe(403);
    expect(logoutCurrentAccount).not.toHaveBeenCalled();
  });

  it("does not forward account credentials to the battle data provider", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-30T12:00:00Z"));
    const upstream = vi.fn().mockImplementation(async () => Response.json(battleUsageFixture().index));
    vi.stubGlobal("fetch", upstream);
    const response = await worker.fetch(new Request("https://pokepilot.app/api/battle-usage/singles", {
      headers: { Cookie: "pokepilot_session=secret", Authorization: "Bearer secret" },
    }), env);
    expect(response.status).toBe(200);
    const forwarded = upstream.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe("https://championsbattledata.com/api");
    expect(forwarded.headers.get("Cookie")).toBeNull();
    expect(forwarded.headers.get("Authorization")).toBeNull();
    expect(forwarded.headers.get("Accept")).toBe("application/json");
  });
});
