const SPECIAL_POKEMON_LOOKUP_ALIASES: Record<string, string[]> = {
  pyroar: ["pyroarmega", "pyroar-mega"],
  "pyroar-male": ["pyroarmega", "pyroar-mega"],
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

export function shouldKeepSelectedPokemonForUsageTarget(
  selectedPokemonId: string,
  usagePokemonId: string,
) {
  return (
    selectedPokemonId === "pyroar-male" &&
    toPokemonLookupId(usagePokemonId).includes("-mega")
  );
}
