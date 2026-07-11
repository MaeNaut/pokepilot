function getCommonPrefixLength(first: string, second: string) {
  const maxLength = Math.min(first.length, second.length);
  let index = 0;

  while (index < maxLength && first[index] === second[index]) {
    index += 1;
  }

  return index;
}

export function isMegaPokemonName(name: string) {
  return name.includes("-mega");
}

export function getMegaSpeciesKey(name: string) {
  if (!isMegaPokemonName(name)) {
    return name;
  }

  return name.includes("-mega-") ? name.split("-mega-")[0] : name.split("-mega")[0];
}

export function getMegaStoneItemName(
  megaPokemonName: string,
  knownMegaStoneNames: Set<string>,
) {
  const [speciesKey, suffix = ""] = megaPokemonName.includes("-mega-")
    ? megaPokemonName.split("-mega-")
    : megaPokemonName.split("-mega");

  if (!speciesKey || megaPokemonName === speciesKey) {
    return null;
  }

  const candidate = `${speciesKey}ite${suffix ? `-${suffix}` : ""}`;

  if (knownMegaStoneNames.has(candidate)) {
    return candidate;
  }

  const normalizedSpeciesKey = speciesKey.replace(/-/g, "");
  const minimumPrefixLength = Math.min(5, normalizedSpeciesKey.length);
  const matchingStones = [...knownMegaStoneNames]
    .map((itemName) => {
      const itemSuffix = itemName.match(/-(x|y|z)$/)?.[1] ?? "";

      if (suffix && itemSuffix !== suffix) {
        return null;
      }

      if (!suffix && itemSuffix) {
        return null;
      }

      const normalizedItemName = itemName.replace(/-(x|y|z)$/, "").replace(/-/g, "");
      const score = getCommonPrefixLength(normalizedSpeciesKey, normalizedItemName);

      return score >= minimumPrefixLength ? { itemName, score } : null;
    })
    .filter((entry): entry is { itemName: string; score: number } => Boolean(entry))
    .sort((first, second) => second.score - first.score);

  return matchingStones[0]?.itemName ?? null;
}
