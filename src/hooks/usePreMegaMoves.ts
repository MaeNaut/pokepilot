import { useEffect, useState } from "react";
import { fetchPokemon } from "../api/pokeApi";
import type {
  PokemonIndexEntry,
  PokemonMove,
  TeamMember,
} from "../types";

export function usePreMegaMoves(
  member: TeamMember | null,
  preMegaPokemonId: string,
  pokemonIndex: PokemonIndexEntry[],
) {
  const [moves, setMoves] = useState<PokemonMove[]>([]);
  const isMega =
    pokemonIndex.find((entry) => entry.name === member?.id)?.formKind ===
    "mega";

  useEffect(() => {
    if (!isMega || !preMegaPokemonId) {
      setMoves([]);
      return;
    }

    let isCurrent = true;

    void fetchPokemon(preMegaPokemonId)
      .then((pokemon) => {
        if (isCurrent) {
          setMoves(pokemon.moves ?? []);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setMoves([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isMega, preMegaPokemonId]);

  return moves;
}
