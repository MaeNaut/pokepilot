import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("../server/battleUsageApi", () => ({ createBattleUsageApi: () => handle }));
import { handleCachedBattleUsage } from "./battleUsage";

beforeEach(() => {
  handle.mockReset().mockImplementation(async () => Response.json({ public: true }, { headers: { "Cache-Control": "public, max-age=300" } }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("battle usage edge caching", () => {
  it("uses a canonical public key without cookies or authorization", async () => {
    const match = vi.fn().mockResolvedValue(undefined);
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ match, put }) });
    const request = new Request("https://pokepilot.app/api/battle-usage/singles/garchomp", { headers: { Cookie: "private", Authorization: "Bearer private" } });
    const result = await handleCachedBattleUsage(request);
    expect(result.status).toBe(200);
    expect(match.mock.calls[0][0].url).toBe(request.url);
    expect([...match.mock.calls[0][0].headers]).toEqual([]);
    expect(put).toHaveBeenCalledOnce();
    expect(await result.json()).toEqual({ public: true });
  });
  it("does not contact upstream for a cache hit", async () => {
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ match: vi.fn().mockResolvedValue(Response.json({ cached: true })) }) });
    expect(await (await handleCachedBattleUsage(new Request("https://pokepilot.app/api/battle-usage/doubles"))).json()).toEqual({ cached: true });
    expect(handle).not.toHaveBeenCalled();
  });
  it.each([400, 404, 503])("does not cache HTTP %i responses", async (status) => {
    const put = vi.fn();
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ match: vi.fn(), put }) });
    handle.mockResolvedValue(new Response(null, { status }));
    expect((await handleCachedBattleUsage(new Request("https://pokepilot.app/api/battle-usage/singles"))).status).toBe(status);
    expect(put).not.toHaveBeenCalled();
  });
  it("does not cache stale responses", async () => {
    const put = vi.fn();
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ match: vi.fn(), put }) });
    handle.mockResolvedValue(Response.json({ stale: true }, { headers: { "Cache-Control": "no-store" } }));
    await handleCachedBattleUsage(new Request("https://pokepilot.app/api/battle-usage/singles"));
    expect(put).not.toHaveBeenCalled();
  });
  it("never serves a cached GET body for HEAD or unsupported requests", async () => {
    const open = vi.fn(); vi.stubGlobal("caches", { open });
    for (const request of [
      new Request("https://pokepilot.app/api/battle-usage/singles", { method: "HEAD" }),
      new Request("https://pokepilot.app/api/battle-usage/singles", { method: "POST" }),
      new Request("https://pokepilot.app/api/battle-usage/singles?x=1"),
      new Request("https://pokepilot.app/api/battle-usage/singles/a/b"),
    ]) await handleCachedBattleUsage(request);
    expect(open).not.toHaveBeenCalled();
    expect(handle).toHaveBeenCalledTimes(4);
  });
  it.each(["open", "match", "put"])("survives cache %s failures", async (phase) => {
    const failure = vi.fn().mockRejectedValue(new Error("Cache unavailable"));
    vi.stubGlobal("caches", { open: phase === "open" ? failure : vi.fn().mockResolvedValue({
      match: phase === "match" ? failure : vi.fn(), put: phase === "put" ? failure : vi.fn(),
    }) });
    expect((await handleCachedBattleUsage(new Request("https://pokepilot.app/api/battle-usage/singles"))).status).toBe(200);
  });
});
