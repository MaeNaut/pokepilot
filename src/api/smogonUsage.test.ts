import { afterEach, describe, expect, it, vi } from "vitest";
import type { PokemonMove } from "../types";
import {
  getSmogonUsageFormatId,
  parseSmogonMovesetText,
  resolveSmogonUsageMoveIds,
} from "./smogonUsage";

function createMove(id: string, name: string): PokemonMove {
  return {
    id,
    name,
    type: "normal",
    category: "Status",
    power: null,
    accuracy: null,
    pp: 10,
    description: "Test move",
    tags: [],
  };
}

describe("Smogon usage move resolution", () => {
  it("maps legacy hyphenated usage IDs to canonical Showdown move IDs", () => {
    const moves = [
      createMove("shadowball", "Shadow Ball"),
      createMove("solarbeam", "Solar Beam"),
      createMove("protect", "Protect"),
      createMove("willowisp", "Will-O-Wisp"),
    ];

    expect(
      resolveSmogonUsageMoveIds(moves, [
        "shadow-ball",
        "solar-beam",
        "protect",
        "will-o-wisp",
      ]),
    ).toEqual(["shadowball", "solarbeam", "protect", "willowisp"]);
  });

  it("skips unavailable moves and continues to the next popular legal move", () => {
    const moves = [
      createMove("protect", "Protect"),
      createMove("shadowball", "Shadow Ball"),
      createMove("solarbeam", "Solar Beam"),
      createMove("willowisp", "Will-O-Wisp"),
    ];

    expect(
      resolveSmogonUsageMoveIds(moves, [
        "unavailable-move",
        "protect",
        "shadow-ball",
        "solar-beam",
        "will-o-wisp",
      ]),
    ).toEqual(["protect", "shadowball", "solarbeam", "willowisp"]);
  });
});

describe("Smogon usage formats", () => {
  it("maps singles and doubles to their respective M-C and M-B ladders", () => {
    expect(getSmogonUsageFormatId("singles", "mc")).toBe(
      "gen9championsbssregmc",
    );
    expect(getSmogonUsageFormatId("doubles", "mc")).toBe(
      "gen9championsvgc2026regmc",
    );
    expect(getSmogonUsageFormatId("singles", "mb")).toBe(
      "gen9championsbssregmb",
    );
    expect(getSmogonUsageFormatId("doubles", "mb")).toBe(
      "gen9championsvgc2026regmb",
    );
  });

  it("keeps several observed item candidates while preserving the top item", () => {
    const snapshot = parseSmogonMovesetText(
      `
 +------------+
 | Incineroar |
 +------------+
 | Raw count: 100
 | Items |
 | Sitrus Berry 50.000% |
 | Assault Vest 25.000% |
 | Safety Goggles 15.000% |
 | Leftovers 5.000% |
 | Choice Band 3.000% |
 | Moves |
 | Fake Out 90.000% |
`,
      "2026-08",
      1630,
    );

    expect(snapshot.sets[0]).toMatchObject({
      itemName: "Sitrus Berry",
      itemNames: [
        "Sitrus Berry",
        "Assault Vest",
        "Safety Goggles",
        "Leftovers",
      ],
      itemOptions: [
        { id: "sitrusberry", usagePercent: 50 },
        { id: "assaultvest", usagePercent: 25 },
        { id: "safetygoggles", usagePercent: 15 },
        { id: "leftovers", usagePercent: 5 },
      ],
      moveOptions: [{ id: "fakeout", usagePercent: 90 }],
    });
  });

  it("keeps bounded spread variants with their observed percentages", () => {
    const snapshot = parseSmogonMovesetText(
      `
 +----------+
 | Weavile  |
 +----------+
 | Raw count: 100
 | Spreads |
 | Jolly:2/32/0/0/0/32 48.500% |
 | Adamant:2/32/0/0/0/32 21.250% |
 | Jolly:32/32/0/0/0/2 10.000% |
`,
      "2026-08",
      1630,
    );

    expect(snapshot.sets[0].spreads).toEqual([
      expect.objectContaining({ nature: "jolly", usagePercent: 48.5 }),
      expect.objectContaining({ nature: "adamant", usagePercent: 21.25 }),
      expect.objectContaining({ nature: "jolly", usagePercent: 10 }),
    ]);
    expect(snapshot.sets[0]).toMatchObject({
      nature: "jolly",
      evs: { hp: 2, attack: 32, speed: 32 },
    });
  });
});

const movesetText = `
 +------------+
 | Incineroar |
 +------------+
 | Raw count: 100
 | Abilities |
 | Intimidate 95.000% |
 | Items |
 | Sitrus Berry 50.000% |
 | Moves |
 | Fake Out 90.000% |
`;

function stubBrowserStorage() {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  });
  return entries;
}

function movesetResponse(url: string, path: string) {
  const found = url.includes(path);
  return new Response(found ? movesetText : "", { status: found ? 200 : 404 });
}

describe("Smogon usage source selection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps M-B before September M-C statistics can exist", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
    stubBrowserStorage();
    const fetchMock = vi.fn(async (url: string) => movesetResponse(
      url, "2026-08/moveset/gen9championsbssregmb-1630.txt",
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { loadSmogonUsageSource } = await import("./smogonUsage");
    expect(await loadSmogonUsageSource("singles")).toEqual({
      regulation: "mb", sourceMonth: "2026-08", cutoff: 1630,
    });
    expect(fetchMock.mock.calls.every(([url]) => !url.includes("regmc"))).toBe(true);
  });

  it("prefers published M-C data and shares its source across usage consumers", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const storage = stubBrowserStorage();
    storage.set("pokepilot:smogon-usage:v6:doubles", JSON.stringify({
      sourceMonth: "2026-08", cutoff: 1630, sets: [{ pokemonId: "stale" }],
      cachedAt: Date.now(),
    }));
    const fetchMock = vi.fn(async (url: string) => movesetResponse(
      url, "2026-09/moveset/gen9championsvgc2026regmc-1630.txt",
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { loadSmogonUsageSource, loadSmogonUsageSets, loadPopularSmogonSet } = await import("./smogonUsage");
    expect(await loadSmogonUsageSource("doubles")).toEqual({
      regulation: "mc", sourceMonth: "2026-09", cutoff: 1630,
    });
    expect((await loadSmogonUsageSets("doubles"))[0].pokemonId).toBe("incineroar");
    expect((await loadPopularSmogonSet("incineroar", "doubles"))?.sourceMonth).toBe("2026-09");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("switches singles and doubles independently and accepts the 0 cutoff", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    stubBrowserStorage();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const isSinglesMc = url.includes("2026-09/moveset/gen9championsbssregmc-0.txt");
      const isDoublesMb = url.includes("2026-08/moveset/gen9championsvgc2026regmb-1630.txt");
      const found = isSinglesMc || isDoublesMb;
      return new Response(found ? movesetText : "", { status: found ? 200 : 404 });
    }));

    const { loadSmogonUsageSource } = await import("./smogonUsage");
    const [singles, doubles] = await Promise.all([
      loadSmogonUsageSource("singles"),
      loadSmogonUsageSource("doubles"),
    ]);
    expect(singles).toEqual({ regulation: "mc", sourceMonth: "2026-09", cutoff: 0 });
    expect(doubles).toEqual({ regulation: "mb", sourceMonth: "2026-08", cutoff: 1630 });
  });

  it("falls back to M-B, then refreshes the fallback when M-C appears", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const storage = stubBrowserStorage();
    let mcPublished = false;
    const fetchMock = vi.fn(async (url: string) => {
      const isMc = url.includes("2026-09/moveset/gen9championsvgc2026regmc-1630.txt");
      const isMb = url.includes("2026-08/moveset/gen9championsvgc2026regmb-1630.txt");
      return new Response(isMb || (isMc && mcPublished) ? movesetText : "", {
        status: isMb || (isMc && mcPublished) ? 200 : 404,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    let { loadSmogonUsageSource } = await import("./smogonUsage");
    expect(await loadSmogonUsageSource("doubles")).toEqual({
      regulation: "mb", sourceMonth: "2026-08", cutoff: 1630,
    });
    expect(storage.has("pokepilot:smogon-usage:v7:doubles")).toBe(true);

    vi.resetModules();
    ({ loadSmogonUsageSource } = await import("./smogonUsage"));
    const callsBeforeCacheRead = fetchMock.mock.calls.length;
    expect((await loadSmogonUsageSource("doubles"))?.regulation).toBe("mb");
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeCacheRead);

    mcPublished = true;
    vi.setSystemTime(new Date("2026-10-04T01:01:00Z"));
    expect(await loadSmogonUsageSource("doubles")).toEqual({
      regulation: "mc", sourceMonth: "2026-09", cutoff: 1630,
    });
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeCacheRead + 1);
  });
});
