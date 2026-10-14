import kabamandaText from "../../public/help/kabamanda-team.txt?raw";
import { parseShowdownTeam } from "../utils/showdownText";
import { getPreferredPokeApiId, toPokemonLookupId } from "../utils/pokemonAliases";

export const TEAM_PRESETS = [{
  id: "kabamanda",
  nameKey: "team.kabamandaExample",
  battleFormat: "singles",
  showdownText: kabamandaText,
  pokemon: parseShowdownTeam(kabamandaText).map((set) => {
    const pokemonId = getPreferredPokeApiId(set.pokemonName) ?? toPokemonLookupId(set.pokemonName);
    return {
      pokemonId,
      name: set.pokemonName,
      iconSpriteUrl: `https://play.pokemonshowdown.com/sprites/gen5/${pokemonId}.png`,
    };
  }),
}] as const;

export type TeamPreset = (typeof TEAM_PRESETS)[number];
