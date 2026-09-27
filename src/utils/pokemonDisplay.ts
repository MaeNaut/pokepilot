import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import { getBattleFormGroup } from "../data/battleForms";
import type { PokemonIndexEntry } from "../types";

const NAMED_BASE_FORMS = new Set(["toxtricity", "squawkabilly"]);

export function shouldIncludePokemonForm(entry: PokemonIndexEntry) {
  if (entry.formKind === "gender") {
    return true;
  }

  if (entry.formKind === "mega" || getBattleFormGroup(entry.name)) {
    return false;
  }

  return (
    entry.formKind === "regional" ||
    NAMED_BASE_FORMS.has(entry.name) ||
    normalizeShowdownId(entry.displayName) !==
      normalizeShowdownId(formatIdLabel(entry.speciesKey))
  );
}

export function shouldIncludeSelectedPokemonForm(entry: PokemonIndexEntry) {
  return entry.formKind !== "gender" && shouldIncludePokemonForm(entry);
}

export function getPokemonNameFallback(
  entry: PokemonIndexEntry,
  includeForm = shouldIncludePokemonForm(entry),
) {
  if (!includeForm) {
    return entry.formKind === "base"
      ? entry.displayName
      : formatIdLabel(entry.speciesKey);
  }

  if (
    entry.formLabel &&
    !normalizeShowdownId(entry.displayName).includes(
      normalizeShowdownId(entry.formLabel),
    )
  ) {
    return `${entry.displayName} ${entry.formLabel}`;
  }

  return entry.displayName;
}
