import type {
  GameDescriptionCategory,
  GameTranslationCategory,
} from "../gameTranslations";

export const koGameOverrides: Partial<
  Record<GameTranslationCategory, Record<string, string>>
> = {
  // Keep intentional PokePilot terminology changes here so regenerating the
  // PokeAPI snapshot never overwrites them.
  abilities: {
    eelevate: "천정부지",
    firemane: "불꽃의갈기",
  },
};

export const koGameDescriptionOverrides: Partial<
  Record<GameDescriptionCategory, Record<string, string>>
> = {
  // Description corrections use the same normalized canonical IDs as names.
  abilities: {
    eelevate:
      "땅타입 기술과 압정뿌리기, 독압정, 끈적끈적네트의 효과를 받지 않는다. 공격으로 상대를 쓰러뜨리면 가장 높은 능력이 1단계 올라간다.",
    firemane: "불꽃타입 기술의 위력이 1.5배가 된다.",
  },
};
