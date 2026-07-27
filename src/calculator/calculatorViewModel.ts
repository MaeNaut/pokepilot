import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  calculateChampionsStats,
  getNatureById,
} from "../data/natures";
import type { PokemonMove, TeamMember } from "../types";
import { findMoveByLookup } from "../utils/pokemonMoves";
import type {
  CalculatorBuildValues,
  CalculatorSideBattleState,
} from "./calculatorEditorTypes";
import type {
  CalculatorBoosts,
  CalculatorField,
} from "./damageCalculator";

export type DamageDirection =
  | "player-to-opponent"
  | "opponent-to-player";

const emptyBoosts: CalculatorBoosts = {
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

export function createDefaultCalculatorField(
  battleFormat: BattleFormat,
): CalculatorField {
  return {
    weather: "none",
    terrain: "none",
    room: "none",
    aura: "none",
    gameType: battleFormat,
    isCritical: false,
    isSpread: battleFormat === "doubles",
    isHelpingHand: false,
    isTailwind: false,
    isFriendGuard: false,
    isPlusMinus: false,
    isWall: false,
  };
}

export function getCalculatorMaxHp(
  member: TeamMember | null,
  build: CalculatorBuildValues,
) {
  if (!member?.baseStats) {
    return 1;
  }

  return calculateChampionsStats(
    member.baseStats,
    build.evs,
    getNatureById(build.natureId),
  ).hp;
}

export function getCalculatorSpeed(
  member: TeamMember | null,
  build: CalculatorBuildValues,
  stage: number,
) {
  if (!member?.baseStats) {
    return null;
  }

  const speed = calculateChampionsStats(
    member.baseStats,
    build.evs,
    getNatureById(build.natureId),
  ).speed;
  const clampedStage = Number.isFinite(stage)
    ? Math.max(-6, Math.min(6, stage))
    : 0;

  return Math.floor(
    speed *
      (clampedStage >= 0
        ? (2 + clampedStage) / 2
        : 2 / (2 - clampedStage)),
  );
}

function getMoveById(
  member: TeamMember | null,
  moveId: string,
  fallbackMoves: PokemonMove[] = [],
) {
  return findMoveByLookup(
    [...(member?.moves ?? []), ...fallbackMoves],
    moveId,
  );
}

export function getCalculatorMoveSlots(
  member: TeamMember | null,
  moveIds: string[],
  fallbackMoves: PokemonMove[] = [],
) {
  return [0, 1, 2, 3].map((index) =>
    getMoveById(member, moveIds[index] ?? "", fallbackMoves),
  );
}

export function createCalculatorBattleState(
  currentHp = 1,
): CalculatorSideBattleState {
  return {
    currentHp,
    status: "healthy",
    boosts: { ...emptyBoosts },
  };
}
