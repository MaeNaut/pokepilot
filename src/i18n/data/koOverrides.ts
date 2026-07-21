import type {
  GameDescriptionCategory,
  GameTranslationCategory,
} from "../gameTranslations";

export const koGameOverrides: Partial<
  Record<GameTranslationCategory, Record<string, string>>
> = {
  // Keep intentional PokePilot terminology changes here so regenerating the
  // PokeAPI snapshot never overwrites them.
};

export const koGameDescriptionOverrides: Partial<
  Record<GameDescriptionCategory, Record<string, string>>
> = {
  // Description corrections use the same normalized canonical IDs as names.
};
