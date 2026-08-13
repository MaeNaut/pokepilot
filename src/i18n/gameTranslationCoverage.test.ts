import { describe, expect, it } from "vitest";
import regulationMbSnapshotJson from "../../public/data/showdown-regulation-mb.json";
import {
  translateGameDescription,
  translateGameName,
  type GameDescriptionCategory,
  type GameTranslationCategory,
} from "./gameTranslations";

type RegulationMbSnapshot = {
  itemIds: string[];
  abilityByPokemon: Array<[string, string[]]>;
  moveByPokemon: Array<[string, string[]]>;
};

const regulationMbSnapshot =
  regulationMbSnapshotJson as unknown as RegulationMbSnapshot;
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
    (id) =>
      !koreanTextPattern.test(
        translateGameDescription("ko", category, id, missingFallback),
      ),
  );

  expect(missing).toEqual([]);
}

describe("Regulation M-B Korean translation coverage", () => {
  const moveIds = unique(
    regulationMbSnapshot.moveByPokemon.flatMap(([, ids]) => ids),
  );
  const itemIds = unique(regulationMbSnapshot.itemIds);
  const abilityIds = unique(
    regulationMbSnapshot.abilityByPokemon.flatMap(([, ids]) => ids),
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
