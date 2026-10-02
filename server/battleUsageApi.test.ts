import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleUsageApi } from "./battleUsageApi";
import { battleUsageFixture } from "../src/test/fixtures/battleUsageFixture";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("battle usage API", () => {
  it("coalesces index requests and strips credentials and raw metadata", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json(battleUsageFixture().index));
    vi.stubGlobal("fetch", fetcher);
    const handler = createBattleUsageApi();
    const request = new Request("https://pokepilot.app/api/battle-usage/singles", { headers: { Cookie: "secret", Authorization: "Bearer secret" } });
    const [a, b] = await Promise.all([handler(request), handler(new Request("https://pokepilot.app/api/battle-usage/doubles"))]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    const upstream = fetcher.mock.calls[0][0] as Request;
    expect(upstream.url).toBe("https://championsbattledata.com/api");
    expect(upstream.redirect).toBe("manual");
    expect(upstream.headers.has("cookie")).toBe(false);
    expect(upstream.headers.has("authorization")).toBe(false);
    expect(await a.text()).not.toContain("battleDataCsvs");
  });
  it("rejects upstream redirects without following another origin", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, {
      status: 302, headers: { Location: "https://untrusted.test/api" },
    }));
    vi.stubGlobal("fetch", fetcher);
    const response = await createBattleUsageApi()(new Request("https://pokepilot.app/api/battle-usage/singles"));
    expect(response.status).toBe(503);
    expect(fetcher).toHaveBeenCalledOnce();
    expect((fetcher.mock.calls[0][0] as Request).redirect).toBe("manual");
  });
  it("loads and caches selected Pokemon details", async () => {
    const fixture = battleUsageFixture();
    const fetcher = vi.fn().mockImplementation(async (request: Request) => Response.json(request.url.endsWith("/api") ? fixture.index : fixture.detail()));
    vi.stubGlobal("fetch", fetcher);
    const handler = createBattleUsageApi();
    const request = new Request("https://pokepilot.app/api/battle-usage/singles/garchomp");
    const result = await handler(request);
    expect(result.status).toBe(200);
    expect((await result.json()).moveOptions).toHaveLength(2);
    await handler(request);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0].url).toContain("season=M6&days=2");
  });
  it("rejects unsupported paths, queries, and writes without upstream requests", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const handler = createBattleUsageApi();
    for (const path of ["/triples", "/singles?url=https://other.test", "/singles/a/b"]) {
      expect((await handler(new Request(`https://pokepilot.app/api/battle-usage${path}`))).status).toBe(400);
    }
    expect((await handler(new Request("https://pokepilot.app/api/battle-usage/singles", { method: "POST" }))).status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains recent data on refresh failure, but not indefinitely", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(battleUsageFixture().index)).mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const handler = createBattleUsageApi();
    const request = new Request("https://pokepilot.app/api/battle-usage/singles");
    await handler(request);
    vi.setSystemTime(new Date("2026-09-30T14:00:00Z"));
    expect(await (await handler(request)).json()).toMatchObject({ stale: true });
    vi.setSystemTime(new Date("2026-10-09T14:00:00Z"));
    expect((await handler(request)).status).toBe(503);
  });
  it("serves a healthy format while the other format is incomplete", async () => {
    const fixture = battleUsageFixture();
    fixture.index.pokemon[0].summary.battleSummary.Current.Doubles = {
      ...structuredClone(fixture.index.pokemon[0].summary.battleSummary.Current.Singles),
      top: {},
    } as typeof fixture.index.pokemon[0]["summary"]["battleSummary"]["Current"]["Doubles"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(fixture.index)));
    const handler = createBattleUsageApi();
    expect((await handler(new Request("https://pokepilot.app/api/battle-usage/singles"))).status).toBe(200);
    expect((await handler(new Request("https://pokepilot.app/api/battle-usage/doubles"))).status).toBe(503);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("never returns a body for HEAD, including failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const handler = createBattleUsageApi();
    for (const path of ["singles", "singles?invalid=1", "singles/a/b"]) {
      const response = await handler(new Request(`https://pokepilot.app/api/battle-usage/${path}`, { method: "HEAD" }));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).toBe("");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
  it("coalesces detail requests and isolates Singles/Doubles samples", async () => {
    const fixture = battleUsageFixture();
    const fetcher = vi.fn().mockImplementation(async (request: Request) => Response.json(
      request.url.endsWith("/api") ? fixture.index : fixture.detail(request.url.includes("/Doubles/") ? "Doubles" : "Singles"),
    ));
    vi.stubGlobal("fetch", fetcher);
    const handler = createBattleUsageApi();
    const request = (format: string) => new Request(`https://pokepilot.app/api/battle-usage/${format}/garchomp`);
    const responses = await Promise.all([handler(request("singles")), handler(request("singles")), handler(request("doubles"))]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect((await responses[0].json()).usageRank).toBe(1);
    expect((await responses[2].json()).usageRank).toBe(9);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("refreshes detail keys when the day and season change", async () => {
    let fixture = battleUsageFixture();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (request: Request) => Response.json(
      request.url.endsWith("/api") ? fixture.index : fixture.detail(),
    )));
    const handler = createBattleUsageApi();
    const request = new Request("https://pokepilot.app/api/battle-usage/singles/garchomp");
    expect(await (await handler(request)).json()).toMatchObject({ season: "M6" });
    fixture = battleUsageFixture("01_10_2026", "M7");
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    expect(await (await handler(request)).json()).toMatchObject({ season: "M7", sourceDate: "2026-10-01" });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("does not return the wrong day or species from detail endpoints", async () => {
    const fixture = battleUsageFixture();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (request: Request) => Response.json(
      request.url.endsWith("/api") ? fixture.index : { ...fixture.detail(), showdownId: "salamence" },
    )));
    const handler = createBattleUsageApi();
    expect((await handler(new Request("https://pokepilot.app/api/battle-usage/singles/garchomp"))).status).toBe(503);
    expect((await handler(new Request("https://pokepilot.app/api/battle-usage/singles/missing"))).status).toBe(404);
  });
});
