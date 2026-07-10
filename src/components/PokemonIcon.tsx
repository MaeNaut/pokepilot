import type { TeamMember } from "../types";
import { isFullShowdownSpriteUrl } from "../utils/pokemonSprites";

type PokemonIconProps = {
  pokemon: Pick<TeamMember, "name" | "spriteUrl" | "iconSpriteUrl">;
};

export function PokemonIcon({ pokemon }: PokemonIconProps) {
  const iconSpriteUrl = isFullShowdownSpriteUrl(pokemon.iconSpriteUrl)
    ? undefined
    : pokemon.iconSpriteUrl;
  const fallbackUrl = pokemon.spriteUrl;

  if (!iconSpriteUrl && !fallbackUrl) {
    return null;
  }

  return (
    <img
      src={iconSpriteUrl ?? fallbackUrl}
      alt=""
      onError={(event) => {
        const image = event.currentTarget;

        if (fallbackUrl && image.src !== fallbackUrl && !image.dataset.fallbackApplied) {
          image.dataset.fallbackApplied = "true";
          image.src = fallbackUrl;
          return;
        }

        image.hidden = true;
      }}
    />
  );
}
