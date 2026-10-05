import { describe, expect, it, vi } from "vitest";
import { normalizeShowdownSnapshot } from "./showdownData";

describe("Showdown move mechanics normalization", () => {
  it("refreshes pre-detail cached snapshots instead of retaining short-only mechanics", async () => {
    vi.resetModules();
    const old = { cachedAt: Date.now(), speciesById: {}, movesById: { wish: { description: "Old short summary" } } };
    const storage = {
      getItem: vi.fn((key: string) => key.endsWith("mc-v4") ? JSON.stringify(old) : null),
      setItem: vi.fn(), removeItem: vi.fn(),
    };
    const desc = "The Pokemon at the user's position recovers HP next turn.";
    vi.stubGlobal("localStorage", storage);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ species: {}, moves: {
      wish: { name: "Wish", type: "Normal", category: "Status", shortDesc: "Heal next turn.", desc },
    } }) });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { loadShowdownData } = await import("./showdownData");
      expect((await loadShowdownData()).movesById.wish.detailedDescription).toBe(desc);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(storage.removeItem).toHaveBeenCalledWith("pokepilot:showdown-data:mc-v4");
      expect(storage.setItem).toHaveBeenCalledWith("pokepilot:showdown-data:mc-v5", expect.any(String));
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("keeps detailed delayed effects separate from short UI descriptions", () => {
    const desc = "At the end of the next turn, the Pokemon at the user's position has half the user's maximum HP restored.";
    const snapshot = normalizeShowdownSnapshot({}, {
      wish: { name: "Wish", type: "Normal", category: "Status", target: "self",
        shortDesc: "Next turn, 50% of the user's max HP is restored.", desc },
    });
    expect(snapshot.movesById.wish.description).toBe("Next turn, 50% of the user's max HP is restored.");
    expect(snapshot.movesById.wish.detailedDescription).toBe(desc);
  });
  it("retains weather damage and immunity rules omitted from short descriptions", () => {
    const description = "Active Pokemon lose 1/16 HP unless Ground, Rock, or Steel type.";
    const snapshot = normalizeShowdownSnapshot({}, {
      sandstorm: { name: "Sandstorm", type: "Rock", category: "Status", weather: "Sandstorm",
        shortDesc: "A sandstorm rages.", desc: description },
    });
    expect(snapshot.movesById.sandstorm.description).toBe(description);
  });
  it("preserves target, priority, deterministic target stages, and field effects", () => {
    const snapshot = normalizeShowdownSnapshot({}, {
      charm: {
        name: "Charm",
        type: "Fairy",
        category: "Status",
        basePower: 0,
        accuracy: 100,
        pp: 20,
        target: "normal",
        boosts: { atk: -2 },
      },
      helpinghand: {
        name: "Helping Hand",
        type: "Normal",
        category: "Status",
        basePower: 0,
        accuracy: true,
        pp: 20,
        target: "adjacentAlly",
        priority: 5,
      },
      raindance: {
        name: "Rain Dance",
        type: "Water",
        category: "Status",
        basePower: 0,
        accuracy: true,
        pp: 5,
        target: "all",
        weather: "rain",
        sideCondition: "tailwind",
      },
    });

    expect(snapshot.movesById.charm).toMatchObject({
      target: "any-adjacent",
      targetStatChanges: [{ stat: "attack", stages: -2 }],
    });
    expect(snapshot.movesById.helpinghand).toMatchObject({
      target: "adjacent-ally",
      priority: 5,
    });
    expect(snapshot.movesById.raindance).toMatchObject({
      target: "all",
      fieldEffects: [
        { kind: "weather", id: "rain" },
        { kind: "side-condition", id: "tailwind" },
      ],
    });
  });
});
