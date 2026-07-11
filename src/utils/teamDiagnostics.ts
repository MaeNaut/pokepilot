import { typeChart } from "../data/typeChart";
import {
  defensiveMoveIds,
  supportAbilityIds,
  supportMoveIds,
} from "../data/teamRoleMoves";
import {
  calculateChampionsStats,
  defaultEvs,
  getNatureById,
} from "../data/natures";
import { pokemonTypes } from "../types";
import type {
  PokemonMove,
  PokemonType,
  TeamMember,
  TeamSlot,
} from "../types";
import type { TeamBuildState } from "../hooks/useTeamBuildState";

export type DefensiveMatchup = {
  type: PokemonType;
  weakCount: number;
  fourTimesWeakCount: number;
  resistCount: number;
  immuneCount: number;
};

export type TeamDiagnosticAlert = {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  message: string;
};

export type TeamRoleId =
  | "physical-attacker"
  | "special-attacker"
  | "physical-wall"
  | "special-wall"
  | "supporter";

export type TeamRoleSummary = {
  id: TeamRoleId;
  label: string;
  description: string;
  slotIndexes: number[];
};

export type TeamDiagnosticsResult = {
  filledSlots: number;
  defensiveMatchups: DefensiveMatchup[];
  attackingTypes: PokemonType[];
  coveredDefendingTypes: PokemonType[];
  uncoveredDefendingTypes: PokemonType[];
  roles: TeamRoleSummary[];
  alerts: TeamDiagnosticAlert[];
};

type DiagnosticBuildState = Pick<
  TeamBuildState,
  | "moveIdsBySlot"
  | "evsBySlot"
  | "natureBySlot"
  | "abilityBySlot"
>;

const roleDefinitions: Array<{
  id: TeamRoleId;
  label: string;
  description: string;
}> = [
  {
    id: "physical-attacker",
    label: "Physical Attacker",
    description: "Commits EVs or nature to Attack, uses at least two physical attacks, and clearly leans physical.",
  },
  {
    id: "special-attacker",
    label: "Special Attacker",
    description: "Commits EVs or nature to Sp. Atk, uses at least two special attacks, and clearly leans special.",
  },
  {
    id: "physical-wall",
    label: "Physical Wall",
    description: "Concentrates EVs in HP and Defense, clearly leans physical, and carries multiple defensive moves.",
  },
  {
    id: "special-wall",
    label: "Special Wall",
    description: "Concentrates EVs in HP and Sp. Def, clearly leans special, and carries multiple defensive moves.",
  },
  {
    id: "supporter",
    label: "Supporter",
    description: "Carries multiple support moves, or combines a support ability with utility.",
  },
];

const typeImmunityByAbility: Record<string, PokemonType> = {
  dryskin: "water",
  eartheater: "ground",
  flashfire: "fire",
  levitate: "ground",
  lightningrod: "electric",
  motordrive: "electric",
  sapsipper: "grass",
  stormdrain: "water",
  voltabsorb: "electric",
  waterabsorb: "water",
  wellbakedbody: "fire",
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatType(type: PokemonType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getTypeMultiplier(attackingType: PokemonType, defendingType: PokemonType) {
  return typeChart[attackingType][defendingType] ?? 1;
}

export function getDefensiveMultiplier(
  attackingType: PokemonType,
  defendingTypes: PokemonType[],
) {
  return defendingTypes.reduce(
    (multiplier, defendingType) =>
      multiplier * getTypeMultiplier(attackingType, defendingType),
    1,
  );
}

function getAbilityAwareDefensiveMultiplier(
  attackingType: PokemonType,
  member: TeamMember,
  ability: string,
) {
  if (typeImmunityByAbility[normalizeLookup(ability)] === attackingType) {
    return 0;
  }

  return getDefensiveMultiplier(attackingType, member.types);
}

function buildMoveLookup(team: TeamSlot[], moveSources: TeamMember[]) {
  const moveLookup = new Map<string, PokemonMove>();

  for (const member of [...moveSources, ...team.filter((slot): slot is TeamMember => Boolean(slot))]) {
    for (const move of member.moves ?? []) {
      moveLookup.set(normalizeLookup(move.id), move);
      moveLookup.set(normalizeLookup(move.name), move);
    }
  }

  return moveLookup;
}

function getSelectedMoves(
  team: TeamSlot[],
  buildState: DiagnosticBuildState,
  moveSources: TeamMember[],
) {
  const moveLookup = buildMoveLookup(team, moveSources);

  return team.map((member, slotIndex) => {
    if (!member) {
      return [];
    }

    const configuredMoveIds = buildState.moveIdsBySlot[slotIndex];
    const selectedMoveIds = configuredMoveIds?.length
      ? configuredMoveIds
      : (member.moves ?? []).slice(0, 4).map((move) => move.id);

    return selectedMoveIds
      .map((moveId) => moveLookup.get(normalizeLookup(moveId)))
      .filter((move): move is PokemonMove => Boolean(move));
  });
}

function isDamagingMove(move: PokemonMove) {
  if (move.category) {
    return move.category.toLowerCase() !== "status";
  }

  return move.power !== null;
}

function getMoveCategory(move: PokemonMove) {
  const category = move.category?.toLowerCase();

  if (category === "physical" || category === "special") {
    return category;
  }

  return "status";
}

function classifyTeamRoles(
  team: TeamSlot[],
  buildState: DiagnosticBuildState,
  selectedMovesBySlot: PokemonMove[][],
) {
  const assignments = new Map<TeamRoleId, number[]>(
    roleDefinitions.map(({ id }) => [id, []]),
  );

  team.forEach((member, slotIndex) => {
    if (!member) {
      return;
    }

    const moves = selectedMovesBySlot[slotIndex];
    const physicalMoves = moves.filter(
      (move) => getMoveCategory(move) === "physical",
    ).length;
    const specialMoves = moves.filter(
      (move) => getMoveCategory(move) === "special",
    ).length;
    const statusMoves = moves.filter(
      (move) => getMoveCategory(move) === "status",
    ).length;
    const supportMoves = moves.filter((move) =>
      supportMoveIds.has(normalizeLookup(move.id)),
    ).length;
    const defensiveMoves = moves.filter((move) =>
      defensiveMoveIds.has(normalizeLookup(move.id)),
    ).length;
    const evs = buildState.evsBySlot[slotIndex] ?? defaultEvs;
    const natureId = buildState.natureBySlot[slotIndex] ?? "hardy";
    const nature = getNatureById(natureId);
    const boostedStat = nature.up === nature.down ? null : nature.up;
    const selectedAbility =
      buildState.abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? "";
    const hasSupportAbility = supportAbilityIds.has(normalizeLookup(selectedAbility));
    const stats = member.baseStats
      ? calculateChampionsStats(member.baseStats, evs, nature)
      : null;

    if (!stats) {
      if (
        supportMoves >= 2 ||
        (supportMoves >= 1 && statusMoves >= 2) ||
        (supportMoves >= 1 && hasSupportAbility)
      ) {
        assignments.get("supporter")!.push(slotIndex);
      }
      return;
    }

    const hasPhysicalCommitment =
      evs.attack >= 16 ||
      boostedStat === "attack";
    const hasSpecialCommitment =
      evs.specialAttack >= 16 ||
      boostedStat === "specialAttack";

    if (
      physicalMoves >= 2 &&
      hasPhysicalCommitment &&
      (stats.attack >= stats.specialAttack * 1.1 || physicalMoves >= 3)
    ) {
      assignments.get("physical-attacker")!.push(slotIndex);
    }

    if (
      specialMoves >= 2 &&
      hasSpecialCommitment &&
      (stats.specialAttack >= stats.attack * 1.1 || specialMoves >= 3)
    ) {
      assignments.get("special-attacker")!.push(slotIndex);
    }

    const physicalBulk = stats.hp + stats.defense;
    const specialBulk = stats.hp + stats.specialDefense;
    const physicalInvestment = evs.hp + evs.defense;
    const specialInvestment = evs.hp + evs.specialDefense;

    if (
      physicalBulk >= 240 &&
      physicalInvestment >= 48 &&
      evs.defense >= 24 &&
      defensiveMoves >= 2 &&
      (boostedStat === "defense" || stats.defense >= stats.specialDefense * 1.1)
    ) {
      assignments.get("physical-wall")!.push(slotIndex);
    }

    if (
      specialBulk >= 240 &&
      specialInvestment >= 48 &&
      evs.specialDefense >= 24 &&
      defensiveMoves >= 2 &&
      (boostedStat === "specialDefense" ||
        stats.specialDefense >= stats.defense * 1.1)
    ) {
      assignments.get("special-wall")!.push(slotIndex);
    }

    if (
      supportMoves >= 2 ||
      (supportMoves >= 1 && statusMoves >= 2) ||
      (supportMoves >= 1 && hasSupportAbility)
    ) {
      assignments.get("supporter")!.push(slotIndex);
    }
  });

  return roleDefinitions.map(({ id, label, description }) => ({
    id,
    label,
    description,
    slotIndexes: assignments.get(id) ?? [],
  }));
}

function createDefensiveMatchups(
  team: TeamSlot[],
  abilityBySlot: DiagnosticBuildState["abilityBySlot"],
) {
  const members = team.flatMap((member, slotIndex) =>
    member
      ? [
          {
            member,
            ability: abilityBySlot[slotIndex] || member.abilities?.[0] || "",
          },
        ]
      : [],
  );

  return pokemonTypes.map((type) => {
    const multipliers = members.map(({ member, ability }) =>
      getAbilityAwareDefensiveMultiplier(type, member, ability),
    );

    return {
      type,
      weakCount: multipliers.filter((multiplier) => multiplier > 1).length,
      fourTimesWeakCount: multipliers.filter((multiplier) => multiplier >= 4).length,
      resistCount: multipliers.filter(
        (multiplier) => multiplier > 0 && multiplier < 1,
      ).length,
      immuneCount: multipliers.filter((multiplier) => multiplier === 0).length,
    };
  });
}

function createAlerts(
  team: TeamSlot[],
  defensiveMatchups: DefensiveMatchup[],
  roles: TeamRoleSummary[],
) {
  const members = team.filter((slot): slot is TeamMember => Boolean(slot));
  const alerts: TeamDiagnosticAlert[] = [];

  if (members.length === 0) {
    return [
      {
        id: "empty-team",
        tone: "info" as const,
        message: "Choose a Pokemon to begin team analysis.",
      },
    ];
  }

  const threatThreshold = Math.max(2, Math.ceil(members.length / 2));
  const threats = defensiveMatchups
    .filter((matchup) => {
      const switchIns = matchup.resistCount + matchup.immuneCount;
      return matchup.weakCount >= threatThreshold && matchup.weakCount > switchIns;
    })
    .sort((first, second) => {
      const firstScore =
        first.weakCount * 2 +
        first.fourTimesWeakCount * 2 -
        first.resistCount -
        first.immuneCount * 1.5;
      const secondScore =
        second.weakCount * 2 +
        second.fourTimesWeakCount * 2 -
        second.resistCount -
        second.immuneCount * 1.5;

      return secondScore - firstScore;
    })
    .slice(0, 2);

  for (const threat of threats) {
    const switchIns = threat.resistCount + threat.immuneCount;
    const fourTimesText = threat.fourTimesWeakCount
      ? `, including ${threat.fourTimesWeakCount} at 4x`
      : "";
    const switchInText = switchIns
      ? `${switchIns} type-based switch-in${switchIns === 1 ? "" : "s"}`
      : "no type-based switch-in";

    alerts.push({
      id: `threat-${threat.type}`,
      tone: threat.weakCount >= 4 && switchIns === 0 ? "danger" : "warning",
      message: `${formatType(threat.type)} pressures ${threat.weakCount} members${fourTimesText}; ${switchInText}.`,
    });
  }

  const openSlots = team.length - members.length;

  if (openSlots > 0) {
    alerts.push({
      id: "open-slots",
      tone: "info",
      message: `${openSlots} team slot${openSlots === 1 ? " is" : "s are"} still open.`,
    });
  }

  const typeCounts = members
    .flatMap((member) => member.types)
    .reduce(
      (counts, type) => ({ ...counts, [type]: (counts[type] ?? 0) + 1 }),
      {} as Partial<Record<PokemonType, number>>,
    );
  const repeatedType = pokemonTypes
    .map((type) => ({ type, count: typeCounts[type] ?? 0 }))
    .filter(({ count }) => count >= 3)
    .sort((first, second) => second.count - first.count)[0];

  if (repeatedType) {
    alerts.push({
      id: `repeated-${repeatedType.type}`,
      tone: "info",
      message: `${repeatedType.count} members share ${formatType(repeatedType.type)} typing.`,
    });
  }

  const roleCounts = new Map<TeamRoleId, number>(
    roles.map((role) => [role.id, role.slotIndexes.length]),
  );
  const physicalAttackers = roleCounts.get("physical-attacker") ?? 0;
  const specialAttackers = roleCounts.get("special-attacker") ?? 0;
  const isPhysicalAttackerOnly = physicalAttackers >= 2 && specialAttackers === 0;
  const isSpecialAttackerOnly = specialAttackers >= 2 && physicalAttackers === 0;

  if (isPhysicalAttackerOnly || isSpecialAttackerOnly) {
    const category = isPhysicalAttackerOnly ? "physical" : "special";
    const attackerCount = isPhysicalAttackerOnly ? physicalAttackers : specialAttackers;

    alerts.push({
      id: "attacker-role-balance",
      tone: "warning",
      message: `${attackerCount} ${category} attackers, but no ${
        isPhysicalAttackerOnly ? "special" : "physical"
      } attacker.`,
    });
  }

  const physicalWalls = roleCounts.get("physical-wall") ?? 0;
  const specialWalls = roleCounts.get("special-wall") ?? 0;
  const isPhysicalWallOnly = physicalWalls >= 2 && specialWalls === 0;
  const isSpecialWallOnly = specialWalls >= 2 && physicalWalls === 0;

  if (isPhysicalWallOnly || isSpecialWallOnly) {
    const category = isPhysicalWallOnly ? "physical" : "special";
    const wallCount = isPhysicalWallOnly ? physicalWalls : specialWalls;

    alerts.push({
      id: "wall-role-balance",
      tone: "warning",
      message: `${wallCount} ${category} walls, but no ${
        isPhysicalWallOnly ? "special" : "physical"
      } wall.`,
    });
  }

  const tonePriority: Record<TeamDiagnosticAlert["tone"], number> = {
    danger: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return alerts.length > 0
    ? alerts
        .sort((first, second) => tonePriority[first.tone] - tonePriority[second.tone])
        .slice(0, 4)
    : [
        {
          id: "no-alerts",
          tone: "success" as const,
          message: "No immediate type or role-balance alerts.",
        },
      ];
}

export function analyzeTeam(
  team: TeamSlot[],
  buildState: DiagnosticBuildState,
  moveSources: TeamMember[] = [],
): TeamDiagnosticsResult {
  const members = team.filter((slot): slot is TeamMember => Boolean(slot));
  const defensiveMatchups = createDefensiveMatchups(team, buildState.abilityBySlot);
  const selectedMovesBySlot = getSelectedMoves(team, buildState, moveSources);
  const selectedMoves = selectedMovesBySlot.flat();
  const damagingMoves = selectedMoves.filter(isDamagingMove);
  const attackingTypes = pokemonTypes.filter((type) =>
    damagingMoves.some((move) => move.type === type),
  );
  const coveredDefendingTypes = pokemonTypes.filter((defendingType) =>
    attackingTypes.some(
      (attackingType) => getTypeMultiplier(attackingType, defendingType) > 1,
    ),
  );
  const coveredTypeSet = new Set(coveredDefendingTypes);
  const uncoveredDefendingTypes = pokemonTypes.filter(
    (type) => !coveredTypeSet.has(type),
  );
  const roles = classifyTeamRoles(team, buildState, selectedMovesBySlot);

  return {
    filledSlots: members.length,
    defensiveMatchups,
    attackingTypes,
    coveredDefendingTypes,
    uncoveredDefendingTypes,
    roles,
    alerts: createAlerts(team, defensiveMatchups, roles),
  };
}
