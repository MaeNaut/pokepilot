import { describe, expect, it } from "vitest";
import { environmentSourceKey, resolveAutomaticEnvironment, type EnvironmentSources } from "./automaticEnvironment";

function sources(player = "", opponent = ""): EnvironmentSources {
  return {
    player: { identity: player ? "player" : "", ability: player, speed: 100 },
    opponent: { identity: opponent ? "opponent" : "", ability: opponent, speed: 80 },
  };
}

describe("automatic calculator environment", () => {
  it.each([
    ["Sand Stream", "sand", "none"], ["Drought", "sun", "none"],
    ["Drizzle", "rain", "none"], ["Snow Warning", "snow", "none"],
    ["Electric Surge", "none", "electric"], ["Grassy Surge", "none", "grassy"],
    ["Psychic Surge", "none", "psychic"], ["Misty Surge", "none", "misty"],
    ["Orichalcum Pulse", "sun", "none"], ["Hadron Engine", "none", "electric"],
  ])("handles %s from either side", (ability, weather, terrain) => {
    expect(resolveAutomaticEnvironment(sources(ability))).toEqual({ weather, terrain });
    expect(resolveAutomaticEnvironment(sources("", ability))).toEqual({ weather, terrain });
  });
  it("resets after removing setters without treating on-hit abilities as entry effects", () => {
    expect(resolveAutomaticEnvironment(sources("Intimidate", "Seed Sower"), sources("Sand Stream", "Grassy Surge")))
      .toEqual({ weather: "none", terrain: "none" });
  });
  it("keeps the remaining source and resolves weather and terrain independently", () => {
    expect(resolveAutomaticEnvironment(sources("Sand Stream", "Psychic Surge")))
      .toEqual({ weather: "sand", terrain: "psychic" });
    expect(resolveAutomaticEnvironment(sources("Intimidate", "Drizzle"), sources("Sand Stream", "Drizzle")).weather).toBe("rain");
  });
  it("uses the slower simultaneous setter, or the newly selected setter", () => {
    expect(resolveAutomaticEnvironment(sources("Drought", "Drizzle")).weather).toBe("rain");
    expect(resolveAutomaticEnvironment(sources("Sand Stream", "Drizzle"), sources("Drought", "Drizzle")).weather).toBe("sand");
    expect(resolveAutomaticEnvironment(sources("Grassy Surge", "Psychic Surge")).terrain).toBe("psychic");
  });
  it("changes the selection key for slots/abilities but not ordinary stat adjustments", () => {
    const original = sources("Sand Stream").player;
    expect(environmentSourceKey({ ...original, speed: 200 })).toBe(environmentSourceKey(original));
    expect(environmentSourceKey({ ...original, identity: "another-slot" })).not.toBe(environmentSourceKey(original));
    expect(environmentSourceKey({ ...original, ability: "Unnerve" })).not.toBe(environmentSourceKey(original));
  });
});
