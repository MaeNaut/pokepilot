import { normalizeShowdownId } from "../api/showdownIds";
import type { MetaThreatAnalysisPlan } from "../calculator/metaThreatAnalysis";
import { type CalculatorAnalysisContext } from "../calculator/setOptimizer";
import type { TeamMatchupPlan } from "../calculator/teamMatchup";
import { calculateChampionsStats, getNatureById } from "../data/natures";
import { translateGameName, type Locale } from "../i18n/gameTranslations";
import { type PokemonAbility, type PokemonIndexEntry, type PokemonMove } from "../types";
import type { CopilotExactMatchupSnapshot, CopilotMatchupSnapshot, CopilotMetaMatchupSnapshot, CopilotSetOptimizationSnapshot, CopilotSetSnapshot, CreateCopilotRequestInput } from "./copilotContracts";
import { compactCopilotMechanicEffect } from "./copilotMechanics";
import { localizeType, normalizeLookup } from "./copilotRequestLabels";
import { getOptimizationPokemonDisplayName, normalizeMoveCategory } from "./copilotRequestOptimizationSnapshot";

export function createCopilotExactMatchupSnapshot(
  context: CalculatorAnalysisContext | null | undefined,
  plan: TeamMatchupPlan | null | undefined,
  locale: Locale,
  pokemonIndex: PokemonIndexEntry[],
  sets: CopilotSetSnapshot[],
  abilityById: Map<string, PokemonAbility>,
): CopilotExactMatchupSnapshot | null {
  const opponent = context?.opponent.member;
  if (!context || !opponent?.baseStats || !plan || plan.status !== "ready") {
    return null;
  }

  const opponentItem = context.opponent.build.item;
  const opponentItemId = opponentItem
    ? normalizeShowdownId(
        opponentItem.showdownId ?? opponentItem.id ?? opponentItem.name,
      )
    : null;
  const opponentNature = getNatureById(context.opponent.build.natureId);
  const opponentMoveById = new Map<string, PokemonMove>();
  for (const move of [
    ...context.opponent.moves,
    ...(context.opponent.usageMoves ?? []),
  ]) {
    if (move && !opponentMoveById.has(move.id)) {
      opponentMoveById.set(move.id, move);
    }
  }
  const opponentMoves = [...opponentMoveById.values()].slice(0, 8).map((move) => {
    const effect = compactCopilotMechanicEffect(move.description);
    const tags = [...new Set(
      (move.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    )];
    return {
      id: move.id,
      displayName: translateGameName(locale, "moves", move.id, move.name),
      type: move.type,
      category: normalizeMoveCategory(move.category),
      power: move.power,
      ...(effect ? { effect } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    };
  });
  const setBySlot = new Map(sets.map((set) => [set.slotIndex, set]));

  return {
    mode: "exact",
    opponent: {
      pokemonId: opponent.id,
      displayName: getOptimizationPokemonDisplayName(
        locale,
        opponent,
        pokemonIndex,
      ),
      types: [...opponent.types],
      typeDisplayNames: opponent.types.map((type) => localizeType(locale, type)),
      itemId: opponentItemId,
      itemDisplayName: opponentItem
        ? translateGameName(
            locale,
            "items",
            opponentItemId ?? opponentItem.name,
            opponentItem.name,
          )
        : null,
      itemEffect: compactCopilotMechanicEffect(opponentItem?.effect) ?? null,
      abilityId: context.opponent.build.ability || null,
      abilityDisplayName: context.opponent.build.ability
        ? translateGameName(
            locale,
            "abilities",
            context.opponent.build.ability,
            context.opponent.build.ability,
          )
        : null,
      abilityEffect: compactCopilotMechanicEffect(
        abilityById.get(normalizeLookup(context.opponent.build.ability))?.effect,
      ) ?? null,
      natureId: context.opponent.build.natureId,
      natureDisplayName: translateGameName(
        locale,
        "natures",
        context.opponent.build.natureId,
        opponentNature.label,
      ),
      evs: { ...context.opponent.build.evs },
      finalStats: calculateChampionsStats(
        opponent.baseStats,
        context.opponent.build.evs,
        opponentNature,
      ),
      selectedMoveIds: context.opponent.moves.flatMap((move) =>
        move ? [move.id] : [],
      ),
      moves: opponentMoves,
    },
    field: { ...context.field },
    teamBaseline: "full-hp-neutral-stages",
    members: plan.members.flatMap((member) => {
      const set = setBySlot.get(member.slotIndex);
      if (!set) return [];
      const displayName = member.state === "mega"
        ? set.megaEvolution?.displayName ?? member.pokemonName
        : set.displayName;
      const localizeBenchmark = (
        benchmark: (typeof member.offenseBenchmarks)[number],
      ) => ({
        moveId: benchmark.moveId,
        moveDisplayName: translateGameName(
          locale,
          "moves",
          benchmark.moveId,
          benchmark.moveName,
        ),
        moveCategory: benchmark.moveCategory,
        source: benchmark.source,
        requiresRecharge: benchmark.requiresRecharge,
        possibleActionTurns: benchmark.possibleActionTurns,
        guaranteedActionTurns: benchmark.guaranteedActionTurns,
        result: { ...benchmark.result },
        ...(benchmark.persistentSequence
          ? {
              persistentSequence: {
                ...benchmark.persistentSequence,
                hits: benchmark.persistentSequence.hits.map((hit) => ({
                  ...hit,
                })),
              },
            }
          : {}),
      });

      return [{
        slotIndex: member.slotIndex,
        pokemonId: member.pokemonId,
        displayName,
        state: member.state,
        roleIds: [...set.roleIds],
        responseTier: member.responseTier,
        offenseBenchmarks: member.offenseBenchmarks.map(localizeBenchmark),
        defenseBenchmarks: member.defenseBenchmarks.map(localizeBenchmark),
        speed: { ...member.speed },
      }];
    }),
  };
}

export function createCopilotMetaMatchupSnapshot(
  plan: MetaThreatAnalysisPlan | null | undefined,
  replacementCandidates: CreateCopilotRequestInput["threatReplacementCandidates"],
  locale: Locale,
  pokemonIndex: PokemonIndexEntry[],
  sets: CopilotSetSnapshot[],
  abilityById: Map<string, PokemonAbility>,
): CopilotMetaMatchupSnapshot | null {
  if (!plan || plan.status !== "ready") return null;
  const replacementEvidence: CopilotMetaMatchupSnapshot["replacementEvidence"] = [];

  const threats = plan.threats.flatMap((threat) => {
    const exact = createCopilotExactMatchupSnapshot(
      threat.context,
      threat.matchup,
      locale,
      pokemonIndex,
      sets,
      abilityById,
    );
    if (!exact) return [];

    const compactBenchmark = (
      benchmark: (typeof exact.members)[number]["offenseBenchmarks"][number],
    ) => ({
      moveId: benchmark.moveId,
      moveDisplayName: benchmark.moveDisplayName,
      moveCategory: benchmark.moveCategory,
      source: benchmark.source,
      requiresRecharge: benchmark.requiresRecharge,
      possibleActionTurns: benchmark.possibleActionTurns,
      guaranteedActionTurns: benchmark.guaranteedActionTurns,
      outcome: {
        minPercent: benchmark.result.minPercent,
        maxPercent: benchmark.result.maxPercent,
        possibleKoHits: benchmark.result.possibleKoHits,
        guaranteedKoHits: benchmark.result.guaranteedKoHits,
      },
      ...(benchmark.persistentSequence
        ? { persistentSequence: benchmark.persistentSequence }
        : {}),
    });
    const { selectedMoveIds: _selectedMoveIds, ...opponent } = exact.opponent;
    void _selectedMoveIds;
    const retainedMemberCount = threat.riskSignals.answerCount === 0 ? 3 : 2;
    const members = exact.members.slice(0, retainedMemberCount).map((member) => ({
      slotIndex: member.slotIndex,
      pokemonId: member.pokemonId,
      displayName: member.displayName,
      state: member.state,
      responseTier: member.responseTier,
      offenseBenchmarks: member.offenseBenchmarks
        .slice(0, 2)
        .map(compactBenchmark),
      defenseBenchmarks: member.defenseBenchmarks
        .slice(0, 2)
        .map(compactBenchmark),
      speed: member.speed,
    }));
    const threatReplacementEvidence = (replacementCandidates ?? [])
      .filter(
        ({ threatPokemonId }) =>
          normalizeShowdownId(threatPokemonId) ===
          normalizeShowdownId(opponent.pokemonId),
      )
      .map(({ candidate, member }) => ({
        candidatePokemonId: candidate.pokemonId,
        targetSlotIndex: candidate.target.slotIndex,
        threatPokemonId: opponent.pokemonId,
        member: {
          slotIndex: member.slotIndex,
          pokemonId: member.pokemonId,
          displayName: candidate.displayName,
          state: member.state,
          responseTier: member.responseTier,
          offenseBenchmarks: member.offenseBenchmarks.slice(0, 1).map((benchmark) =>
            compactBenchmark({
              ...benchmark,
              moveDisplayName: translateGameName(
                locale,
                "moves",
                benchmark.moveId,
                benchmark.moveName,
              ),
            }),
          ),
          defenseBenchmarks: member.defenseBenchmarks.slice(0, 1).map((benchmark) =>
            compactBenchmark({
              ...benchmark,
              moveDisplayName: translateGameName(
                locale,
                "moves",
                benchmark.moveId,
                benchmark.moveName,
              ),
            }),
          ),
          speed: { ...member.speed },
        },
      }));
    replacementEvidence.push(...threatReplacementEvidence);
    const retainedOpponentMoveIds = new Set(
      [...members, ...threatReplacementEvidence.map(({ member }) => member)]
        .flatMap((member) =>
          member.defenseBenchmarks.map((benchmark) => benchmark.moveId),
        ),
    );

    return [{
      usageRank: threat.usageRank,
      opponent: {
        ...opponent,
        moves: opponent.moves.filter((move) =>
          retainedOpponentMoveIds.has(move.id),
        ),
      },
      field: {
        weather: exact.field.weather,
        terrain: exact.field.terrain,
        room: exact.field.room,
        gameType: exact.field.gameType,
      },
      testedMemberCount: threat.matchup.members.length,
      answerCount: threat.riskSignals.answerCount,
      checkCount: threat.riskSignals.checkCount,
      fastPressureCount: threat.riskSignals.fastPressureCount,
      oneHitThreatCount: threat.riskSignals.oneHitThreatCount,
      hardToBreakCount: threat.riskSignals.hardToBreakCount,
      members,
    }];
  });

  if (threats.length === 0) return null;
  return {
    mode: "meta",
    sourceMonth: plan.sourceMonth,
    cutoff: plan.cutoff,
    evaluatedThreatCount: plan.evaluatedThreatCount,
    teamBaseline: "full-hp-neutral-stages",
    threats,
    replacementEvidence,
  };
}

export function filterPersistentMatchupOptimization(
  optimization: CopilotSetOptimizationSnapshot | null,
  matchup: CopilotMatchupSnapshot | null,
) {
  if (!optimization || !matchup) return optimization;

  const selectedMember = matchup.mode === "exact"
    ? matchup.members.find(
        ({ slotIndex }) => slotIndex === optimization.slotIndex,
      )
    : matchup.threats
        .find(
          ({ opponent }) =>
            normalizeShowdownId(opponent.pokemonId) ===
            normalizeShowdownId(optimization.opponentPokemonId ?? ""),
        )
        ?.members.find(
          ({ slotIndex }) => slotIndex === optimization.slotIndex,
        );
  const persistentMoveIds = new Set(
    selectedMember?.offenseBenchmarks.flatMap((benchmark) =>
      benchmark.persistentSequence ? [benchmark.moveId] : [],
    ) ?? [],
  );
  const preservesActionOrder = (
    candidate: CopilotSetOptimizationSnapshot["candidates"][number],
  ) => {
    const speed = candidate.speedBenchmark;
    if (
      speed?.current.relation !== "faster" ||
      speed.optimized.relation === "faster"
    ) {
      return true;
    }

    return candidate.defenseBenchmarks.some(({ current, optimized }) =>
      current.possibleKoHits === 1 &&
      (optimized.possibleKoHits === null || optimized.possibleKoHits >= 2),
    );
  };

  const candidates = optimization.candidates.filter((candidate) =>
    candidate.id === "set-current" ||
    (preservesActionOrder(candidate) &&
      !candidate.offenseBenchmarks.some((benchmark) =>
        benchmark.optimizedVsCurrent === "better" &&
        (persistentMoveIds.has(benchmark.moveId) ||
          persistentMoveIds.has(benchmark.currentMoveId)),
      )),
  );

  if (matchup.mode === "exact") {
    return candidates.length > 0 ? { ...optimization, candidates } : null;
  }
  const changedCandidates = candidates.filter(
    (candidate) => candidate.id !== "set-current",
  );
  return changedCandidates.length > 0
    ? { ...optimization, candidates: changedCandidates.slice(0, 3) }
    : null;
}
