import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
} from "../types";
import { analyzeTeam, type TeamDiagnosticsResult } from "./teamDiagnostics";
import type { TeamBuildState } from "./teamBuildState";
import { validateTeam, type TeamValidityResult } from "./teamValidity";

export type TeamAnalysisContext = {
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
};

type CreateTeamAnalysisContextInput = {
  team: TeamSlot[];
  buildState: TeamBuildState;
  moveSources?: TeamMember[];
  legality: ShowdownLegalitySnapshot | null;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
};

export function createTeamAnalysisContext({
  team,
  buildState,
  moveSources = [],
  legality,
  pokemonIndex,
  itemIndex,
}: CreateTeamAnalysisContextInput): TeamAnalysisContext {
  return {
    diagnostics: analyzeTeam(team, buildState, moveSources),
    validity: validateTeam(
      team,
      buildState,
      legality,
      pokemonIndex,
      itemIndex,
    ),
  };
}
