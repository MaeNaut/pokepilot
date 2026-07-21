import koreanCatalogJson from "./data/ko-game-data.json";
import {
  koGameDescriptionOverrides,
  koGameOverrides,
} from "./data/koOverrides";

export type Locale = "en" | "ko";
export type GameTranslationCategory =
  | "pokemon"
  | "moves"
  | "items"
  | "abilities"
  | "types"
  | "natures";
export type GameDescriptionCategory = "moves" | "items" | "abilities";

type PokemonFormTranslation = {
  pokemonName: string;
  formName: string;
};

type KoreanGameCatalog = {
  schemaVersion: number;
  locale: "ko";
  pokemon: Record<string, string>;
  pokemonForms: Record<string, PokemonFormTranslation>;
  moves: Record<string, string>;
  moveDescriptions: Record<string, string>;
  items: Record<string, string>;
  itemDescriptions: Record<string, string>;
  abilities: Record<string, string>;
  abilityDescriptions: Record<string, string>;
  types: Record<string, string>;
  natures: Record<string, string>;
};

const koreanCatalog = koreanCatalogJson as KoreanGameCatalog;

export function normalizeTranslationId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findOverride(category: GameTranslationCategory, id: string) {
  return koGameOverrides[category]?.[normalizeTranslationId(id)];
}

export function translateGameName(
  locale: Locale,
  category: GameTranslationCategory,
  id: string,
  fallback: string,
) {
  if (locale === "en") {
    return fallback;
  }

  const key = normalizeTranslationId(id);
  return findOverride(category, key) ?? koreanCatalog[category][key] ?? fallback;
}

const descriptionCatalogKeys: Record<
  GameDescriptionCategory,
  "moveDescriptions" | "itemDescriptions" | "abilityDescriptions"
> = {
  moves: "moveDescriptions",
  items: "itemDescriptions",
  abilities: "abilityDescriptions",
};

export function translateGameDescription(
  locale: Locale,
  category: GameDescriptionCategory,
  id: string,
  fallback: string,
) {
  if (locale === "en") {
    return fallback;
  }

  const key = normalizeTranslationId(id);
  const catalogKey = descriptionCatalogKeys[category];

  return (
    koGameDescriptionOverrides[category]?.[key] ??
    koreanCatalog[catalogKey][key] ??
    fallback
  );
}

const koreanMoveTags: Record<string, string> = {
  Contact: "접촉",
  Sound: "소리",
  Punch: "펀치",
  Bite: "물기",
  Slicing: "베기",
  "Ball/Bomb": "구슬/폭탄",
  Pulse: "파동",
  Wind: "바람",
  Powder: "가루",
  Dance: "춤",
  Recovery: "회복",
  "Bypass Sub": "대타 무시",
  Charge: "충전",
  Recharge: "재충전",
  "Spread: All": "전체 광역",
  "Spread: Adjacent": "인접 광역",
  "Spread: Foes": "상대 광역",
  "Fixed Damage": "고정 대미지",
  Protect: "방어기",
  Trap: "구속",
  Recoil: "반동",
  Rampage: "난동",
  "Stat Change": "랭크 변화",
  "Self-KO": "자폭",
  "High Crit": "급소율 상승",
  "Multi-Hit": "연속기",
  "Never Miss": "필중",
  Field: "필드",
  Screen: "장막",
  Switch: "교체",
};

export function translateMoveTag(locale: Locale, tag: string) {
  if (locale === "en") {
    return tag;
  }

  const priority = /^Priority ([+-]?\d+)$/.exec(tag);

  return priority ? `우선도 ${priority[1]}` : koreanMoveTags[tag] ?? tag;
}

type PokemonNameOptions = {
  id: string;
  fallback: string;
  speciesId?: string;
  includeForm?: boolean;
  formLabel?: string;
  formKind?: "base" | "regional" | "form" | "gender" | "mega";
};

const koreanFormLabels: Record<string, string> = {
  m: "수컷",
  male: "수컷",
  f: "암컷",
  female: "암컷",
  mega: "메가",
  "mega x": "메가 X",
  "mega y": "메가 Y",
};

const koreanRegionalPrefixes: Record<string, string> = {
  alola: "알로라",
  alolan: "알로라",
  galar: "가라르",
  galarian: "가라르",
  hisui: "히스이",
  hisuian: "히스이",
  paldea: "팔데아",
  paldean: "팔데아",
};

const koreanRegionalVariants: Record<string, string> = {
  aqua: "워터종",
  blaze: "블레이즈종",
  combat: "컴뱃종",
};

function translateFallbackFormLabel(label: string) {
  return koreanFormLabels[label.trim().toLowerCase()] ?? label;
}

function getKoreanRegionalName(baseName: string, formLabel: string) {
  const [regionId, ...variantIds] = formLabel
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  const region = koreanRegionalPrefixes[regionId];

  if (!region) {
    return null;
  }

  const variant = variantIds
    .map((id) => koreanRegionalVariants[id] ?? id)
    .join(" ");

  return [region, baseName, variant].filter(Boolean).join(" ");
}

export function translatePokemonName(locale: Locale, options: PokemonNameOptions) {
  if (locale === "en") {
    return options.fallback;
  }

  const exactKey = normalizeTranslationId(options.id);
  const speciesKey = normalizeTranslationId(options.speciesId ?? options.id);
  const exactOverride = findOverride("pokemon", exactKey);

  if (exactOverride) {
    return exactOverride;
  }

  const baseName =
    findOverride("pokemon", speciesKey) ?? koreanCatalog.pokemon[speciesKey];

  if (options.includeForm === false) {
    return baseName ?? koreanCatalog.pokemon[exactKey] ?? options.fallback;
  }

  if (baseName && options.formLabel && options.formKind === "gender") {
    const gender = koreanFormLabels[options.formLabel.trim().toLowerCase()];

    if (gender) {
      return `${gender} ${baseName}`;
    }
  }

  if (baseName && options.formLabel && options.formKind === "regional") {
    const regionalName = getKoreanRegionalName(baseName, options.formLabel);

    if (regionalName) {
      return regionalName;
    }
  }

  const form = koreanCatalog.pokemonForms[exactKey];
  const formName = form?.pokemonName || form?.formName;

  if (formName) {
    if (!baseName || formName.includes(baseName)) {
      return formName;
    }

    return `${baseName} ${formName}`;
  }

  const exactName = koreanCatalog.pokemon[exactKey];

  if (exactName) {
    return exactName;
  }

  if (baseName && options.formLabel) {
    return `${baseName} ${translateFallbackFormLabel(options.formLabel)}`;
  }

  return baseName ?? options.fallback;
}

export function translatePokemonFormName(
  locale: Locale,
  pokemonId: string,
  fallback: string,
) {
  if (locale === "en") {
    return fallback;
  }

  const form = koreanCatalog.pokemonForms[normalizeTranslationId(pokemonId)];
  return form?.formName || form?.pokemonName || translateFallbackFormLabel(fallback);
}

export function getKoreanCatalogCounts() {
  return {
    pokemon: Object.keys(koreanCatalog.pokemon).length,
    pokemonForms: Object.keys(koreanCatalog.pokemonForms).length,
    moves: Object.keys(koreanCatalog.moves).length,
    moveDescriptions: Object.keys(koreanCatalog.moveDescriptions).length,
    items: Object.keys(koreanCatalog.items).length,
    itemDescriptions: Object.keys(koreanCatalog.itemDescriptions).length,
    abilities: Object.keys(koreanCatalog.abilities).length,
    abilityDescriptions: Object.keys(koreanCatalog.abilityDescriptions).length,
    types: Object.keys(koreanCatalog.types).length,
    natures: Object.keys(koreanCatalog.natures).length,
  };
}
