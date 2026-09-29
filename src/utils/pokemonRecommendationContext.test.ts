import { describe, expect, it } from "vitest";
import { translateGameName, translatePokemonName } from "../i18n/gameTranslations";
import type { PokemonIndexEntry, TeamMember } from "../types";
import { createEmptyBuildState } from "./teamBuildState";
import { analyzeTeam } from "./teamDiagnostics";
import { createLocalizedRecommendationContext } from "./pokemonRecommendationContext";

const entry: PokemonIndexEntry = {
  name: "meowstic-female", showdownId: "meowsticf", displayName: "Meowstic",
  speciesKey: "meowstic", sortNumber: 678, types: ["psychic"], abilities: ["Competitive"],
  formKind: "gender", formLabel: "Female", isSelectorOption: true,
};
const member: TeamMember = { id: entry.name, name: "Meowstic", types: ["psychic"], roles: [], abilities: ["Competitive"] };

describe.each(["en", "ko"] as const)("localized recommendation context (%s)", (locale) => {
  it("keeps gender forms and localized types/abilities consistent in options and replacement targets", () => {
    const buildState = createEmptyBuildState();
    const context = createLocalizedRecommendationContext({
      pokemonIndex: [entry], abilityIndex: [{ id: "competitive", name: "Competitive", effect: "Raises Special Attack when a stat is lowered." }],
      legality: null, team: [member], selectedSlot: 0, buildState,
      diagnostics: analyzeTeam([member], buildState),
      gameName: (category, id, fallback) => translateGameName(locale, category, id, fallback),
      pokemonName: (options) => translatePokemonName(locale, options),
    });
    const expectedName = translatePokemonName(locale, {
      id: entry.name, speciesId: entry.speciesKey, fallback: "Meowstic Female",
      includeForm: true, formKind: "gender", formLabel: "Female",
    });
    expect(context.options[0]).toMatchObject({
      displayName: expectedName,
      typeDisplayNames: [translateGameName(locale, "types", "psychic", "psychic")],
      abilities: [expect.objectContaining({
        displayName: translateGameName(locale, "abilities", "competitive", "Competitive"),
        effect: "Raises Special Attack when a stat is lowered.",
      })],
    });
    expect(context.targets[0]).toMatchObject({ mode: "replacement", currentDisplayName: expectedName });
  });

  it("retains the saved name for a member missing from the current index", () => {
    const buildState = createEmptyBuildState();
    const unknown = { ...member, id: "custom-pokemon", name: "Saved Pokemon" };
    const context = createLocalizedRecommendationContext({
      pokemonIndex: [], abilityIndex: [], legality: null, team: [unknown], selectedSlot: 0,
      buildState, diagnostics: analyzeTeam([unknown], buildState),
      gameName: (category, id, fallback) => translateGameName(locale, category, id, fallback),
      pokemonName: (options) => translatePokemonName(locale, options),
    });
    expect(context.options).toEqual([]);
    expect(context.targets[0]?.currentDisplayName).toBe("Saved Pokemon");
  });
});
