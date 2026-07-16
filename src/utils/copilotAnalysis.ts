import { CHAMPIONS_MAX_EV_TOTAL, defaultEvs, getNatureById, statKeys } from "../data/natures";
import type { TeamConceptId } from "../data/teamConcepts";
import type { TeamBuildState } from "./teamBuildState";
import type {
  PokemonCandidateFilterValue,
  PokemonIndexEntry,
  PokemonMove,
  PokemonType,
  StatBlock,
  TeamSlot,
} from "../types";
import type {
  TeamDiagnosticAlert,
  TeamDiagnosticsResult,
  TeamRoleId,
} from "./teamDiagnostics";
import type { TeamConceptSummary } from "./teamConcepts";
import type { TeamValidityResult, ValidityStatus } from "./teamValidity";
import { hasPokemonCandidateFilters } from "./pokemonCandidateFilters";

export type CopilotAnalysisScope = "team" | "pokemon";
export type CopilotPriority = "high" | "medium" | "low";

export type CopilotMoveSnapshot = Pick<
  PokemonMove,
  "id" | "name" | "type" | "category" | "power"
>;

export type CopilotSetSnapshot = {
  slotIndex: number;
  pokemonId: string;
  pokemonName: string;
  types: PokemonType[];
  item: string | null;
  ability: string | null;
  nature: string;
  evs: StatBlock;
  evTotal: number;
  moves: CopilotMoveSnapshot[];
  roleIds: TeamRoleId[];
  setterConceptIds: TeamConceptId[];
  aceConceptIds: TeamConceptId[];
  validityStatus: ValidityStatus;
  validityIssues: string[];
};

export type CopilotDiagnosticsSnapshot = {
  filledSlots: number;
  coverageCount: number;
  coverageGaps: PokemonType[];
  alerts: TeamDiagnosticAlert[];
  roleCounts: Record<TeamRoleId, number>;
  concepts: TeamConceptSummary[];
  validity: Pick<
    TeamValidityResult,
    "status" | "errorCount" | "unavailableCount"
  >;
};

export type CopilotCandidateFilterSnapshot = {
  slotIndex: number;
  types: PokemonType[];
  ability: PokemonCandidateFilterValue | null;
  moves: PokemonCandidateFilterValue[];
};

export type CopilotAnalysisRequest = {
  version: 1;
  scope: CopilotAnalysisScope;
  teamName: string;
  selectedSlot: number;
  sets: CopilotSetSnapshot[];
  candidateFilters: CopilotCandidateFilterSnapshot[];
  diagnostics: CopilotDiagnosticsSnapshot;
};

export type CopilotRecommendation = {
  id: string;
  title: string;
  reason: string;
  priority: CopilotPriority;
};

export type CopilotAnalysisResponse = {
  version: 1;
  source: "local";
  scope: CopilotAnalysisScope;
  title: string;
  summary: string;
  playstyle: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: CopilotRecommendation[];
};

type CreateCopilotRequestInput = {
  scope: CopilotAnalysisScope;
  teamName: string;
  team: TeamSlot[];
  pokemonIndex?: PokemonIndexEntry[];
  selectedSlot: number;
  buildState: TeamBuildState;
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
};

const roleLabels: Record<TeamRoleId, string> = {
  "physical-attacker": "Physical Attacker",
  "special-attacker": "Special Attacker",
  "physical-wall": "Physical Wall",
  "special-wall": "Special Wall",
  supporter: "Supporter",
  setter: "Setter",
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatLookup(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function describeCandidateFilter(filter: CopilotCandidateFilterSnapshot) {
  return formatList([
    ...filter.types.map((type) => `${formatLookup(type)} type`),
    ...(filter.ability ? [`${filter.ability.name} ability`] : []),
    ...filter.moves.map((move) => `${move.name} access`),
  ]);
}

function getSelectedMoves(
  memberMoves: PokemonMove[] | undefined,
  configuredMoveIds: string[] | undefined,
) {
  const moveLookup = new Map<string, PokemonMove>();

  for (const move of memberMoves ?? []) {
    moveLookup.set(normalizeLookup(move.id), move);
    moveLookup.set(normalizeLookup(move.name), move);
  }

  const moveIds = configuredMoveIds?.length
    ? configuredMoveIds
    : (memberMoves ?? []).slice(0, 4).map((move) => move.id);

  return moveIds.flatMap((moveId) => {
    if (!moveId) {
      return [];
    }

    const move = moveLookup.get(normalizeLookup(moveId));

    return [
      move
        ? {
            id: move.id,
            name: move.name,
            type: move.type,
            category: move.category,
            power: move.power,
          }
        : {
            id: moveId,
            name: formatLookup(moveId),
            type: "normal" as const,
            power: null,
          },
    ];
  });
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

export function createCopilotAnalysisRequest({
  scope,
  teamName,
  team,
  pokemonIndex = [],
  selectedSlot,
  buildState,
  diagnostics,
  validity,
}: CreateCopilotRequestInput): CopilotAnalysisRequest {
  const sets = team.flatMap((member, slotIndex) => {
    if (!member) {
      return [];
    }

    const evs = buildState.evsBySlot[slotIndex] ?? defaultEvs;
    const slotValidity = validity.slotResults[slotIndex];
    const displayName =
      pokemonIndex.find((entry) => entry.name === member.id)?.displayName ??
      member.name;

    return [
      {
        slotIndex,
        pokemonId: member.id,
        pokemonName: displayName,
        types: member.types,
        item: buildState.itemBySlot[slotIndex]?.name ?? null,
        ability: buildState.abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? null,
        nature: getNatureById(buildState.natureBySlot[slotIndex] ?? "hardy").label,
        evs,
        evTotal: statKeys.reduce((total, stat) => total + evs[stat], 0),
        moves: getSelectedMoves(member.moves, buildState.moveIdsBySlot[slotIndex]),
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
        validityIssues: slotValidity?.issues.map((issue) => issue.message) ?? [],
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

  return {
    version: 1,
    scope,
    teamName: teamName.trim() || "Untitled Team",
    selectedSlot,
    sets,
    candidateFilters,
    diagnostics: {
      filledSlots: diagnostics.filledSlots,
      coverageCount: diagnostics.coveredDefendingTypes.length,
      coverageGaps: diagnostics.uncoveredDefendingTypes,
      alerts: diagnostics.alerts,
      roleCounts: createRoleCounts(diagnostics),
      concepts: diagnostics.concepts,
      validity: {
        status: validity.status,
        errorCount: validity.errorCount,
        unavailableCount: validity.unavailableCount,
      },
    },
  };
}

export function getCopilotRequestFingerprint(request: CopilotAnalysisRequest) {
  if (request.scope === "team") {
    return JSON.stringify({ ...request, selectedSlot: -1 });
  }

  return JSON.stringify({
    version: request.version,
    scope: request.scope,
    selectedSlot: request.selectedSlot,
    selectedSet: request.sets.find((set) => set.slotIndex === request.selectedSlot),
    selectedCandidateFilters: request.candidateFilters.find(
      (filters) => filters.slotIndex === request.selectedSlot,
    ),
  });
}

function inferPlaystyle(
  roleCounts: Record<TeamRoleId, number>,
  concepts: TeamConceptSummary[],
) {
  const completeConcepts = concepts.filter(
    (concept) => concept.status === "complete",
  );

  if (completeConcepts.length > 1) {
    return "Hybrid";
  }

  if (completeConcepts.length === 1) {
    return completeConcepts[0].label;
  }

  const attackers =
    roleCounts["physical-attacker"] + roleCounts["special-attacker"];
  const walls = roleCounts["physical-wall"] + roleCounts["special-wall"];
  const supporters = roleCounts.supporter;

  if (attackers >= 4 && walls <= 1) {
    return "Offensive";
  }

  if (walls >= 3) {
    return "Defensive";
  }

  if (supporters >= 2 && attackers <= 2) {
    return "Support-oriented";
  }

  return "Balanced";
}

function createTeamRecommendations(request: CopilotAnalysisRequest) {
  const recommendations: CopilotRecommendation[] = [];
  const { diagnostics } = request;

  if (diagnostics.validity.status === "invalid") {
    recommendations.push({
      id: "resolve-validity",
      title: "Resolve validity issues",
      reason: `${diagnostics.validity.errorCount} configured choice${
        diagnostics.validity.errorCount === 1 ? "" : "s"
      } currently fail Regulation M-B checks.`,
      priority: "high",
    });
  }

  if (request.candidateFilters.length > 0) {
    recommendations.push({
      id: "candidate-filters",
      title: "Fill the constrained slots",
      reason: `Slots ${formatList(
        request.candidateFilters.map((filter) => String(filter.slotIndex + 1)),
      )} have saved Pokemon requirements to satisfy.`,
      priority: "medium",
    });
  }

  for (const concept of diagnostics.concepts) {
    if (recommendations.length >= 3) {
      break;
    }

    if (concept.status === "beneficiary-only") {
      recommendations.push({
        id: `concept-${concept.id}-setter`,
        title: `Add reliable ${concept.label} setup`,
        reason: `A ${concept.label} dependent attacker is present without a setter on the active team.`,
        priority: "high",
      });
    } else if (
      concept.dependentAceSlots.length > 0 &&
      !concept.hasIndependentAttacker
    ) {
      recommendations.push({
        id: `concept-${concept.id}-fallback`,
        title: "Add an off-mode attacker",
        reason: `The ${concept.label} core lacks an independently classified attacker when its setup is denied.`,
        priority: "medium",
      });
    }
  }

  for (const alert of diagnostics.alerts) {
    if (
      recommendations.length >= 3 ||
      alert.tone === "success" ||
      alert.id.startsWith("concept-")
    ) {
      continue;
    }

    if (alert.id.startsWith("threat-")) {
      recommendations.push({
        id: `answer-${alert.id}`,
        title: `Add a ${formatLookup(alert.id.replace("threat-", ""))} answer`,
        reason: alert.message,
        priority: alert.tone === "danger" ? "high" : "medium",
      });
    } else if (alert.id === "attacker-role-balance") {
      recommendations.push({
        id: "balance-damage",
        title: "Diversify damage pressure",
        reason: `${alert.message} A mixed damage profile is harder to wall.`,
        priority: "medium",
      });
    } else if (alert.id === "wall-role-balance") {
      recommendations.push({
        id: "balance-bulk",
        title: "Balance defensive answers",
        reason: alert.message,
        priority: "medium",
      });
    } else if (alert.id === "open-slots") {
      recommendations.push({
        id: "fill-team",
        title: "Complete the active six",
        reason: alert.message,
        priority: "medium",
      });
    } else if (alert.id.startsWith("repeated-")) {
      recommendations.push({
        id: "review-overlap",
        title: "Review overlapping typing",
        reason: alert.message,
        priority: "low",
      });
    }
  }

  if (recommendations.length < 3 && diagnostics.coverageGaps.length > 0) {
    const gaps = diagnostics.coverageGaps.slice(0, 4).map(formatLookup);
    recommendations.push({
      id: "coverage-gaps",
      title: "Close offensive coverage gaps",
      reason: `${formatList(gaps)} currently lack super-effective move coverage.`,
      priority: diagnostics.coverageGaps.length >= 5 ? "medium" : "low",
    });
  }

  return recommendations.length > 0
    ? recommendations.slice(0, 3)
    : [
        {
          id: "preserve-structure",
          title: "Preserve the current structure",
          reason: "No immediate type, role, or validity issue needs priority attention.",
          priority: "low" as const,
        },
      ];
}

function analyzeTeamRequest(
  request: CopilotAnalysisRequest,
): CopilotAnalysisResponse {
  const { diagnostics } = request;
  const playstyle = inferPlaystyle(diagnostics.roleCounts, diagnostics.concepts);

  if (diagnostics.filledSlots === 0) {
    const filterCount = request.candidateFilters.length;

    return {
      version: 1,
      source: "local",
      scope: "team",
      title: request.teamName,
      summary: filterCount
        ? `The active team is empty, but ${filterCount} slot${
            filterCount === 1 ? " has" : "s have"
          } saved Pokemon requirements.`
        : "The active team is empty, so there is not enough set data to assess yet.",
      playstyle: "Unclassified",
      strengths: [],
      weaknesses: ["No active Pokemon are configured."],
      recommendations: [
        {
          id: "add-first-pokemon",
          title: "Build the first core",
          reason: filterCount
            ? "Choose Pokemon that satisfy the saved slot requirements to establish the first core."
            : "Add a Pokemon to begin type, role, and set analysis.",
          priority: "high",
        },
      ],
    };
  }

  const strengths: string[] = [];
  const completeConcept = diagnostics.concepts.find(
    (concept) => concept.status === "complete",
  );

  if (completeConcept) {
    strengths.push(
      `${completeConcept.label} connects ${completeConcept.setterSlots.length} setter${
        completeConcept.setterSlots.length === 1 ? "" : "s"
      } with ${completeConcept.aceSlots.length} ace candidate${
        completeConcept.aceSlots.length === 1 ? "" : "s"
      }.`,
    );
  }
  if (diagnostics.coverageCount >= 14) {
    strengths.push(
      `Broad offensive coverage reaches ${diagnostics.coverageCount} of 18 single types.`,
    );
  }
  if (diagnostics.roleCounts.supporter > 0) {
    strengths.push(
      `${diagnostics.roleCounts.supporter} set${
        diagnostics.roleCounts.supporter === 1 ? "" : "s"
      } ${diagnostics.roleCounts.supporter === 1 ? "provides" : "provide"} a clear support role.`,
    );
  }
  if (diagnostics.validity.status === "valid") {
    strengths.push("Configured choices pass the current Regulation M-B checks.");
  }

  const weaknesses = diagnostics.alerts
    .filter((alert) => alert.tone === "danger" || alert.tone === "warning")
    .slice(0, 3)
    .map((alert) => alert.message);

  const primaryConcern = weaknesses[0]
    ? ` Priority concern: ${weaknesses[0]}`
    : " No immediate high-priority imbalance is visible.";
  const playstyleArticle = /^[aeiou]/i.test(playstyle) ? "an" : "a";

  return {
    version: 1,
    source: "local",
    scope: "team",
    title: request.teamName,
    summary: `${diagnostics.filledSlots}/6 active sets form ${playstyleArticle} ${playstyle.toLowerCase()} profile with ${diagnostics.coverageCount}/18 single-type offensive coverage.${primaryConcern}`,
    playstyle,
    strengths: strengths.slice(0, 3),
    weaknesses,
    recommendations: createTeamRecommendations(request),
  };
}

function analyzePokemonRequest(
  request: CopilotAnalysisRequest,
): CopilotAnalysisResponse {
  const selectedSet = request.sets.find(
    (set) => set.slotIndex === request.selectedSlot,
  );
  const selectedCandidateFilter = request.candidateFilters.find(
    (filters) => filters.slotIndex === request.selectedSlot,
  );

  if (!selectedSet) {
    const filterDescription = selectedCandidateFilter
      ? describeCandidateFilter(selectedCandidateFilter)
      : "";

    return {
      version: 1,
      source: "local",
      scope: "pokemon",
      title: `Slot ${request.selectedSlot + 1}`,
      summary: selectedCandidateFilter
        ? `This slot is reserved for a Pokemon with ${filterDescription}.`
        : "This slot is empty, so there is no set to assess yet.",
      playstyle: "Unclassified",
      strengths: [],
      weaknesses: [
        selectedCandidateFilter
          ? "No Pokemon has been chosen for the saved candidate requirements yet."
          : "No Pokemon is configured in the selected slot.",
      ],
      recommendations: [
        {
          id: "choose-pokemon",
          title: selectedCandidateFilter ? "Choose a matching Pokemon" : "Choose a Pokemon",
          reason: selectedCandidateFilter
            ? `Use the saved ${filterDescription} requirements when comparing candidates.`
            : "Set analysis begins after a Pokemon is added to this slot.",
          priority: "high",
        },
      ],
    };
  }

  const roleNames = selectedSet.roleIds.map((roleId) => roleLabels[roleId]);
  const moveTypes = [...new Set(selectedSet.moves.map((move) => move.type))];
  const strengths: string[] = [];

  if (selectedSet.setterConceptIds.length > 0) {
    strengths.push(
      `Establishes ${formatList(selectedSet.setterConceptIds.map(formatLookup))} for the team.`,
    );
  }
  if (roleNames.length > 0) {
    strengths.push(`The current investment supports ${formatList(roleNames)}.`);
  }
  if (moveTypes.length >= 3) {
    strengths.push(`${moveTypes.length} move types give the set varied coverage.`);
  }
  if (selectedSet.evTotal === CHAMPIONS_MAX_EV_TOTAL) {
    strengths.push(`All ${CHAMPIONS_MAX_EV_TOTAL} EV points are allocated.`);
  }
  if (selectedSet.validityStatus === "valid") {
    strengths.push("The configured set passes current Regulation M-B checks.");
  }

  const weaknesses = [...selectedSet.validityIssues];
  if (roleNames.length === 0) {
    weaknesses.push(
      "Its current EVs, nature, and moves do not form a clear conservative role classification.",
    );
  }
  if (selectedSet.moves.length === 0) {
    weaknesses.push("No moves are currently configured for set analysis.");
  }

  const recommendations: CopilotRecommendation[] = [];
  if (selectedSet.validityIssues.length > 0) {
    recommendations.push({
      id: "fix-selected-validity",
      title: "Fix the configured set",
      reason: selectedSet.validityIssues[0],
      priority: "high",
    });
  }
  if (roleNames.length === 0) {
    recommendations.push({
      id: "clarify-selected-role",
      title: "Clarify the set's job",
      reason: "Align its EVs, nature, and moves toward one intended team role.",
      priority: "medium",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "check-team-fit",
      title: "Check its team fit",
      reason: "The set is internally coherent; compare its role against the team alerts before changing it.",
      priority: "low",
    });
  }

  const roleSummary = roleNames.length > 0
    ? formatList(roleNames).toLowerCase()
    : "flexible set";
  const abilitySummary = selectedSet.ability
    ? `${selectedSet.ability} and a ${selectedSet.nature} nature`
    : `a ${selectedSet.nature} nature`;

  return {
    version: 1,
    source: "local",
    scope: "pokemon",
    title: selectedSet.pokemonName,
    summary: `${selectedSet.pokemonName} is configured as a ${roleSummary}, using ${abilitySummary}. It carries ${selectedSet.moves.length} selected move${selectedSet.moves.length === 1 ? "" : "s"}.`,
    playstyle: roleNames[0] ?? "Flexible",
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

export function createLocalCopilotAnalysis(
  request: CopilotAnalysisRequest,
): CopilotAnalysisResponse {
  return request.scope === "team"
    ? analyzeTeamRequest(request)
    : analyzePokemonRequest(request);
}
