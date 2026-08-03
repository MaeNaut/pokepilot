import { describe, expect, it } from "vitest";
import { parseShowdownTeam } from "../../utils/showdownText";
import { aiTeamFixtures } from "./aiTeamFixtures";
import { aiPokemonAnalysisFixtures } from "./aiPokemonAnalysisFixtures";

describe("AI Pokemon-analysis fixtures", () => {
  it("uses unique IDs and complete semantic expectations", () => {
    const ids = aiPokemonAnalysisFixtures.map((fixture) => fixture.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const fixture of aiPokemonAnalysisFixtures) {
      expect(fixture.schemaVersion).toBe(1);
      expect(fixture.expectations.teamIdentities.length).toBeGreaterThan(0);
      expect(fixture.expectations.criticalObservations.length).toBeGreaterThan(
        0,
      );
      expect(fixture.expectations.forbiddenConclusions.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("points to the intended Pokemon in a production-hydratable team fixture", () => {
    for (const fixture of aiPokemonAnalysisFixtures) {
      const teamFixture = aiTeamFixtures.find(
        (candidate) => candidate.id === fixture.teamFixtureId,
      );

      expect(teamFixture, fixture.id).toBeDefined();

      const selectedPokemon = parseShowdownTeam(
        teamFixture?.showdownText ?? "",
      )[fixture.selectedSlot];

      expect(selectedPokemon?.pokemonName, fixture.id).toBe(
        fixture.expectedPokemonName,
      );
    }
  });
});
