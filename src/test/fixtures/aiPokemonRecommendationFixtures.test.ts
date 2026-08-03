import { describe, expect, it } from "vitest";
import { parseShowdownTeam } from "../../utils/showdownText";
import { aiTeamFixtures } from "./aiTeamFixtures";
import { aiPokemonRecommendationFixtures } from "./aiPokemonRecommendationFixtures";

describe("AI Pokemon-recommendation fixtures", () => {
  it("uses unique IDs and complete semantic expectations", () => {
    const ids = aiPokemonRecommendationFixtures.map((fixture) => fixture.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const fixture of aiPokemonRecommendationFixtures) {
      expect(fixture.schemaVersion).toBe(1);
      expect(fixture.expectedCandidateIds.length).toBeGreaterThan(0);
      expect(fixture.expectations.teamIdentities.length).toBeGreaterThan(0);
      expect(fixture.expectations.criticalObservations.length).toBeGreaterThan(
        0,
      );
      expect(fixture.expectations.forbiddenConclusions.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("removes the intended Pokemon from a production-hydratable team fixture", () => {
    for (const fixture of aiPokemonRecommendationFixtures) {
      const teamFixture = aiTeamFixtures.find(
        (candidate) => candidate.id === fixture.teamFixtureId,
      );

      expect(teamFixture, fixture.id).toBeDefined();

      const removedPokemon = parseShowdownTeam(teamFixture?.showdownText ?? "")[
        fixture.removedSlot
      ];

      expect(removedPokemon?.pokemonName, fixture.id).toBe(
        fixture.expectedRemovedPokemonName,
      );
    }
  });
});
