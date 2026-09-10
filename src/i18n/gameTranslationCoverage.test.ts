import { describe, expect, it } from "vitest";
import regulationMcSnapshotJson from "../../public/data/showdown-regulation-mc.json";
import {
  hasKoreanGameDescription,
  translateGameName,
  type GameDescriptionCategory,
  type GameTranslationCategory,
} from "./gameTranslations";

type RegulationMcSnapshot = {
  itemIds: string[];
  abilityByPokemon: Array<[string, string[]]>;
  moveByPokemon: Array<[string, string[]]>;
};

const regulationMcSnapshot =
  regulationMcSnapshotJson as unknown as RegulationMcSnapshot;
const missingFallback = "__MISSING_KOREAN_TRANSLATION__";
const koreanTextPattern = /[가-힣]/;

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function expectKoreanNames(category: GameTranslationCategory, ids: string[]) {
  const missing = ids.filter(
    (id) =>
      !koreanTextPattern.test(
        translateGameName("ko", category, id, missingFallback),
      ),
  );

  expect(missing).toEqual([]);
}

function expectKoreanDescriptions(
  category: GameDescriptionCategory,
  ids: string[],
) {
  const missing = ids.filter(
    (id) => !hasKoreanGameDescription(category, id),
  );

  expect(missing).toEqual([]);
}

describe("Regulation M-C Korean translation coverage", () => {
  const moveIds = unique(
    regulationMcSnapshot.moveByPokemon.flatMap(([, ids]) => ids),
  );
  const itemIds = unique(regulationMcSnapshot.itemIds);
  const abilityIds = unique(
    regulationMcSnapshot.abilityByPokemon.flatMap(([, ids]) => ids),
  );

  it("has Korean names for every selectable move, item, and ability", () => {
    expectKoreanNames("moves", moveIds);
    expectKoreanNames("items", itemIds);
    expectKoreanNames("abilities", abilityIds);
  });

  it("has Korean descriptions for every selectable move, item, and ability", () => {
    expectKoreanDescriptions("moves", moveIds);
    expectKoreanDescriptions("items", itemIds);
    expectKoreanDescriptions("abilities", abilityIds);
  });
});
