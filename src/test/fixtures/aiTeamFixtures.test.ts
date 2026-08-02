import { describe, expect, it } from "vitest";
import { CHAMPIONS_MAX_EV_PER_STAT, CHAMPIONS_MAX_EV_TOTAL } from "../../data/natures";
import { parseShowdownTeam } from "../../utils/showdownText";
import {
  aiTeamDoublesFixtures,
  aiTeamBaselineFixtures,
  aiTeamFixtures,
  aiTeamSinglesFixtures,
  aiTeamStrategyFixtures,
} from "./aiTeamFixtures";

describe("AI Regulation M-B team fixtures", () => {
  it("keeps the balanced baseline separate from deep strategy regressions", () => {
    expect(aiTeamBaselineFixtures).toHaveLength(20);
    expect(aiTeamSinglesFixtures).toHaveLength(10);
    expect(aiTeamDoublesFixtures).toHaveLength(10);
    expect(aiTeamStrategyFixtures).toHaveLength(4);
    expect(aiTeamFixtures).toHaveLength(24);
    expect(
      aiTeamFixtures.filter((fixture) => fixture.battleFormat === "singles"),
    ).toHaveLength(10);
    expect(
      aiTeamFixtures.filter((fixture) => fixture.battleFormat === "doubles"),
    ).toHaveLength(14);
  });

  it("keeps published evidence separate from constructed boundary cases", () => {
    expect(
      aiTeamFixtures.filter((fixture) => fixture.source.origin === "published"),
    ).toHaveLength(19);
    expect(
      aiTeamFixtures.filter(
        (fixture) => fixture.source.origin === "constructed",
      ),
    ).toHaveLength(5);

    for (const fixture of aiTeamFixtures) {
      if (fixture.source.origin === "published") {
        expect(fixture.source.url).toMatch(/^https:\/\//);
      } else {
        expect(fixture.source.notes).toBeTruthy();
      }
    }
  });

  it("uses unique stable IDs and complete evaluation expectations", () => {
    const ids = aiTeamFixtures.map((fixture) => fixture.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const fixture of aiTeamFixtures) {
      expect(fixture.schemaVersion).toBe(1);
      expect(fixture.regulation).toBe("M-B");
      expect(fixture.source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fixture.expectations.teamIdentities.length).toBeGreaterThan(0);
      expect(fixture.expectations.criticalObservations.length).toBeGreaterThan(
        0,
      );
      expect(fixture.expectations.forbiddenConclusions.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("parses every fixture as six complete Pokemon Champions sets", () => {
    for (const fixture of aiTeamFixtures) {
      const parsedTeam = parseShowdownTeam(fixture.showdownText);

      expect(parsedTeam, fixture.id).toHaveLength(6);

      for (const pokemon of parsedTeam) {
        expect(pokemon.pokemonName, fixture.id).toBeTruthy();
        expect(pokemon.itemName, `${fixture.id}: ${pokemon.pokemonName}`).toBeTruthy();
        expect(pokemon.ability, `${fixture.id}: ${pokemon.pokemonName}`).toBeTruthy();
        expect(pokemon.nature, `${fixture.id}: ${pokemon.pokemonName}`).toBeTruthy();
        expect(pokemon.moves, `${fixture.id}: ${pokemon.pokemonName}`).toHaveLength(
          4,
        );
      }
    }
  });

  it("keeps Stat Points within Champions per-stat and total limits", () => {
    for (const fixture of aiTeamFixtures) {
      for (const pokemon of parseShowdownTeam(fixture.showdownText)) {
        const evValues = Object.values(pokemon.evs ?? {});
        const total = evValues.reduce((sum, value) => sum + value, 0);

        expect(
          evValues.every(
            (value) => value >= 0 && value <= CHAMPIONS_MAX_EV_PER_STAT,
          ),
          `${fixture.id}: ${pokemon.pokemonName}`,
        ).toBe(true);
        expect(total, `${fixture.id}: ${pokemon.pokemonName}`).toBeLessThanOrEqual(
          CHAMPIONS_MAX_EV_TOTAL,
        );
      }
    }
  });

  it("respects Item Clause within every team", () => {
    for (const fixture of aiTeamFixtures) {
      const items = parseShowdownTeam(fixture.showdownText).map(
        (pokemon) => pokemon.itemName?.toLowerCase(),
      );

      expect(new Set(items).size, fixture.id).toBe(items.length);
    }
  });
});
