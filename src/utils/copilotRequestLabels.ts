import { formatIdLabel } from "../api/showdownIds";
import { translateGameName, type Locale } from "../i18n/gameTranslations";
import { pokemonTypes, type PokemonType } from "../types";
import type { CopilotTypeLabelSnapshot } from "./copilotContracts";

export function localizeType(locale: Locale, type: PokemonType) {
  return translateGameName(locale, "types", type, formatIdLabel(type));
}

export function createCopilotTypeLabels(
  locale: Locale,
): CopilotTypeLabelSnapshot[] {
  return pokemonTypes.map((type) => ({
    id: type,
    displayName: localizeType(locale, type),
  }));
}
