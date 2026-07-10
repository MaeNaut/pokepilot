import type { PokemonType } from "../types";

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
  const hasIcon = typesWithIcons.has(type);

  return (
    <span className={`type-badge ${hasIcon ? "has-type-icon" : ""}`} aria-label={type} title={type}>
      {hasIcon ? <span className={`type-icon type-icon-${type}`} aria-hidden="true" /> : null}
    </span>
  );
}
