import { describe, expect, it } from "vitest";
import { normalizeShowdownSnapshot } from "./showdownData";

describe("Showdown move mechanics normalization", () => {
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
