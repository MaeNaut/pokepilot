import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { normalizeShowdownId } from "../api/showdownIds";
import type { ShowdownDataSnapshot } from "../api/showdownData";
import type { SmogonUsageSet } from "../api/smogonUsage";
import {
  resolveSmogonUsageAbility,
} from "../api/smogonUsage";
import {
  createUsageCalculatorBuild,
  resolveUsageCalculatorItems,
  resolveUsageCalculatorMoves,
} from "./calculatorUsageBuild";
import {
  createCalculatorBattleState,
  createDefaultCalculatorField,
  getCalculatorMaxHp,
  getCalculatorMoveSlots,
  getCalculatorSpeed,
} from "./calculatorViewModel";
import { resolveAutomaticEnvironment } from "./automaticEnvironment";
import { createProjectedMegaMember } from "../utils/megaEvolution";
import { getPokemonBuildSnapshot } from "../utils/benchPokemon";
import {
  createPokemonDefensiveProfile,
  getDefensiveMultiplier,
} from "../utils/teamDiagnostics";
import type { TeamBuildState } from "../utils/teamBuildState";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  PokemonMove,
  PokemonType,
  TeamMember,
  TeamSlot,
} from "../types";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type {
  CalculatorAnalysisContext,
  CalculatorAnalysisSide,
  SetOptimizationPlan,
} from "./setOptimizer/types";
import {
  createTeamMatchupPlan,
  type TeamMatchupPlan,
} from "./teamMatchup";
import { createSetOptimizationPlan } from "./setOptimizer/plan";
import { projectCalculatorSideToMega } from "./megaProjection";

const BASE_USAGE_POOL_SIZE = 30;
const SPECIALIST_POOL_SIZE = 10;
const MAX_SPECIALIST_USAGE_RANK = 80;
const FINAL_THREAT_LIMIT = 5;

export type MetaThreatCandidate = {
  usageRank: number;
  sourceMonth: string;
  cutoff: number;
  opponent: CalculatorAnalysisSide;
};

export type MetaThreatAnalysisInput = {
  battleFormat: BattleFormat;
  roster: Array<CalculatorAnalysisSide & { slotIndex: number }>;
  candidates: MetaThreatCandidate[];
};

export type MetaThreatRiskSignals = {
  answerCount: number;
  checkCount: number;
  fastPressureCount: number;
  oneHitThreatCount: number;
  hardToBreakCount: number;
};

export type MetaThreatPlanEntry = {
  usageRank: number;
  sourceMonth: string;
  cutoff: number;
  context: CalculatorAnalysisContext;
  matchup: Extract<TeamMatchupPlan, { status: "ready" }>;
  riskSignals: MetaThreatRiskSignals;
};

export type MetaThreatAnalysisPlan =
  | {
      status: "ready";
      sourceMonth: string;
      cutoff: number;
      evaluatedThreatCount: number;
      threats: MetaThreatPlanEntry[];
      optimizationContext: CalculatorAnalysisContext | null;
      optimizationPlan: SetOptimizationPlan | null;
    }
  | {
      status: "unavailable";
      sourceMonth: string | null;
      cutoff: number | null;
      evaluatedThreatCount: number;
      threats: [];
      optimizationContext: null;
      optimizationPlan: null;
      reason: "missing-roster" | "missing-usage-data" | "missing-benchmarks";
    };

function findSpecies(
  snapshot: ShowdownDataSnapshot,
  pokemonId: string,
) {
  for (const alias of getPokemonLookupAliases(pokemonId)) {
    const species = snapshot.speciesById[normalizeShowdownId(alias)];
    if (species) return species;
  }
  return undefined;
}

function createRoster(
  team: TeamSlot[],
  buildState: TeamBuildState,
  pokemonIndex: PokemonIndexEntry[],
) {
  return team.flatMap<CalculatorAnalysisSide & { slotIndex: number }>(
    (member, slotIndex) => {
      if (!member) return [];
      const snapshot = getPokemonBuildSnapshot(member, buildState, slotIndex);
      const build = {
        item: snapshot.item,
        ability: snapshot.ability,
        natureId: snapshot.nature,
        evs: snapshot.evs,
        moveIds: snapshot.moveIds,
      };
      const maxHp = getCalculatorMaxHp(member, build);
      const megaMember = createProjectedMegaMember(
        member,
        build.item,
        pokemonIndex,
      );

      return [{
        slotIndex,
        member,
        build,
        battle: createCalculatorBattleState(maxHp),
        moves: getCalculatorMoveSlots(member, build.moveIds),
        maxHp,
        ...(megaMember?.abilities?.[0]
          ? {
              megaEvolution: {
                member: megaMember,
                ability: megaMember.abilities[0],
              },
            }
          : {}),
      }];
    },
  );
}

function createOpponent(
  usageSet: SmogonUsageSet,
  showdownData: ShowdownDataSnapshot,
  itemIndex: ItemIndexEntry[],
): CalculatorAnalysisSide | null {
  const species = findSpecies(showdownData, usageSet.pokemonId);
  if (!species?.types || !species.baseStats) return null;

  const usageMoves = usageSet.moveIds.flatMap((moveId) => {
    const move = showdownData.movesById[normalizeShowdownId(moveId)];
    return move ? [move] : [];
  });
  const member: TeamMember = {
    id: species.id,
    name: species.name,
    showdownId: species.id,
    showdownName: species.name,
    types: [...species.types],
    roles: [],
    baseStats: { ...species.baseStats },
    abilities: [...species.abilities],
    moves: usageMoves,
    source: "showdown",
  };
  const item = resolveUsageCalculatorItems(usageSet, itemIndex, 1)[0] ?? null;
  const build = createUsageCalculatorBuild(member, usageSet, item);
  const resolvedMoves = resolveUsageCalculatorMoves(
    member,
    usageSet,
    usageMoves,
    8,
  );
  const maxHp = getCalculatorMaxHp(member, build);

  return {
    member,
    build: {
      ...build,
      ability: resolveSmogonUsageAbility(
        member,
        usageSet.ability,
        build.ability,
      ),
    },
    battle: createCalculatorBattleState(maxHp),
    moves: [],
    usageMoves: resolvedMoves,
    maxHp,
  };
}

export function createMetaThreatAnalysisInput({
  battleFormat,
  team,
  buildState,
  pokemonIndex,
  itemIndex,
  usageSets,
  showdownData,
}: {
  battleFormat: BattleFormat;
  team: TeamSlot[];
  buildState: TeamBuildState;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  usageSets: SmogonUsageSet[];
  showdownData: ShowdownDataSnapshot;
}): MetaThreatAnalysisInput {
  const roster = createRoster(team, buildState, pokemonIndex);
  const candidates = usageSets.flatMap<MetaThreatCandidate>((usageSet, index) => {
    const opponent = createOpponent(usageSet, showdownData, itemIndex);
    return opponent
      ? [{
          usageRank: index + 1,
          sourceMonth: usageSet.sourceMonth,
          cutoff: usageSet.cutoff,
          opponent,
        }]
      : [];
  });

  return { battleFormat, roster, candidates };
}

function getAbilityAwareMultiplier(
  type: PokemonType,
  side: CalculatorAnalysisSide,
) {
  const member = side.member;
  if (!member) return 1;
  const profile = createPokemonDefensiveProfile(member, side.build.ability);
  if (profile.immunities.some((entry) => entry.type === type)) return 0;
  return getDefensiveMultiplier(type, member.types);
}

function getDamagingMoves(side: CalculatorAnalysisSide) {
  const moves = [...side.moves, ...(side.usageMoves ?? [])];
  const unique = new Map<string, PokemonMove>();
  for (const move of moves) {
    if (
      move &&
      (move.category === "Physical" || move.category === "Special") &&
      (move.power ?? 0) > 0
    ) {
      unique.set(move.id, move);
    }
  }
  return [...unique.values()];
}

function cheapThreatScore(
  candidate: MetaThreatCandidate,
  roster: MetaThreatAnalysisInput["roster"],
) {
  const opponent = candidate.opponent;
  const opponentMoves = getDamagingMoves(opponent);
  const pressure = roster.reduce((score, member) => {
    const best = Math.max(
      0,
      ...opponentMoves.map((move) => getAbilityAwareMultiplier(move.type, member)),
    );
    return score + (best >= 4 ? 5 : best >= 2 ? 3 : best >= 1 ? 1 : 0);
  }, 0);
  const walling = roster.reduce((score, member) => {
    const best = Math.max(
      0,
      ...getDamagingMoves(member).map((move) =>
        getAbilityAwareMultiplier(move.type, opponent),
      ),
    );
    return score + (best === 0 ? 3 : best <= 0.5 ? 2 : best <= 1 ? 1 : 0);
  }, 0);
  const opponentSpeed = getCalculatorSpeed(opponent.member, opponent.build, 0) ?? 0;
  const fasterCount = roster.filter((member) =>
    opponentSpeed > (getCalculatorSpeed(member.member, member.build, 0) ?? 0),
  ).length;
  const recovery = [...(opponent.usageMoves ?? [])].some((move) =>
    move.tags?.includes("Recovery"),
  ) ? 2 : 0;
  const usageWeight = Math.max(0, 8 - candidate.usageRank / 8);

  return pressure * 2 + walling * 1.5 + fasterCount + recovery + usageWeight;
}

export function selectMetaThreatCandidates(input: MetaThreatAnalysisInput) {
  const base = input.candidates.slice(0, BASE_USAGE_POOL_SIZE);
  const baseIds = new Set(
    base.map((candidate) => candidate.opponent.member?.id).filter(Boolean),
  );
  const specialists = input.candidates
    .slice(BASE_USAGE_POOL_SIZE, MAX_SPECIALIST_USAGE_RANK)
    .filter((candidate) => !baseIds.has(candidate.opponent.member?.id))
    .sort((left, right) =>
      cheapThreatScore(right, input.roster) - cheapThreatScore(left, input.roster) ||
      left.usageRank - right.usageRank,
    )
    .slice(0, SPECIALIST_POOL_SIZE);

  return [...base, ...specialists];
}

function createThreatContext(
  input: MetaThreatAnalysisInput,
  candidate: MetaThreatCandidate,
): CalculatorAnalysisContext | null {
  const first = input.roster[0];
  const opponent = candidate.opponent;
  if (!first || !opponent.member) return null;
  const opponentSpeed = getCalculatorSpeed(opponent.member, opponent.build, 0);
  const environment = resolveAutomaticEnvironment({
    player: { identity: "", ability: "", speed: null },
    opponent: {
      identity: opponent.member.id,
      ability: opponent.build.ability,
      speed: opponentSpeed,
    },
  });

  return {
    battleFormat: input.battleFormat,
    selectedSlot: first.slotIndex,
    direction: "player-to-opponent",
    player: first,
    opponent,
    roster: input.roster,
    field: {
      ...createDefaultCalculatorField(input.battleFormat),
      ...environment,
    },
  };
}

function getRiskSignals(
  matchup: Extract<TeamMatchupPlan, { status: "ready" }>,
): MetaThreatRiskSignals {
  let fastPressureCount = 0;
  let oneHitThreatCount = 0;
  let hardToBreakCount = 0;

  for (const member of matchup.members) {
    const offense = member.offenseBenchmarks[0];
    const defense = member.defenseBenchmarks[0];
    if (
      member.speed.relation === "slower" &&
      defense &&
      (defense.result.possibleKoHits ?? Number.POSITIVE_INFINITY) <= 2
    ) {
      fastPressureCount += 1;
    }
    if ((defense?.result.possibleKoHits ?? Number.POSITIVE_INFINITY) <= 1) {
      oneHitThreatCount += 1;
    }
    if (
      !offense ||
      (offense.guaranteedActionTurns ?? Number.POSITIVE_INFINITY) >= 3
    ) {
      hardToBreakCount += 1;
    }
  }

  return {
    answerCount: matchup.members.filter((member) => member.responseTier === "answer").length,
    checkCount: matchup.members.filter((member) => member.responseTier === "check").length,
    fastPressureCount,
    oneHitThreatCount,
    hardToBreakCount,
  };
}

function detailedThreatScore(entry: MetaThreatPlanEntry) {
  const { riskSignals } = entry;
  return (
    (riskSignals.answerCount === 0 ? 20 : 0) +
    (riskSignals.answerCount === 0 && riskSignals.checkCount === 0 ? 10 : 0) +
    riskSignals.oneHitThreatCount * 4 +
    riskSignals.fastPressureCount * 2 +
    riskSignals.hardToBreakCount * 2 +
    Math.max(0, 8 - entry.usageRank / 8)
  );
}

export function createMetaThreatAnalysisPlan(
  input: MetaThreatAnalysisInput,
): MetaThreatAnalysisPlan {
  if (input.roster.length === 0) {
    return {
      status: "unavailable",
      sourceMonth: null,
      cutoff: null,
      evaluatedThreatCount: 0,
      threats: [],
      optimizationContext: null,
      optimizationPlan: null,
      reason: "missing-roster",
    };
  }
  if (input.candidates.length === 0) {
    return {
      status: "unavailable",
      sourceMonth: null,
      cutoff: null,
      evaluatedThreatCount: 0,
      threats: [],
      optimizationContext: null,
      optimizationPlan: null,
      reason: "missing-usage-data",
    };
  }

  const selected = selectMetaThreatCandidates(input);
  const evaluated = selected.flatMap<MetaThreatPlanEntry>((candidate) => {
    const context = createThreatContext(input, candidate);
    if (!context) return [];
    const matchup = createTeamMatchupPlan(context);
    if (matchup.status !== "ready") return [];
    return [{
      usageRank: candidate.usageRank,
      sourceMonth: candidate.sourceMonth,
      cutoff: candidate.cutoff,
      context,
      matchup,
      riskSignals: getRiskSignals(matchup),
    }];
  });
  const threats = evaluated
    .sort((left, right) =>
      detailedThreatScore(right) - detailedThreatScore(left) ||
      left.usageRank - right.usageRank,
    )
    .slice(0, FINAL_THREAT_LIMIT);

  if (threats.length === 0) {
    return {
      status: "unavailable",
      sourceMonth: selected[0]?.sourceMonth ?? null,
      cutoff: selected[0]?.cutoff ?? null,
      evaluatedThreatCount: selected.length,
      threats: [],
      optimizationContext: null,
      optimizationPlan: null,
      reason: "missing-benchmarks",
    };
  }

  const optimizationTarget = threats.find(
    (threat) =>
      threat.riskSignals.answerCount === 0 &&
      threat.riskSignals.checkCount > 0,
  );
  const optimizationMember = optimizationTarget?.matchup.members.find(
    (member) => member.responseTier === "check",
  );
  const rosterSide = optimizationTarget?.context.roster?.find(
    (side) => side.slotIndex === optimizationMember?.slotIndex,
  );
  const projectedSide =
    optimizationMember?.state === "mega" && rosterSide
      ? projectCalculatorSideToMega(rosterSide)
      : null;
  const optimizationContext = optimizationTarget && rosterSide
    ? {
        ...optimizationTarget.context,
        selectedSlot: rosterSide.slotIndex,
        player: projectedSide ?? rosterSide,
      }
    : null;
  const optimizationPlan = optimizationContext
    ? createSetOptimizationPlan(optimizationContext)
    : null;
  const changedOptimizationCandidates = optimizationPlan?.candidates
    .filter((candidate) => candidate.id !== "set-current")
    .slice(0, 3) ?? [];
  const retainedOptimizationPlan =
    optimizationPlan?.status === "ready" &&
    changedOptimizationCandidates.length > 0
      ? { ...optimizationPlan, candidates: changedOptimizationCandidates }
      : null;

  return {
    status: "ready",
    sourceMonth: threats[0].sourceMonth,
    cutoff: threats[0].cutoff,
    evaluatedThreatCount: evaluated.length,
    threats,
    optimizationContext: retainedOptimizationPlan ? optimizationContext : null,
    optimizationPlan: retainedOptimizationPlan,
  };
}
