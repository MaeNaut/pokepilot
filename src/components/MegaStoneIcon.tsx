import { useEffect, useState } from "react";
import { fetchItemIndex, itemFromIndexEntry } from "../api/showdownCatalog";
import { getMegaStoneItemName } from "../utils/megaEvolution";
import type { PokemonItem } from "../types";
import { ItemSprite } from "./ItemSprite";

export function MegaStoneIcon({ pokemon, fallback }: { pokemon: string; fallback: string }) {
  const [stone, setStone] = useState<PokemonItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStone(null);
    void fetchItemIndex().then((items) => {
      const name = getMegaStoneItemName(pokemon, new Set(
        items.filter((item) => item.isMegaStone).map((item) => item.name),
      ));
      const item = items.find((entry) => entry.name === name);
      if (!cancelled && item) setStone(itemFromIndexEntry(item));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pokemon]);

  return stone ? <ItemSprite item={stone} /> : <span>{fallback}</span>;
}
