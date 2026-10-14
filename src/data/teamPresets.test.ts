import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEAM_PRESETS } from "./teamPresets";
import { parseShowdownTeam } from "../utils/showdownText";

describe("public team presets", () => {
  it("uses the canonical six-member public team without duplicating its sets", () => {
    const preset = TEAM_PRESETS[0];
    expect(preset.showdownText).toBe(readFileSync(new URL("../../public/help/kabamanda-team.txt", import.meta.url), "utf8"));
    expect(preset.battleFormat).toBe("singles");
    expect(preset.pokemon).toHaveLength(6);
    expect(preset.pokemon.every((pokemon) => pokemon.iconSpriteUrl.endsWith(`${pokemon.pokemonId}.png`))).toBe(true);
    expect(preset.pokemon[2].pokemonId).toBe("lucario-mega-z");
    expect(parseShowdownTeam(preset.showdownText).map(set => set.pokemonName)).toEqual([
      "Hippowdon", "Salamence-Mega", "Lucario-Mega-Z", "Archaludon", "Meowscarada", "Primarina",
    ]);
  });
});
