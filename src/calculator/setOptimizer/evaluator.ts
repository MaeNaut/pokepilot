import type {
  CalculatorBuildValues,
  CalculatorSideBattleState,
} from "../calculatorEditorTypes";
import {
  calculateChampionsDamage,
  type CalculatorField,
  type CalculatorPokemon,
} from "../damageCalculator";
import type { DamageDirection } from "../calculatorViewModel";
import {
  calculateChampionsStats,
  getNatureById,
  statKeys,
} from "../../data/natures";
import type { PokemonMove } from "../../types";
import { MAX_USAGE_MOVES_PER_SIDE } from "./constants";
import type {
  CalculatorAnalysisContext,
  CalculatorAnalysisSide,
  OptimizationEvaluator,
  OptimizationMove,
  ReadyDamageResult,
  SetOptimizationMoveSource,
  SetOptimizationSpeedState,
} from "./types";

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
  const itemId = build.item?.showdownId ?? build.item?.id ?? build.item?.name ?? "";
  return `${build.natureId}:${itemId}:${statKeys
    .map((stat) => build.evs[stat])
    .join("-")}`;
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

export function getSpeedState(
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

export function createOptimizationEvaluator(
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

export function getDamagingMoves(side: CalculatorAnalysisSide) {
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

export function getDefensiveTargetStat(
  context: CalculatorAnalysisContext,
  result: ReadyDamageResult,
) {
  if (context.field.room !== "wonder") return result.defensiveStatKey;
  if (result.defensiveStatKey === "defense") return "specialDefense";
  if (result.defensiveStatKey === "specialDefense") return "defense";
  return result.defensiveStatKey;
}
