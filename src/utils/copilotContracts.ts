import type { BattleFormat } from "../battleFormat/battleFormat";
import type {
  CalculatorAnalysisContext,
  SetOptimizationBenchmark,
  SetOptimizationPlan,
  SetOptimizationCandidateProfile,
  SetOptimizationFocus,
  SetOptimizationMoveSource,
  SetOptimizationOutcomeComparison,
  SetOptimizationSpeedBenchmark,
} from "../calculator/setOptimizer";
import type { TeamConceptId } from "../data/teamConcepts";
import type { Locale } from "../i18n/gameTranslations";
import type {
  PokemonCandidateFilterValue,
  PokemonAbility,
  PokemonIndexEntry,
  PokemonMove,
  PokemonType,
  StatBlock,
  StatKey,
  TeamSlot,
} from "../types";
import type { CopilotMechanicsSnapshot } from "./copilotMechanics";
import type { CopilotResponsibilityId } from "./copilotResponsibilities";
import type { CopilotRecommendationCandidateSnapshot } from "./pokemonRecommendations";
import type {
  DefensiveMatchup,
  PokemonDefensiveProfile,
  TeamDiagnosticAlert,
  TeamDiagnosticsResult,
  TeamRoleId,
} from "./teamDiagnostics";
import type { TeamConceptSummary } from "./teamConcepts";
import type { TeamBuildState } from "./teamBuildState";
import type {
  TeamValidityResult,
  ValidityIssue,
  ValidityStatus,
} from "./teamValidity";

export type CopilotAnalysisScope =
  | "team"
  | "pokemon"
  | "recommendation"
  | "optimization";

export type CopilotPriority = "high" | "medium" | "low";

export type CopilotMoveCategory =
  | "physical"
  | "special"
  | "status"
  | "unknown";

export type CopilotMoveSpreadTarget = "all" | "adjacent" | "foes";

export type CopilotMoveSnapshot = Pick<
  PokemonMove,
  "id" | "name" | "type" | "power"
> & {
  displayName: string;
  category: CopilotMoveCategory;
  spreadTarget: CopilotMoveSpreadTarget | null;
};

export type CopilotSetOffensiveProfile = {
  physicalMoveIds: string[];
  specialMoveIds: string[];
  statusMoveIds: string[];
  spreadMoveIds: string[];
};

export type CopilotTeamOffensiveProfile = {
  physicalMoveCount: number;
  specialMoveCount: number;
  spreadMoveCount: number;
  physicalSources: Record<string, string[]>;
  specialSources: Record<string, string[]>;
  spreadSources: Record<string, string[]>;
};

export type CopilotTeamDefensiveProfile = {
  weakTo: Partial<Record<PokemonType, string[]>>;
  resists: Partial<Record<PokemonType, string[]>>;
  immuneTo: Partial<Record<PokemonType, string[]>>;
};

export type CopilotMegaEvolutionSnapshot = {
  pokemonId: string;
  pokemonName: string;
  displayName: string;
  types: PokemonType[];
  typeDisplayNames: string[];
  ability: string | null;
  abilityDisplayName: string | null;
  defensiveProfile: PokemonDefensiveProfile;
};

export type CopilotMegaOptionSnapshot = {
  slotIndex: number;
  pokemonId: string;
  pokemonName: string;
  displayName: string;
  types: PokemonType[];
  typeDisplayNames: string[];
  ability: string | null;
  abilityDisplayName: string | null;
};

export type CopilotSetSnapshot = {
  slotIndex: number;
  pokemonId: string;
  pokemonName: string;
  displayName: string;
  isMegaForm: boolean;
  types: PokemonType[];
  typeDisplayNames: string[];
  item: string | null;
  itemDisplayName: string | null;
  ability: string | null;
  abilityDisplayName: string | null;
  nature: string;
  natureDisplayName: string;
  baseStats: StatBlock | null;
  stats: StatBlock | null;
  evs: StatBlock;
  evTotal: number;
  moves: CopilotMoveSnapshot[];
  defensiveProfile: PokemonDefensiveProfile;
  megaEvolution: CopilotMegaEvolutionSnapshot | null;
  offensiveProfile: CopilotSetOffensiveProfile;
  roleIds: TeamRoleId[];
  setterConceptIds: TeamConceptId[];
  aceConceptIds: TeamConceptId[];
  validityStatus: ValidityStatus;
  validityIssues: ValidityIssue[];
};

export type CopilotDiagnosticsSnapshot = {
  filledSlots: number;
  coverageCount: number;
  coverageGaps: PokemonType[];
  defensiveMatchups: DefensiveMatchup[];
  alerts: TeamDiagnosticAlert[];
  roleCounts: Record<TeamRoleId, number>;
  responsibilityCounts: Record<CopilotResponsibilityId, number>;
  moveSources: Record<string, string[]>;
  defensiveProfile: CopilotTeamDefensiveProfile;
  offensiveProfile: CopilotTeamOffensiveProfile;
  concepts: TeamConceptSummary[];
  validity: Pick<
    TeamValidityResult,
    "status" | "errorCount" | "unavailableCount"
  >;
};

export type CopilotCandidateFilterSnapshot = {
  slotIndex: number;
  types: PokemonType[];
  ability: PokemonCandidateFilterValue | null;
  moves: PokemonCandidateFilterValue[];
};

export type CopilotTypeLabelSnapshot = {
  id: PokemonType;
  displayName: string;
};

export type CopilotSetOptimizationCandidateSnapshot = {
  id: string;
  slotIndex: number;
  focuses: SetOptimizationFocus[];
  profiles: SetOptimizationCandidateProfile[];
  maxedStats: StatKey[];
  natureId: string;
  natureDisplayName: string;
  evs: StatBlock;
  evTotal: number;
  finalStats: StatBlock;
  itemId: string | null;
  itemDisplayName: string | null;
  changedStatPoints: number;
  statPointChanges: StatBlock;
  offenseBenchmarks: Array<{
    moveId: string;
    moveDisplayName: string;
    moveCategory: "Physical" | "Special";
    source: SetOptimizationMoveSource;
    relevantStat: StatKey;
    optimizedVsCurrent: SetOptimizationOutcomeComparison;
    current: SetOptimizationBenchmark;
    optimized: SetOptimizationBenchmark;
  }>;
  defenseBenchmarks: Array<{
    moveId: string;
    moveDisplayName: string;
    moveCategory: "Physical" | "Special";
    source: SetOptimizationMoveSource;
    relevantStat: StatKey;
    optimizedVsCurrent: SetOptimizationOutcomeComparison;
    current: SetOptimizationBenchmark;
    optimized: SetOptimizationBenchmark;
  }>;
  speedBenchmark: SetOptimizationSpeedBenchmark;
};

export type CopilotSetOptimizationSnapshot = {
  slotIndex: number;
  configuredDirection: CalculatorAnalysisContext["direction"];
  playerPokemonId: string;
  playerDisplayName: string;
  opponentPokemonId: string;
  opponentDisplayName: string;
  field: CalculatorAnalysisContext["field"];
  currentBuild: {
    natureId: string;
    natureDisplayName: string;
    evs: StatBlock;
    finalStats: StatBlock;
    itemId: string | null;
    itemDisplayName: string | null;
  };
  candidates: CopilotSetOptimizationCandidateSnapshot[];
};

export type CopilotAnalysisRequest = {
  version: 18;
  locale: Locale;
  scope: CopilotAnalysisScope;
  battleFormat: BattleFormat;
  teamName: string;
  selectedSlot: number;
  typeLabels: CopilotTypeLabelSnapshot[];
  sets: CopilotSetSnapshot[];
  megaOptions: CopilotMegaOptionSnapshot[];
  candidateFilters: CopilotCandidateFilterSnapshot[];
  recommendationCandidates: CopilotRecommendationCandidateSnapshot[];
  optimization?: CopilotSetOptimizationSnapshot | null;
  mechanics: CopilotMechanicsSnapshot;
  diagnostics: CopilotDiagnosticsSnapshot;
};

export type CopilotRecommendation = {
  id: string;
  title: string;
  reason: string;
  priority: CopilotPriority;
};

export type CopilotAnalysisResponse = {
  version: 2;
  source: "local" | "hosted";
  scope: CopilotAnalysisScope;
  title: string;
  paragraphs: string[];
  recommendations: CopilotRecommendation[];
  optimizationCandidates?: CopilotSetOptimizationCandidateSnapshot[];
};

export type CreateCopilotRequestInput = {
  scope: CopilotAnalysisScope;
  locale?: Locale;
  battleFormat?: BattleFormat;
  teamName: string;
  team: TeamSlot[];
  pokemonIndex?: PokemonIndexEntry[];
  abilityIndex?: PokemonAbility[];
  selectedSlot: number;
  buildState: TeamBuildState;
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
  recommendationCandidates?: CopilotRecommendationCandidateSnapshot[];
  calculatorContext?: CalculatorAnalysisContext | null;
  // Undefined keeps the synchronous path for evaluation scripts; null skips search.
  optimizationPlan?: SetOptimizationPlan | null;
};
