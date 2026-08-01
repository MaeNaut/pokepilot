import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  regulationMbSnapshotFixture,
  showdownMovesFixture,
  showdownPokedexFixture,
} from "../test/fixtures/showdownLegalityFixtures";
import { fetchPokemon } from "./pokeApi";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => String(payload),
  } as Response;
}

const pokeApiRotomFixture = {
  id: 10009,
  name: "rotom-wash",
  sprites: {
    front_default: "rotom-default.png",
    other: {
      "official-artwork": { front_default: "rotom-artwork.png" },
    },
    versions: {
      "generation-ix": {
        "scarlet-violet": { front_default: "rotom-icon.png" },
      },
    },
  },
  abilities: [{ ability: { name: "wrong-pokeapi-ability" } }],
  moves: [{ move: { name: "tackle" }, version_group_details: [] }],
  stats: [
    { base_stat: 1, stat: { name: "hp" } },
    { base_stat: 1, stat: { name: "attack" } },
    { base_stat: 1, stat: { name: "defense" } },
    { base_stat: 1, stat: { name: "special-attack" } },
    { base_stat: 1, stat: { name: "special-defense" } },
    { base_stat: 1, stat: { name: "speed" } },
  ],
  types: [{ slot: 1, type: { name: "normal" } }],
};

const pokeApiMegaScraftyFixture = {
  ...pokeApiRotomFixture,
  id: 10289,
  name: "scrafty-mega",
  sprites: {
    front_default: "mega-scrafty-default.png",
    other: {
      "official-artwork": { front_default: "mega-scrafty-artwork.png" },
    },
    versions: {
      "generation-ix": {
        "scarlet-violet": { front_default: null },
      },
    },
  },
};

describe("Showdown-primary Pokemon battle data", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.endsWith("/api/v2/pokemon/rotom-wash")) {
          return createResponse(pokeApiRotomFixture);
        }

        if (url.endsWith("/api/v2/pokemon/scrafty-mega")) {
          return createResponse(pokeApiMegaScraftyFixture);
        }

        if (url.endsWith("/pokedex.json")) {
          return createResponse(showdownPokedexFixture);
        }

        if (url.endsWith("/moves.json")) {
          return createResponse(showdownMovesFixture);
        }

        if (url.endsWith("/data/showdown-regulation-mb.json")) {
          return createResponse(regulationMbSnapshotFixture);
        }

        throw new Error(`Unexpected fixture URL: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Showdown stats, abilities, and legal move details while retaining PokeAPI art", async () => {
    const [pokemon, duplicatePokemon] = await Promise.all([
      fetchPokemon("rotom-wash"),
      fetchPokemon("rotom-wash"),
    ]);
    const requestedUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));

    expect(duplicatePokemon).toEqual(pokemon);
    expect(pokemon.source).toBe("showdown");
    expect(pokemon.types).toEqual(["electric", "water"]);
    expect(pokemon.baseStats).toEqual({
      hp: 50,
      attack: 65,
      defense: 107,
      specialAttack: 105,
      specialDefense: 107,
      speed: 86,
    });
    expect(pokemon.abilities).toEqual(["Levitate"]);
    expect(pokemon.moves?.map((move) => move.id).sort()).toEqual([
      "hydropump",
      "protect",
      "shadowball",
      "thunderbolt",
    ]);
    expect(pokemon.moves?.find((move) => move.id === "hydropump")).toMatchObject({
      type: "water",
      category: "Special",
      power: 110,
      accuracy: 80,
      pp: 5,
      description: "No additional effect.",
    });
    expect(pokemon.spriteUrl).toBe("rotom-artwork.png");
    expect(pokemon.iconSpriteUrl).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/champions/10009.png",
    );
    expect(pokemon.iconFallbackSpriteUrls).toEqual([
      "rotom-icon.png",
      "rotom-default.png",
    ]);
    expect(requestedUrls.some((url) => url.includes("/api/v2/move/"))).toBe(false);
    expect(
      requestedUrls.filter((url) => url.endsWith("/api/v2/pokemon/rotom-wash")),
    ).toHaveLength(1);
    expect(requestedUrls.filter((url) => url.endsWith("/pokedex.json"))).toHaveLength(1);
    expect(requestedUrls.filter((url) => url.endsWith("/moves.json"))).toHaveLength(1);
    expect(
      requestedUrls.filter((url) =>
        url.endsWith("/data/showdown-regulation-mb.json"),
      ),
    ).toHaveLength(1);
    expect(
      requestedUrls.some((url) => url.endsWith("/teambuilder-tables.js")),
    ).toBe(false);
  });

  it("uses a Champions icon before the generic sprite when Scarlet/Violet has none", async () => {
    const pokemon = await fetchPokemon("scrafty-mega");

    expect(pokemon.spriteUrl).toBe("mega-scrafty-artwork.png");
    expect(pokemon.iconSpriteUrl).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/champions/10289.png",
    );
    expect(pokemon.iconFallbackSpriteUrls).toEqual([
      "mega-scrafty-default.png",
    ]);
  });
});
