import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  translateGameName,
  translateGameDescription,
  translateMoveTag,
  translatePokemonFormName,
  translatePokemonName,
  type Locale,
} from "./gameTranslations";
import { en, interpolateTranslation, ko } from "./translations";
import {
  LocalizationContext,
  type LocalizationContextValue,
} from "./LocalizationContext";

const LOCALE_STORAGE_KEY = "pokepilot:locale";
const supportedLocales = new Set<Locale>(["en", "ko"]);

function getInitialLocale(): Locale {
  try {
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;

    if (storedLocale && supportedLocales.has(storedLocale)) {
      return storedLocale;
    }
  } catch {
    // localStorage may be unavailable in private or restricted browser contexts.
  }

  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);

    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The in-memory preference still works for this session.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocalizationContextValue>(() => {
    const translations = locale === "ko" ? ko : en;

    return {
      locale,
      setLocale,
      t: (key, variables) =>
        interpolateTranslation(translations[key] ?? en[key], variables),
      gameName: (category, id, fallback) =>
        translateGameName(locale, category, id, fallback),
      gameDescription: (category, id, fallback) =>
        translateGameDescription(locale, category, id, fallback),
      moveTag: (tag) => translateMoveTag(locale, tag),
      pokemonName: (options) => translatePokemonName(locale, options),
      pokemonFormName: (pokemonId, fallback) =>
        translatePokemonFormName(locale, pokemonId, fallback),
    };
  }, [locale, setLocale]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}
