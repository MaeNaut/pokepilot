import type { TeamConceptId } from "../data/teamConcepts";
import { conceptCopilotTextKeys, getCopilotText, type CopilotTextKey, } from "../i18n/copilotText";
import { translateGameName, type Locale } from "../i18n/gameTranslations";
import { pokemonTypes, type PokemonType } from "../types";
import type { CopilotCandidateFilterSnapshot, CopilotTypeLabelSnapshot } from "./copilotContracts";

export function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatLookup(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatList(values: string[], locale: Locale) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (locale === "ko") {
    return values.join(", ");
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

export function text(
  locale: Locale,
  key: CopilotTextKey,
  variables?: Record<string, string | number>,
) {
  return getCopilotText(locale, key, variables);
}

export function localizeType(locale: Locale, type: PokemonType) {
  return translateGameName(locale, "types", type, formatLookup(type));
}

export function createCopilotTypeLabels(
  locale: Locale,
): CopilotTypeLabelSnapshot[] {
  return pokemonTypes.map((type) => ({
    id: type,
    displayName: localizeType(locale, type),
  }));
}

export function localizeConcept(
  locale: Locale,
  conceptId: TeamConceptId,
  fallback?: string,
) {
  const key = conceptCopilotTextKeys[conceptId];
  return key ? text(locale, key) : (fallback ?? formatLookup(conceptId));
}

export function describeCandidateFilter(
  filter: CopilotCandidateFilterSnapshot,
  locale: Locale,
) {
  return formatList(
    [
      ...filter.types.map((type) =>
        text(locale, "requirement.type", { type: localizeType(locale, type) }),
      ),
      ...(filter.ability
        ? [
            text(locale, "requirement.ability", {
              ability: translateGameName(
                locale,
                "abilities",
                filter.ability.id,
                filter.ability.name,
              ),
            }),
          ]
        : []),
      ...filter.moves.map((move) =>
        text(locale, "requirement.move", {
          move: translateGameName(locale, "moves", move.id, move.name),
        }),
      ),
    ],
    locale,
  );
}
