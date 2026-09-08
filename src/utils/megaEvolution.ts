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

function getItemNameCandidates(item: PokemonItem) {
  return new Set(
    [item.id, item.showdownId, item.name]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => {
        const hyphenated = value.trim().toLowerCase().replace(/\s+/g, "-");
        return [hyphenated, normalizeShowdownId(value)];
      }),
  );
}

export function getMegaEvolutionIndexEntry(
  pokemonId: string,
  item: PokemonItem | null | undefined,
  pokemonIndex: PokemonIndexEntry[],
) {
  if (!item) return null;

  const activeEntry = pokemonIndex.find((entry) => entry.name === pokemonId);
  if (!activeEntry || activeEntry.formKind === "mega") return null;

  const itemNames = getItemNameCandidates(item);
  return pokemonIndex.find(
    (entry) =>
      entry.formKind === "mega" &&
      entry.speciesKey === activeEntry.speciesKey &&
      getMegaStoneItemName(entry.name, itemNames) !== null,
  ) ?? null;
}

export function createProjectedMegaMember(
  member: TeamMember,
  item: PokemonItem | null | undefined,
  pokemonIndex: PokemonIndexEntry[],
): TeamMember | null {
  const megaEntry = getMegaEvolutionIndexEntry(member.id, item, pokemonIndex);
  if (!megaEntry?.baseStats) return null;

  return {
    ...member,
    id: megaEntry.name,
    name: megaEntry.displayName,
    showdownId: megaEntry.showdownId,
    showdownName: megaEntry.showdownName ?? megaEntry.displayName,
    types: [...megaEntry.types],
    baseStats: { ...megaEntry.baseStats },
    abilities: [...megaEntry.abilities],
  };
}
import { normalizeShowdownId } from "../api/showdownIds";
import type {
  PokemonIndexEntry,
  PokemonItem,
  TeamMember,
} from "../types";
