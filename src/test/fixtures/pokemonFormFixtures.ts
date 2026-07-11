export const pokemonAliasFixtures = [
  {
    input: "Meowstic Female",
    expectedAliases: ["meowstic-female", "meowstic-f", "meowsticf"],
  },
  {
    input: "Basculegion ♂",
    expectedAliases: ["basculegion-m", "basculegion-male", "basculegionmale"],
  },
  {
    input: "tauros-paldea-aqua-breed",
    expectedAliases: ["tauros-paldea-aqua-breed", "tauros-paldea-aqua"],
  },
  {
    input: "Aegislash Shield",
    expectedAliases: ["aegislash-shield", "aegislash"],
  },
  {
    input: "Palafin Zero",
    expectedAliases: ["palafin-zero", "palafin", "palafin-hero"],
  },
] as const;

type PokemonListFixtureEntry = {
  name: string;
  id: number;
};

const pokemonIndexEntries: PokemonListFixtureEntry[] = [
  { name: "pikachu", id: 25 },
  { name: "tauros", id: 128 },
  { name: "castform", id: 351 },
  { name: "pyroar-male", id: 668 },
  { name: "meowstic-male", id: 678 },
  { name: "aegislash-shield", id: 681 },
  { name: "mimikyu-disguised", id: 778 },
  { name: "morpeko-full-belly", id: 877 },
  { name: "basculegion-male", id: 902 },
  { name: "palafin-zero", id: 964 },
  { name: "castform-sunny", id: 10013 },
  { name: "aegislash-blade", id: 10026 },
  { name: "pikachu-rock-star", id: 10080 },
  { name: "meowstic-female", id: 10083 },
  { name: "mimikyu-busted", id: 10143 },
  { name: "mimikyu-totem-disguised", id: 10144 },
  { name: "morpeko-hangry", id: 10187 },
  { name: "tauros-paldea-aqua-breed", id: 10252 },
  { name: "basculegion-female", id: 10248 },
  { name: "palafin-hero", id: 10256 },
];

export const pokemonIndexResponseFixture = {
  count: pokemonIndexEntries.length,
  results: pokemonIndexEntries.map(({ name, id }) => ({
    name,
    url: `https://pokeapi.co/api/v2/pokemon/${id}/`,
  })),
};

export const expectedVisiblePickerForms = [
  "aegislash-shield",
  "basculegion-female",
  "basculegion-male",
  "meowstic-female",
  "meowstic-male",
  "mimikyu-disguised",
  "morpeko-full-belly",
  "palafin-zero",
  "pikachu",
  "pyroar-male",
  "tauros-paldea-aqua-breed",
] as const;

export const expectedHiddenPickerForms = [
  "aegislash-blade",
  "castform-sunny",
  "mimikyu-busted",
  "mimikyu-totem-disguised",
  "morpeko-hangry",
  "palafin-hero",
  "pikachu-rock-star",
  "pyroar-female",
] as const;
