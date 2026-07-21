import type { StatKey } from "../types";
import type { ValidityIssue, ValidityIssueCode } from "../utils/teamValidity";
import type { LocalizationContextValue } from "./LocalizationContext";
import { statTranslationKeys } from "./statTranslations";
import type { TranslationKey, TranslationVariables } from "./translations";

const validityTranslationKeys: Record<ValidityIssueCode, TranslationKey> = {
  "ev-stat": "validity.evStat",
  "ev-total": "validity.evTotal",
  "duplicate-moves": "validity.duplicateMoves",
  "move-data-unavailable": "validity.moveDataUnavailable",
  "illegal-move": "validity.illegalMove",
  "unknown-nature": "validity.unknownNature",
  "mega-stone": "validity.megaStone",
  "legality-unavailable": "validity.legalityUnavailable",
  "illegal-pokemon": "validity.illegalPokemon",
  "illegal-item": "validity.illegalItem",
  "ability-data-unavailable": "validity.abilityDataUnavailable",
  "illegal-ability": "validity.illegalAbility",
  "duplicate-species": "validity.duplicateSpecies",
  "duplicate-item": "validity.duplicateItem",
};

type ValidityLocalization = Pick<
  LocalizationContextValue,
  "gameName" | "pokemonName" | "t"
>;

function stringValue(
  values: ValidityIssue["values"],
  key: string,
  fallback = "",
) {
  const value = values?.[key];
  return typeof value === "string" ? value : fallback;
}

export function localizeValidityIssue(
  issue: ValidityIssue,
  { gameName, pokemonName, t }: ValidityLocalization,
) {
  const values: TranslationVariables = { ...issue.values };

  if (issue.code === "ev-stat") {
    const stat = stringValue(issue.values, "stat") as StatKey;
    values.stat = statTranslationKeys[stat] ? t(statTranslationKeys[stat]) : stat;
  } else if (issue.code === "illegal-move") {
    const id = stringValue(issue.values, "moveId");
    values.move = gameName(
      "moves",
      id,
      stringValue(issue.values, "moveName", id),
    );
  } else if (issue.code === "unknown-nature") {
    const id = stringValue(issue.values, "natureId");
    values.nature = gameName(
      "natures",
      id,
      stringValue(issue.values, "natureName", id),
    );
  } else if (issue.code === "mega-stone" || issue.code === "illegal-item") {
    const id = stringValue(issue.values, "itemId");
    values.item = gameName(
      "items",
      id,
      stringValue(issue.values, "itemName", id),
    );
  } else if (issue.code === "illegal-pokemon") {
    const id = stringValue(issue.values, "pokemonId");
    values.pokemon = pokemonName({
      id,
      fallback: stringValue(issue.values, "pokemonName", id),
      includeForm: true,
    });
  } else if (issue.code === "illegal-ability") {
    const id = stringValue(issue.values, "abilityId");
    values.ability = gameName(
      "abilities",
      id,
      stringValue(issue.values, "abilityName", id),
    );
  } else if (issue.code === "duplicate-item") {
    const id = stringValue(issue.values, "itemId");
    values.item = gameName(
      "items",
      id,
      stringValue(issue.values, "itemName", id),
    );
  }

  return t(validityTranslationKeys[issue.code], values);
}
