import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  loadSmogonUsagePokemonIds,
  loadSmogonUsageSets,
  type SmogonUsageSet,
} from "../api/smogonUsage";
import { getPokemonLookupAliases } from "./pokemonAliases";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import { loadShowdownData } from "../api/showdownData";
import type {
  ShowdownDataSnapshot,
  ShowdownSpeciesData,
} from "../api/showdownData";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import {
  getLegalMoves,
  getPokemonCandidateAbilities,
  isPokemonLegal,
} from "../api/showdownLegality";
import {
  teamConceptDefinitions,
  type TeamConceptId,
} from "../data/teamConcepts";
import {
  defensiveMoveIds,
  supportMoveIds,
} from "../data/teamRoleMoves";
import type {
  PokemonAbility,
  PokemonCandidateFilters,
  PokemonIndexEntry,
  PokemonMove,
  PokemonType,
  StatBlock,
  TeamSlot,
} from "../types";
import type { TeamBuildState } from "./teamBuildState";
import { matchesPokemonCandidateFilters } from "./pokemonCandidateFilters";
import { compactCopilotMechanicEffect } from "./copilotMechanics";
import {
  inferCopilotResponsibilities,
  type CopilotResponsibilityId,
} from "./copilotResponsibilities";
import { orderPokemonOptionsByUsage } from "./pokemonUsageOrder";
import {
  createPokemonDefensiveProfile,
  getDefensiveMultiplier,
  type TeamDiagnosticsResult,
  type TeamRoleId,
} from "./teamDiagnostics";

export type PokemonRecommendationAbility = {
  id: string;
  displayName: string;
  effect?: string;
};

export type PokemonRecommendationOption = {
  id: string;
  speciesKey: string;
  displayName: string;
  types: PokemonType[];
  typeDisplayNames: string[];
  abilities: PokemonRecommendationAbility[];
  legalMoveIds: string[];
  isMegaForm?: boolean;
};

type CreatePokemonRecommendationOptionsInput = {
  pokemonIndex: PokemonIndexEntry[];
  abilityIndex: PokemonAbility[];
  legality: ShowdownLegalitySnapshot | null;
  getPokemonDisplayName: (
    entry: PokemonIndexEntry,
    includeForm: boolean,
  ) => string;
  getTypeDisplayName: (type: PokemonType) => string;
  getAbilityDisplayName: (id: string, fallback: string) => string;
};

export type PokemonRecommendationCommonSet = {
  ability: string | null;
  item: string | null;
  nature: string | null;
  moves: Array<{
    id: string;
    displayName: string;
    type: PokemonType;
    category: string;
    power: number | null;
    effect?: string;
  }>;
};

export type CopilotRecommendationCandidateSnapshot = {
  pokemonId: string;
  displayName: string;
  types: PokemonType[];
  typeDisplayNames: string[];
  abilities: PokemonRecommendationAbility[];
  baseStats: StatBlock | null;
  speedTier: "very-slow" | "slow" | "mid" | "fast" | "very-fast" | "unknown";
  requiresMegaStone: boolean;
  usageRank: number | null;
  commonSet: PokemonRecommendationCommonSet | null;
  responsibilityIds: CopilotResponsibilityId[];
  fit: {
    weakTo: PokemonType[];
    resistsTeamThreats: PokemonType[];
    amplifiesTeamThreats: PokemonType[];
    addsUnansweredWeaknesses: PokemonType[];
    coversTypes: PokemonType[];
    roleContributions: TeamRoleId[];
    roleRedundancies: TeamRoleId[];
    conceptSynergies: TeamConceptId[];
    conflicts: string[];
  };
};

type CreatePokemonRecommendationCandidatesInput = {
  options: PokemonRecommendationOption[];
  filters: PokemonCandidateFilters;
  occupiedSpeciesKeys: Set<string>;
  diagnostics: TeamDiagnosticsResult;
  battleFormat: BattleFormat;
  existingMegaOptionCount?: number;
  limit?: number;
};

type RankPokemonRecommendationCandidatesInput = Omit<
  CreatePokemonRecommendationCandidatesInput,
  "battleFormat"
> & {
  usageIds: string[] | null;
  usageSets?: SmogonUsageSet[] | null;
  showdownData: ShowdownDataSnapshot | null;
};

type ScoredCandidate = {
  candidate: CopilotRecommendationCandidateSnapshot;
  scores: {
    usage: number;
    defense: number;
    coverage: number;
    role: number;
    strategy: number;
    overall: number;
  };
};

const MAX_RECOMMENDATION_ABILITY_EFFECT_LENGTH = 320;
const MAX_RECOMMENDATION_ABILITIES = 3;
const DEFAULT_RECOMMENDATION_CANDIDATE_LIMIT = 30;
const RECOMMENDATION_USAGE_SHARE = 0.75;

export function createPokemonRecommendationOptions({
  pokemonIndex,
  abilityIndex,
  legality,
  getPokemonDisplayName,
  getTypeDisplayName,
  getAbilityDisplayName,
}: CreatePokemonRecommendationOptionsInput): PokemonRecommendationOption[] {
  const abilityById = new Map(
    abilityIndex.map((ability) => [normalizeShowdownId(ability.id), ability]),
  );

  return pokemonIndex
    .filter((entry) => entry.isSelectorOption)
    .filter((entry) =>
      isPokemonLegal(legality, entry.showdownId, entry.speciesKey),
    )
    .map((entry) => {
      const includeForm =
        entry.formKind === "gender" ||
        entry.formKind === "regional" ||
        entry.displayName !== formatIdLabel(entry.speciesKey);

      return {
        id: entry.name,
        speciesKey: entry.speciesKey,
        displayName: getPokemonDisplayName(entry, includeForm),
        types: entry.types,
        typeDisplayNames: entry.types.map(getTypeDisplayName),
        abilities: getPokemonCandidateAbilities(
          legality,
          entry,
          pokemonIndex,
        ).map((ability) => {
          const abilityData = abilityById.get(normalizeShowdownId(ability.id));

          return {
            id: ability.id,
            displayName: getAbilityDisplayName(ability.id, ability.name),
            ...(abilityData?.effect ? { effect: abilityData.effect } : {}),
          };
        }),
        legalMoveIds: [
          ...(getLegalMoves(legality, entry.showdownId, entry.speciesKey) ?? []),
        ],
        isMegaForm: entry.formKind === "mega",
      };
    });
}

export function getOccupiedPokemonSpeciesKeys(
  team: TeamSlot[],
  pokemonIndex: PokemonIndexEntry[],
) {
  return new Set(
    team.flatMap((member) => {
      if (!member) return [];

      return [
        pokemonIndex.find((entry) => entry.name === member.id)?.speciesKey ??
          member.id,
      ];
    }),
  );
}

export function countTeamMegaOptions(
  team: TeamSlot[],
  itemBySlot: TeamBuildState["itemBySlot"],
  pokemonIndex: PokemonIndexEntry[],
) {
  return team.reduce((count, member, slotIndex) => {
    if (!member) return count;

    const item = itemBySlot[slotIndex];
    const isMegaForm =
      pokemonIndex.find((entry) => entry.name === member.id)?.formKind === "mega";
    const hasMegaStone = item?.category === "Mega Stones";
    return count + Number(isMegaForm || hasMegaStone);
  }, 0);
}

function normalizeRecommendationAbilities(
  abilities: PokemonRecommendationAbility[],
  commonAbility: string | null,
) {
  const commonAbilityId = normalizeShowdownId(commonAbility ?? "");
  const orderedAbilities = [...abilities].sort((left, right) => {
    const leftIsCommon = normalizeShowdownId(left.id) === commonAbilityId;
    const rightIsCommon = normalizeShowdownId(right.id) === commonAbilityId;
    return Number(rightIsCommon) - Number(leftIsCommon);
  });

  return orderedAbilities
    .slice(0, MAX_RECOMMENDATION_ABILITIES)
    .map((ability) => {
      if (
        !ability.effect ||
        ability.effect.length <= MAX_RECOMMENDATION_ABILITY_EFFECT_LENGTH
      ) {
        return ability;
      }

      return {
        ...ability,
        effect: `${ability.effect
          .slice(0, MAX_RECOMMENDATION_ABILITY_EFFECT_LENGTH - 3)
          .trimEnd()}...`,
      };
    });
}

function resolveShowdownSpecies(
  option: PokemonRecommendationOption,
  showdownData: ShowdownDataSnapshot | null,
) {
  if (!showdownData) {
    return null;
  }

  const lookupIds = [option.id, option.speciesKey].map(normalizeShowdownId);
  return (
    lookupIds
      .map((lookupId) => showdownData.speciesById[lookupId])
      .find((species): species is ShowdownSpeciesData => Boolean(species)) ?? null
  );
}

function resolveUsageSet(
  option: PokemonRecommendationOption,
  usageSets: SmogonUsageSet[] | null | undefined,
) {
  if (!usageSets?.length) {
    return null;
  }

  const lookupIds = new Set(
    [option.id, option.speciesKey]
      .flatMap((id) => getPokemonLookupAliases(id))
      .map(normalizeShowdownId),
  );

  return (
    usageSets.find((set) => lookupIds.has(normalizeShowdownId(set.pokemonId))) ??
    null
  );
}

function createCommonSet(
  usageSet: SmogonUsageSet | null,
  showdownData: ShowdownDataSnapshot | null,
): PokemonRecommendationCommonSet | null {
  if (!usageSet) {
    return null;
  }

  const moves = usageSet.moveIds
    .slice(0, 4)
    .flatMap((moveId) => {
      const move = showdownData?.movesById[normalizeShowdownId(moveId)];
      if (!move) return [];

      const effect = compactCopilotMechanicEffect(move.description);
      return [
        {
          id: move.id,
          displayName: move.name,
          type: move.type,
          category: move.category ?? "Status",
          power: move.power,
          ...(effect ? { effect } : {}),
        },
      ];
    });

  return {
    ability: usageSet.ability ?? null,
    item: usageSet.itemName ?? null,
    nature: usageSet.nature ?? null,
    moves,
  };
}

function getSpeedTier(baseStats: StatBlock | null) {
  if (!baseStats) return "unknown" as const;
  if (baseStats.speed <= 50) return "very-slow" as const;
  if (baseStats.speed <= 75) return "slow" as const;
  if (baseStats.speed <= 99) return "mid" as const;
  if (baseStats.speed <= 119) return "fast" as const;
  return "very-fast" as const;
}

function getCommonMoves(
  usageSet: SmogonUsageSet | null,
  showdownData: ShowdownDataSnapshot | null,
) {
  return (usageSet?.moveIds ?? []).flatMap((moveId) => {
    const move = showdownData?.movesById[normalizeShowdownId(moveId)];
    return move ? [move] : [];
  });
}

function inferCandidateRoles(
  baseStats: StatBlock | null,
  usageSet: SmogonUsageSet | null,
  moves: PokemonMove[],
) {
  const roles = new Set<TeamRoleId>();
  const physicalMoves = moves.filter((move) => move.category === "Physical").length;
  const specialMoves = moves.filter((move) => move.category === "Special").length;
  const supportMoves = moves.filter((move) =>
    supportMoveIds.has(normalizeShowdownId(move.id)),
  ).length;
  const defensiveMoves = moves.filter((move) =>
    defensiveMoveIds.has(normalizeShowdownId(move.id)),
  ).length;
  const setterMoves = moves.filter((move) =>
    teamConceptDefinitions.some((definition) =>
      definition.setterMoveIds.has(normalizeShowdownId(move.id)),
    ),
  ).length;
  const evs = usageSet?.evs;

  if (
    physicalMoves >= 2 &&
    (!baseStats || baseStats.attack >= baseStats.specialAttack * 0.85)
  ) {
    roles.add("physical-attacker");
  }
  if (
    specialMoves >= 2 &&
    (!baseStats || baseStats.specialAttack >= baseStats.attack * 0.85)
  ) {
    roles.add("special-attacker");
  }
  if (supportMoves >= 2) roles.add("supporter");
  if (setterMoves > 0) roles.add("setter");
  if (
    baseStats &&
    defensiveMoves >= 2 &&
    (evs?.hp ?? 0) + (evs?.defense ?? 0) >= 252 &&
    baseStats.defense >= baseStats.specialDefense * 0.9
  ) {
    roles.add("physical-wall");
  }
  if (
    baseStats &&
    defensiveMoves >= 2 &&
    (evs?.hp ?? 0) + (evs?.specialDefense ?? 0) >= 252 &&
    baseStats.specialDefense >= baseStats.defense * 0.9
  ) {
    roles.add("special-wall");
  }

  return [...roles];
}

const weatherConceptIds = new Set<TeamConceptId>([
  "rain",
  "sun",
  "sand",
  "snow",
]);

function inferConceptFit(
  diagnostics: TeamDiagnosticsResult,
  baseStats: StatBlock | null,
  roles: TeamRoleId[],
  abilityId: string,
  moves: PokemonMove[],
) {
  const activeConceptIds = new Set(diagnostics.concepts.map((concept) => concept.id));
  const abilityLookup = normalizeShowdownId(abilityId);
  const moveIds = new Set(moves.map((move) => normalizeShowdownId(move.id)));
  const isAttacker =
    roles.includes("physical-attacker") || roles.includes("special-attacker");

  const conceptSynergies = teamConceptDefinitions.flatMap(
    (definition): TeamConceptId[] => {
    const setsMode =
      definition.setterAbilityIds.has(abilityLookup) ||
      [...definition.setterMoveIds].some((moveId) => moveIds.has(moveId));
    const benefitsFromMode =
      definition.aceAbilityIds.has(abilityLookup) ||
      [...definition.aceMoveIds].some((moveId) => moveIds.has(moveId)) ||
      (definition.boostedMoveType
        ? moves.some(
            (move) =>
              move.category !== "Status" && move.type === definition.boostedMoveType,
          )
        : false);
    const speedModeFit =
      definition.id === "trick-room"
        ? Boolean(isAttacker && baseStats && baseStats.speed <= 75)
        : definition.id === "tailwind"
          ? isAttacker
          : false;

      return activeConceptIds.has(definition.id) &&
        (setsMode || benefitsFromMode || speedModeFit)
        ? [definition.id]
        : [];
    },
  );
  const activeWeatherIds = [...activeConceptIds].filter((conceptId) =>
    weatherConceptIds.has(conceptId),
  );
  const conceptConflicts = teamConceptDefinitions.flatMap((definition) => {
    if (
      !weatherConceptIds.has(definition.id) ||
      activeWeatherIds.length === 0 ||
      activeConceptIds.has(definition.id)
    ) {
      return [];
    }

    const relation = definition.setterAbilityIds.has(abilityLookup)
      ? "sets"
      : definition.aceAbilityIds.has(abilityLookup)
        ? "benefits-from"
        : null;

    return relation
      ? [
          `common-ability-${relation}-${definition.id}-not-active-${activeWeatherIds.join("-")}`,
        ]
      : [];
  });

  return { conceptConflicts, conceptSynergies };
}

function candidateHandlesThreat(
  option: PokemonRecommendationOption,
  attackingType: PokemonType,
  abilityId: string,
) {
  const profile = createPokemonDefensiveProfile(option, abilityId);
  return (
    getDefensiveMultiplier(attackingType, option.types) < 1 ||
    profile.immunities.some((entry) => entry.type === attackingType)
  );
}

function selectDiversifiedCandidates(
  candidates: ScoredCandidate[],
  limit: number,
) {
  const tieBreak = (left: ScoredCandidate, right: ScoredCandidate) =>
    (left.candidate.usageRank ?? Number.MAX_SAFE_INTEGER) -
      (right.candidate.usageRank ?? Number.MAX_SAFE_INTEGER) ||
    left.candidate.displayName.localeCompare(right.candidate.displayName);
  const rankBy = (score: keyof ScoredCandidate["scores"]) =>
    [...candidates].sort(
      (left, right) => right.scores[score] - left.scores[score] || tieBreak(left, right),
    );
  const lanes = [
    rankBy("defense"),
    rankBy("strategy"),
    rankBy("role"),
    rankBy("coverage"),
    rankBy("overall"),
  ];
  const selected = new Map<string, ScoredCandidate>();
  const usageQuota = Math.min(
    limit,
    Math.ceil(limit * RECOMMENDATION_USAGE_SHARE),
  );

  rankBy("usage")
    .filter((entry) => entry.candidate.usageRank !== null)
    .slice(0, usageQuota)
    .forEach((entry) => selected.set(entry.candidate.pokemonId, entry));

  for (let depth = 0; depth < candidates.length && selected.size < limit; depth += 1) {
    for (const lane of lanes) {
      const entry = lane[depth];
      if (entry) selected.set(entry.candidate.pokemonId, entry);
      if (selected.size >= limit) break;
    }
  }

  if (selected.size < limit) {
    rankBy("usage").forEach((entry) => {
      if (selected.size < limit) {
        selected.set(entry.candidate.pokemonId, entry);
      }
    });
  }

  return [...selected.values()]
    .sort(
      (left, right) =>
        right.scores.overall - left.scores.overall || tieBreak(left, right),
    )
    .map(({ candidate }) => candidate);
}

export function rankPokemonRecommendationCandidates({
  options,
  filters,
  occupiedSpeciesKeys,
  diagnostics,
  usageIds,
  usageSets = null,
  showdownData,
  existingMegaOptionCount = 0,
  limit = DEFAULT_RECOMMENDATION_CANDIDATE_LIMIT,
}: RankPokemonRecommendationCandidatesInput) {
  const eligibleOptions = options.filter(
    (option) =>
      !occupiedSpeciesKeys.has(option.speciesKey) &&
      matchesPokemonCandidateFilters(
        {
          types: option.types,
          abilityIds: option.abilities.map((ability) => ability.id),
          moveIds: option.legalMoveIds,
        },
        filters,
      ),
  );

  if (eligibleOptions.length === 0) return [];

  const { orderedOptions, rankByOptionId } = orderPokemonOptionsByUsage(
    eligibleOptions,
    usageIds,
  );
  const teamThreats = diagnostics.defensiveMatchups
    .filter(
      (matchup) =>
        matchup.weakCount >= 2 &&
        matchup.weakCount > matchup.resistCount + matchup.immuneCount,
    )
    .map((matchup) => matchup.type);
  const coverageGaps = diagnostics.uncoveredDefendingTypes;
  const roleCounts = new Map(
    diagnostics.roles.map((role) => [role.id, role.slotIndexes.length]),
  );

  const scoredCandidates = orderedOptions.map((option) => {
    const usageRank = rankByOptionId.get(option.id) ?? null;
    const usageSet = resolveUsageSet(option, usageSets);
    const species = resolveShowdownSpecies(option, showdownData);
    const baseStats = species?.baseStats ?? null;
    const commonMoves = getCommonMoves(usageSet, showdownData);
    const commonAbility = usageSet?.ability ?? option.abilities[0]?.id ?? "";
    const defensiveProfile = createPokemonDefensiveProfile(option, commonAbility);
    const commonSet = createCommonSet(usageSet, showdownData);
    const normalizedAbilities = normalizeRecommendationAbilities(
      option.abilities,
      usageSet?.ability ?? null,
    );
    const commonAbilitySnapshot =
      normalizedAbilities.find(
        (ability) =>
          normalizeShowdownId(ability.id) ===
          normalizeShowdownId(commonSet?.ability ?? commonAbility),
      ) ?? normalizedAbilities[0];
    const responsibilityIds = inferCopilotResponsibilities({
      abilities: commonAbilitySnapshot ? [commonAbilitySnapshot] : [],
      moves:
        commonSet?.moves.map((move) => ({
          id: move.id,
          effect: move.effect,
        })) ?? [],
    });
    const weakTo = defensiveProfile.weaknesses.map((entry) => entry.type);
    const candidateRoles = inferCandidateRoles(baseStats, usageSet, commonMoves);
    const resistsTeamThreats = teamThreats.filter((type) =>
      candidateHandlesThreat(option, type, commonAbility),
    );
    const amplifiesTeamThreats = teamThreats.filter((type) =>
      defensiveProfile.weaknesses.some((entry) => entry.type === type),
    );
    const addsUnansweredWeaknesses = defensiveProfile.weaknesses
      .map((entry) => entry.type)
      .filter((type) => {
        const matchup = diagnostics.defensiveMatchups.find(
          (entry) => entry.type === type,
        );
        return matchup && matchup.resistCount + matchup.immuneCount === 0;
      });
    const legalMoveTypes = new Set(
      option.legalMoveIds.flatMap((moveId) => {
        const move = showdownData?.movesById[normalizeShowdownId(moveId)];
        return move && move.power !== null && move.power > 0 ? [move.type] : [];
      }),
    );
    const coversTypes = coverageGaps.filter((defendingType) =>
      [...legalMoveTypes].some(
        (attackingType) =>
          getDefensiveMultiplier(attackingType, [defendingType]) > 1,
      ),
    );
    const roleContributions = candidateRoles.filter(
      (roleId) => (roleCounts.get(roleId) ?? 0) === 0,
    );
    const roleRedundancies = candidateRoles.filter(
      (roleId) => (roleCounts.get(roleId) ?? 0) >= 2,
    );
    const { conceptConflicts, conceptSynergies } = inferConceptFit(
      diagnostics,
      baseStats,
      candidateRoles,
      commonAbility,
      commonMoves,
    );
    const conflicts = [
      ...conceptConflicts,
      ...(option.isMegaForm && existingMegaOptionCount >= 2
        ? ["would-be-third-mega-option"]
        : []),
      ...(option.isMegaForm && existingMegaOptionCount === 1
        ? ["adds-second-mega-branch"]
        : []),
    ];
    const usageScore = usageRank ? Math.max(0, (61 - usageRank) / 6) : 0;
    const defenseScore =
      resistsTeamThreats.length * 10 -
      amplifiesTeamThreats.length * 7 -
      addsUnansweredWeaknesses.length * 2;
    const coverageScore = coversTypes.length * 2;
    const roleScore =
      roleContributions.length * 6 - roleRedundancies.length * 2;
    const strategyScore =
      conceptSynergies.length * 8 -
      conflicts.filter((conflict) => conflict === "would-be-third-mega-option")
        .length *
        10;

    return {
      candidate: {
        pokemonId: option.id,
        displayName: option.displayName,
        types: option.types,
        typeDisplayNames: option.typeDisplayNames,
        abilities: normalizedAbilities,
        baseStats,
        speedTier: getSpeedTier(baseStats),
        requiresMegaStone: Boolean(option.isMegaForm),
        usageRank,
        commonSet,
        responsibilityIds,
        fit: {
          weakTo,
          resistsTeamThreats,
          amplifiesTeamThreats,
          addsUnansweredWeaknesses,
          coversTypes,
          roleContributions,
          roleRedundancies,
          conceptSynergies,
          conflicts,
        },
      },
      scores: {
        usage: usageScore,
        defense: defenseScore,
        coverage: coverageScore,
        role: roleScore,
        strategy: strategyScore,
        overall:
          usageScore +
          defenseScore +
          coverageScore +
          roleScore +
          strategyScore,
      },
    } satisfies ScoredCandidate;
  });

  return selectDiversifiedCandidates(scoredCandidates, limit);
}

export async function createPokemonRecommendationCandidates(
  input: CreatePokemonRecommendationCandidatesInput,
) {
  const [usageIds, usageSets, showdownData] = await Promise.all([
    loadSmogonUsagePokemonIds(input.battleFormat).catch(() => null),
    loadSmogonUsageSets(input.battleFormat).catch(() => null),
    loadShowdownData().catch(() => null),
  ]);

  return rankPokemonRecommendationCandidates({
    ...input,
    usageIds,
    usageSets,
    showdownData,
  });
}
