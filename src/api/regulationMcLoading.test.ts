import { afterEach, describe, expect, it, vi } from "vitest";
import battle from "../../public/data/showdown-battle-mc.json";
import legality from "../../public/data/showdown-regulation-mc.json";
import previous from "../../public/data/showdown-regulation-mb.json";
import { fetchPokemon } from "./pokeApi";
import { fetchPokemonIndex } from "./pokemonIndex";
import { getLegalMoves, hydrateShowdownLegalitySnapshot, type ShowdownLegalityPayload } from "./showdownLegality";
import { getBattleFormGroup } from "../data/battleForms";
import { translatePokemonName } from "../i18n/gameTranslations";
import { resolveImportedPokemonId } from "../utils/showdownImport";
import { formatShowdownTeam, parseShowdownTeam } from "../utils/showdownText";
import { createEmptyBuildState } from "../utils/teamBuildState";
import {
  getPokemonNameFallback,
  shouldIncludePokemonForm,
} from "../utils/pokemonDisplay";

afterEach(() => vi.unstubAllGlobals());
describe("M-C production loading", () => {
  it("loads every new form without PokeAPI and has legal moves", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (String(input).includes("pokeapi.co")) throw new Error("PokeAPI unavailable");
      const data = String(input).includes("showdown-battle") ? battle : legality;
      return { ok: true, json: async () => data };
    }));
    const index = await fetchPokemonIndex();
    for (const id of legality.pokemonIds.filter(id => !previous.pokemonIds.includes(id))) {
      const entry = index.find(entry => entry.showdownId === id);
      expect(entry, id).toBeDefined();
      const pokemon = await fetchPokemon(entry!.name);
      expect(pokemon.showdownId, id).toBe(id);
      expect(pokemon.moves?.length, id).toBeGreaterThan(0);
      expect(pokemon.baseStats?.hp, id).toBeGreaterThan(1);
    }
  });
  it("round-trips every new M-C entry through canonical Showdown text", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (String(input).includes("pokeapi.co")) throw new Error("PokeAPI unavailable");
      const data = String(input).includes("showdown-battle") ? battle : legality;
      return { ok: true, json: async () => data };
    }));
    const index = await fetchPokemonIndex();
    const buildState = createEmptyBuildState();

    for (const showdownId of legality.pokemonIds.filter(
      id => !previous.pokemonIds.includes(id),
    )) {
      const entry = index.find(candidate => candidate.showdownId === showdownId)!;
      const member = await fetchPokemon(entry.name);
      const text = formatShowdownTeam([member], buildState);
      const parsed = parseShowdownTeam(text)[0];

      expect(parsed.pokemonName, showdownId).toBe(entry.showdownName);
      expect(
        resolveImportedPokemonId(parsed.pokemonName, index, parsed.gender),
        showdownId,
      ).toBe(entry.name);
    }
  });
  it("does not merge male Indeedee moves into the female form", () => {
    const snapshot = hydrateShowdownLegalitySnapshot(legality as unknown as ShowdownLegalityPayload);
    const expected = new Map(legality.moveByPokemon as [string, string[]][]).get("indeedeef");
    expect([...getLegalMoves(snapshot, "indeedee-female", "indeedee")!].sort()).toEqual([...expected!].sort());
  });
  it("rejects a previous regulation snapshot", () => {
    expect(() => hydrateShowdownLegalitySnapshot(previous as unknown as ShowdownLegalityPayload)).toThrow();
  });
  it("keeps fixed forms in search and battle states behind form controls", async () => {
    const index = await fetchPokemonIndex();
    for (const [prefix, count] of [
      ["indeedee", 2],
      ["toxtricity", 2],
      ["squawkabilly", 2],
    ] as const) {
      expect(index.filter(entry => entry.showdownId?.startsWith(prefix) && entry.isSelectorOption && legality.pokemonIds.includes(entry.showdownId))).toHaveLength(count);
    }
    expect(getBattleFormGroup("indeedee")).toBeUndefined();
    expect(getBattleFormGroup("toxtricity")).toBeUndefined();
    expect(getBattleFormGroup("squawkabilly")).toBeUndefined();
    expect(getBattleFormGroup("pyroar")?.options.map((option) => option.pokemonId))
      .toEqual(["pyroar-male", "pyroar-female"]);
    expect(index.find(entry => entry.name === "squawkabilly-blue")?.isSelectorOption).toBe(false);
    expect(index.find(entry => entry.name === "squawkabilly-white")?.isSelectorOption).toBe(false);
    for (const id of [
      "indeedee-male",
      "indeedee-female",
      "toxtricity",
      "toxtricity-low-key",
      "squawkabilly",
      "squawkabilly-yellow",
    ]) {
      const entry = index.find(candidate => candidate.name === id)!;
      const includeForm = shouldIncludePokemonForm(entry);
      expect(translatePokemonName("ko", {
        id: entry.name,
        speciesId: entry.speciesKey,
        fallback: getPokemonNameFallback(entry, includeForm),
        includeForm,
        formLabel: entry.formLabel,
        formKind: entry.formKind,
      })).not.toMatch(/[A-Za-z]/);
    }
    expect(index.find(entry => entry.name === "farfetchd")?.displayName).toBe("Farfetch’d");
    expect(index.find(entry => entry.name === "mr-mime")?.displayName).toBe("Mr. Mime");
    expect(index.find(entry => entry.name === "sirfetchd")?.displayName).toBe("Sirfetch’d");
    const snapshot = hydrateShowdownLegalitySnapshot(legality as unknown as ShowdownLegalityPayload);
    expect(battle.species.indeedee.baseStats.spa).toBe(105);
    expect(battle.species.indeedeef.baseStats.spa).toBe(95);
    expect(getLegalMoves(snapshot, "toxtricity-amped", "toxtricity")?.has("shiftgear")).toBe(true);
    expect(getLegalMoves(snapshot, "toxtricity-low-key", "toxtricity")?.has("shiftgear")).toBe(false);
    expect(getLegalMoves(snapshot, "toxtricity-low-key", "toxtricity")?.has("magneticflux")).toBe(true);
    for (const [first, second] of [["squawkabilly", "squawkabillyblue"], ["squawkabillyyellow", "squawkabillywhite"]] as const) {
      expect(battle.species[first].baseStats).toEqual(battle.species[second].baseStats);
      expect(battle.species[first].abilities).toEqual(battle.species[second].abilities);
      expect(getLegalMoves(snapshot, first, "squawkabilly")).toEqual(getLegalMoves(snapshot, second, "squawkabilly"));
    }
    expect(battle.species.squawkabilly.abilities.H).toBe("Guts");
    expect(battle.species.squawkabillyyellow.abilities.H).toBe("Sheer Force");
  });
  it("keeps canonical IDs when PokeAPI uses asset-specific form IDs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = String(input);
      const segments = url.split("/");
      const name = segments[segments.length - 1];
      return {
        ok: true,
        json: async () => ({
          id: name.startsWith("toxtricity") ? 849 : 931,
          name,
          sprites: { front_default: `${name}.png` },
          abilities: [], moves: [], stats: [], types: [],
        }),
      };
    }));
    expect((await fetchPokemon("toxtricity")).id).toBe("toxtricity");
    expect((await fetchPokemon("squawkabilly-yellow")).id).toBe("squawkabilly-yellow");
  });
  it.each(["furfrou-natural", "gourgeist-average", "lycanroc-midday"])(
    "loads the default %s form through its Showdown species",
    async (pokemonId) => {
      vi.stubGlobal("fetch", vi.fn(async (input: string) => {
        if (String(input).includes("pokeapi.co")) throw new Error("PokeAPI unavailable");
        return { ok: true, json: async () => String(input).includes("showdown-battle") ? battle : legality };
      }));

      const member = await fetchPokemon(pokemonId);
      expect(member.id).toBe(pokemonId);
      expect(member.moves?.length).toBeGreaterThan(0);
      expect(member.baseStats?.hp).toBeGreaterThan(1);
    },
  );

  it("loads Pyroar's female art with the shared battle data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes("pokeapi.co")) {
        expect(url).toContain("/pokemon/pyroar-male");
        return {
          ok: true,
          json: async () => ({
            id: 668,
            name: "pyroar-male",
            sprites: {
              front_default: "male.png",
              front_female: "female.png",
              other: {
                home: { front_female: "female-home.png" },
                "official-artwork": { front_default: "male-art.png" },
              },
            },
          }),
        };
      }
      return { ok: true, json: async () => url.includes("showdown-battle") ? battle : legality };
    }));

    const female = await fetchPokemon("pyroar-female");
    expect(female).toMatchObject({
      id: "pyroar-female",
      showdownId: "pyroar",
      showdownGender: "F",
      source: "showdown",
      spriteUrl: "female-home.png",
      abilities: ["Rivalry", "Unnerve", "Moxie"],
    });
    expect(female.baseStats?.hp).toBe(battle.species.pyroar.baseStats.hp);
    expect(female.moves?.length).toBeGreaterThan(0);
  });

  it("keeps male Pyroar's base battle data distinct from its Mega form", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes("pokeapi.co")) {
        return {
          ok: true,
          json: async () => ({
            id: 668,
            name: "pyroar-male",
            sprites: { front_default: "male.png" },
          }),
        };
      }
      return { ok: true, json: async () => url.includes("showdown-battle") ? battle : legality };
    }));

    const male = await fetchPokemon("pyroar-male");
    expect(male.showdownId).toBe("pyroar");
    expect(male.abilities).toEqual(["Rivalry", "Unnerve", "Moxie"]);
    expect(male.baseStats).toMatchObject({
      hp: battle.species.pyroar.baseStats.hp,
      attack: battle.species.pyroar.baseStats.atk,
      specialAttack: battle.species.pyroar.baseStats.spa,
      speed: battle.species.pyroar.baseStats.spe,
    });
  });

  it("requests the canonical Meowstic Mega art and uses the matching Showdown form", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes("pokeapi.co")) {
        expect(url).toContain("/pokemon/meowstic-female-mega");
        return {
          ok: true,
          json: async () => ({
            id: 10326,
            name: "meowstic-female-mega",
            sprites: {
              front_default: null,
              other: { "official-artwork": { front_default: "female-mega-art.png" } },
            },
          }),
        };
      }
      return { ok: true, json: async () => url.includes("showdown-battle") ? battle : legality };
    }));

    const femaleMega = await fetchPokemon("meowstic-female-mega");
    expect(femaleMega).toMatchObject({
      id: "meowstic-female-mega",
      showdownId: "meowsticfmega",
      spriteUrl: "female-mega-art.png",
    });
  });

  it("uses a valid gender-specific image when PokeAPI is temporarily unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes("pokeapi.co")) throw new Error("PokeAPI unavailable");
      return { ok: true, json: async () => url.includes("showdown-battle") ? battle : legality };
    }));

    const female = await fetchPokemon("meowstic-female");
    expect(female.showdownId).toBe("meowsticf");
    expect(female.spriteUrl).toContain("/official-artwork/10025.png");
    expect(female.iconSpriteUrl).toContain("/champions/10025.png");
  });
});
