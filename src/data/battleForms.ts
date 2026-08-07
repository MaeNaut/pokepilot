type BattleFormGroup = {
  speciesKey: string;
  defaultPokemonId: string;
  options: Array<{
    pokemonId: string;
    label: string;
  }>;
};

const battleFormGroups: BattleFormGroup[] = [
  {
    speciesKey: "aegislash",
    defaultPokemonId: "aegislash-shield",
    options: [
      { pokemonId: "aegislash-shield", label: "Shield" },
      { pokemonId: "aegislash-blade", label: "Blade" },
    ],
  },
  {
    speciesKey: "palafin",
    defaultPokemonId: "palafin-zero",
    options: [
      { pokemonId: "palafin-zero", label: "Zero" },
      { pokemonId: "palafin-hero", label: "Hero" },
    ],
  },
  {
    speciesKey: "morpeko",
    defaultPokemonId: "morpeko-full-belly",
    options: [
      { pokemonId: "morpeko-full-belly", label: "Full Belly" },
      { pokemonId: "morpeko-hangry", label: "Hangry" },
    ],
  },
];

export const battleOnlyAlternateFormIds = new Set(
  battleFormGroups.flatMap((group) =>
    group.options
      .filter((option) => option.pokemonId !== group.defaultPokemonId)
      .map((option) => option.pokemonId),
  ),
);

export function getBattleFormGroup(value: string) {
  return battleFormGroups.find(
    (group) =>
      group.speciesKey === value ||
      group.options.some((option) => option.pokemonId === value),
  );
}

export function areEquivalentBattleForms(first: string, second: string) {
  const firstGroup = getBattleFormGroup(first);
  const secondGroup = getBattleFormGroup(second);

  return Boolean(firstGroup && firstGroup === secondGroup);
}
