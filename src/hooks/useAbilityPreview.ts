import { useEffect, useState } from "react";
import { fetchAbility } from "../api/showdownCatalog";
import { normalizeShowdownId } from "../api/showdownIds";
import type { PokemonAbility } from "../types";

export function useAbilityPreview() {
  const [name, setName] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, PokemonAbility>>({});
  const id = normalizeShowdownId(name ?? "");
  const details = detailsById[id];

  useEffect(() => {
    if (!name || !id || details) return;

    let current = true;
    void fetchAbility(name).then((ability) => {
      if (current) {
        setDetailsById((previous) => ({ ...previous, [id]: ability }));
      }
    }).catch(() => {
      // A name-only preview remains usable when the catalog cannot load.
    });
    return () => { current = false; };
  }, [name, id, details]);

  return {
    preview: name ? details ?? { id, name } : null,
    detailsById,
    previewAbility: setName,
  };
}
