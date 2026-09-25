import { normalizeShowdownId } from "../api/showdownIds";
import { projectCalculatorSideToMega } from "../calculator/megaProjection";
import { createSetOptimizationPlan, type CalculatorAnalysisContext, type SetOptimizationPlan, } from "../calculator/setOptimizer";
import { calculateChampionsStats, getNatureById } from "../data/natures";
import { translateGameName, translatePokemonName, type Locale, } from "../i18n/gameTranslations";
import { type PokemonIndexEntry, type PokemonItem, type PokemonMove, type TeamSlot } from "../types";
import type { CopilotMoveCategory, CopilotOptimizationItemMechanicSnapshot, CopilotOptimizationMoveMechanicSnapshot, CopilotSetOptimizationSnapshot } from "./copilotContracts";
import { compactCopilotMechanicEffect } from "./copilotMechanics";
import { getPokemonNameFallback, } from "./pokemonDisplay";

export function getOptimizationPokemonDisplayName(
  locale: Locale,
  member: NonNullable<CalculatorAnalysisContext["player"]["member"]>,
  pokemonIndex: PokemonIndexEntry[],
) {
  const entry = pokemonIndex.find((candidate) => candidate.name === member.id);
  const includeForm = true;

  return translatePokemonName(locale, {
    id: entry?.name ?? member.id,
    fallback: entry
      ? getPokemonNameFallback(entry, includeForm)
      : member.name,
    speciesId: entry?.speciesKey,
    formLabel: entry?.formLabel,
    formKind: entry?.formKind,
    includeForm,
  });
}

function createOptimizationMoveMechanics(
  context: CalculatorAnalysisContext | null | undefined,
  plan: SetOptimizationPlan,
  locale: Locale,
  member?: TeamSlot,
): CopilotOptimizationMoveMechanicSnapshot[] {
  const relevantMoveIds = new Set(
    plan.candidates.flatMap((candidate) =>
      candidate.moveChanges.flatMap((change) => [
        change.currentMoveId,
        change.optimizedMoveId,
      ]),
    ),
  );
  const movesById = new Map<string, PokemonMove>();

  for (const move of [
    ...(member?.moves ?? []),
    ...(context?.player.moves ?? []),
    ...(context?.player.usageMoves ?? []),
  ]) {
    if (!move || !relevantMoveIds.has(move.id) || movesById.has(move.id)) {
      continue;
    }
    movesById.set(move.id, move);
  }

  return [...movesById.values()].map((move) => {
    const effect = compactCopilotMechanicEffect(move.description);
    const tags = [...new Set(
      (move.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    )];

    return {
      id: move.id,
      displayName: translateGameName(
        locale,
        "moves",
        move.id,
        move.name,
      ),
      type: move.type,
      category: normalizeMoveCategory(move.category),
      power: move.power,
      ...(effect ? { effect } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    };
  });
}

function createOptimizationItemMechanics(
  plan: SetOptimizationPlan,
  locale: Locale,
): CopilotOptimizationItemMechanicSnapshot[] {
  const relevantIds = new Set(
    plan.candidates.flatMap((candidate) => candidate.itemId ? [candidate.itemId] : []),
  );
  const items = new Map<string, CopilotOptimizationItemMechanicSnapshot>();
  for (const item of plan.itemMechanics ?? []) {
    const id = normalizeShowdownId(item.showdownId ?? item.id ?? item.name);
    if (!id || !relevantIds.has(id) || items.has(id)) continue;
    const effect = compactCopilotMechanicEffect(item.effect);
    items.set(id, {
      id,
      displayName: translateGameName(locale, "items", id, item.name),
      ...(effect ? { effect } : {}),
    });
  }
  return [...items.values()];
}

export function createCopilotOptimizationSnapshot(
  context: CalculatorAnalysisContext | null | undefined,
  locale: Locale,
  pokemonIndex: PokemonIndexEntry[],
  preparedPlan?: SetOptimizationPlan | null,
  fallback?: {
    member: TeamSlot;
    item: PokemonItem | null;
    natureId: string;
    evs: ReturnType<typeof calculateChampionsStats>;
    moveIds: string[];
  },
): CopilotSetOptimizationSnapshot | null {
  const plan = preparedPlan === undefined && context
    ? createSetOptimizationPlan(context)
    : preparedPlan;
  if (!plan || plan.status !== "ready" || plan.candidates.length === 0) {
    return null;
  }
  const projectedPlayer = context ? projectCalculatorSideToMega(context.player) : null;
  if (context && projectedPlayer?.member?.id === plan.playerId) {
    context = { ...context, player: projectedPlayer };
  }
  const calculatorMatches = Boolean(
    context?.player.member?.id === plan.playerId &&
    context.selectedSlot === plan.slotIndex,
  );
  const player = calculatorMatches ? context?.player.member : fallback?.member;
  const opponent = calculatorMatches ? context?.opponent.member : null;

  if (!player?.baseStats) {
    return null;
  }

  const currentBuild = calculatorMatches ? context!.player.build : fallback;
  if (!currentBuild) return null;
  const currentNature = getNatureById(currentBuild.natureId);
  const currentItem = currentBuild.item;
  const currentItemId = currentItem
    ? normalizeShowdownId(
        currentItem.showdownId ?? currentItem.id ?? currentItem.name,
      )
    : null;
  const currentItemDisplayName = currentItem
    ? translateGameName(
        locale,
        "items",
        currentItemId ?? currentItem.name,
        currentItem.name,
      )
    : null;

  return {
    mode: plan.mode,
    slotIndex: plan.slotIndex,
    configuredDirection: plan.configuredDirection,
    playerPokemonId: player.id,
    playerDisplayName: getOptimizationPokemonDisplayName(
      locale,
      player,
      pokemonIndex,
    ),
    opponentPokemonId: opponent?.id ?? null,
    opponentDisplayName: opponent
      ? getOptimizationPokemonDisplayName(locale, opponent, pokemonIndex)
      : null,
    field: calculatorMatches && context ? { ...context.field } : null,
    currentBuild: {
      natureId: currentBuild.natureId,
      natureDisplayName: translateGameName(
        locale,
        "natures",
        currentBuild.natureId,
        currentNature.label,
      ),
      evs: { ...currentBuild.evs },
      finalStats: calculateChampionsStats(
        player.baseStats,
        currentBuild.evs,
        currentNature,
      ),
      itemId: currentItemId,
      itemDisplayName: currentItemDisplayName,
      moveIds: [0, 1, 2, 3].map((index) =>
        (calculatorMatches ? context?.player.moves[index]?.id : undefined) ??
        currentBuild.moveIds[index] ?? "",
      ),
    },
    moveMechanics: createOptimizationMoveMechanics(context, plan, locale, player),
    itemMechanics: createOptimizationItemMechanics(plan, locale),
    candidates: plan.candidates.map((candidate) => ({
      id: candidate.id,
      slotIndex: candidate.slotIndex,
      focuses: [...candidate.focuses],
      profiles: [...candidate.profiles],
      maxedStats: [...candidate.maxedStats],
      natureId: candidate.natureId,
      natureDisplayName: translateGameName(
        locale,
        "natures",
        candidate.natureId,
        getNatureById(candidate.natureId).label,
      ),
      evs: { ...candidate.evs },
      evTotal: candidate.evTotal,
      finalStats: { ...candidate.finalStats },
      itemId: candidate.itemId,
      itemDisplayName: candidate.itemName
        ? translateGameName(
            locale,
            "items",
            candidate.itemId ?? candidate.itemName,
            candidate.itemName,
          )
        : null,
      itemChanged: candidate.itemChanged,
      moveIds: [...candidate.moveIds],
      moveChanges: candidate.moveChanges.map((change) => ({
        slotIndex: change.slotIndex,
        currentMoveId: change.currentMoveId,
        currentMoveDisplayName: translateGameName(
          locale,
          "moves",
          change.currentMoveId,
          change.currentMoveName,
        ),
        optimizedMoveId: change.optimizedMoveId,
        optimizedMoveDisplayName: translateGameName(
          locale,
          "moves",
          change.optimizedMoveId,
          change.optimizedMoveName,
        ),
        sameTypeAndCategory: change.sameTypeAndCategory,
      })),
      changedStatPoints: candidate.changedStatPoints,
      statPointChanges: { ...candidate.statPointChanges },
      offenseBenchmarks: candidate.offenseBenchmarks.map((benchmark) => ({
        moveId: benchmark.moveId,
        moveDisplayName: translateGameName(
          locale,
          "moves",
          benchmark.moveId,
          benchmark.moveName,
        ),
        currentMoveId: benchmark.currentMoveId,
        currentMoveDisplayName: translateGameName(
          locale,
          "moves",
          benchmark.currentMoveId,
          benchmark.currentMoveName,
        ),
        moveCategory: benchmark.moveCategory,
        source: benchmark.source,
        relevantStat: benchmark.relevantStat,
        optimizedVsCurrent: benchmark.optimizedVsCurrent,
        current: { ...benchmark.current },
        optimized: { ...benchmark.optimized },
      })),
      defenseBenchmarks: candidate.defenseBenchmarks.map((benchmark) => ({
        moveId: benchmark.moveId,
        moveDisplayName: translateGameName(
          locale,
          "moves",
          benchmark.moveId,
          benchmark.moveName,
        ),
        currentMoveId: benchmark.currentMoveId,
        currentMoveDisplayName: translateGameName(
          locale,
          "moves",
          benchmark.currentMoveId,
          benchmark.currentMoveName,
        ),
        moveCategory: benchmark.moveCategory,
        source: benchmark.source,
        relevantStat: benchmark.relevantStat,
        optimizedVsCurrent: benchmark.optimizedVsCurrent,
        current: { ...benchmark.current },
        optimized: { ...benchmark.optimized },
      })),
      ...(candidate.generalEvidence?.source === "current" ||
      candidate.generalEvidence?.source === "usage"
        ? {}
        : {
            speedBenchmark: {
              current: { ...candidate.speedBenchmark.current },
              optimized: { ...candidate.speedBenchmark.optimized },
            },
          }),
      generalEvidence: candidate.generalEvidence ?? {
        source: "matchup",
        variant: "matchup",
        roleStats: [],
        reducedRoleStats: [],
      },
    })),
  };
}

export function normalizeMoveCategory(
  category: PokemonMove["category"],
): CopilotMoveCategory {
  const normalized = category?.toLowerCase();

  if (
    normalized === "physical" ||
    normalized === "special" ||
    normalized === "status"
  ) {
    return normalized;
  }

  return "unknown";
}
