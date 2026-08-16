import { describe, expect, it } from "vitest";
import type { StatBlock } from "../types";
import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  clampStatPointSpread,
  getMaxAllowedStatPoints,
  getNatureById,
  getNatureStatShift,
  normalizeStatPointSpread,
} from "./natures";

const baseStats: StatBlock = {
  hp: 100,
  attack: 100,
  defense: 100,
  specialAttack: 100,
  specialDefense: 100,
  speed: 100,
};

describe("Pokemon Champions stat calculation", () => {
  it("adds the fixed IV bonus and EVs to neutral stats", () => {
    const stats = calculateChampionsStats(
      baseStats,
      { hp: 2, attack: 0, defense: 0, specialAttack: 32, specialDefense: 0, speed: 32 },
      getNatureById("hardy"),
    );

    expect(stats).toEqual({
      hp: 177,
      attack: 120,
      defense: 120,
      specialAttack: 152,
      specialDefense: 120,
      speed: 152,
    });
  });

  it("applies nature modifiers after the fixed bonus and EVs", () => {
    const stats = calculateChampionsStats(
      baseStats,
      { hp: 2, attack: 0, defense: 0, specialAttack: 32, specialDefense: 0, speed: 32 },
      getNatureById("modest"),
    );

    expect(stats.attack).toBe(108);
    expect(stats.specialAttack).toBe(167);
    expect(stats.hp).toBe(177);
  });

  it("caps an individual EV value at the Champions limit", () => {
    const stats = calculateChampionsStats(
      baseStats,
      { hp: 99, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      getNatureById("hardy"),
    );

    expect(CHAMPIONS_MAX_EV_PER_STAT).toBe(32);
    expect(CHAMPIONS_MAX_EV_TOTAL).toBe(66);
    expect(stats.hp).toBe(207);
  });

  it("caps an edited spread by both the per-stat and total limits", () => {
    const spread: StatBlock = {
      hp: 2,
      attack: 32,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 32,
    };

    expect(getMaxAllowedStatPoints(spread, "defense")).toBe(0);
    expect(clampStatPointSpread(spread, "defense", 12).defense).toBe(0);
    expect(clampStatPointSpread(spread, "attack", 99).attack).toBe(32);
  });

  it("describes only non-neutral nature changes", () => {
    const modest = getNatureById("modest");

    expect(getNatureStatShift(modest, "specialAttack")).toBe("up");
    expect(getNatureStatShift(modest, "attack")).toBe("down");
    expect(getNatureStatShift(modest, "hp")).toBeNull();
    expect(getNatureStatShift(getNatureById("hardy"), "attack")).toBeNull();
  });

  it("normalizes a partial spread against per-stat and total limits", () => {
    expect(
      normalizeStatPointSpread({
        hp: 40,
        attack: 30,
        speed: 12,
      }),
    ).toEqual({
      hp: 32,
      attack: 30,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 4,
    });
  });
});
