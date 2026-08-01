export const POKEMON_CACHE_PREFIX = "pokepilot:pokemon:v21:";

const LEGACY_DATA_CACHE_PREFIXES = [
  "pokepilot:move:",
  "pokepilot:pokemon-index:",
  "pokepilot:item-index:",
  "pokepilot:item:",
  "pokepilot:ability:",
  "pokepilot:showdown-legality:",
];

let didCleanLegacyDataCaches = false;

export function cleanLegacyDataCaches() {
  if (didCleanLegacyDataCaches) {
    return;
  }

  didCleanLegacyDataCaches = true;

  try {
    const staleKeys: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (
        key &&
        (LEGACY_DATA_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
          (key.startsWith("pokepilot:pokemon:v") &&
            !key.startsWith(POKEMON_CACHE_PREFIX)))
      ) {
        staleKeys.push(key);
      }
    }

    for (const key of staleKeys) {
      localStorage.removeItem(key);
    }
  } catch {
    // Cache migration must not block the builder when storage is unavailable.
  }
}
