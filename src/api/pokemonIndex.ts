import { battleOnlyAlternateFormIds } from "../data/battleForms";
import type { PokemonIndexEntry } from "../types";
import { toPokemonLookupId } from "../utils/pokemonAliases";
import {
  loadShowdownData,
  type ShowdownSpeciesData,
} from "./showdownData";
import { formatIdLabel } from "./showdownIds";

type GenderFormMeta = {
  pokemonId: string;
  speciesKey: string;
  label: "Male" | "Female";
};

const DEFAULT_FORM_IDS_BY_SHOWDOWN_ID: Record<string, string> = {
  aegislash: "aegislash-shield",
  furfrou: "furfrou-natural",
  gourgeist: "gourgeist-average",
  lycanroc: "lycanroc-midday",
  maushold: "maushold-family-of-four",
  mimikyu: "mimikyu-disguised",
  morpeko: "morpeko-full-belly",
  palafin: "palafin-zero",
};

const GENDER_FORMS_BY_SHOWDOWN_ID: Record<string, GenderFormMeta> = {
  basculegion: {
    pokemonId: "basculegion-male",
    speciesKey: "basculegion",
    label: "Male",
  },
  basculegionf: {
    pokemonId: "basculegion-female",
    speciesKey: "basculegion",
    label: "Female",
  },
  indeedee: {
    pokemonId: "indeedee-male",
    speciesKey: "indeedee",
    label: "Male",
  },
  indeedeef: {
    pokemonId: "indeedee-female",
    speciesKey: "indeedee",
    label: "Female",
  },
  meowstic: {
    pokemonId: "meowstic-male",
    speciesKey: "meowstic",
    label: "Male",
  },
  meowsticf: {
    pokemonId: "meowstic-female",
    speciesKey: "meowstic",
    label: "Female",
  },
  oinkologne: {
    pokemonId: "oinkologne-male",
    speciesKey: "oinkologne",
    label: "Male",
  },
  oinkolognef: {
    pokemonId: "oinkologne-female",
    speciesKey: "oinkologne",
    label: "Female",
  },
  pyroar: {
    pokemonId: "pyroar-male",
    speciesKey: "pyroar",
    label: "Male",
  },
};

export const syntheticGenderFormSources: Record<
  string,
  { sourceName: string; spriteGender: "female" }
> = {
  "pyroar-female": { sourceName: "pyroar-male", spriteGender: "female" },
};

const BASE_DISPLAY_NAME_FOR_DEFAULT_FORMS = new Set([
  "aegislash-shield",
  "mimikyu-disguised",
  "morpeko-full-belly",
  "palafin-zero",
]);
const MAIN_PICKER_HIDDEN_FORMS = new Set([
  "mimikyu-busted",
  "pyroar-female",
  ...battleOnlyAlternateFormIds,
]);
const MAIN_PICKER_HIDDEN_PREFIXES = [
  "castform-",
  "mimikyu-totem",
  "pikachu-",
];
const REGIONAL_FORM_PATTERN = /^(?:alola|galar|hisui|paldea)(?:-|$)/i;
const MEGA_FORM_PATTERN = /^mega(?:-|$)/i;

function toDisplayId(value: string) {
  return toPokemonLookupId(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, ""),
  );
}

function getPokemonId(species: ShowdownSpeciesData) {
  const genderMeta = GENDER_FORMS_BY_SHOWDOWN_ID[species.id];

  if (genderMeta) {
    return genderMeta.pokemonId;
  }

  const defaultFormId = DEFAULT_FORM_IDS_BY_SHOWDOWN_ID[species.id];

  if (defaultFormId) {
    return defaultFormId;
  }

  const displayId = toDisplayId(species.name);

  if (/^tauros-paldea-(?:combat|blaze|aqua)$/.test(displayId)) {
    return `${displayId}-breed`;
  }

  return displayId;
}

function getSpeciesKey(species: ShowdownSpeciesData) {
  return (
    GENDER_FORMS_BY_SHOWDOWN_ID[species.id]?.speciesKey ??
    toDisplayId(species.baseSpecies ?? species.name)
  );
}

function getFormKind(
  species: ShowdownSpeciesData,
  pokemonId: string,
  speciesKey: string,
): PokemonIndexEntry["formKind"] {
  if (GENDER_FORMS_BY_SHOWDOWN_ID[species.id]) {
    return "gender";
  }

  if (species.forme && MEGA_FORM_PATTERN.test(species.forme)) {
    return "mega";
  }

  if (species.forme && REGIONAL_FORM_PATTERN.test(species.forme)) {
    return "regional";
  }

  if (species.baseSpecies || species.forme || pokemonId !== speciesKey) {
    return "form";
  }

  return "base";
}

function getFormLabel(
  species: ShowdownSpeciesData,
  pokemonId: string,
  speciesKey: string,
) {
  const genderMeta = GENDER_FORMS_BY_SHOWDOWN_ID[species.id];

  if (genderMeta) {
    return genderMeta.label;
  }

  if (species.forme) {
    return formatIdLabel(toDisplayId(species.forme));
  }

  const suffix = pokemonId.replace(`${speciesKey}-`, "");
  return suffix === pokemonId ? undefined : formatIdLabel(suffix);
}

function getDisplayName(
  pokemonId: string,
  speciesKey: string,
  genderMeta?: GenderFormMeta,
) {
  if (
    BASE_DISPLAY_NAME_FOR_DEFAULT_FORMS.has(pokemonId) ||
    pokemonId === "pyroar-male"
  ) {
    return formatIdLabel(speciesKey);
  }

  if (genderMeta) {
    return `${formatIdLabel(speciesKey)} ${genderMeta.label}`;
  }

  return formatIdLabel(pokemonId);
}

function isHiddenFromMainPicker(pokemonId: string) {
  return (
    MAIN_PICKER_HIDDEN_FORMS.has(pokemonId) ||
    MAIN_PICKER_HIDDEN_PREFIXES.some((prefix) => pokemonId.startsWith(prefix))
  );
}

function isSelectorOption(
  pokemonId: string,
  formKind: PokemonIndexEntry["formKind"],
) {
  return !isHiddenFromMainPicker(pokemonId) && formKind !== "mega";
}

function createIndexEntry(species: ShowdownSpeciesData): PokemonIndexEntry | null {
  if (!species.num || species.num <= 0) {
    return null;
  }

  const pokemonId = getPokemonId(species);
  const speciesKey = getSpeciesKey(species);
  const formKind = getFormKind(species, pokemonId, speciesKey);
  const formLabel = getFormLabel(species, pokemonId, speciesKey);

  return {
    name: pokemonId,
    showdownId: species.id,
    displayName: getDisplayName(
      pokemonId,
      speciesKey,
      GENDER_FORMS_BY_SHOWDOWN_ID[species.id],
    ),
    speciesKey,
    sortNumber: species.num,
    formKind,
    ...(formLabel ? { formLabel } : {}),
    isSelectorOption: isSelectorOption(pokemonId, formKind),
  };
}

export function createPokemonIndex(
  speciesById: Record<string, ShowdownSpeciesData>,
): PokemonIndexEntry[] {
  const entriesByName = new Map<string, PokemonIndexEntry>();

  for (const species of Object.values(speciesById)) {
    const entry = createIndexEntry(species);

    if (entry && !entriesByName.has(entry.name)) {
      entriesByName.set(entry.name, entry);
    }
  }

  const pyroarMale = entriesByName.get("pyroar-male");

  if (pyroarMale) {
    entriesByName.set("pyroar-female", {
      ...pyroarMale,
      name: "pyroar-female",
      displayName: "Pyroar Female",
      formKind: "gender",
      formLabel: "Female",
      isSelectorOption: false,
    });
  }

  const formRank: Record<PokemonIndexEntry["formKind"], number> = {
    base: 0,
    form: 0,
    gender: 0,
    regional: 1,
    mega: 2,
  };

  return Array.from(entriesByName.values()).sort(
    (first, second) =>
      first.sortNumber - second.sortNumber ||
      formRank[first.formKind] - formRank[second.formKind] ||
      first.name.localeCompare(second.name),
  );
}

export async function fetchPokemonIndex() {
  const snapshot = await loadShowdownData();
  return createPokemonIndex(snapshot.speciesById);
}
