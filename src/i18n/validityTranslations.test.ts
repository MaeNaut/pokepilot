import { describe, expect, it } from "vitest";
import type { ValidityIssue } from "../utils/teamValidity";
import { translateGameName, translatePokemonName } from "./gameTranslations";
import { getUiTranslation } from "./translations";
import { localizeValidityIssue } from "./validityTranslations";

function createLocalization(locale: "en" | "ko") {
  return {
    t: (key: Parameters<typeof getUiTranslation>[1], variables?: Parameters<typeof getUiTranslation>[2]) =>
      getUiTranslation(locale, key, variables),
    gameName: (
      category: Parameters<typeof translateGameName>[1],
      id: string,
      fallback: string,
    ) => translateGameName(locale, category, id, fallback),
    pokemonName: (options: Parameters<typeof translatePokemonName>[1]) =>
      translatePokemonName(locale, options),
  };
}

describe("validity translations", () => {
  it("localizes stat names and EV limits", () => {
    const issue: ValidityIssue = {
      id: "ev-attack-0",
      code: "ev-stat",
      severity: "error",
      scope: "ev",
      message: "attack EV must be a whole number from 0 to 32.",
      values: { stat: "attack", max: 32 },
      slotIndex: 0,
    };

    expect(localizeValidityIssue(issue, createLocalization("ko"))).toBe(
      "공격 노력치 범위 오류 (0-32 정수)",
    );
  });

  it("localizes game-data names inside legality issues", () => {
    const issue: ValidityIssue = {
      id: "illegal-move-flamethrower-0",
      code: "illegal-move",
      severity: "error",
      scope: "move",
      message: "Flamethrower is not legal for this Pokemon.",
      values: { moveId: "flamethrower", moveName: "Flamethrower" },
      slotIndex: 0,
    };

    expect(localizeValidityIssue(issue, createLocalization("ko"))).toBe(
      "화염방사: 사용 불가 기술",
    );
  });
});
