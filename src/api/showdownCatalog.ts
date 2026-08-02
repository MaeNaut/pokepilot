import type { ItemIndexEntry, PokemonAbility, PokemonItem } from "../types";
import { cleanLegacyDataCaches } from "./legacyDataCache";
import { normalizeShowdownId } from "./showdownIds";

type RawShowdownItemEntry = {
  showdownId: string;
  assetId: string;
  name: string;
  number: number;
  description: string;
  shortDescription: string;
  isMegaStone: boolean;
};

type RawShowdownAbilityEntry = {
  showdownId: string;
  name: string;
  number: number;
  description: string;
  shortDescription: string;
};

type ShowdownItemCatalogPayload = {
  schemaVersion: number;
  items: RawShowdownItemEntry[];
};

type ShowdownAbilityCatalogPayload = {
  schemaVersion: number;
  abilities: RawShowdownAbilityEntry[];
};

type ItemCatalog = {
  index: ItemIndexEntry[];
  itemByLookup: Map<string, PokemonItem>;
};

const POKEAPI_ITEM_SPRITES_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";
const POKEAPI_GEN9_ITEM_SPRITES_URL = `${POKEAPI_ITEM_SPRITES_URL}/gen9`;
const ITEM_CATALOG_URL = "/data/showdown-items.json";
const ABILITY_CATALOG_URL = "/data/showdown-abilities.json";

let itemCatalogPromise: Promise<ItemCatalog> | null = null;
let abilityCatalogPromise: Promise<Map<string, PokemonAbility>> | null = null;

function getItemSpriteUrl(assetId: string) {
  return `${POKEAPI_GEN9_ITEM_SPRITES_URL}/${assetId}.png`;
}

function getItemFallbackSpriteUrl(assetId: string) {
  return `${POKEAPI_ITEM_SPRITES_URL}/${assetId}.png`;
}

function createPokemonItem(entry: RawShowdownItemEntry): PokemonItem {
  return {
    id: entry.assetId,
    showdownId: entry.showdownId,
    name: entry.name,
    spriteUrl: getItemSpriteUrl(entry.assetId),
    fallbackSpriteUrl: getItemFallbackSpriteUrl(entry.assetId),
    category: entry.isMegaStone ? "Mega Stones" : undefined,
    effect: entry.shortDescription || entry.description || undefined,
  };
}

function addItemLookup(
  itemByLookup: Map<string, PokemonItem>,
  value: string,
  item: PokemonItem,
) {
  const lookup = normalizeShowdownId(value);

  if (lookup) {
    itemByLookup.set(lookup, item);
  }
}

export function normalizeShowdownItemCatalog(
  payload: ShowdownItemCatalogPayload,
): ItemCatalog {
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.items)) {
    throw new Error("Unsupported Showdown item catalog.");
  }

  const itemByLookup = new Map<string, PokemonItem>();
  const index = payload.items.map((entry) => {
    const item = createPokemonItem(entry);
    const indexEntry: ItemIndexEntry = {
      id: entry.number,
      name: entry.assetId,
      showdownId: entry.showdownId,
      displayName: entry.name,
      isMegaStone: entry.isMegaStone,
      effect: item.effect,
      spriteUrl: item.spriteUrl,
      fallbackSpriteUrl: item.fallbackSpriteUrl,
    };

    addItemLookup(itemByLookup, entry.showdownId, item);
    addItemLookup(itemByLookup, entry.assetId, item);
    addItemLookup(itemByLookup, entry.name, item);

    return indexEntry;
  });

  return { index, itemByLookup };
}

export function normalizeShowdownAbilityCatalog(
  payload: ShowdownAbilityCatalogPayload,
) {
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.abilities)) {
    throw new Error("Unsupported Showdown ability catalog.");
  }

  return new Map(
    payload.abilities.map((entry) => [
      normalizeShowdownId(entry.showdownId),
      {
        id: entry.showdownId,
        name: entry.name,
        effect: entry.description || undefined,
        shortEffect: entry.shortDescription || entry.description || undefined,
      } satisfies PokemonAbility,
    ]),
  );
}

async function fetchCatalog<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Showdown catalog request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

async function loadItemCatalog() {
  cleanLegacyDataCaches();

  if (!itemCatalogPromise) {
    itemCatalogPromise = fetchCatalog<ShowdownItemCatalogPayload>(ITEM_CATALOG_URL)
      .then(normalizeShowdownItemCatalog)
      .catch((error) => {
        itemCatalogPromise = null;
        throw error;
      });
  }

  return itemCatalogPromise;
}

async function loadAbilityCatalog() {
  cleanLegacyDataCaches();

  if (!abilityCatalogPromise) {
    abilityCatalogPromise = fetchCatalog<ShowdownAbilityCatalogPayload>(
      ABILITY_CATALOG_URL,
    )
      .then(normalizeShowdownAbilityCatalog)
      .catch((error) => {
        abilityCatalogPromise = null;
        throw error;
      });
  }

  return abilityCatalogPromise;
}

export function itemFromIndexEntry(entry: ItemIndexEntry): PokemonItem {
  return {
    id: entry.name,
    showdownId: entry.showdownId,
    name: entry.displayName,
    spriteUrl: entry.spriteUrl,
    fallbackSpriteUrl: entry.fallbackSpriteUrl,
    category: entry.isMegaStone ? "Mega Stones" : undefined,
    effect: entry.effect,
  };
}

export async function fetchItemIndex() {
  return (await loadItemCatalog()).index;
}

export async function fetchAbilityIndex() {
  return [...(await loadAbilityCatalog()).values()];
}

export async function fetchItem(nameOrId: string) {
  const lookup = normalizeShowdownId(nameOrId);

  if (!lookup) {
    throw new Error("Enter an item name or id.");
  }

  const item = (await loadItemCatalog()).itemByLookup.get(lookup);

  if (!item) {
    throw new Error(`Could not find "${nameOrId}".`);
  }

  return item;
}

export async function fetchAbility(nameOrId: string) {
  const lookup = normalizeShowdownId(nameOrId);

  if (!lookup) {
    throw new Error("Enter an ability name or id.");
  }

  const ability = (await loadAbilityCatalog()).get(lookup);

  if (!ability) {
    throw new Error(`Could not find "${nameOrId}".`);
  }

  return ability;
}
