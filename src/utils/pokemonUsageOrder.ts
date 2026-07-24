import { normalizeShowdownId } from "../api/showdownIds";
import { getPokemonLookupAliases } from "./pokemonAliases";

type PokemonUsageOption = {
  id: string;
};

export type PokemonUsageOrder<T> = {
  orderedOptions: T[];
  rankByOptionId: Map<string, number>;
};

export function getBaseUsageLookup(value: string) {
  const withoutMega = value.replace(/-mega(?:-.+)?$/, "");
  const regionalMatch = withoutMega.match(
    /^(.+)-(alola|galar|hisui|paldea)$/,
  );

  return regionalMatch ? withoutMega : withoutMega.split("-")[0];
}

export function orderPokemonOptionsByUsage<T extends PokemonUsageOption>(
  options: T[],
  usagePokemonIds: string[] | null,
): PokemonUsageOrder<T> {
  const optionsByLookup = new Map<string, T>();

  for (const option of options) {
    for (const lookup of getPokemonLookupAliases(option.id)) {
      optionsByLookup.set(normalizeShowdownId(lookup), option);
    }
  }

  const orderedOptions: T[] = [];
  const rankByOptionId = new Map<string, number>();
  const seenOptionIds = new Set<string>();

  for (const [usageIndex, usageId] of (usagePokemonIds ?? []).entries()) {
    const exactOption = getPokemonLookupAliases(usageId)
      .map((lookup) => optionsByLookup.get(normalizeShowdownId(lookup)))
      .find((option): option is T => Boolean(option));
    const option =
      exactOption ??
      optionsByLookup.get(normalizeShowdownId(getBaseUsageLookup(usageId)));

    if (!option || seenOptionIds.has(option.id)) {
      continue;
    }

    seenOptionIds.add(option.id);
    orderedOptions.push(option);
    rankByOptionId.set(option.id, usageIndex + 1);
  }

  for (const option of options) {
    if (!seenOptionIds.has(option.id)) {
      orderedOptions.push(option);
    }
  }

  return { orderedOptions, rankByOptionId };
}
