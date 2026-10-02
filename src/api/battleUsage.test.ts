// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { battleUsageFixture } from "../test/fixtures/battleUsageFixture";
import { parseBattleUsageIndex } from "./battleUsageData";

beforeEach(() => {
  vi.resetModules(); localStorage.clear(); vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("battle usage client", () => {
  it("shares index requests, loads details, and caches the format separately", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    const fetcher = vi.fn().mockImplementation(async (url: string) => Response.json(url.endsWith("garchomp") ? snapshot.sets[0] : snapshot));
    vi.stubGlobal("fetch", fetcher);
    const api = await import("./battleUsage");
    const [ids, sets] = await Promise.all([api.loadBattleUsagePokemonIds("singles"), api.loadBattleUsageSets("singles")]);
    expect(ids).toEqual(["garchomp"]); expect(sets).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(await api.loadPopularUsageSet("garchomp", "singles")).toMatchObject({ pokemonId: "garchomp" });
    await api.loadPopularUsageSet("garchomp", "singles");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await api.loadBattleUsageSource("doubles")).toBeNull();
  });
  it("falls back to recent cached data and marks it stale", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    localStorage.setItem("pokepilot:battle-usage:v1:singles", JSON.stringify({ ...snapshot, cachedAt: Date.now() - 7_200_000 }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const api = await import("./battleUsage");
    expect(await api.loadBattleUsageSource("singles")).toMatchObject({ stale: true, sourceDate: "2026-09-30" });
    expect(await api.loadBattleUsagePokemonIds("singles")).toEqual(["garchomp"]);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not fall through from an unknown gender to another form", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    snapshot.sets[0] = { ...snapshot.sets[0], pokemonId: "indeedee-f", pokemonName: "Indeedee-F" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(snapshot)));
    const api = await import("./battleUsage");
    expect(await api.loadPopularUsageSet("indeedee-male", "singles")).toBeNull();
  });
  it("rejects corrupt and expired caches instead of using old Smogon data", async () => {
    localStorage.setItem("pokepilot:battle-usage:v1:singles", '{"provider":"champions-battle-data"}');
    localStorage.setItem("pokepilot:smogon-usage:v7:singles", '{}');
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const api = await import("./battleUsage");
    expect(await api.loadBattleUsageSource("singles")).toBeNull();
    await expect(api.loadBattleUsageSets("singles")).rejects.toThrow();
  });
  it("expires a recent browser cache when its source data is over seven days old", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    localStorage.setItem("pokepilot:battle-usage:v1:singles", JSON.stringify({ ...snapshot, cachedAt: Date.now() }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const api = await import("./battleUsage");
    expect(await api.loadBattleUsageSource("singles")).toBeNull();
  });
  it("refreshes expired data and selected details on the next day", async () => {
    let snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => Response.json(url.endsWith("garchomp") ? snapshot.sets[0] : snapshot)));
    const api = await import("./battleUsage");
    expect(await api.loadPopularUsageSet("garchomp", "singles")).toMatchObject({ season: "M6" });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    snapshot = parseBattleUsageIndex(battleUsageFixture("01_10_2026", "M7").index, "singles");
    expect(await api.loadPopularUsageSet("garchomp", "singles")).toMatchObject({ season: "M7", sourceDate: "2026-10-01" });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("rejects mismatched details and retries instead of permanently caching failures", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(snapshot))
      .mockResolvedValueOnce(Response.json({ ...snapshot.sets[0], pokemonId: "salamence" }))
      .mockResolvedValueOnce(Response.json({ ...snapshot.sets[0], ability: "Sand Veil" }));
    vi.stubGlobal("fetch", fetcher);
    const api = await import("./battleUsage");
    expect(await api.loadPopularUsageSet("garchomp", "singles")).toEqual(snapshot.sets[0]);
    expect(await api.loadPopularUsageSet("garchomp", "singles")).toMatchObject({ ability: "Sand Veil" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("coalesces selected detail requests while keeping both formats separate", async () => {
    const fixture = battleUsageFixture();
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      const format = url.includes("doubles") ? "doubles" : "singles";
      const snapshot = parseBattleUsageIndex(fixture.index, format);
      return Response.json(url.endsWith("garchomp") ? snapshot.sets[0] : snapshot);
    });
    vi.stubGlobal("fetch", fetcher);
    const api = await import("./battleUsage");
    const [a, b, c] = await Promise.all([
      api.loadPopularUsageSet("garchomp", "singles"), api.loadPopularUsageSet("garchomp", "singles"), api.loadPopularUsageSet("garchomp", "doubles"),
    ]);
    expect(a).toEqual(b);
    expect(a?.usageRank).toBe(1);
    expect(c?.usageRank).toBe(9);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("works with in-memory cache when browser storage cannot be written", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    try {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(snapshot)));
      const api = await import("./battleUsage");
      expect(await api.loadBattleUsagePokemonIds("singles")).toEqual(["garchomp"]);
      expect(await api.loadBattleUsageSource("singles")).not.toBeNull();
      expect(fetch).toHaveBeenCalledOnce();
    } finally { storage.mockRestore(); }
  });
  it("backs off transient index failures and then recovers", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(Response.json(snapshot));
    vi.stubGlobal("fetch", fetcher);
    const api = await import("./battleUsage");
    expect(await api.loadBattleUsageSource("singles")).toBeNull();
    expect(await api.loadBattleUsageSource("singles")).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_001);
    expect(await api.loadBattleUsageSource("singles")).not.toBeNull();
  });
  it("rejects malformed successful responses without crashing consumers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    const api = await import("./battleUsage");
    expect(await api.loadPopularUsageSet("garchomp", "singles")).toBeNull();
    expect(await api.loadBattleUsageSource("singles")).toBeNull();
  });
  it("retains aggregate base usage after Mega evolution", async () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles");
    const fetcher = vi.fn().mockImplementation(async (url: string) => Response.json(url.endsWith("garchomp") ? snapshot.sets[0] : snapshot));
    vi.stubGlobal("fetch", fetcher);
    const api = await import("./battleUsage");
    expect(await api.loadPopularUsageSet("garchomp-mega-z", "singles")).toMatchObject({ pokemonId: "garchomp" });
    expect(fetcher.mock.calls[1][0]).toBe("/api/battle-usage/singles/garchomp");
  });
});
