import type { TeamMember } from "../types";
import {
  getPokeApiChampionsSpriteUrlFromKnownSprites,
  isFullShowdownSpriteUrl,
} from "../utils/pokemonSprites";

type PokemonIconProps = {
  pokemon: Pick<
    TeamMember,
    | "name"
    | "spriteUrl"
    | "iconSpriteUrl"
    | "iconFallbackSpriteUrls"
    | "showdownGender"
  >;
};

export function PokemonIcon({ pokemon }: PokemonIconProps) {
  const savedIconUrls = [
    pokemon.iconSpriteUrl,
    ...(pokemon.iconFallbackSpriteUrls ?? []),
  ];
  const championsIconUrl =
    pokemon.showdownGender === "F"
      ? undefined
      : getPokeApiChampionsSpriteUrlFromKnownSprites([
          ...savedIconUrls,
          pokemon.spriteUrl,
        ]);
  const iconUrls = [championsIconUrl, ...savedIconUrls].filter(
    (url): url is string => Boolean(url) && !isFullShowdownSpriteUrl(url),
  );
  const spriteUrls = Array.from(
    new Set(
      [...iconUrls, pokemon.spriteUrl].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  );

  if (spriteUrls.length === 0) {
    return null;
  }

  return (
    <img
      key={spriteUrls.join("|")}
      src={spriteUrls[0]}
      alt=""
      draggable={false}
      onError={(event) => {
        const image = event.currentTarget;
        const currentIndex = Number(image.dataset.spriteIndex ?? "0");
        const nextIndex = currentIndex + 1;

        if (nextIndex < spriteUrls.length) {
          image.dataset.spriteIndex = String(nextIndex);
          image.src = spriteUrls[nextIndex];
          return;
        }

        image.hidden = true;
      }}
    />
  );
}
