import type {
  CalculatorBuildValues,
  CalculatorSideBattleState,
} from "../calculatorEditorTypes";
import type {
  CalculatorField,
  DamageCalculationResult,
} from "../damageCalculator";
import type { DamageDirection } from "../calculatorViewModel";
import type {
  PokemonMove,
  PokemonItem,
  StatBlock,
  StatKey,
  TeamMember,
} from "../../types";

export type CalculatorAnalysisSide = {
  member: TeamMember | null;
  build: CalculatorBuildValues;
  battle: CalculatorSideBattleState;
  moves: Array<PokemonMove | undefined>;
  usageMoves?: PokemonMove[];
  usageItems?: PokemonItem[];
  maxHp: number;
};

export type CalculatorAnalysisContext = {
  battleFormat: CalculatorField["gameType"];
  selectedSlot: number;
  direction: DamageDirection;
  player: CalculatorAnalysisSide;
  opponent: CalculatorAnalysisSide;
  field: CalculatorField;
};

export type SetOptimizationFocus = "offense" | "defense" | "speed";
export type SetOptimizationMoveSource = "selected" | "usage";
export type SetOptimizationOutcomeComparison = "better" | "same" | "worse";
export type SetOptimizationCandidateProfile =
  | "offense-breakpoint"
  | "physical-bulk-maximum"
  | "special-bulk-maximum"
  | "physical-survival-with-reserve"
  | "special-survival-with-reserve"
  | "speed-adjustment";

export type SetOptimizationBenchmark = {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  defenderCurrentHp: number;
  defenderMaxHp: number;
  oneHitKoChance: number;
  koHits: number;
  koChance: number | null;
  possibleKoHits: number | null;
  guaranteedKoHits: number | null;
};

export type SetOptimizationMoveBenchmark = {
  moveId: string;
  moveName: string;
  currentMoveId: string;
  currentMoveName: string;
  moveCategory: "Physical" | "Special";
  source: SetOptimizationMoveSource;
  relevantStat: StatKey;
  optimizedVsCurrent: SetOptimizationOutcomeComparison;
  current: SetOptimizationBenchmark;
  optimized: SetOptimizationBenchmark;
};

export type SetOptimizationSpeedRelation = "faster" | "tie" | "slower";

export type SetOptimizationSpeedState = {
  playerSpeed: number;
  opponentSpeed: number;
  relation: SetOptimizationSpeedRelation;
};

export type SetOptimizationSpeedBenchmark = {
  current: SetOptimizationSpeedState;
  optimized: SetOptimizationSpeedState;
};

export type SetOptimizationCandidate = {
  id: string;
  slotIndex: number;
  focuses: SetOptimizationFocus[];
  profiles: SetOptimizationCandidateProfile[];
  maxedStats: StatKey[];
  natureId: string;
  evs: StatBlock;
  evTotal: number;
  finalStats: StatBlock;
  itemId: string | null;
  itemName: string | null;
  itemChanged: boolean;
  moveIds: string[];
  moveChanges: SetOptimizationMoveChange[];
  changedStatPoints: number;
  statPointChanges: StatBlock;
  offenseBenchmarks: SetOptimizationMoveBenchmark[];
  defenseBenchmarks: SetOptimizationMoveBenchmark[];
  speedBenchmark: SetOptimizationSpeedBenchmark;
};

export type SetOptimizationPlan = {
  status: "ready" | "unavailable";
  slotIndex: number;
  playerId: string | null;
  playerName: string | null;
  opponentId: string | null;
  opponentName: string | null;
  configuredDirection: DamageDirection;
  candidates: SetOptimizationCandidate[];
  reason?:
    | "missing-pokemon"
    | "missing-stats"
    | "missing-damaging-move"
    | "no-meaningful-candidate";
};

export type ReadyDamageResult = Extract<
  DamageCalculationResult,
  { status: "ready" }
>;

export type CandidateSeed = {
  natureId: string;
  evs: StatBlock;
  focuses: SetOptimizationFocus[];
  targets: Partial<StatBlock>;
  axes: string[];
};

export type SetOptimizationMoveChange = {
  slotIndex: number;
  currentMoveId: string;
  currentMoveName: string;
  optimizedMoveId: string;
  optimizedMoveName: string;
  sameTypeAndCategory: boolean;
};

export type CandidateLoadout = {
  item: PokemonItem | null;
  moveIds: string[];
  moves: OptimizationMove[];
  moveChanges: SetOptimizationMoveChange[];
};

export type EvaluatedCandidate = SetOptimizationCandidate & { roleCost?: number };

export type OptimizationMove = {
  move: PokemonMove;
  source: SetOptimizationMoveSource;
};

export type EvaluatedSeed = {
  seed: CandidateSeed;
  candidate: EvaluatedCandidate;
};

export type OptimizationEvaluator = {
  calculate: (
    move: PokemonMove,
    playerBuild: CalculatorBuildValues,
    direction: DamageDirection,
  ) => ReadyDamageResult | null;
  speed: (
    playerBuild: CalculatorBuildValues,
  ) => SetOptimizationSpeedState | null;
};

export type ProbabilisticKoOutcome = {
  hitCount: number;
  chance: number;
};

export type KoProbabilitySource = {
  oneHitKoChance: number;
  koHits: number;
  koChance: number | null;
};
