import {
  calculateChampionsStats,
  defaultEvs,
  getNatureById,
  statKeys,
} from "../data/natures";
import { normalizeShowdownId } from "../api/showdownIds";
import type { TeamConceptId } from "../data/teamConcepts";
import {
  conceptCopilotTextKeys,
  getCopilotText,
  type CopilotTextKey,
} from "../i18n/copilotText";
import {
  translateGameName,
  translatePokemonName,
  type Locale,
} from "../i18n/gameTranslations";
import {
  pokemonTypes,
  type PokemonAbility,
  type PokemonIndexEntry,
  type PokemonItem,
  type PokemonMove,
  type PokemonType,
  type TeamSlot,
} from "../types";
import {
  createPokemonDefensiveProfile,
  type TeamDiagnosticsResult,
  type TeamRoleId,
} from "./teamDiagnostics";
import { hasPokemonCandidateFilters } from "./pokemonCandidateFilters";
import { getMegaStoneItemName } from "./megaEvolution";
import {
  compactCopilotMechanicEffect,
  createCopilotMechanicsSnapshot,
  type CopilotMechanicsSetInput,
} from "./copilotMechanics";
import {
  createCopilotResponsibilityCounts,
  inferCopilotResponsibilities,
  type CopilotResponsibilityId,
} from "./copilotResponsibilities";
import type { CopilotRecommendationCandidateSnapshot } from "./pokemonRecommendations";
import {
  createSetOptimizationPlan,
  type CalculatorAnalysisContext,
  type SetOptimizationPlan,
} from "../calculator/setOptimizer";
import type { TeamMatchupPlan } from "../calculator/teamMatchup";
import type {
  CopilotAnalysisRequest,
  CopilotCandidateFilterSnapshot,
  CopilotMegaEvolutionSnapshot,
  CopilotMegaOptionSnapshot,
  CopilotMatchupSnapshot,
  CopilotMoveCategory,
  CopilotMoveSnapshot,
  CopilotMoveSpreadTarget,
  CopilotOptimizationMoveMechanicSnapshot,
  CopilotSetOffensiveProfile,
  CopilotSetOptimizationSnapshot,
  CopilotSetSnapshot,
  CopilotTeamDefensiveProfile,
  CopilotTeamOffensiveProfile,
  CopilotTypeLabelSnapshot,
  CreateCopilotRequestInput,
} from "./copilotContracts";

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatLookup(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function localizeRecommendationCandidates(
  locale: Locale,
  candidates: CopilotRecommendationCandidateSnapshot[],
) {
  return candidates.map((candidate) => ({
    ...candidate,
    commonSet: candidate.commonSet
      ? {
          ...candidate.commonSet,
          moves: candidate.commonSet.moves.map((move) => ({
            ...move,
            displayName: translateGameName(
              locale,
              "moves",
              move.id,
              move.displayName,
            ),
          })),
        }
      : null,
  }));
}

function getOptimizationPokemonDisplayName(
  locale: Locale,
  member: NonNullable<CalculatorAnalysisContext["player"]["member"]>,
  pokemonIndex: PokemonIndexEntry[],
) {
  const entry = pokemonIndex.find((candidate) => candidate.name === member.id);

  return translatePokemonName(locale, {
    id: entry?.name ?? member.id,
    fallback: entry?.displayName ?? member.name,
    speciesId: entry?.speciesKey,
    formLabel: entry?.formLabel,
    formKind: entry?.formKind,
    includeForm: true,
  });
}

function createOptimizationMoveMechanics(
  context: CalculatorAnalysisContext,
  plan: SetOptimizationPlan,
  locale: Locale,
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
    ...context.player.moves,
    ...(context.player.usageMoves ?? []),
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

function createCopilotOptimizationSnapshot(
  context: CalculatorAnalysisContext | null | undefined,
  locale: Locale,
  pokemonIndex: PokemonIndexEntry[],
  preparedPlan?: SetOptimizationPlan | null,
): CopilotSetOptimizationSnapshot | null {
  if (!context) return null;

  const plan = preparedPlan === undefined ? createSetOptimizationPlan(context) : preparedPlan;
  const player = context.player.member;
  const opponent = context.opponent.member;

  if (
    !plan || plan.status !== "ready" ||
    !player?.baseStats ||
    !opponent ||
    plan.candidates.length === 0
  ) {
    return null;
  }

  const currentNature = getNatureById(context.player.build.natureId);
  const currentItem = context.player.build.item;
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
    slotIndex: plan.slotIndex,
    configuredDirection: plan.configuredDirection,
    playerPokemonId: player.id,
    playerDisplayName: getOptimizationPokemonDisplayName(
      locale,
      player,
      pokemonIndex,
    ),
    opponentPokemonId: opponent.id,
    opponentDisplayName: getOptimizationPokemonDisplayName(
      locale,
      opponent,
      pokemonIndex,
    ),
    field: { ...context.field },
    currentBuild: {
      natureId: context.player.build.natureId,
      natureDisplayName: translateGameName(
        locale,
        "natures",
        context.player.build.natureId,
        currentNature.label,
      ),
      evs: { ...context.player.build.evs },
      finalStats: calculateChampionsStats(
        player.baseStats,
        context.player.build.evs,
        currentNature,
      ),
      itemId: currentItemId,
      itemDisplayName: currentItemDisplayName,
      moveIds: [0, 1, 2, 3].map(
        (index) =>
          context.player.moves[index]?.id ??
          context.player.build.moveIds[index] ??
          "",
      ),
    },
    moveMechanics: createOptimizationMoveMechanics(context, plan, locale),
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
      speedBenchmark: {
        current: { ...candidate.speedBenchmark.current },
        optimized: { ...candidate.speedBenchmark.optimized },
      },
    })),
  };
}

function createCopilotMatchupSnapshot(
  context: CalculatorAnalysisContext | null | undefined,
  plan: TeamMatchupPlan | null | undefined,
  locale: Locale,
  pokemonIndex: PokemonIndexEntry[],
  sets: CopilotSetSnapshot[],
  abilityById: Map<string, PokemonAbility>,
): CopilotMatchupSnapshot | null {
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
        displayName: set.displayName,
        roleIds: [...set.roleIds],
        responseTier: member.responseTier,
        offenseBenchmarks: member.offenseBenchmarks.map(localizeBenchmark),
        defenseBenchmarks: member.defenseBenchmarks.map(localizeBenchmark),
        speed: { ...member.speed },
      }];
    }),
  };
}

function filterPersistentMatchupOptimization(
  optimization: CopilotSetOptimizationSnapshot | null,
  matchup: CopilotMatchupSnapshot | null,
) {
  if (!optimization || !matchup) return optimization;

  const selectedMember = matchup.members.find(
    ({ slotIndex }) => slotIndex === optimization.slotIndex,
  );
  const persistentMoveIds = new Set(
    selectedMember?.offenseBenchmarks.flatMap((benchmark) =>
      benchmark.persistentSequence ? [benchmark.moveId] : [],
    ) ?? [],
  );
  if (persistentMoveIds.size === 0) return optimization;

  const candidates = optimization.candidates.filter((candidate) =>
    candidate.id === "set-current" ||
    !candidate.offenseBenchmarks.some((benchmark) =>
      benchmark.optimizedVsCurrent === "better" &&
      (persistentMoveIds.has(benchmark.moveId) ||
        persistentMoveIds.has(benchmark.currentMoveId)),
    ),
  );

  return candidates.length > 0 ? { ...optimization, candidates } : null;
}

export function formatList(values: string[], locale: Locale) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (locale === "ko") {
    return values.join(", ");
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

export function text(
  locale: Locale,
  key: CopilotTextKey,
  variables?: Record<string, string | number>,
) {
  return getCopilotText(locale, key, variables);
}

export function localizeType(locale: Locale, type: PokemonType) {
  return translateGameName(locale, "types", type, formatLookup(type));
}

export function createCopilotTypeLabels(
  locale: Locale,
): CopilotTypeLabelSnapshot[] {
  return pokemonTypes.map((type) => ({
    id: type,
    displayName: localizeType(locale, type),
  }));
}

export function localizeConcept(
  locale: Locale,
  conceptId: TeamConceptId,
  fallback?: string,
) {
  const key = conceptCopilotTextKeys[conceptId];
  return key ? text(locale, key) : (fallback ?? formatLookup(conceptId));
}

export function describeCandidateFilter(
  filter: CopilotCandidateFilterSnapshot,
  locale: Locale,
) {
  return formatList(
    [
      ...filter.types.map((type) =>
        text(locale, "requirement.type", { type: localizeType(locale, type) }),
      ),
      ...(filter.ability
        ? [
            text(locale, "requirement.ability", {
              ability: translateGameName(
                locale,
                "abilities",
                filter.ability.id,
                filter.ability.name,
              ),
            }),
          ]
        : []),
      ...filter.moves.map((move) =>
        text(locale, "requirement.move", {
          move: translateGameName(locale, "moves", move.id, move.name),
        }),
      ),
    ],
    locale,
  );
}

function getSelectedMoves(
  memberMoves: PokemonMove[] | undefined,
  configuredMoveIds: string[] | undefined,
  locale: Locale,
) {
  const moveLookup = new Map<string, PokemonMove>();

  for (const move of memberMoves ?? []) {
    moveLookup.set(normalizeLookup(move.id), move);
    moveLookup.set(normalizeLookup(move.name), move);
  }

  const moveIds = configuredMoveIds?.length
    ? configuredMoveIds
    : (memberMoves ?? []).slice(0, 4).map((move) => move.id);

  const selectedMoves = moveIds.flatMap((moveId) => {
    if (!moveId) {
      return [];
    }

    const move = moveLookup.get(normalizeLookup(moveId));

    const snapshot = move
      ? {
            id: move.id,
            name: move.name,
            displayName: translateGameName(
              locale,
              "moves",
              move.id,
              move.name,
            ),
            type: move.type,
            category: normalizeMoveCategory(move.category),
            power: move.power,
            spreadTarget: getMoveSpreadTarget(move),
          }
      : {
            id: moveId,
            name: formatLookup(moveId),
            displayName: translateGameName(
              locale,
              "moves",
              moveId,
              formatLookup(moveId),
            ),
            type: "normal" as const,
            category: "unknown" as const,
            power: null,
            spreadTarget: null,
          };

    return [{ snapshot, source: move }];
  });

  return {
    snapshots: selectedMoves.map(({ snapshot }) => snapshot),
    mechanics: selectedMoves.map(({ snapshot, source }) => ({
      id: snapshot.id,
      displayName: snapshot.displayName,
      description: source?.description,
      tags: source?.tags,
    })),
  };
}

function normalizeMoveCategory(
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

function getMoveSpreadTarget(
  move: Pick<PokemonMove, "tags">,
): CopilotMoveSpreadTarget | null {
  if (move.tags?.includes("Spread: All")) {
    return "all";
  }

  if (move.tags?.includes("Spread: Adjacent")) {
    return "adjacent";
  }

  if (move.tags?.includes("Spread: Foes")) {
    return "foes";
  }

  return null;
}

function createSetOffensiveProfile(
  moves: CopilotMoveSnapshot[],
): CopilotSetOffensiveProfile {
  return {
    physicalMoveIds: moves
      .filter((move) => move.category === "physical")
      .map((move) => move.id),
    specialMoveIds: moves
      .filter((move) => move.category === "special")
      .map((move) => move.id),
    statusMoveIds: moves
      .filter((move) => move.category === "status")
      .map((move) => move.id),
    spreadMoveIds: moves
      .filter((move) => move.spreadTarget)
      .map((move) => move.id),
  };
}

function createTeamOffensiveProfile(
  sets: CopilotSetSnapshot[],
): CopilotTeamOffensiveProfile {
  const physicalSources = Object.fromEntries(
    sets.flatMap((set) =>
      set.moves.some((move) => move.category === "physical")
        ? [[
            set.displayName,
            set.moves
              .filter((move) => move.category === "physical")
              .map((move) => move.displayName),
          ]]
        : [],
    ),
  );
  const specialSources = Object.fromEntries(
    sets.flatMap((set) =>
      set.moves.some((move) => move.category === "special")
        ? [[
            set.displayName,
            set.moves
              .filter((move) => move.category === "special")
              .map((move) => move.displayName),
          ]]
        : [],
    ),
  );
  const spreadSources = Object.fromEntries(
    sets.flatMap((set) =>
      set.moves.some((move) => move.spreadTarget)
        ? [[
            set.displayName,
            set.moves
              .filter((move) => move.spreadTarget)
              .map((move) => move.displayName),
          ]]
        : [],
    ),
  );

  return {
    physicalMoveCount: Object.values(physicalSources).flat().length,
    specialMoveCount: Object.values(specialSources).flat().length,
    spreadMoveCount: Object.values(spreadSources).flat().length,
    physicalSources,
    specialSources,
    spreadSources,
  };
}

function createTeamMoveSources(sets: CopilotSetSnapshot[]) {
  return Object.fromEntries(
    sets.map((set) => [
      set.displayName,
      set.moves.map((move) => move.displayName),
    ]),
  );
}

function appendDefensiveProfileEntry(
  profile: Partial<Record<PokemonType, string[]>>,
  type: PokemonType,
  pokemonId: string,
) {
  profile[type] = [...(profile[type] ?? []), pokemonId];
}

function createTeamDefensiveProfile(
  sets: CopilotSetSnapshot[],
): CopilotTeamDefensiveProfile {
  const profile: CopilotTeamDefensiveProfile = {
    weakTo: {},
    resists: {},
    immuneTo: {},
  };

  for (const set of sets) {
    for (const weakness of set.defensiveProfile.weaknesses) {
      appendDefensiveProfileEntry(profile.weakTo, weakness.type, set.displayName);
    }

    for (const resistance of set.defensiveProfile.resistances) {
      appendDefensiveProfileEntry(profile.resists, resistance.type, set.displayName);
    }

    for (const immunity of set.defensiveProfile.immunities) {
      appendDefensiveProfileEntry(profile.immuneTo, immunity.type, set.displayName);
    }
  }

  return profile;
}

function createRoleCounts(diagnostics: TeamDiagnosticsResult) {
  return diagnostics.roles.reduce(
    (counts, role) => ({
      ...counts,
      [role.id]: role.slotIndexes.length,
    }),
    {
      "physical-attacker": 0,
      "special-attacker": 0,
      "physical-wall": 0,
      "special-wall": 0,
      supporter: 0,
      setter: 0,
    } satisfies Record<TeamRoleId, number>,
  );
}

function createMegaEvolutionSnapshot(
  member: NonNullable<TeamSlot>,
  item: PokemonItem | null | undefined,
  pokemonIndex: PokemonIndexEntry[],
  locale: Locale,
): CopilotMegaEvolutionSnapshot | null {
  if (!item) {
    return null;
  }

  const activeEntry = pokemonIndex.find((entry) => entry.name === member.id);

  if (!activeEntry || activeEntry.formKind === "mega") {
    return null;
  }

  const itemId = item.id.trim().toLowerCase();
  const knownStoneNames = new Set([itemId]);
  const megaEntry = pokemonIndex.find(
    (entry) =>
      entry.formKind === "mega" &&
      entry.speciesKey === activeEntry.speciesKey &&
      getMegaStoneItemName(entry.name, knownStoneNames) === itemId,
  );

  if (!megaEntry) {
    return null;
  }

  const ability = megaEntry.abilities[0] ?? null;

  return {
    pokemonId: megaEntry.name,
    pokemonName: megaEntry.displayName,
    displayName: translatePokemonName(locale, {
      id: megaEntry.name,
      fallback: megaEntry.displayName,
      speciesId: megaEntry.speciesKey,
      formLabel: megaEntry.formLabel,
      formKind: megaEntry.formKind,
    }),
    types: [...megaEntry.types],
    typeDisplayNames: megaEntry.types.map((type) => localizeType(locale, type)),
    ability,
    abilityDisplayName: ability
      ? translateGameName(locale, "abilities", ability, ability)
      : null,
    defensiveProfile: createPokemonDefensiveProfile(
      { types: megaEntry.types },
      ability ?? "",
    ),
  };
}

function createMegaOptions(
  sets: CopilotSetSnapshot[],
): CopilotMegaOptionSnapshot[] {
  return sets.flatMap((set) => {
    if (set.megaEvolution) {
      return [
        {
          slotIndex: set.slotIndex,
          pokemonId: set.megaEvolution.pokemonId,
          pokemonName: set.megaEvolution.pokemonName,
          displayName: set.megaEvolution.displayName,
          types: [...set.megaEvolution.types],
          typeDisplayNames: [...set.megaEvolution.typeDisplayNames],
          ability: set.megaEvolution.ability,
          abilityDisplayName: set.megaEvolution.abilityDisplayName,
        },
      ];
    }

    if (!set.isMegaForm) {
      return [];
    }

    return [
      {
        slotIndex: set.slotIndex,
        pokemonId: set.pokemonId,
        pokemonName: set.pokemonName,
        displayName: set.displayName,
        types: [...set.types],
        typeDisplayNames: [...set.typeDisplayNames],
        ability: set.ability,
        abilityDisplayName: set.abilityDisplayName,
      },
    ];
  });
}

export function createCopilotAnalysisRequest({
  scope,
  locale = "en",
  battleFormat = "doubles",
  teamName,
  team,
  pokemonIndex = [],
  abilityIndex = [],
  selectedSlot,
  buildState,
  diagnostics,
  validity,
  recommendationCandidates = [],
  calculatorContext,
  optimizationPlan,
  matchupPlan,
}: CreateCopilotRequestInput): CopilotAnalysisRequest {
  const mechanicsSets: CopilotMechanicsSetInput[] = [];
  const responsibilityGroups: CopilotResponsibilityId[][] = [];
  const abilityById = new Map(
    abilityIndex.map((ability) => [normalizeLookup(ability.id), ability]),
  );
  const sets = team.flatMap((member, slotIndex) => {
    if (!member) {
      return [];
    }

    const evs = buildState.evsBySlot[slotIndex] ?? defaultEvs;
    const slotValidity = validity.slotResults[slotIndex];
    const pokemonEntry = pokemonIndex.find((entry) => entry.name === member.id);
    const pokemonName = pokemonEntry?.displayName ?? member.name;
    const includeForm = pokemonEntry
      ? pokemonEntry.displayName !== formatLookup(pokemonEntry.speciesKey)
      : true;
    const displayName = translatePokemonName(locale, {
      id: pokemonEntry?.name ?? member.id,
      fallback: pokemonName,
      speciesId: pokemonEntry?.speciesKey,
      formLabel: pokemonEntry?.formLabel,
      formKind: pokemonEntry?.formKind,
      includeForm,
    });
    const ability =
      buildState.abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? null;
    const item = buildState.itemBySlot[slotIndex];
    const natureId = buildState.natureBySlot[slotIndex] ?? "hardy";
    const selectedNature = getNatureById(natureId);
    const nature = selectedNature.label;
    const baseStats = member.baseStats ? { ...member.baseStats } : null;
    const stats = member.baseStats
      ? calculateChampionsStats(member.baseStats, evs, selectedNature)
      : null;
    const selectedMoves = getSelectedMoves(
      member.moves,
      buildState.moveIdsBySlot[slotIndex],
      locale,
    );
    const moves = selectedMoves.snapshots;
    const itemDisplayName = item
      ? translateGameName(
          locale,
          "items",
          item.showdownId ?? item.id,
          item.name,
        )
      : null;
    const abilityDisplayName = ability
      ? translateGameName(locale, "abilities", ability, ability)
      : null;
    const megaEvolution = createMegaEvolutionSnapshot(
      member,
      item,
      pokemonIndex,
      locale,
    );

    const mechanicsSet: CopilotMechanicsSetInput = {
      abilities: [
        ...(ability && abilityDisplayName
          ? [
              {
                id: ability,
                displayName: abilityDisplayName,
                effect: abilityById.get(normalizeLookup(ability))?.effect,
              },
            ]
          : []),
        ...(megaEvolution?.ability && megaEvolution.abilityDisplayName
          ? [
              {
                id: megaEvolution.ability,
                displayName: megaEvolution.abilityDisplayName,
                effect: abilityById.get(
                  normalizeLookup(megaEvolution.ability),
                )?.effect,
              },
            ]
          : []),
      ],
      itemId: item?.showdownId ?? item?.id ?? null,
      itemDisplayName,
      itemEffect: item?.effect,
      moves: selectedMoves.mechanics,
    };
    mechanicsSets.push(mechanicsSet);
    responsibilityGroups.push(
      inferCopilotResponsibilities({
        abilities: mechanicsSet.abilities,
        moves: mechanicsSet.moves.map((move) => ({
          id: move.id,
          effect: move.description,
          tags: move.tags,
        })),
      }),
    );

    return [
      {
        slotIndex,
        pokemonId: member.id,
        pokemonName,
        displayName,
        isMegaForm: pokemonEntry?.formKind === "mega",
        types: member.types,
        typeDisplayNames: member.types.map((type) => localizeType(locale, type)),
        item: item?.name ?? null,
        itemDisplayName,
        ability,
        abilityDisplayName,
        nature,
        natureDisplayName: translateGameName(
          locale,
          "natures",
          natureId,
          nature,
        ),
        baseStats,
        stats,
        evs,
        evTotal: statKeys.reduce((total, stat) => total + evs[stat], 0),
        moves,
        defensiveProfile: createPokemonDefensiveProfile(member, ability ?? ""),
        megaEvolution,
        offensiveProfile: createSetOffensiveProfile(moves),
        roleIds: diagnostics.roles
          .filter((role) => role.slotIndexes.includes(slotIndex))
          .map((role) => role.id),
        setterConceptIds: diagnostics.concepts
          .filter((concept) => concept.setterSlots.includes(slotIndex))
          .map((concept) => concept.id),
        aceConceptIds: diagnostics.concepts
          .filter((concept) => concept.aceSlots.includes(slotIndex))
          .map((concept) => concept.id),
        validityStatus: slotValidity?.status ?? "unavailable",
        validityIssues:
          slotValidity?.issues.map((issue) => {
            const { slotIndex: issueSlotIndex, values, ...required } = issue;
            return {
              ...required,
              ...(values === undefined ? {} : { values: { ...values } }),
              ...(issueSlotIndex === undefined
                ? {}
                : { slotIndex: issueSlotIndex }),
            };
          }) ?? [],
      },
    ];
  });
  const candidateFilters = Object.entries(buildState.candidateFiltersBySlot).flatMap(
    ([slotIndexValue, filters]) => {
      const slotIndex = Number(slotIndexValue);

      if (team[slotIndex] || !hasPokemonCandidateFilters(filters)) {
        return [];
      }

      return [
        {
          slotIndex,
          types: [...filters.types],
          ability: filters.ability ? { ...filters.ability } : null,
          moves: filters.moves.map((move) => ({ ...move })),
        },
      ];
    },
  );

  const matchup = scope === "matchup"
    ? createCopilotMatchupSnapshot(
        calculatorContext,
        matchupPlan,
        locale,
        pokemonIndex,
        sets,
        abilityById,
      )
    : null;
  const unfilteredOptimization =
    scope === "optimization" || scope === "matchup"
      ? createCopilotOptimizationSnapshot(
          calculatorContext?.selectedSlot === selectedSlot &&
            calculatorContext.player.member?.id === team[selectedSlot]?.id
            ? calculatorContext
            : null,
          locale,
          pokemonIndex,
          optimizationPlan,
        )
      : null;
  const optimization = scope === "matchup"
    ? filterPersistentMatchupOptimization(unfilteredOptimization, matchup)
    : unfilteredOptimization;

  return {
    version: 25,
    locale,
    scope,
    battleFormat,
    teamName: teamName.trim() || "Untitled Team",
    selectedSlot,
    typeLabels: createCopilotTypeLabels(locale),
    sets,
    megaOptions: createMegaOptions(sets),
    candidateFilters,
    recommendationCandidates:
      scope === "recommendation"
        ? localizeRecommendationCandidates(locale, recommendationCandidates)
        : [],
    optimization,
    matchup,
    mechanics: createCopilotMechanicsSnapshot(mechanicsSets),
    diagnostics: {
      filledSlots: diagnostics.filledSlots,
      coverageCount: diagnostics.coveredDefendingTypes.length,
      coverageGaps: diagnostics.uncoveredDefendingTypes,
      defensiveMatchups: diagnostics.defensiveMatchups,
      alerts: diagnostics.alerts,
      roleCounts: createRoleCounts(diagnostics),
      responsibilityCounts:
        createCopilotResponsibilityCounts(responsibilityGroups),
      moveSources: createTeamMoveSources(sets),
      defensiveProfile: createTeamDefensiveProfile(sets),
      offensiveProfile: createTeamOffensiveProfile(sets),
      concepts: diagnostics.concepts,
      validity: {
        status: validity.status,
        errorCount: validity.errorCount,
        unavailableCount: validity.unavailableCount,
      },
    },
  };
}
