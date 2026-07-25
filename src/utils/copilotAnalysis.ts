import { CHAMPIONS_MAX_EV_TOTAL, defaultEvs, getNatureById, statKeys } from "../data/natures";
import type { TeamConceptId } from "../data/teamConcepts";
import {
  conceptCopilotTextKeys,
  getCopilotText,
  roleCopilotTextKeys,
  type CopilotTextKey,
} from "../i18n/copilotText";
import {
  translateGameName,
  translatePokemonName,
  type Locale,
} from "../i18n/gameTranslations";
import { getUiTranslation } from "../i18n/translations";
import { localizeValidityIssue } from "../i18n/validityTranslations";
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
  DefensiveMatchup,
} from "./teamDiagnostics";
import type { TeamConceptSummary } from "./teamConcepts";
import type {
  TeamValidityResult,
  ValidityIssue,
  ValidityStatus,
} from "./teamValidity";
import { hasPokemonCandidateFilters } from "./pokemonCandidateFilters";
import type { BattleFormat } from "../battleFormat/battleFormat";

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
  validityIssues: ValidityIssue[];
};

export type CopilotDiagnosticsSnapshot = {
  filledSlots: number;
  coverageCount: number;
  coverageGaps: PokemonType[];
  defensiveMatchups: DefensiveMatchup[];
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
  battleFormat: BattleFormat;
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
  battleFormat?: BattleFormat;
  teamName: string;
  team: TeamSlot[];
  pokemonIndex?: PokemonIndexEntry[];
  selectedSlot: number;
  buildState: TeamBuildState;
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
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

function formatList(values: string[], locale: Locale) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (locale === "ko") {
    return values.join(", ");
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function text(
  locale: Locale,
  key: CopilotTextKey,
  variables?: Record<string, string | number>,
) {
  return getCopilotText(locale, key, variables);
}

function localizeType(locale: Locale, type: PokemonType) {
  return translateGameName(locale, "types", type, formatLookup(type));
}

function localizeConcept(
  locale: Locale,
  conceptId: TeamConceptId,
  fallback?: string,
) {
  const key = conceptCopilotTextKeys[conceptId];
  return key ? text(locale, key) : (fallback ?? formatLookup(conceptId));
}

function describeCandidateFilter(
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
  battleFormat = "doubles",
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
        validityIssues: slotValidity?.issues.map((issue) => ({ ...issue })) ?? [],
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
    battleFormat,
    teamName: teamName.trim() || "Untitled Team",
    selectedSlot,
    sets,
    candidateFilters,
    diagnostics: {
      filledSlots: diagnostics.filledSlots,
      coverageCount: diagnostics.coveredDefendingTypes.length,
      coverageGaps: diagnostics.uncoveredDefendingTypes,
      defensiveMatchups: diagnostics.defensiveMatchups,
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
    battleFormat: request.battleFormat,
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
  locale: Locale,
) {
  const completeConcepts = concepts.filter(
    (concept) => concept.status === "complete",
  );

  if (completeConcepts.length > 1) {
    return text(locale, "playstyle.hybrid");
  }

  if (completeConcepts.length === 1) {
    return localizeConcept(
      locale,
      completeConcepts[0].id,
      completeConcepts[0].label,
    );
  }

  const attackers =
    roleCounts["physical-attacker"] + roleCounts["special-attacker"];
  const walls = roleCounts["physical-wall"] + roleCounts["special-wall"];
  const supporters = roleCounts.supporter;

  if (attackers >= 4 && walls <= 1) {
    return text(locale, "playstyle.offensive");
  }

  if (walls >= 3) {
    return text(locale, "playstyle.defensive");
  }

  if (supporters >= 2 && attackers <= 2) {
    return text(locale, "playstyle.support");
  }

  return text(locale, "playstyle.balanced");
}

function localizeValidityMessage(issue: ValidityIssue, locale: Locale) {
  return localizeValidityIssue(issue, {
    t: (key, variables) => getUiTranslation(locale, key, variables),
    gameName: (category, id, fallback) =>
      translateGameName(locale, category, id, fallback),
    pokemonName: (options) => translatePokemonName(locale, options),
  });
}

function getDiagnosticAlertMessage(
  request: CopilotAnalysisRequest,
  alert: TeamDiagnosticAlert,
  locale: Locale,
) {
  if (alert.id.startsWith("threat-")) {
    const type = alert.id.replace("threat-", "") as PokemonType;
    const matchup = request.diagnostics.defensiveMatchups.find(
      (entry) => entry.type === type,
    );

    if (matchup) {
      const switchInCount = matchup.resistCount + matchup.immuneCount;
      const switchIns = switchInCount
        ? text(locale, "alert.switchIns", {
            count: switchInCount,
            switchInNoun: switchInCount === 1 ? "switch-in" : "switch-ins",
          })
        : text(locale, "alert.noSwitchIn");

      return text(
        locale,
        matchup.fourTimesWeakCount > 0
          ? "alert.threatFourTimes"
          : "alert.threat",
        {
          type: localizeType(locale, type),
          weak: matchup.weakCount,
          fourTimes: matchup.fourTimesWeakCount,
          switchIns,
        },
      );
    }
  }

  const conceptMatch = /^concept-(.+)-(beneficiary-only|no-fallback)$/.exec(
    alert.id,
  );

  if (conceptMatch) {
    const conceptId = conceptMatch[1] as TeamConceptId;
    const concept = request.diagnostics.concepts.find(
      (entry) => entry.id === conceptId,
    );
    return text(
      locale,
      conceptMatch[2] === "beneficiary-only"
        ? "alert.conceptDependency"
        : "alert.conceptNoFallback",
      { concept: localizeConcept(locale, conceptId, concept?.label) },
    );
  }

  if (alert.id === "open-slots") {
    const openSlots = Math.max(0, 6 - request.diagnostics.filledSlots);
    return text(locale, "alert.openSlots", {
      count: openSlots,
      slotNoun: openSlots === 1 ? "slot" : "slots",
      verb: openSlots === 1 ? "is" : "are",
    });
  }

  if (alert.id.startsWith("repeated-")) {
    const type = alert.id.replace("repeated-", "") as PokemonType;
    return text(locale, "alert.repeatedType", {
      count: request.sets.filter((set) => set.types.includes(type)).length,
      type: localizeType(locale, type),
    });
  }

  if (alert.id === "attacker-role-balance") {
    const physical = request.diagnostics.roleCounts["physical-attacker"];
    const special = request.diagnostics.roleCounts["special-attacker"];
    const physicalOnly = physical >= 2 && special === 0;
    return text(locale, "alert.attackerBalance", {
      count: physicalOnly ? physical : special,
      category: getUiTranslation(
        locale,
        physicalOnly ? "move.categoryPhysical" : "move.categorySpecial",
      ),
      opposite: getUiTranslation(
        locale,
        physicalOnly ? "move.categorySpecial" : "move.categoryPhysical",
      ),
    });
  }

  if (alert.id === "wall-role-balance") {
    const physical = request.diagnostics.roleCounts["physical-wall"];
    const special = request.diagnostics.roleCounts["special-wall"];
    const physicalOnly = physical >= 2 && special === 0;
    return text(locale, "alert.wallBalance", {
      count: physicalOnly ? physical : special,
      category: getUiTranslation(
        locale,
        physicalOnly ? "move.categoryPhysical" : "move.categorySpecial",
      ),
      opposite: getUiTranslation(
        locale,
        physicalOnly ? "move.categorySpecial" : "move.categoryPhysical",
      ),
    });
  }

  if (alert.id === "no-alerts") {
    return text(locale, "alert.noAlerts");
  }

  return alert.message;
}

function createTeamRecommendations(
  request: CopilotAnalysisRequest,
  locale: Locale,
) {
  const recommendations: CopilotRecommendation[] = [];
  const { diagnostics } = request;

  if (diagnostics.validity.status === "invalid") {
    recommendations.push({
      id: "resolve-validity",
      title: text(locale, "recommend.resolveValidityTitle"),
      reason: text(locale, "recommend.resolveValidityReason", {
        count: diagnostics.validity.errorCount,
        choiceNoun:
          diagnostics.validity.errorCount === 1 ? "choice" : "choices",
        verb: diagnostics.validity.errorCount === 1 ? "fails" : "fail",
      }),
      priority: "high",
    });
  }

  if (request.candidateFilters.length > 0) {
    recommendations.push({
      id: "candidate-filters",
      title: text(locale, "recommend.fillRequirementsTitle"),
      reason: text(locale, "recommend.fillRequirementsReason", {
        slots: formatList(
          request.candidateFilters.map((filter) => String(filter.slotIndex + 1)),
          locale,
        ),
      }),
      priority: "medium",
    });
  }

  for (const concept of diagnostics.concepts) {
    if (recommendations.length >= 3) {
      break;
    }

    if (concept.status === "beneficiary-only") {
      const conceptName = localizeConcept(locale, concept.id, concept.label);
      recommendations.push({
        id: `concept-${concept.id}-setter`,
        title: text(locale, "recommend.addSetupTitle", {
          concept: conceptName,
        }),
        reason: text(locale, "recommend.addSetupReason", {
          concept: conceptName,
        }),
        priority: "high",
      });
    } else if (
      concept.dependentAceSlots.length > 0 &&
      !concept.hasIndependentAttacker
    ) {
      recommendations.push({
        id: `concept-${concept.id}-fallback`,
        title: text(locale, "recommend.addOffModeTitle"),
        reason: text(locale, "recommend.addOffModeReason", {
          concept: localizeConcept(locale, concept.id, concept.label),
        }),
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
      const type = alert.id.replace("threat-", "") as PokemonType;
      recommendations.push({
        id: `answer-${alert.id}`,
        title: text(locale, "recommend.addAnswerTitle", {
          type: localizeType(locale, type),
        }),
        reason: getDiagnosticAlertMessage(request, alert, locale),
        priority: alert.tone === "danger" ? "high" : "medium",
      });
    } else if (alert.id === "attacker-role-balance") {
      recommendations.push({
        id: "balance-damage",
        title: text(locale, "recommend.diversifyDamageTitle"),
        reason: `${getDiagnosticAlertMessage(request, alert, locale)} ${text(
          locale,
          "recommend.diversifyDamageSuffix",
        )}`,
        priority: "medium",
      });
    } else if (alert.id === "wall-role-balance") {
      recommendations.push({
        id: "balance-bulk",
        title: text(locale, "recommend.balanceDefenseTitle"),
        reason: getDiagnosticAlertMessage(request, alert, locale),
        priority: "medium",
      });
    } else if (alert.id === "open-slots") {
      recommendations.push({
        id: "fill-team",
        title: text(locale, "recommend.completeTeamTitle"),
        reason: getDiagnosticAlertMessage(request, alert, locale),
        priority: "medium",
      });
    } else if (alert.id.startsWith("repeated-")) {
      recommendations.push({
        id: "review-overlap",
        title: text(locale, "recommend.reviewTypingTitle"),
        reason: getDiagnosticAlertMessage(request, alert, locale),
        priority: "low",
      });
    }
  }

  if (recommendations.length < 3 && diagnostics.coverageGaps.length > 0) {
    const gaps = diagnostics.coverageGaps
      .slice(0, 4)
      .map((type) => localizeType(locale, type));
    recommendations.push({
      id: "coverage-gaps",
      title: text(locale, "recommend.coverageTitle"),
      reason: text(locale, "recommend.coverageReason", {
        types: formatList(gaps, locale),
      }),
      priority: diagnostics.coverageGaps.length >= 5 ? "medium" : "low",
    });
  }

  return recommendations.length > 0
    ? recommendations.slice(0, 3)
    : [
        {
          id: "preserve-structure",
          title: text(locale, "recommend.preserveTitle"),
          reason: text(locale, "recommend.preserveReason"),
          priority: "low" as const,
        },
      ];
}

function analyzeTeamRequest(
  request: CopilotAnalysisRequest,
  locale: Locale,
): CopilotAnalysisResponse {
  const { diagnostics } = request;
  const teamTitle =
    request.teamName === "Untitled Team"
      ? getUiTranslation(locale, "share.untitledTeam")
      : request.teamName;
  const playstyle = inferPlaystyle(
    diagnostics.roleCounts,
    diagnostics.concepts,
    locale,
  );

  if (diagnostics.filledSlots === 0) {
    const filterCount = request.candidateFilters.length;

    return {
      version: 1,
      source: "local",
      scope: "team",
      title: teamTitle,
      summary: filterCount
        ? text(locale, "team.emptyWithFilters", {
            count: filterCount,
            slotNoun: filterCount === 1 ? "slot" : "slots",
            verb: filterCount === 1 ? "has" : "have",
          })
        : text(locale, "team.empty"),
      playstyle: text(locale, "playstyle.unclassified"),
      strengths: [],
      weaknesses: [text(locale, "team.noActivePokemon")],
      recommendations: [
        {
          id: "add-first-pokemon",
          title: text(locale, "team.buildFirstCore"),
          reason: filterCount
            ? text(locale, "team.chooseRequirements")
            : text(locale, "team.addPokemon"),
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
      text(locale, "team.conceptStrength", {
        concept: localizeConcept(
          locale,
          completeConcept.id,
          completeConcept.label,
        ),
        setters: completeConcept.setterSlots.length,
        aces: completeConcept.aceSlots.length,
        setterNoun:
          completeConcept.setterSlots.length === 1 ? "setter" : "setters",
        aceNoun:
          completeConcept.aceSlots.length === 1
            ? "ace candidate"
            : "ace candidates",
      }),
    );
  }
  if (diagnostics.coverageCount >= 14) {
    strengths.push(
      text(locale, "team.coverageStrength", {
        count: diagnostics.coverageCount,
      }),
    );
  }
  if (diagnostics.roleCounts.supporter > 0) {
    strengths.push(
      text(locale, "team.supportStrength", {
        count: diagnostics.roleCounts.supporter,
        setNoun: diagnostics.roleCounts.supporter === 1 ? "set" : "sets",
        verb: diagnostics.roleCounts.supporter === 1 ? "provides" : "provide",
      }),
    );
  }
  if (diagnostics.validity.status === "valid") {
    strengths.push(text(locale, "team.validityStrength"));
  }

  const weaknesses = diagnostics.alerts
    .filter((alert) => alert.tone === "danger" || alert.tone === "warning")
    .slice(0, 3)
    .map((alert) => getDiagnosticAlertMessage(request, alert, locale));

  const primaryConcern = weaknesses[0]
    ? text(locale, "team.priorityConcern", { concern: weaknesses[0] })
    : text(locale, "team.noPriorityConcern");

  return {
    version: 1,
    source: "local",
    scope: "team",
    title: teamTitle,
    summary: text(locale, "team.summary", {
      filled: diagnostics.filledSlots,
      article: /^[aeiou]/i.test(playstyle) ? "an" : "a",
      playstyle: locale === "en" ? playstyle.toLowerCase() : playstyle,
      coverage: diagnostics.coverageCount,
      concern: primaryConcern,
    }),
    playstyle,
    strengths: strengths.slice(0, 3),
    weaknesses,
    recommendations: createTeamRecommendations(request, locale),
  };
}

function analyzePokemonRequest(
  request: CopilotAnalysisRequest,
  locale: Locale,
): CopilotAnalysisResponse {
  const selectedSet = request.sets.find(
    (set) => set.slotIndex === request.selectedSlot,
  );
  const selectedCandidateFilter = request.candidateFilters.find(
    (filters) => filters.slotIndex === request.selectedSlot,
  );

  if (!selectedSet) {
    const filterDescription = selectedCandidateFilter
      ? describeCandidateFilter(selectedCandidateFilter, locale)
      : "";

    return {
      version: 1,
      source: "local",
      scope: "pokemon",
      title: text(locale, "pokemon.slotTitle", {
        slot: request.selectedSlot + 1,
      }),
      summary: selectedCandidateFilter
        ? text(locale, "pokemon.slotReserved", {
            requirements: filterDescription,
          })
        : text(locale, "pokemon.slotEmpty"),
      playstyle: text(locale, "playstyle.unclassified"),
      strengths: [],
      weaknesses: [
        selectedCandidateFilter
          ? text(locale, "pokemon.noRequirementMatch")
          : text(locale, "pokemon.notConfigured"),
      ],
      recommendations: [
        {
          id: "choose-pokemon",
          title: selectedCandidateFilter
            ? text(locale, "pokemon.chooseMatching")
            : text(locale, "pokemon.choose"),
          reason: selectedCandidateFilter
            ? text(locale, "pokemon.compareRequirements", {
                requirements: filterDescription,
              })
            : text(locale, "pokemon.analysisStarts"),
          priority: "high",
        },
      ],
    };
  }

  const roleNames = selectedSet.roleIds.map((roleId) =>
    text(locale, roleCopilotTextKeys[roleId]),
  );
  const moveTypes = [...new Set(selectedSet.moves.map((move) => move.type))];
  const strengths: string[] = [];

  if (selectedSet.setterConceptIds.length > 0) {
    strengths.push(
      text(locale, "pokemon.setterStrength", {
        concepts: formatList(
          selectedSet.setterConceptIds.map((conceptId) =>
            localizeConcept(locale, conceptId),
          ),
          locale,
        ),
      }),
    );
  }
  if (roleNames.length > 0) {
    strengths.push(
      text(locale, "pokemon.roleStrength", {
        roles: formatList(roleNames, locale),
      }),
    );
  }
  if (moveTypes.length >= 3) {
    strengths.push(
      text(locale, "pokemon.moveTypesStrength", { count: moveTypes.length }),
    );
  }
  if (selectedSet.evTotal === CHAMPIONS_MAX_EV_TOTAL) {
    strengths.push(
      text(locale, "pokemon.evStrength", { count: CHAMPIONS_MAX_EV_TOTAL }),
    );
  }
  if (selectedSet.validityStatus === "valid") {
    strengths.push(text(locale, "pokemon.validityStrength"));
  }

  const weaknesses = selectedSet.validityIssues.map((issue) =>
    localizeValidityMessage(issue, locale),
  );
  if (roleNames.length === 0) {
    weaknesses.push(text(locale, "pokemon.noClearRole"));
  }
  if (selectedSet.moves.length === 0) {
    weaknesses.push(text(locale, "pokemon.noMoves"));
  }

  const recommendations: CopilotRecommendation[] = [];
  if (selectedSet.validityIssues.length > 0) {
    recommendations.push({
      id: "fix-selected-validity",
      title: text(locale, "pokemon.fixSetTitle"),
      reason: localizeValidityMessage(selectedSet.validityIssues[0], locale),
      priority: "high",
    });
  }
  if (roleNames.length === 0) {
    recommendations.push({
      id: "clarify-selected-role",
      title: text(locale, "pokemon.clarifyRoleTitle"),
      reason: text(locale, "pokemon.clarifyRoleReason"),
      priority: "medium",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "check-team-fit",
      title: text(locale, "pokemon.checkFitTitle"),
      reason: text(locale, "pokemon.checkFitReason"),
      priority: "low",
    });
  }

  const roleSummary = roleNames.length > 0
    ? locale === "en"
      ? formatList(roleNames, locale).toLowerCase()
      : formatList(roleNames, locale)
    : text(locale, "pokemon.flexibleSet");
  const localizedNature = translateGameName(
    locale,
    "natures",
    selectedSet.nature,
    selectedSet.nature,
  );
  const abilitySummary = selectedSet.ability
    ? text(locale, "pokemon.abilityNature", {
        ability: translateGameName(
          locale,
          "abilities",
          selectedSet.ability,
          selectedSet.ability,
        ),
        nature: localizedNature,
      })
    : text(locale, "pokemon.natureOnly", { nature: localizedNature });
  const localizedPokemonName = translatePokemonName(locale, {
    id: selectedSet.pokemonId,
    fallback: selectedSet.pokemonName,
    includeForm: false,
  });

  return {
    version: 1,
    source: "local",
    scope: "pokemon",
    title: localizedPokemonName,
    summary: text(locale, "pokemon.summary", {
      pokemon: localizedPokemonName,
      role: roleSummary,
      abilityNature: abilitySummary,
      moves: selectedSet.moves.length,
      moveNoun: selectedSet.moves.length === 1 ? "move" : "moves",
    }),
    playstyle: roleNames[0] ?? text(locale, "playstyle.flexible"),
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

export function createLocalCopilotAnalysis(
  request: CopilotAnalysisRequest,
  locale: Locale = "en",
): CopilotAnalysisResponse {
  return request.scope === "team"
    ? analyzeTeamRequest(request, locale)
    : analyzePokemonRequest(request, locale);
}
