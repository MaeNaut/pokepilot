import { describe, expect, it } from "vitest";
import {
  itemFromIndexEntry,
  normalizeShowdownAbilityCatalog,
  normalizeShowdownItemCatalog,
} from "./showdownCatalog";

describe("Showdown item and ability catalogs", () => {
  it("normalizes Showdown items into asset-compatible picker entries", () => {
    const catalog = normalizeShowdownItemCatalog({
      schemaVersion: 1,
      items: [
        {
          showdownId: "charizarditey",
          assetId: "charizardite-y",
          name: "Charizardite Y",
          number: 678,
          description: "Allows Charizard to Mega Evolve.",
          shortDescription: "Mega Evolves Charizard into Mega Charizard Y.",
          isMegaStone: true,
        },
      ],
    });
    const entry = catalog.index[0];
    const item = itemFromIndexEntry(entry);

    expect(entry).toMatchObject({
      id: 678,
      name: "charizardite-y",
      showdownId: "charizarditey",
      displayName: "Charizardite Y",
      isMegaStone: true,
    });
    expect(item).toMatchObject({
      id: "charizardite-y",
      showdownId: "charizarditey",
      name: "Charizardite Y",
      category: "Mega Stones",
      effect: "Mega Evolves Charizard into Mega Charizard Y.",
    });
    expect(item.spriteUrl).toContain("/sprites/items/gen9/charizardite-y.png");
    expect(catalog.itemByLookup.get("charizarditey")).toEqual(item);
  });

  it("normalizes compact ability descriptions by canonical Showdown ID", () => {
    const abilities = normalizeShowdownAbilityCatalog({
      schemaVersion: 1,
      abilities: [
        {
          showdownId: "lightningrod",
          name: "Lightning Rod",
          number: 31,
          description: "Draws in Electric-type moves and grants immunity.",
          shortDescription: "Draws Electric moves; Electric immunity.",
        },
      ],
    });

    expect(abilities.get("lightningrod")).toEqual({
      id: "lightningrod",
      name: "Lightning Rod",
      effect: "Draws in Electric-type moves and grants immunity.",
      shortEffect: "Draws Electric moves; Electric immunity.",
    });
  });
});
