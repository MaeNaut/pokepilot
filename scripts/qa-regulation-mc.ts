import { readFile } from "node:fs/promises";
import { hasKoreanGameDescription, translateGameName } from "../src/i18n/gameTranslations";
import { getPokeApiLookupId, getPreferredPokeApiId, toPokemonLookupId } from "../src/utils/pokemonAliases";

const load = async (file: string) => JSON.parse(await readFile(new URL(`../public/data/${file}`, import.meta.url), "utf8"));
const current = await load("showdown-regulation-mc.json");
const previous = await load("showdown-regulation-mb.json");
const battle = await load("showdown-battle-mc.json");
const added: string[] = current.pokemonIds.filter((id: string) => !previous.pokemonIds.includes(id));
const categories = {
  moves: [...new Set<string>(current.moveByPokemon.flatMap(([, ids]: [string, string[]]) => ids))],
  abilities: [...new Set<string>(current.abilityByPokemon.flatMap(([, ids]: [string, string[]]) => ids))],
  items: current.itemIds as string[],
};
console.log(JSON.stringify({ added, counts: { before: previous.pokemonIds.length, after: current.pokemonIds.length }, missing: Object.fromEntries(Object.entries(categories).map(([category, ids]) => [category, {
  names: ids.filter(id => translateGameName("ko", category as "moves", id, "MISSING") === "MISSING"),
  descriptions: ids.filter(id => !hasKoreanGameDescription(category as "moves", id)),
}])) }, null, 2));
for (const id of added) {
  const species = battle.species[id];
  const canonicalLookup = getPreferredPokeApiId(species.name) ?? toPokemonLookupId(species.name);
  const lookup = getPokeApiLookupId(canonicalLookup);
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${lookup}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) { console.log(JSON.stringify({ id, lookup, api: response.status })); continue; }
    const p = await response.json();
    const urls = [
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/champions/${p.id}.png`,
      p.sprites.versions?.["generation-ix"]?.["scarlet-violet"]?.front_default,
      p.sprites.front_default,
      p.sprites.other?.["official-artwork"]?.front_default,
    ].filter(Boolean);
    const statuses = await Promise.all(urls.map(async url => ({ url, status: (await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) })).status })));
    console.log(JSON.stringify({ id, lookup, images: statuses }));
  } catch (error) { console.log(JSON.stringify({ id, error: String(error) })); }
}
