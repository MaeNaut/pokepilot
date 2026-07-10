import type { TeamMember } from "../types";

export const samplePool: TeamMember[] = [
  {
    id: "charizard",
    name: "Charizard",
    types: ["fire", "flying"],
    roles: ["special attacker", "speed control"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/6.png",
    source: "local",
  },
  {
    id: "swampert",
    name: "Swampert",
    types: ["water", "ground"],
    roles: ["bulky pivot", "hazard control"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/260.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/260.png",
    source: "local",
  },
  {
    id: "rotom-wash",
    name: "Rotom Wash",
    types: ["electric", "water"],
    roles: ["bulky pivot", "utility"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10009.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/10009.png",
    source: "local",
  },
  {
    id: "gardevoir",
    name: "Gardevoir",
    types: ["psychic", "fairy"],
    roles: ["special attacker", "support"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/282.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/282.png",
    source: "local",
  },
  {
    id: "scizor",
    name: "Scizor",
    types: ["bug", "steel"],
    roles: ["physical attacker", "setup check"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/212.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/212.png",
    source: "local",
  },
  {
    id: "hydreigon",
    name: "Hydreigon",
    types: ["dark", "dragon"],
    roles: ["physical attacker", "late-game cleaner"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/635.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/635.png",
    source: "local",
  },
  {
    id: "mamoswine",
    name: "Mamoswine",
    types: ["ice", "ground"],
    roles: ["wallbreaker", "anti-flying"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/473.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/473.png",
    source: "local",
  },
  {
    id: "toxicroak",
    name: "Toxicroak",
    types: ["poison", "fighting"],
    roles: ["revenge killer", "fairy check"],
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/454.png",
    iconSpriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ix/scarlet-violet/454.png",
    source: "local",
  },
];

export const startingTeam = samplePool.slice(0, 6);
