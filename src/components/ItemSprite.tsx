import { useEffect, useState } from "react";
import type { PokemonItem } from "../types";

type ItemSpriteProps = {
  item: PokemonItem;
};

export function ItemSprite({ item }: ItemSpriteProps) {
  const [spriteUrl, setSpriteUrl] = useState(item.spriteUrl);

  useEffect(() => {
    setSpriteUrl(item.spriteUrl);
  }, [item.spriteUrl]);

  if (spriteUrl) {
    return (
      <img
        src={spriteUrl}
        alt=""
        onError={() =>
          setSpriteUrl((current) =>
            current === item.spriteUrl ? item.fallbackSpriteUrl : undefined,
          )
        }
      />
    );
  }

  return (
    <span className="item-fallback-label">
      {item.category === "Mega Stones" ? "M" : item.name.charAt(0)}
    </span>
  );
}
