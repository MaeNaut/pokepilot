import type {
  CalculatorBuildValues,
  CalculatorSideBattleState,
} from "./calculatorEditorTypes";
import {
  calculateChampionsDamage,
  type CalculatorField,
  type CalculatorPokemon,
  type DamageCalculationResult,
} from "./damageCalculator";
import type { DamageDirection } from "./calculatorViewModel";
import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  getNatureById,
  natures,
  statKeys,
} from "../data/natures";
import type {
  PokemonMove,
  StatBlock,
  StatKey,
  TeamMember,
} from "../types";

export type CalculatorAnalysisSide = {
  member: TeamMember | null;
  build: CalculatorBuildValues;
  battle: CalculatorSideBattleState;
  moves: Array<PokemonMove | undefined>;
  usageMoves?: PokemonMove[];
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

type ReadyDamageResult = Extract<DamageCalculationResult, { status: "ready" }>;

type CandidateSeed = {
  natureId: string;
  evs: StatBlock;
  focuses: SetOptimizationFocus[];
  targets: Partial<StatBlock>;
  axes: string[];
};

type EvaluatedCandidate = SetOptimizationCandidate;

type OptimizationMove = {
  move: PokemonMove;
  source: SetOptimizationMoveSource;
};

type EvaluatedSeed = {
  seed: CandidateSeed;
  candidate: EvaluatedCandidate;
};

type OptimizationEvaluator = {
  calculate: (
    move: PokemonMove,
    playerBuild: CalculatorBuildValues,
    direction: DamageDirection,
  ) => ReadyDamageResult | null;
  speed: (
    playerBuild: CalculatorBuildValues,
  ) => SetOptimizationSpeedState | null;
};

type ProbabilisticKoOutcome = {
  hitCount: number;
  chance: number;
};

type KoProbabilitySource = {
  oneHitKoChance: number;
  koHits: number;
  koChance: number | null;
};

const MAX_PRACTICAL_GUARANTEED_KO_HITS = 3;
const MAX_PRACTICAL_DEFENSIVE_KO_HITS = 3;
const MAX_OPTIMIZATION_CANDIDATES = 8;
const MAX_BENCHMARKS_PER_AXIS = 2;
const MAX_USAGE_MOVES_PER_SIDE = 4;
const MAX_BREAKPOINTS_PER_MOVE_NATURE = 6;
const MAX_COMBINATION_FRONTIER = 40;
const MAX_FINAL_SEARCH_FRONTIER = 160;
const MIN_MEANINGFUL_KO_CHANCE_GAIN = 6.25;
const KO_CHANCE_EPSILON = 0.01;

function totalStatPoints(evs: StatBlock) {
  return statKeys.reduce((total, stat) => total + evs[stat], 0);
}

function clampStatPoints(value: number) {
  return Math.max(
    0,
    Math.min(CHAMPIONS_MAX_EV_PER_STAT, Math.round(value)),
  );
}

function getChangedStatPoints(current: StatBlock, candidate: StatBlock) {
  return statKeys.reduce(
    (total, stat) => total + Math.abs(candidate[stat] - current[stat]),
    0,
  );
}

function getStatPointChanges(current: StatBlock, candidate: StatBlock) {
  return statKeys.reduce<StatBlock>((changes, stat) => {
    changes[stat] = candidate[stat] - current[stat];
    return changes;
  }, {} as StatBlock);
}

function getOppositeOffenseStat(stat: StatKey): StatKey | null {
  if (stat === "attack") return "specialAttack";
  if (stat === "specialAttack") return "attack";
  return null;
}

function rebalanceSpread(
  current: StatBlock,
  targets: Partial<StatBlock>,
): StatBlock {
  const targetStats = new Set(Object.keys(targets) as StatKey[]);
  const next = statKeys.reduce<StatBlock>((spread, stat) => {
    spread[stat] = clampStatPoints(targets[stat] ?? current[stat]);
    return spread;
  }, {} as StatBlock);
  const targetedOffense = [...targetStats].find(
    (stat) => stat === "attack" || stat === "specialAttack",
  );
  const oppositeOffense = targetedOffense
    ? getOppositeOffenseStat(targetedOffense)
    : null;
  const adjustableStats = statKeys.filter((stat) => !targetStats.has(stat));
  const trimOrder = [...adjustableStats].sort((left, right) => {
    if (left === oppositeOffense) return -1;
    if (right === oppositeOffense) return 1;
    if (left === "hp") return 1;
    if (right === "hp") return -1;
    return current[left] - current[right];
  });

  let overflow = Math.max(0, totalStatPoints(next) - CHAMPIONS_MAX_EV_TOTAL);
  for (const stat of trimOrder) {
    if (overflow === 0) break;
    const removed = Math.min(next[stat], overflow);
    next[stat] -= removed;
    overflow -= removed;
  }

  let remaining = CHAMPIONS_MAX_EV_TOTAL - totalStatPoints(next);
  const fillOrder = [...adjustableStats].sort((left, right) => {
    if (left === "hp") return -1;
    if (right === "hp") return 1;
    if (left === oppositeOffense) return 1;
    if (right === oppositeOffense) return -1;
    return current[right] - current[left];
  });
  for (const stat of fillOrder) {
    if (remaining === 0) break;
    const added = Math.min(
      CHAMPIONS_MAX_EV_PER_STAT - next[stat],
      remaining,
    );
    next[stat] += added;
    remaining -= added;
  }

  return next;
}

function createCalculatorPokemon(
  side: CalculatorAnalysisSide,
  move: PokemonMove,
  build: CalculatorBuildValues = side.build,
  battle: CalculatorSideBattleState = side.battle,
): CalculatorPokemon | null {
  if (!side.member) return null;

  return {
    member: side.member,
    item: build.item,
    ability: build.ability,
    natureId: build.natureId,
    evs: build.evs,
    boosts: battle.boosts,
    currentHp: battle.currentHp,
    status: battle.status,
    move,
  };
}

function toBenchmark(result: ReadyDamageResult): SetOptimizationBenchmark {
  return {
    minDamage: result.minDamage,
    maxDamage: result.maxDamage,
    minPercent: Number(result.minPercent.toFixed(2)),
    maxPercent: Number(result.maxPercent.toFixed(2)),
    defenderCurrentHp: result.defenderCurrentHp,
    defenderMaxHp: result.defenderMaxHp,
    oneHitKoChance: Number(result.oneHitKoChance.toFixed(2)),
    koHits: result.koHits,
    koChance:
      result.koChance === null ? null : Number(result.koChance.toFixed(2)),
    possibleKoHits:
      result.maxDamage > 0
        ? Math.ceil(result.defenderCurrentHp / result.maxDamage)
        : null,
    guaranteedKoHits:
      result.minDamage > 0
        ? Math.ceil(result.defenderCurrentHp / result.minDamage)
        : null,
  };
}

function getScaledBattleState(
  side: CalculatorAnalysisSide,
  build: CalculatorBuildValues,
): CalculatorSideBattleState {
  if (!side.member?.baseStats) return side.battle;

  const maxHp = calculateChampionsStats(
    side.member.baseStats,
    build.evs,
    getNatureById(build.natureId),
  ).hp;

  return {
    ...side.battle,
    currentHp:
      side.battle.currentHp >= side.maxHp
        ? maxHp
        : Math.max(1, Math.min(maxHp, side.battle.currentHp)),
  };
}

function getFieldForDirection(
  context: CalculatorAnalysisContext,
  direction: DamageDirection,
): CalculatorField {
  if (context.direction === direction) return context.field;

  return {
    ...context.field,
    isCritical: false,
    isHelpingHand: false,
    isTailwind: false,
    isFriendGuard: false,
    isPlusMinus: false,
    isWall: false,
  };
}

function calculateForBuild(
  context: CalculatorAnalysisContext,
  move: PokemonMove,
  playerBuild: CalculatorBuildValues,
  direction: DamageDirection,
): ReadyDamageResult | null {
  const playerBattle = getScaledBattleState(context.player, playerBuild);
  const player = createCalculatorPokemon(
    context.player,
    move,
    playerBuild,
    playerBattle,
  );
  const opponent = createCalculatorPokemon(context.opponent, move);

  if (!player || !opponent) return null;

  const result =
    direction === "player-to-opponent"
      ? calculateChampionsDamage(
          player,
          opponent,
          getFieldForDirection(context, direction),
        )
      : calculateChampionsDamage(
          opponent,
          player,
          getFieldForDirection(context, direction),
        );

  return result.status === "ready" ? result : null;
}

function getBuildCacheKey(build: CalculatorBuildValues) {
  return `${build.natureId}:${statKeys
    .map((stat) => build.evs[stat])
    .join("-")}`;
}

function createOptimizationEvaluator(
  context: CalculatorAnalysisContext,
): OptimizationEvaluator {
  const damageCache = new Map<string, ReadyDamageResult | null>();
  const speedCache = new Map<string, SetOptimizationSpeedState | null>();

  return {
    calculate(move, playerBuild, direction) {
      const key = `${direction}:${move.id}:${getBuildCacheKey(playerBuild)}`;
      if (damageCache.has(key)) return damageCache.get(key) ?? null;

      const result = calculateForBuild(context, move, playerBuild, direction);
      damageCache.set(key, result);
      return result;
    },
    speed(playerBuild) {
      const key = getBuildCacheKey(playerBuild);
      if (speedCache.has(key)) return speedCache.get(key) ?? null;

      const result = getSpeedState(context, playerBuild);
      speedCache.set(key, result);
      return result;
    },
  };
}

function getDamagingMoves(side: CalculatorAnalysisSide) {
  const moves = new Map<string, OptimizationMove>();
  const addMove = (
    move: PokemonMove | undefined,
    source: SetOptimizationMoveSource,
  ) => {
    if (
      !move?.power ||
      move.power <= 0 ||
      (move.category !== "Physical" && move.category !== "Special") ||
      moves.has(move.id)
    ) {
      return false;
    }

    moves.set(move.id, { move, source });
    return true;
  };

  side.moves.forEach((move) => addMove(move, "selected"));

  let addedUsageMoves = 0;
  for (const move of side.usageMoves ?? []) {
    if (addMove(move, "usage")) addedUsageMoves += 1;
    if (addedUsageMoves >= MAX_USAGE_MOVES_PER_SIDE) break;
  }

  return [...moves.values()];
}

function getNatureCandidates(natureId: string, targetStat: StatKey) {
  const ids = new Set([natureId]);

  if (targetStat !== "hp") {
    natures
      .filter(
        (nature) =>
          nature.up === targetStat &&
          nature.down !== targetStat &&
          !(
            (targetStat === "defense" ||
              targetStat === "specialDefense") &&
            (nature.down === "defense" ||
              nature.down === "specialDefense")
          ),
      )
      .forEach((nature) => ids.add(nature.id));
  }

  return [...ids];
}

function getOffenseNatureCandidates(
  context: CalculatorAnalysisContext,
  targetStat: Exclude<StatKey, "hp">,
) {
  const ids = new Set([context.player.build.natureId]);
  const oppositeOffense = getOppositeOffenseStat(targetStat);
  const canLowerSpeed = context.player.build.evs.speed === 0;

  natures
    .filter(
      (nature) =>
        nature.up !== nature.down &&
        nature.up !== oppositeOffense &&
        (nature.down === oppositeOffense ||
          (canLowerSpeed && nature.down === "speed")),
    )
    .forEach((nature) => ids.add(nature.id));

  return [...ids];
}

function getSpeedNatureCandidates(
  currentNatureId: string,
  mode: "fast" | "slow",
) {
  const ids = new Set([currentNatureId]);

  natures
    .filter((nature) =>
      mode === "fast"
        ? nature.up === "speed" &&
          (nature.down === "attack" || nature.down === "specialAttack")
        : nature.down === "speed" && nature.up !== "speed",
    )
    .forEach((nature) => ids.add(nature.id));

  return [...ids];
}

function createBuild(
  context: CalculatorAnalysisContext,
  natureId: string,
  evs: StatBlock,
): CalculatorBuildValues {
  return { ...context.player.build, natureId, evs };
}

function createSeed(
  natureId: string,
  evs: StatBlock,
  focus: SetOptimizationFocus,
  targets: Partial<StatBlock>,
  axis: string,
): CandidateSeed {
  return {
    natureId,
    evs,
    focuses: [focus],
    targets,
    axes: [axis],
  };
}

function getTargetPointTotal(targets: Partial<StatBlock>) {
  return statKeys.reduce((total, stat) => total + (targets[stat] ?? 0), 0);
}

function getOutcomeBreakpointSubset<T>(
  entries: T[],
  getTier: (entry: T) => string,
) {
  if (entries.length <= MAX_BREAKPOINTS_PER_MOVE_NATURE) return entries;

  const selected = new Set<T>();
  const firstByTier = new Map<string, T>();
  entries.forEach((entry) => {
    const tier = getTier(entry);
    if (!firstByTier.has(tier)) firstByTier.set(tier, entry);
  });
  selected.add(entries[0]);
  selected.add(entries[entries.length - 1]);

  const available = [...firstByTier.values()].filter(
    (entry) => !selected.has(entry),
  );
  const spaces = MAX_BREAKPOINTS_PER_MOVE_NATURE - selected.size;
  for (let index = 0; index < spaces && available.length > 0; index += 1) {
    const position = Math.floor(((index + 1) * available.length) / (spaces + 1));
    selected.add(available[Math.min(position, available.length - 1)]);
  }

  return entries.filter((entry) => selected.has(entry));
}

function getGuaranteedKoHits(result: ReadyDamageResult) {
  return result.minDamage > 0
    ? Math.ceil(result.defenderCurrentHp / result.minDamage)
    : null;
}

function getProbabilisticKoOutcome(
  result: KoProbabilitySource,
): ProbabilisticKoOutcome | null {
  if (result.oneHitKoChance > 0) {
    return { hitCount: 1, chance: result.oneHitKoChance };
  }
  if (result.koHits <= 0 || result.koChance === null || result.koChance <= 0) {
    return null;
  }

  return { hitCount: result.koHits, chance: result.koChance };
}

function hasMeaningfulProbabilisticKoGain(
  optimized: KoProbabilitySource,
  current: KoProbabilitySource,
) {
  const optimizedOutcome = getProbabilisticKoOutcome(optimized);
  const currentOutcome = getProbabilisticKoOutcome(current);
  if (!optimizedOutcome) return false;
  if (!currentOutcome) {
    return (
      optimizedOutcome.chance + KO_CHANCE_EPSILON >=
      MIN_MEANINGFUL_KO_CHANCE_GAIN
    );
  }
  if (optimizedOutcome.hitCount < currentOutcome.hitCount) {
    return (
      optimizedOutcome.chance + KO_CHANCE_EPSILON >=
      MIN_MEANINGFUL_KO_CHANCE_GAIN
    );
  }
  if (optimizedOutcome.hitCount > currentOutcome.hitCount) return false;

  return (
    optimizedOutcome.chance - currentOutcome.chance + KO_CHANCE_EPSILON >=
    MIN_MEANINGFUL_KO_CHANCE_GAIN
  );
}

function preservesProbabilisticKoOutcome(
  candidate: KoProbabilitySource,
  target: KoProbabilitySource,
) {
  const candidateOutcome = getProbabilisticKoOutcome(candidate);
  const targetOutcome = getProbabilisticKoOutcome(target);
  if (!targetOutcome) return true;
  if (!candidateOutcome) return false;
  if (candidateOutcome.hitCount < targetOutcome.hitCount) return true;
  if (candidateOutcome.hitCount > targetOutcome.hitCount) return false;

  return candidateOutcome.chance + KO_CHANCE_EPSILON >= targetOutcome.chance;
}

function compareOffenseOutcomes(
  left: SetOptimizationBenchmark,
  right: SetOptimizationBenchmark,
) {
  const leftGuaranteed = cappedOffenseHits(left.guaranteedKoHits);
  const rightGuaranteed = cappedOffenseHits(right.guaranteedKoHits);
  if (leftGuaranteed < rightGuaranteed) return 1;
  if (leftGuaranteed > rightGuaranteed) return -1;
  if (hasMeaningfulProbabilisticKoGain(left, right)) return 1;
  if (hasMeaningfulProbabilisticKoGain(right, left)) return -1;
  return 0;
}

function getOffenseOutcomeTier(result: SetOptimizationBenchmark) {
  const probability = getProbabilisticKoOutcome(result);
  return `${cappedOffenseHits(result.guaranteedKoHits)}:${
    probability
      ? `${probability.hitCount}:${Math.floor(
          (probability.chance + KO_CHANCE_EPSILON) /
            MIN_MEANINGFUL_KO_CHANCE_GAIN,
        )}`
      : "-"
  }`;
}

function isPracticalOffenseOutcome(result: SetOptimizationBenchmark) {
  const probability = getProbabilisticKoOutcome(result);
  return (
    cappedOffenseHits(result.guaranteedKoHits) <=
      MAX_PRACTICAL_GUARANTEED_KO_HITS ||
    (probability !== null &&
      probability.hitCount <= MAX_PRACTICAL_GUARANTEED_KO_HITS)
  );
}

function createOffenseSeeds(
  context: CalculatorAnalysisContext,
  move: PokemonMove,
  evaluator: OptimizationEvaluator,
) {
  const currentResult = evaluator.calculate(
    move,
    context.player.build,
    "player-to-opponent",
  );
  if (!currentResult || currentResult.offensiveStatOwner !== "attacker") {
    return [];
  }

  const targetStat = currentResult.offensiveStatKey;
  const currentBenchmark = toBenchmark(currentResult);

  return getOffenseNatureCandidates(context, targetStat).flatMap(
    (natureId) => {
      const breakpoints: Array<{
        investment: number;
        evs: StatBlock;
        benchmark: SetOptimizationBenchmark;
      }> = [];
      let lastBenchmark: SetOptimizationBenchmark | null = null;

      for (
        let investment = 0;
        investment <= CHAMPIONS_MAX_EV_PER_STAT;
        investment += 1
      ) {
        const targets = { [targetStat]: investment } as Partial<StatBlock>;
        const evs = rebalanceSpread(context.player.build.evs, targets);
        const result = evaluator.calculate(
          move,
          createBuild(context, natureId, evs),
          "player-to-opponent",
        );
        if (!result || result.offensiveStatOwner !== "attacker") continue;

        const benchmark = toBenchmark(result);
        if (!isPracticalOffenseOutcome(benchmark)) continue;

        const comparisonToCurrent = compareOffenseOutcomes(
          benchmark,
          currentBenchmark,
        );
        const preservesWithLessInvestment =
          comparisonToCurrent === 0 &&
          investment < context.player.build.evs[targetStat];
        if (comparisonToCurrent < 0) continue;
        if (comparisonToCurrent === 0 && !preservesWithLessInvestment) {
          continue;
        }
        if (
          lastBenchmark &&
          compareOffenseOutcomes(benchmark, lastBenchmark) <= 0
        ) {
          continue;
        }

        breakpoints.push({ investment, evs, benchmark });
        lastBenchmark = benchmark;
      }

      return getOutcomeBreakpointSubset(
        breakpoints,
        (entry) => getOffenseOutcomeTier(entry.benchmark),
      ).map((entry) =>
        createSeed(
          natureId,
          entry.evs,
          "offense",
          { [targetStat]: entry.investment },
          `offense:${targetStat}`,
        ),
      );
    },
  );
}

function getDefensiveTargetStat(
  context: CalculatorAnalysisContext,
  result: ReadyDamageResult,
) {
  if (context.field.room !== "wonder") return result.defensiveStatKey;
  if (result.defensiveStatKey === "defense") return "specialDefense";
  if (result.defensiveStatKey === "specialDefense") return "defense";
  return result.defensiveStatKey;
}

function compareDefenseOutcomes(
  left: SetOptimizationBenchmark,
  right: SetOptimizationBenchmark,
) {
  const leftPossible = cappedDefenseHits(left.possibleKoHits);
  const rightPossible = cappedDefenseHits(right.possibleKoHits);
  if (leftPossible > rightPossible) return 1;
  if (leftPossible < rightPossible) return -1;

  if (hasMeaningfulProbabilisticKoGain(right, left)) return 1;
  if (hasMeaningfulProbabilisticKoGain(left, right)) return -1;
  if (left.maxPercent < right.maxPercent - 2 + KO_CHANCE_EPSILON) return 1;
  if (left.maxPercent > right.maxPercent + 2 - KO_CHANCE_EPSILON) return -1;
  return 0;
}

function hasDefensiveSurvivalBoundaryGain(
  optimized: SetOptimizationBenchmark,
  current: SetOptimizationBenchmark,
) {
  return (
    cappedDefenseHits(optimized.possibleKoHits) >
      cappedDefenseHits(current.possibleKoHits) ||
    hasMeaningfulProbabilisticKoGain(current, optimized)
  );
}

function getDefenseOutcomeTier(result: SetOptimizationBenchmark) {
  const probability = getProbabilisticKoOutcome(result);
  return `${cappedDefenseHits(result.possibleKoHits)}:${
    probability
      ? `${probability.hitCount}:${Math.floor(
          (probability.chance + KO_CHANCE_EPSILON) /
            MIN_MEANINGFUL_KO_CHANCE_GAIN,
        )}`
      : "-"
  }:${Math.floor(result.maxPercent / 2)}`;
}

function createDefenseSeeds(
  context: CalculatorAnalysisContext,
  move: PokemonMove,
  evaluator: OptimizationEvaluator,
) {
  const currentResult = evaluator.calculate(
    move,
    context.player.build,
    "opponent-to-player",
  );
  if (!currentResult || currentResult.defensiveStatOwner !== "defender") {
    return [];
  }

  const targetStat = getDefensiveTargetStat(context, currentResult);
  const currentBenchmark = toBenchmark(currentResult);
  const currentBulkPoints =
    context.player.build.evs.hp + context.player.build.evs[targetStat];

  return getNatureCandidates(
    context.player.build.natureId,
    targetStat,
  ).flatMap((natureId) => {
    const bulkCandidates: Array<{
      hp: number;
      defense: number;
      evs: StatBlock;
      benchmark: SetOptimizationBenchmark;
    }> = [];

    for (
      let defense = 0;
      defense <= CHAMPIONS_MAX_EV_PER_STAT;
      defense += 1
    ) {
      // HP is completed first, then the relevant defense is scanned for the
      // first exact survival breakpoint. This avoids B/D-only bulk spreads.
      const hp = CHAMPIONS_MAX_EV_PER_STAT;
      const targets = { hp, [targetStat]: defense } as Partial<StatBlock>;
      const evs = rebalanceSpread(context.player.build.evs, targets);
      const result = evaluator.calculate(
        move,
        createBuild(context, natureId, evs),
        "opponent-to-player",
      );
      if (!result || result.defensiveStatOwner !== "defender") continue;

      bulkCandidates.push({
        hp,
        defense,
        evs,
        benchmark: toBenchmark(result),
      });
    }

    const breakpoints: typeof bulkCandidates = [];
    let lastBenchmark: SetOptimizationBenchmark | null = null;
    for (const candidate of bulkCandidates) {
      const comparisonToCurrent = compareDefenseOutcomes(
        candidate.benchmark,
        currentBenchmark,
      );
      const candidateCost = candidate.hp + candidate.defense;
      const preservesWithFewerPoints =
        comparisonToCurrent === 0 && candidateCost < currentBulkPoints;
      if (comparisonToCurrent < 0) continue;
      if (comparisonToCurrent === 0 && !preservesWithFewerPoints) continue;
      if (
        lastBenchmark &&
        compareDefenseOutcomes(candidate.benchmark, lastBenchmark) <= 0
      ) {
        continue;
      }

      breakpoints.push(candidate);
      lastBenchmark = candidate.benchmark;
    }

    return getOutcomeBreakpointSubset(
      breakpoints,
      (entry) => getDefenseOutcomeTier(entry.benchmark),
    ).map((entry) =>
      createSeed(
        natureId,
        entry.evs,
        "defense",
        { hp: entry.hp, [targetStat]: entry.defense },
        `defense:${targetStat}`,
      ),
    );
  });
}

function applyStatStage(value: number, stage: number) {
  const clampedStage = Number.isFinite(stage)
    ? Math.max(-6, Math.min(6, stage))
    : 0;

  return Math.floor(
    value *
      (clampedStage >= 0
        ? (2 + clampedStage) / 2
        : 2 / (2 - clampedStage)),
  );
}

function getSpeedState(
  context: CalculatorAnalysisContext,
  playerBuild: CalculatorBuildValues,
): SetOptimizationSpeedState | null {
  if (!context.player.member?.baseStats || !context.opponent.member?.baseStats) {
    return null;
  }

  const playerStats = calculateChampionsStats(
    context.player.member.baseStats,
    playerBuild.evs,
    getNatureById(playerBuild.natureId),
  );
  const opponentStats = calculateChampionsStats(
    context.opponent.member.baseStats,
    context.opponent.build.evs,
    getNatureById(context.opponent.build.natureId),
  );
  const playerTailwind =
    context.field.isTailwind && context.direction === "player-to-opponent";
  const opponentTailwind =
    context.field.isTailwind && context.direction === "opponent-to-player";
  const playerSpeed =
    applyStatStage(playerStats.speed, context.player.battle.boosts.speed) *
    (playerTailwind ? 2 : 1);
  const opponentSpeed =
    applyStatStage(opponentStats.speed, context.opponent.battle.boosts.speed) *
    (opponentTailwind ? 2 : 1);

  return {
    playerSpeed,
    opponentSpeed,
    relation:
      playerSpeed === opponentSpeed
        ? "tie"
        : playerSpeed > opponentSpeed
          ? "faster"
          : "slower",
  };
}

function createSpeedSeeds(
  context: CalculatorAnalysisContext,
  evaluator: OptimizationEvaluator,
) {
  const currentSpeed = evaluator.speed(context.player.build);
  if (!currentSpeed) return [];

  const seeds: CandidateSeed[] = [];
  for (const natureId of getSpeedNatureCandidates(
    context.player.build.natureId,
    "fast",
  )) {
    for (
      let speedInvestment = 0;
      speedInvestment <= CHAMPIONS_MAX_EV_PER_STAT;
      speedInvestment += 1
    ) {
      const speed = speedInvestment;
      const evs = rebalanceSpread(context.player.build.evs, { speed });
      const build = createBuild(context, natureId, evs);
      const speedState = evaluator.speed(build);
      if (speedState?.relation === "faster") {
        seeds.push(
          createSeed(
            natureId,
            evs,
            "speed",
            { speed },
            "speed:fast",
          ),
        );
        break;
      }
    }
  }

  for (const natureId of getSpeedNatureCandidates(
    context.player.build.natureId,
    "slow",
  )) {
    const evs = rebalanceSpread(context.player.build.evs, { speed: 0 });
    const speed = evaluator.speed(createBuild(context, natureId, evs));
    if (speed?.relation === "slower") {
      seeds.push(
        createSeed(
          natureId,
          evs,
          "speed",
          { speed: 0 },
          "speed:slow",
        ),
      );
    }
  }

  return seeds;
}

function minimizeRedundantOffense(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  moves: OptimizationMove[],
  evaluator: OptimizationEvaluator,
) {
  let evs = seed.evs;
  const targets = { ...seed.targets };

  for (const stat of ["attack", "specialAttack"] as const) {
    const baselineBuild = createBuild(context, seed.natureId, evs);
    const zeroInvestmentEvs = rebalanceSpread(evs, {
      ...targets,
      [stat]: 0,
    });
    const zeroInvestmentBuild = createBuild(
      context,
      seed.natureId,
      zeroInvestmentEvs,
    );
    const relevantMoves = moves.flatMap(({ move }) => {
      const result = evaluator.calculate(
        move,
        baselineBuild,
        "player-to-opponent",
      );
      const zeroInvestmentResult = evaluator.calculate(
        move,
        zeroInvestmentBuild,
        "player-to-opponent",
      );

      if (
        result?.offensiveStatOwner !== "attacker" ||
        result.offensiveStatKey !== stat ||
        zeroInvestmentResult?.offensiveStatOwner !== "attacker" ||
        zeroInvestmentResult.offensiveStatKey !== stat ||
        !isPracticalOffenseOutcome(toBenchmark(result))
      ) {
        return [];
      }

      return [
        {
          move,
          targetHits: cappedOffenseHits(getGuaranteedKoHits(result)),
          probabilityTarget: hasMeaningfulProbabilisticKoGain(
            result,
            zeroInvestmentResult,
          )
            ? result
            : null,
        },
      ];
    });
    let best = zeroInvestmentEvs;

    if (relevantMoves.length > 0) {
      let minimum = 0;
      let maximum = evs[stat];
      best = evs;

      while (minimum <= maximum) {
        const investment = Math.floor((minimum + maximum) / 2);
        const candidateEvs = rebalanceSpread(evs, {
          ...targets,
          [stat]: investment,
        });
        const candidateBuild = createBuild(
          context,
          seed.natureId,
          candidateEvs,
        );
        const preservesEveryTier = relevantMoves.every(
          ({ move, targetHits, probabilityTarget }) => {
            const result = evaluator.calculate(
              move,
              candidateBuild,
              "player-to-opponent",
            );

            return (
              result?.offensiveStatOwner === "attacker" &&
              result.offensiveStatKey === stat &&
              cappedOffenseHits(getGuaranteedKoHits(result)) <= targetHits &&
              (!probabilityTarget ||
                preservesProbabilisticKoOutcome(result, probabilityTarget))
            );
          },
        );

        if (preservesEveryTier) {
          best = candidateEvs;
          maximum = investment - 1;
        } else {
          minimum = investment + 1;
        }
      }
    }

    evs = best;
    targets[stat] = best[stat];
  }

  return { ...seed, evs, targets };
}

function mergeSeeds(seeds: CandidateSeed[]) {
  const merged = new Map<string, CandidateSeed>();

  for (const seed of seeds) {
    const key = `${seed.natureId}:${statKeys
      .map((stat) => seed.evs[stat])
      .join("-")}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, seed);
      continue;
    }

    existing.focuses = [...new Set([...existing.focuses, ...seed.focuses])];
    existing.axes = [...new Set([...existing.axes, ...seed.axes])];
    for (const stat of statKeys) {
      const target = seed.targets[stat];
      if (target !== undefined) {
        existing.targets[stat] = Math.max(
          existing.targets[stat] ?? 0,
          target,
        );
      }
    }
  }

  return [...merged.values()];
}

function combineSeeds(
  context: CalculatorAnalysisContext,
  left: CandidateSeed,
  right: CandidateSeed,
) {
  if (left.axes.some((axis) => right.axes.includes(axis))) return [];

  const targets = { ...left.targets };
  for (const stat of statKeys) {
    const rightTarget = right.targets[stat];
    if (rightTarget === undefined) continue;
    targets[stat] = Math.max(targets[stat] ?? 0, rightTarget);
  }
  if (getTargetPointTotal(targets) > CHAMPIONS_MAX_EV_TOTAL) return [];

  return [...new Set([left.natureId, right.natureId])].flatMap(
    (natureId): CandidateSeed[] => {
      const evs = rebalanceSpread(context.player.build.evs, targets);
      if (totalStatPoints(evs) !== CHAMPIONS_MAX_EV_TOTAL) return [];

      return [
        {
          natureId,
          evs,
          focuses: [...new Set([...left.focuses, ...right.focuses])],
          targets,
          axes: [...new Set([...left.axes, ...right.axes])],
        },
      ];
    },
  );
}

function createCombinedSeeds(
  context: CalculatorAnalysisContext,
  leftSeeds: CandidateSeed[],
  rightSeeds: CandidateSeed[],
  shouldCombine: (left: CandidateSeed, right: CandidateSeed) => boolean =
    () => true,
) {
  const combined: CandidateSeed[] = [];
  for (const left of leftSeeds) {
    for (const right of rightSeeds) {
      if (left === right || !shouldCombine(left, right)) continue;
      combined.push(...combineSeeds(context, left, right));
    }
  }
  return mergeSeeds(combined);
}

function createMoveBenchmark(
  move: PokemonMove,
  source: SetOptimizationMoveSource,
  current: ReadyDamageResult,
  optimized: ReadyDamageResult,
  focus: "offense" | "defense",
  relevantStat: StatKey,
): SetOptimizationMoveBenchmark {
  const currentBenchmark = toBenchmark(current);
  const optimizedBenchmark = toBenchmark(optimized);
  const comparison =
    focus === "offense"
      ? compareOffenseOutcomes(optimizedBenchmark, currentBenchmark)
      : compareDefenseOutcomes(optimizedBenchmark, currentBenchmark);

  return {
    moveId: move.id,
    moveName: move.name,
    moveCategory: move.category as "Physical" | "Special",
    source,
    relevantStat,
    optimizedVsCurrent:
      comparison > 0 ? "better" : comparison < 0 ? "worse" : "same",
    current: currentBenchmark,
    optimized: optimizedBenchmark,
  };
}

function getCandidateProfiles(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  offenseBenchmarks: SetOptimizationMoveBenchmark[],
  defenseBenchmarks: SetOptimizationMoveBenchmark[],
  currentSpeed: SetOptimizationSpeedState,
  optimizedSpeed: SetOptimizationSpeedState,
): SetOptimizationCandidateProfile[] {
  const profiles = new Set<SetOptimizationCandidateProfile>();

  if (
    offenseBenchmarks.some(
      (benchmark) => benchmark.optimizedVsCurrent === "better",
    )
  ) {
    profiles.add("offense-breakpoint");
  }

  for (const benchmark of defenseBenchmarks) {
    if (benchmark.optimizedVsCurrent !== "better") continue;
    const targetStat = benchmark.relevantStat;
    if (targetStat !== "defense" && targetStat !== "specialDefense") {
      continue;
    }

    const maximumProfile =
      targetStat === "defense"
        ? "physical-bulk-maximum"
        : "special-bulk-maximum";
    const reserveProfile =
      targetStat === "defense"
        ? "physical-survival-with-reserve"
        : "special-survival-with-reserve";
    const oppositeStat =
      targetStat === "defense" ? "specialDefense" : "defense";

    if (
      seed.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
      seed.evs[targetStat] === CHAMPIONS_MAX_EV_PER_STAT
    ) {
      profiles.add(maximumProfile);
    } else if (
      seed.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
      seed.evs[targetStat] < CHAMPIONS_MAX_EV_PER_STAT &&
      seed.evs[oppositeStat] > context.player.build.evs[oppositeStat] &&
      hasDefensiveSurvivalBoundaryGain(
        benchmark.optimized,
        benchmark.current,
      )
    ) {
      profiles.add(reserveProfile);
    }
  }

  if (
    currentSpeed.relation !== optimizedSpeed.relation ||
    currentSpeed.playerSpeed !== optimizedSpeed.playerSpeed
  ) {
    profiles.add("speed-adjustment");
  }

  return [...profiles];
}

function evaluateSeed(
  context: CalculatorAnalysisContext,
  seed: CandidateSeed,
  playerMoves: OptimizationMove[],
  opponentMoves: OptimizationMove[],
  currentSpeed: SetOptimizationSpeedState,
  evaluator: OptimizationEvaluator,
): EvaluatedCandidate | null {
  if (!context.player.member?.baseStats) return null;

  const build = createBuild(context, seed.natureId, seed.evs);
  const offenseBenchmarks = playerMoves.flatMap(({ move, source }) => {
    const current = evaluator.calculate(
      move,
      context.player.build,
      "player-to-opponent",
    );
    const optimized = evaluator.calculate(
      move,
      build,
      "player-to-opponent",
    );

    return current &&
      optimized &&
      current.offensiveStatOwner === "attacker" &&
      optimized.offensiveStatOwner === "attacker"
      ? [
          createMoveBenchmark(
            move,
            source,
            current,
            optimized,
            "offense",
            optimized.offensiveStatKey,
          ),
        ]
      : [];
  });
  const defenseBenchmarks = opponentMoves.flatMap(({ move, source }) => {
    const current = evaluator.calculate(
      move,
      context.player.build,
      "opponent-to-player",
    );
    const optimized = evaluator.calculate(
      move,
      build,
      "opponent-to-player",
    );

    return current &&
      optimized &&
      current.defensiveStatOwner === "defender" &&
      optimized.defensiveStatOwner === "defender"
      ? [
          createMoveBenchmark(
            move,
            source,
            current,
            optimized,
            "defense",
            getDefensiveTargetStat(context, optimized),
          ),
        ]
      : [];
  });
  const optimizedSpeed = evaluator.speed(build);
  if (!optimizedSpeed) return null;

  const item = context.player.build.item;
  const evCode = statKeys.map((stat) => seed.evs[stat]).join("-");

  return {
    id: `set-${seed.natureId}-${evCode}`,
    slotIndex: context.selectedSlot,
    focuses: seed.focuses,
    profiles: getCandidateProfiles(
      context,
      seed,
      offenseBenchmarks,
      defenseBenchmarks,
      currentSpeed,
      optimizedSpeed,
    ),
    maxedStats: statKeys.filter(
      (stat) => seed.evs[stat] === CHAMPIONS_MAX_EV_PER_STAT,
    ),
    natureId: seed.natureId,
    evs: seed.evs,
    evTotal: totalStatPoints(seed.evs),
    finalStats: calculateChampionsStats(
      context.player.member.baseStats,
      seed.evs,
      getNatureById(seed.natureId),
    ),
    itemId: item?.showdownId ?? item?.id ?? null,
    itemName: item?.name ?? null,
    changedStatPoints: getChangedStatPoints(
      context.player.build.evs,
      seed.evs,
    ),
    statPointChanges: getStatPointChanges(
      context.player.build.evs,
      seed.evs,
    ),
    offenseBenchmarks,
    defenseBenchmarks,
    speedBenchmark: { current: currentSpeed, optimized: optimizedSpeed },
  };
}

function cappedOffenseHits(value: number | null) {
  return value === null
    ? MAX_PRACTICAL_GUARANTEED_KO_HITS + 1
    : Math.min(MAX_PRACTICAL_GUARANTEED_KO_HITS + 1, value);
}

function cappedDefenseHits(value: number | null) {
  return value === null
    ? MAX_PRACTICAL_DEFENSIVE_KO_HITS + 1
    : Math.min(MAX_PRACTICAL_DEFENSIVE_KO_HITS + 1, value);
}

function getNatureSpreadAlignment(candidate: SetOptimizationCandidate) {
  const nature = getNatureById(candidate.natureId);
  if (nature.up === nature.down) return 0;
  return candidate.evs[nature.up] - candidate.evs[nature.down];
}

function hasMeaningfulChange(candidate: EvaluatedCandidate) {
  const offenseChanged = candidate.offenseBenchmarks.some(
    ({ current, optimized }) => compareOffenseOutcomes(optimized, current) > 0,
  );
  const defenseChanged = candidate.defenseBenchmarks.some(
    ({ current, optimized }) => compareDefenseOutcomes(optimized, current) > 0,
  );
  const speedChanged =
    candidate.speedBenchmark.current.relation !==
      candidate.speedBenchmark.optimized.relation ||
    candidate.speedBenchmark.current.playerSpeed !==
      candidate.speedBenchmark.optimized.playerSpeed;

  return offenseChanged || defenseChanged || speedChanged;
}

function getBenchmarkByMove(
  benchmarks: SetOptimizationMoveBenchmark[],
  moveId: string,
) {
  return benchmarks.find((benchmark) => benchmark.moveId === moveId);
}

function dominates(left: EvaluatedCandidate, right: EvaluatedCandidate) {
  if (
    left.speedBenchmark.optimized.relation !==
    right.speedBenchmark.optimized.relation
  ) {
    return false;
  }

  let strictlyBetter = false;
  for (const rightBenchmark of right.offenseBenchmarks) {
    const leftBenchmark = getBenchmarkByMove(
      left.offenseBenchmarks,
      rightBenchmark.moveId,
    );
    if (!leftBenchmark) return false;

    const comparison = compareOffenseOutcomes(
      leftBenchmark.optimized,
      rightBenchmark.optimized,
    );
    if (comparison < 0) return false;
    if (comparison > 0) strictlyBetter = true;
  }

  for (const rightBenchmark of right.defenseBenchmarks) {
    const leftBenchmark = getBenchmarkByMove(
      left.defenseBenchmarks,
      rightBenchmark.moveId,
    );
    if (!leftBenchmark) return false;

    const comparison = compareDefenseOutcomes(
      leftBenchmark.optimized,
      rightBenchmark.optimized,
    );
    if (comparison < 0) return false;
    if (comparison > 0) strictlyBetter = true;
  }

  for (const stat of ["defense", "specialDefense"] as const) {
    const leftBulk = left.finalStats.hp * left.finalStats[stat];
    const rightBulk = right.finalStats.hp * right.finalStats[stat];
    if (leftBulk < rightBulk) return false;
    if (leftBulk > rightBulk) strictlyBetter = true;
  }

  if (!strictlyBetter) {
    return left.changedStatPoints < right.changedStatPoints;
  }

  return true;
}

function getCandidateScore(candidate: EvaluatedCandidate) {
  let score = 0;

  for (const { current, optimized } of candidate.offenseBenchmarks) {
    score +=
      (cappedOffenseHits(current.guaranteedKoHits) -
        cappedOffenseHits(optimized.guaranteedKoHits)) *
      80;

    if (hasMeaningfulProbabilisticKoGain(optimized, current)) {
      const currentOutcome = getProbabilisticKoOutcome(current);
      const optimizedOutcome = getProbabilisticKoOutcome(optimized);
      if (optimizedOutcome) {
        const improvedHitCounts = currentOutcome
          ? Math.max(0, currentOutcome.hitCount - optimizedOutcome.hitCount)
          : 0;
        const chanceGain =
          currentOutcome?.hitCount === optimizedOutcome.hitCount
            ? Math.max(0, optimizedOutcome.chance - currentOutcome.chance)
            : optimizedOutcome.chance;
        score += improvedHitCounts * 8 + chanceGain * 0.2;
      }
    }
  }
  for (const { current, optimized } of candidate.defenseBenchmarks) {
    score +=
      (cappedDefenseHits(optimized.possibleKoHits) -
        cappedDefenseHits(current.possibleKoHits)) *
      45;
    if (hasMeaningfulProbabilisticKoGain(current, optimized)) {
      const currentOutcome = getProbabilisticKoOutcome(current);
      const optimizedOutcome = getProbabilisticKoOutcome(optimized);
      if (currentOutcome) {
        const delayedHitCounts = optimizedOutcome
          ? Math.max(0, optimizedOutcome.hitCount - currentOutcome.hitCount)
          : 1;
        const chanceReduction =
          optimizedOutcome?.hitCount === currentOutcome.hitCount
            ? Math.max(0, currentOutcome.chance - optimizedOutcome.chance)
            : currentOutcome.chance;
        score += delayedHitCounts * 8 + chanceReduction * 0.2;
      }
    }
    score += Math.max(0, current.maxPercent - optimized.maxPercent) * 0.5;
  }
  if (
    candidate.speedBenchmark.current.relation !==
    candidate.speedBenchmark.optimized.relation
  ) {
    score += 12;
  }
  score += getNatureSpreadAlignment(candidate) * 0.25;
  score -= candidate.changedStatPoints * 0.02;

  return score;
}

function getOutcomeSignature(candidate: EvaluatedCandidate) {
  const offense = candidate.offenseBenchmarks
    .map(({ moveId, optimized }) => {
      const probability = getProbabilisticKoOutcome(optimized);
      return `${moveId}:${cappedOffenseHits(optimized.guaranteedKoHits)}:${
        probability
          ? `${probability.hitCount}:${probability.chance.toFixed(2)}`
          : "-"
      }`;
    })
    .join("|");
  const defense = candidate.defenseBenchmarks
    .map(
      ({ moveId, optimized }) => {
        const probability = getProbabilisticKoOutcome(optimized);
        return `${moveId}:${cappedDefenseHits(optimized.possibleKoHits)}:${
          probability
            ? `${probability.hitCount}:${probability.chance.toFixed(2)}`
            : "-"
        }:${Math.round(optimized.maxPercent / 2)}`;
      },
    )
    .join("|");

  return `${offense}/${defense}/${candidate.speedBenchmark.optimized.relation}`;
}

function selectOffenseHighlights(benchmarks: SetOptimizationMoveBenchmark[]) {
  return benchmarks
    .filter(
      ({ current, optimized }) =>
        cappedOffenseHits(current.guaranteedKoHits) <=
          MAX_PRACTICAL_GUARANTEED_KO_HITS ||
        cappedOffenseHits(optimized.guaranteedKoHits) <=
          MAX_PRACTICAL_GUARANTEED_KO_HITS,
    )
    .sort((left, right) => {
      const leftComparison = compareOffenseOutcomes(
        left.optimized,
        left.current,
      );
      const rightComparison = compareOffenseOutcomes(
        right.optimized,
        right.current,
      );
      if (leftComparison !== rightComparison) {
        return rightComparison - leftComparison;
      }

      const leftOutcome = getProbabilisticKoOutcome(left.optimized);
      const rightOutcome = getProbabilisticKoOutcome(right.optimized);
      if (leftOutcome?.hitCount !== rightOutcome?.hitCount) {
        return (
          (leftOutcome?.hitCount ?? Number.POSITIVE_INFINITY) -
          (rightOutcome?.hitCount ?? Number.POSITIVE_INFINITY)
        );
      }
      return (rightOutcome?.chance ?? 0) - (leftOutcome?.chance ?? 0);
    })
    .slice(0, MAX_BENCHMARKS_PER_AXIS);
}

function selectDefenseHighlights(benchmarks: SetOptimizationMoveBenchmark[]) {
  return [...benchmarks]
    .sort((left, right) => {
      const leftImprovement = compareDefenseOutcomes(
        left.optimized,
        left.current,
      );
      const rightImprovement = compareDefenseOutcomes(
        right.optimized,
        right.current,
      );
      if (leftImprovement !== rightImprovement) {
        return rightImprovement - leftImprovement;
      }
      return right.current.maxPercent - left.current.maxPercent;
    })
    .slice(0, MAX_BENCHMARKS_PER_AXIS);
}

function trimCandidateBenchmarks(
  candidate: EvaluatedCandidate,
): SetOptimizationCandidate {
  return {
    ...candidate,
    offenseBenchmarks: selectOffenseHighlights(candidate.offenseBenchmarks),
    defenseBenchmarks: selectDefenseHighlights(candidate.defenseBenchmarks),
  };
}

function evaluateSeeds(
  context: CalculatorAnalysisContext,
  seeds: CandidateSeed[],
  playerMoves: OptimizationMove[],
  opponentMoves: OptimizationMove[],
  currentSpeed: SetOptimizationSpeedState,
  evaluator: OptimizationEvaluator,
): EvaluatedSeed[] {
  return mergeSeeds(seeds).flatMap((seed) => {
    const candidate = evaluateSeed(
      context,
      seed,
      playerMoves,
      opponentMoves,
      currentSpeed,
      evaluator,
    );
    return candidate ? [{ seed, candidate }] : [];
  });
}

function selectSearchFrontier(
  entries: EvaluatedSeed[],
  limit: number,
): EvaluatedSeed[] {
  const byOutcome = new Map<string, EvaluatedSeed>();
  for (const entry of [...entries].sort(
    (left, right) =>
      getCandidateScore(right.candidate) - getCandidateScore(left.candidate),
  )) {
    if (!hasMeaningfulChange(entry.candidate)) continue;
    const signature = getOutcomeSignature(entry.candidate);
    if (!byOutcome.has(signature)) byOutcome.set(signature, entry);
  }

  const frontier: EvaluatedSeed[] = [];
  for (const entry of byOutcome.values()) {
    if (
      frontier.some((kept) =>
        dominates(kept.candidate, entry.candidate),
      )
    ) {
      continue;
    }

    for (let index = frontier.length - 1; index >= 0; index -= 1) {
      if (dominates(entry.candidate, frontier[index].candidate)) {
        frontier.splice(index, 1);
      }
    }
    frontier.push(entry);

    if (frontier.length > limit * 2) {
      frontier.sort(
        (left, right) =>
          getCandidateScore(right.candidate) -
          getCandidateScore(left.candidate),
      );
      frontier.length = limit;
    }
  }

  return frontier
    .sort(
      (left, right) =>
        getCandidateScore(right.candidate) -
        getCandidateScore(left.candidate),
    )
    .slice(0, limit);
}

function selectCandidates(candidates: EvaluatedCandidate[]) {
  const meaningful = candidates.filter(hasMeaningfulChange);
  const frontier = meaningful.filter(
    (candidate, index) =>
      !meaningful.some(
        (other, otherIndex) =>
          index !== otherIndex && dominates(other, candidate),
      ),
  );
  const bySignature = new Map<string, EvaluatedCandidate>();

  for (const candidate of [...frontier].sort(
    (left, right) => getCandidateScore(right) - getCandidateScore(left),
  )) {
    const signature = getOutcomeSignature(candidate);
    if (!bySignature.has(signature)) bySignature.set(signature, candidate);
  }

  const diversified = [...bySignature.values()];
  const profilePairs = [
    {
      maximum: "physical-bulk-maximum",
      reserve: "physical-survival-with-reserve",
      targetStat: "defense",
      reserveStat: "specialDefense",
    },
    {
      maximum: "special-bulk-maximum",
      reserve: "special-survival-with-reserve",
      targetStat: "specialDefense",
      reserveStat: "defense",
    },
  ] as const;
  const required: EvaluatedCandidate[] = [];

  for (const profilePair of profilePairs) {
    const maximumCandidates = diversified.filter((candidate) =>
      candidate.profiles.includes(profilePair.maximum),
    );
    for (const candidate of diversified) {
      candidate.profiles = candidate.profiles.filter(
        (profile) => profile !== profilePair.reserve,
      );
    }
    if (maximumCandidates.length === 0) {
      continue;
    }

    const targetBenchmark = maximumCandidates
      .flatMap((candidate) => candidate.defenseBenchmarks)
      .filter(
        (benchmark) =>
          benchmark.relevantStat === profilePair.targetStat &&
          benchmark.optimizedVsCurrent === "better" &&
          hasDefensiveSurvivalBoundaryGain(
            benchmark.optimized,
            benchmark.current,
          ),
      )
      .sort((left, right) => {
        const possibleDifference =
          cappedDefenseHits(left.current.possibleKoHits) -
          cappedDefenseHits(right.current.possibleKoHits);
        if (possibleDifference !== 0) return possibleDifference;
        return right.current.maxPercent - left.current.maxPercent;
      })[0];
    if (!targetBenchmark) continue;

    const maximum = maximumCandidates
      .filter((candidate) =>
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === targetBenchmark.moveId &&
            benchmark.optimizedVsCurrent === "better" &&
            hasDefensiveSurvivalBoundaryGain(
              benchmark.optimized,
              benchmark.current,
            ),
        ),
      )
      .sort(
        (left, right) => getCandidateScore(right) - getCandidateScore(left),
      )[0];
    const reserveCandidates = diversified.filter((candidate) => {
      const currentReservePoints =
        candidate.evs[profilePair.reserveStat] -
        candidate.statPointChanges[profilePair.reserveStat];

      return (
        candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
        candidate.evs[profilePair.targetStat] <
          CHAMPIONS_MAX_EV_PER_STAT &&
        candidate.evs[profilePair.reserveStat] > currentReservePoints &&
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === targetBenchmark.moveId &&
            benchmark.relevantStat === profilePair.targetStat &&
            benchmark.optimizedVsCurrent === "better" &&
            hasDefensiveSurvivalBoundaryGain(
              benchmark.optimized,
              benchmark.current,
            ),
        )
      );
    });
    if (!maximum || reserveCandidates.length === 0) continue;

    const deepestReserve = [...reserveCandidates].sort((left, right) => {
      const leftBenchmark = getBenchmarkByMove(
        left.defenseBenchmarks,
        targetBenchmark.moveId,
      );
      const rightBenchmark = getBenchmarkByMove(
        right.defenseBenchmarks,
        targetBenchmark.moveId,
      );
      const possibleHitDifference =
        cappedDefenseHits(rightBenchmark?.optimized.possibleKoHits ?? null) -
        cappedDefenseHits(leftBenchmark?.optimized.possibleKoHits ?? null);
      if (possibleHitDifference !== 0) return possibleHitDifference;

      const reserveDifference =
        right.evs[profilePair.reserveStat] -
        left.evs[profilePair.reserveStat];
      if (reserveDifference !== 0) return reserveDifference;

      const targetDifference =
        left.evs[profilePair.targetStat] -
        right.evs[profilePair.targetStat];
      if (targetDifference !== 0) return targetDifference;

      return getCandidateScore(right) - getCandidateScore(left);
    })[0];

    deepestReserve.profiles.push(profilePair.reserve);
    required.push(maximum, deepestReserve);
  }

  const selected = new Map<string, EvaluatedCandidate>();
  for (const candidate of required) selected.set(candidate.id, candidate);
  for (const candidate of diversified) {
    if (selected.size >= MAX_OPTIMIZATION_CANDIDATES) break;
    selected.set(candidate.id, candidate);
  }

  return [...selected.values()].map(trimCandidateBenchmarks);
}

export function createSetOptimizationPlan(
  context: CalculatorAnalysisContext,
): SetOptimizationPlan {
  const base = {
    slotIndex: context.selectedSlot,
    playerId: context.player.member?.id ?? null,
    playerName: context.player.member?.name ?? null,
    opponentId: context.opponent.member?.id ?? null,
    opponentName: context.opponent.member?.name ?? null,
    configuredDirection: context.direction,
  };

  if (!context.player.member || !context.opponent.member) {
    return {
      ...base,
      status: "unavailable",
      candidates: [],
      reason: "missing-pokemon",
    };
  }
  if (!context.player.member.baseStats || !context.opponent.member.baseStats) {
    return {
      ...base,
      status: "unavailable",
      candidates: [],
      reason: "missing-stats",
    };
  }

  const playerMoves = getDamagingMoves(context.player);
  const opponentMoves = getDamagingMoves(context.opponent);
  if (playerMoves.length === 0 && opponentMoves.length === 0) {
    return {
      ...base,
      status: "unavailable",
      candidates: [],
      reason: "missing-damaging-move",
    };
  }

  const evaluator = createOptimizationEvaluator(context);
  const currentSpeed = evaluator.speed(context.player.build);
  if (!currentSpeed) {
    return {
      ...base,
      status: "unavailable",
      candidates: [],
      reason: "missing-stats",
    };
  }

  const atomicSeeds = mergeSeeds(
    [
      ...playerMoves.flatMap(({ move }) =>
        createOffenseSeeds(context, move, evaluator),
      ),
      ...opponentMoves.flatMap(({ move }) =>
        createDefenseSeeds(context, move, evaluator),
      ),
      ...createSpeedSeeds(context, evaluator),
    ].map((seed) =>
      minimizeRedundantOffense(context, seed, playerMoves, evaluator),
    ),
  );
  const atomicEntries = evaluateSeeds(
    context,
    atomicSeeds,
    playerMoves,
    opponentMoves,
    currentSpeed,
    evaluator,
  );

  const rawPairSeeds: CandidateSeed[] = [];
  for (let left = 0; left < atomicSeeds.length; left += 1) {
    for (let right = left + 1; right < atomicSeeds.length; right += 1) {
      rawPairSeeds.push(
        ...combineSeeds(context, atomicSeeds[left], atomicSeeds[right]),
      );
    }
  }
  const pairSeeds = mergeSeeds(
    rawPairSeeds.map((seed) =>
      minimizeRedundantOffense(context, seed, playerMoves, evaluator),
    ),
  );
  const pairFrontier = selectSearchFrontier(
    evaluateSeeds(
      context,
      pairSeeds,
      playerMoves,
      opponentMoves,
      currentSpeed,
      evaluator,
    ),
    MAX_COMBINATION_FRONTIER,
  );

  const tripleSeeds = mergeSeeds(
    createCombinedSeeds(
      context,
      pairFrontier.map(({ seed }) => seed),
      atomicSeeds,
    ).map((seed) =>
      minimizeRedundantOffense(context, seed, playerMoves, evaluator),
    ),
  );
  const tripleEntries = evaluateSeeds(
    context,
    tripleSeeds,
    playerMoves,
    opponentMoves,
    currentSpeed,
    evaluator,
  );
  const searchFrontier = selectSearchFrontier(
    [...atomicEntries, ...pairFrontier, ...tripleEntries],
    MAX_FINAL_SEARCH_FRONTIER,
  );
  const candidates = selectCandidates(
    searchFrontier.map(({ candidate }) => candidate),
  );

  return {
    ...base,
    status: candidates.length > 0 ? "ready" : "unavailable",
    candidates,
    ...(candidates.length > 0
      ? {}
      : { reason: "no-meaningful-candidate" as const }),
  };
}
