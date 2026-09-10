import { areEquivalentBattleForms } from "../data/battleForms";

const SPECIAL_POKEMON_LOOKUP_ALIASES: Record<string, string[]> = {
  "toxtricity-amped": ["toxtricity"],
  "squawkabilly-green-plumage": ["squawkabilly"],
  "squawkabilly-blue-plumage": ["squawkabillyblue", "squawkabilly"],
  "squawkabilly-white-plumage": [
    "squawkabillywhite",
    "squawkabilly-yellow",
  ],
  "squawkabilly-yellow-plumage": ["squawkabillyyellow"],
  "squawkabilly-blue": ["squawkabilly"],
  "squawkabilly-white": ["squawkabilly-yellow"],
  "aegislash-blade": ["aegislash"],
  "aegislash-shield": ["aegislash"],
  "maushold-family-of-four": ["maushold"],
  "mimikyu-disguised": ["mimikyu"],
  "morpeko-full-belly": ["morpeko"],
  "morpeko-hangry": ["morpeko"],
  "palafin-hero": ["palafin"],
  "palafin-zero": ["palafin", "palafin-hero"],
  pyroar: ["pyroarmega", "pyroar-mega"],
  "pyroar-male": ["pyroarmega", "pyroar-mega"],
};

const PREFERRED_POKEAPI_IDS: Record<string, string> = {
  "farfetch-d": "farfetchd",
  "sirfetch-d": "sirfetchd",
  indeedee: "indeedee-male",
  "indeedee-f": "indeedee-female",
  aegislash: "aegislash-shield",
  mimikyu: "mimikyu-disguised",
  morpeko: "morpeko-full-belly",
  palafin: "palafin-zero",
};

const POKEAPI_LOOKUP_IDS: Record<string, string> = {
  toxtricity: "toxtricity-amped",
  squawkabilly: "squawkabilly-green-plumage",
  "squawkabilly-blue": "squawkabilly-blue-plumage",
  "squawkabilly-white": "squawkabilly-white-plumage",
  "squawkabilly-yellow": "squawkabilly-yellow-plumage",
};

export function toPokemonLookupId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u2640/g, "-f")
    .replace(/\u2642/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getPokemonLookupAliases(value: string) {
  const dashed = toPokemonLookupId(value);

  if (!dashed) {
    return [];
  }

  const aliases = new Set<string>([
    dashed,
    dashed.replace(/[^a-z0-9]/g, ""),
    ...(SPECIAL_POKEMON_LOOKUP_ALIASES[dashed] ?? []),
  ]);
  const genderShortMatch = dashed.match(/^(.+)-([mf])(-.+)?$/);
  const genderLongMatch = dashed.match(/^(.+)-(male|female)(-.+)?$/);

  if (genderShortMatch) {
    const [, baseName, gender, suffix = ""] = genderShortMatch;
    const longGender = gender === "f" ? "female" : "male";

    aliases.add(`${baseName}-${longGender}${suffix}`);
    aliases.add(`${baseName}${longGender}${suffix}`);
  }

  if (genderLongMatch) {
    const [, baseName, gender, suffix = ""] = genderLongMatch;
    const shortGender = gender === "female" ? "f" : "m";

    aliases.add(`${baseName}-${shortGender}${suffix}`);
    aliases.add(`${baseName}${shortGender}${suffix}`);

    if (gender === "male") {
      aliases.add(`${baseName}${suffix}`);
      aliases.add(baseName);
    }
  }

  if (dashed.startsWith("tauros-paldea-") && dashed.endsWith("-breed")) {
    aliases.add(dashed.replace(/-breed$/, ""));
  } else if (dashed.startsWith("tauros-paldea-")) {
    aliases.add(`${dashed}-breed`);
  }

  return Array.from(aliases);
}

export function getPreferredPokeApiId(value: string) {
  return PREFERRED_POKEAPI_IDS[toPokemonLookupId(value)];
}

export function getPokeApiLookupId(value: string) {
  const id = toPokemonLookupId(value);
  return POKEAPI_LOOKUP_IDS[id] ?? id;
}

export function shouldKeepSelectedPokemonForUsageTarget(
  selectedPokemonId: string,
  usagePokemonId: string,
) {
  return (
    areEquivalentBattleForms(
      toPokemonLookupId(selectedPokemonId),
      toPokemonLookupId(usagePokemonId),
    ) ||
    (selectedPokemonId === "pyroar-male" &&
      toPokemonLookupId(usagePokemonId).includes("-mega"))
  );
}
