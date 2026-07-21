import { createContext } from "react";
import type {
  GameDescriptionCategory,
  GameTranslationCategory,
  Locale,
  translatePokemonName,
} from "./gameTranslations";
import type { TranslationKey, TranslationVariables } from "./translations";

export type LocalizationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
  gameName: (
    category: GameTranslationCategory,
    id: string,
    fallback: string,
  ) => string;
  gameDescription: (
    category: GameDescriptionCategory,
    id: string,
    fallback: string,
  ) => string;
  moveTag: (tag: string) => string;
  pokemonName: (options: Parameters<typeof translatePokemonName>[1]) => string;
  pokemonFormName: (pokemonId: string, fallback: string) => string;
};

export const LocalizationContext = createContext<LocalizationContextValue | null>(null);
