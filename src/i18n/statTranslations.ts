import type { StatKey } from "../types";
import type { TranslationKey } from "./translations";

export const statTranslationKeys: Record<StatKey, TranslationKey> = {
  hp: "stat.hp",
  attack: "stat.attack",
  defense: "stat.defense",
  specialAttack: "stat.specialAttack",
  specialDefense: "stat.specialDefense",
  speed: "stat.speed",
};
