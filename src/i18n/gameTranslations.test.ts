import { describe, expect, it } from "vitest";
import {
  getKoreanCatalogCounts,
  translateGameDescription,
  translateGameName,
  translateMoveTag,
  translatePokemonFormName,
  translatePokemonName,
} from "./gameTranslations";

describe("Korean game translations", () => {
  it("ships a broad generated PokeAPI catalog", () => {
    expect(getKoreanCatalogCounts()).toMatchObject({
      pokemon: expect.any(Number),
      pokemonForms: expect.any(Number),
      moves: expect.any(Number),
      items: expect.any(Number),
      abilities: expect.any(Number),
      types: expect.any(Number),
      natures: 25,
    });
    expect(getKoreanCatalogCounts().pokemon).toBeGreaterThanOrEqual(1_000);
    expect(getKoreanCatalogCounts().moves).toBeGreaterThanOrEqual(900);
  });

  it("translates canonical game identifiers", () => {
    expect(translateGameName("ko", "moves", "protect", "Protect")).toBe("방어");
    expect(translateGameName("ko", "items", "leftovers", "Leftovers")).toBe(
      "먹다남은음식",
    );
    expect(translateGameName("ko", "abilities", "intimidate", "Intimidate")).toBe(
      "위협",
    );
    expect(translateGameName("ko", "types", "fire", "Fire")).toBe("불꽃");
  });

  it("translates post-PokeAPI override data", () => {
    expect(translateGameName("ko", "abilities", "eelevate", "Eelevate")).toBe(
      "천정부지",
    );
    expect(translateGameName("ko", "abilities", "firemane", "Fire Mane")).toBe(
      "불꽃의갈기",
    );
    expect(
      translateGameDescription(
        "ko",
        "abilities",
        "eelevate",
        "This Pokemon is immune to Ground; +1 to highest stat if it KOes another Pokemon.",
      ),
    ).toContain("가장 높은 능력");
    expect(
      translateGameDescription(
        "ko",
        "abilities",
        "firemane",
        "Boosts the power of the Pokemon's Fire-type moves by 50%.",
      ),
    ).toBe("불꽃타입 기술의 위력이 1.5배가 된다.");
    expect(
      translateGameName("ko", "abilities", "innardsout", "Innards Out"),
    ).toBe("내용물분출");
  });

  it("translates descriptions and PokePilot move tags", () => {
    expect(
      translateGameDescription(
        "ko",
        "moves",
        "flamethrower",
        "The target is scorched with an intense blast of fire.",
      ),
    ).toContain("불꽃");
    expect(translateMoveTag("ko", "Contact")).toBe("접촉");
    expect(translateMoveTag("ko", "Priority +1")).toBe("우선도 +1");
    expect(translateMoveTag("en", "Contact")).toBe("Contact");
  });

  it("combines species and form names without duplicating the species", () => {
    expect(
      translatePokemonName("ko", {
        id: "articuno-galar",
        speciesId: "articuno",
        fallback: "Articuno Galar",
        formLabel: "Galar",
        formKind: "regional",
      }),
    ).toBe("가라르 프리져");
    expect(
      translatePokemonName("ko", {
        id: "rotom-wash",
        speciesId: "rotom",
        fallback: "Rotom Wash",
      }),
    ).toBe("워시로토무");
    expect(translatePokemonFormName("ko", "aegislash-shield", "Shield Forme")).toBe(
      "실드폼",
    );
  });

  it("uses concise prefix labels for picker-facing regional and gender forms", () => {
    expect(
      translatePokemonName("ko", {
        id: "arcanine-hisui",
        speciesId: "arcanine",
        fallback: "Arcanine Hisui",
        formLabel: "Hisui",
        formKind: "regional",
      }),
    ).toBe("히스이 윈디");
    expect(
      translatePokemonName("ko", {
        id: "tauros-paldea-aqua-breed",
        speciesId: "tauros",
        fallback: "Tauros Paldea Aqua Breed",
        formLabel: "Paldea Aqua",
        formKind: "regional",
      }),
    ).toBe("팔데아 켄타로스 워터종");
    expect(
      translatePokemonName("ko", {
        id: "meowstic-female",
        speciesId: "meowstic",
        fallback: "Meowstic Female",
        formLabel: "Female",
        formKind: "gender",
      }),
    ).toBe("암컷 냐오닉스");
  });

  it("can suppress default battle-state form labels", () => {
    expect(
      translatePokemonName("ko", {
        id: "aegislash-shield",
        speciesId: "aegislash",
        fallback: "Aegislash",
        includeForm: false,
        formLabel: "Shield",
        formKind: "form",
      }),
    ).toBe("킬가르도");
  });

  it("leaves English and missing entries unchanged", () => {
    expect(translateGameName("en", "moves", "protect", "Protect")).toBe("Protect");
    expect(translateGameName("ko", "moves", "future-custom-move", "Future Move")).toBe(
      "Future Move",
    );
  });
});
