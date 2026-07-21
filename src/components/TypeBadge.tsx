import type { PokemonType } from "../types";
import { useLocalization } from "../i18n/useLocalization";

type TypeBadgeProps = {
  type: PokemonType;
};

const typesWithIcons = new Set<PokemonType>([
  "bug",
  "dark",
  "dragon",
  "electric",
  "fairy",
  "fighting",
  "fire",
  "flying",
  "ghost",
  "grass",
  "ground",
  "ice",
  "normal",
  "poison",
  "psychic",
  "rock",
  "steel",
  "water",
]);

export function TypeBadge({ type }: TypeBadgeProps) {
  const { gameName } = useLocalization();
  const hasIcon = typesWithIcons.has(type);
  const label = gameName("types", type, type);

  return (
    <span className={`type-badge ${hasIcon ? "has-type-icon" : ""}`} aria-label={label} title={label}>
      {hasIcon ? <span className={`type-icon type-icon-${type}`} aria-hidden="true" /> : null}
    </span>
  );
}
