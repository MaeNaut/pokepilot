import type { LocalizationContextValue } from "../i18n/LocalizationContext";
import { getPokemonNameFallback } from "./pokemonDisplay";
import {
  createPokemonRecommendationOptions,
  createPokemonRecommendationTargets,
} from "./pokemonRecommendations";

type RecommendationContextInput = Pick<
  Parameters<typeof createPokemonRecommendationOptions>[0],
  "pokemonIndex" | "abilityIndex" | "legality"
> & Omit<
  Parameters<typeof createPokemonRecommendationTargets>[0],
  "pokemonIndex" | "getCurrentPokemonDisplayName"
> & Pick<LocalizationContextValue, "gameName" | "pokemonName">;

export function createLocalizedRecommendationContext({
  pokemonIndex, abilityIndex, legality, team, selectedSlot, buildState,
  diagnostics, gameName, pokemonName,
}: RecommendationContextInput) {
  const options = createPokemonRecommendationOptions({
    pokemonIndex,
    abilityIndex,
    legality,
    getPokemonDisplayName: (entry, includeForm) => pokemonName({
      id: entry.name,
      speciesId: entry.speciesKey,
      fallback: getPokemonNameFallback(entry, includeForm),
      includeForm,
      formLabel: entry.formLabel,
      formKind: entry.formKind,
    }),
    getTypeDisplayName: (type) => gameName("types", type, type),
    getAbilityDisplayName: (id, fallback) => gameName("abilities", id, fallback),
  });
  const targets = createPokemonRecommendationTargets({
    team,
    selectedSlot,
    buildState,
    diagnostics,
    pokemonIndex,
    getCurrentPokemonDisplayName: (member, entry) => {
      const includeForm = Boolean(entry);
      return pokemonName({
        id: entry?.name ?? member.id,
        speciesId: entry?.speciesKey,
        fallback: entry ? getPokemonNameFallback(entry, includeForm) : member.name,
        includeForm,
        formLabel: entry?.formLabel,
        formKind: entry?.formKind,
      });
    },
  });

  return { options, targets };
}
