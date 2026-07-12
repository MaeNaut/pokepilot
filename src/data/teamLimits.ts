export const ACTIVE_TEAM_SIZE = 6;
export const MAX_SAVED_TEAMS = 30;
export const MAX_BENCH_POKEMON = 6;

export function canAddSavedTeam(savedTeamCount: number) {
  return savedTeamCount < MAX_SAVED_TEAMS;
}

export function canAddBenchPokemon(benchPokemonCount: number) {
  return benchPokemonCount < MAX_BENCH_POKEMON;
}
