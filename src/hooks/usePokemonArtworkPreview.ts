import { useEffect, useState } from "react";
import { fetchPokemon } from "../api/pokeApi";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { normalizeShowdownId } from "../api/showdownIds";
import type { TeamMember } from "../types";

export function usePokemonArtworkPreview(
  pokemonId: string | null,
  { delayMs = 0, member }: { delayMs?: number; member?: TeamMember | null } = {},
) {
  const [artwork, setArtwork] = useState<string | null>(null);
  const memberId = member?.id;
  const memberArtwork = member?.spriteUrl;

  useEffect(() => {
    if (!pokemonId) {
      setArtwork(null);
      return;
    }
    if (memberId && memberArtwork && getPokemonLookupAliases(memberId).some(
      (alias) => normalizeShowdownId(alias) === normalizeShowdownId(pokemonId),
    )) {
      setArtwork(memberArtwork);
      return;
    }

    let current = true;
    if (delayMs) setArtwork(null);
    const load = () => {
      void fetchPokemon(pokemonId).then((pokemon) => {
        if (current) setArtwork(pokemon.spriteUrl ?? null);
      }).catch(() => {
        if (current) setArtwork(null);
      });
    };
    const timer = delayMs ? window.setTimeout(load, delayMs) : null;
    if (!delayMs) load();
    return () => {
      current = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [pokemonId, delayMs, memberId, memberArtwork]);

  return artwork;
}
