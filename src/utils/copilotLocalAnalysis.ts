import {
  CHAMPIONS_MAX_EV_TOTAL,
  statKeys,
  statLabels,
} from "../data/natures";
import type { TeamConceptId } from "../data/teamConcepts";
import { roleCopilotTextKeys } from "../i18n/copilotText";
import {
  translateGameName,
  translatePokemonName,
  type Locale,
} from "../i18n/gameTranslations";
import { getUiTranslation } from "../i18n/translations";
import { localizeValidityIssue } from "../i18n/validityTranslations";
import type { PokemonType, StatBlock } from "../types";
import type {
  TeamDiagnosticAlert,
  TeamRoleId,
} from "./teamDiagnostics";
import type { TeamConceptSummary } from "./teamConcepts";
import type { ValidityIssue } from "./teamValidity";
import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
  CopilotRecommendation,
  CopilotSetOptimizationCandidateSnapshot,
} from "./copilotContracts";
import {
  describeCandidateFilter,
  formatList,
  localizeConcept,
  localizeType,
  text,
} from "./copilotRequestBuilder";

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

function analyzeRecommendationRequest(
  request: CopilotAnalysisRequest,
  locale: Locale,
): CopilotAnalysisResponse {
  const candidates = request.recommendationCandidates.slice(0, 5);
  const isKorean = locale === "ko";

  if (request.sets.some((set) => set.slotIndex === request.selectedSlot)) {
    return {
      version: 1,
      source: "local",
      scope: "recommendation",
      title: isKorean ? "빈 슬롯 선택 필요" : "Choose an empty slot",
      summary: isKorean
        ? "포켓몬 추천은 현재 선택한 빈 슬롯의 필터와 팀 구성을 기준으로 작동함"
        : "Pokemon recommendations use the selected empty slot, its filters, and the current team.",
      playstyle: isKorean ? "추천 준비" : "Recommendation setup",
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
  }

  return {
    version: 1,
    source: "local",
    scope: "recommendation",
    title: isKorean ? "추천 후보" : "Recommended candidates",
    summary:
      candidates.length > 0
        ? isKorean
          ? "M-B 적법성, 선택 필터, 사용률과 현재 팀의 타입 구조를 반영한 후보"
          : "Candidates filtered by M-B legality, slot requirements, usage, and the current team's type profile."
        : isKorean
          ? "현재 조건을 모두 만족하는 후보 없음"
          : "No candidate satisfies every current requirement.",
    playstyle: isKorean ? "후보 비교" : "Candidate comparison",
    strengths: [],
    weaknesses: [],
    recommendations: candidates.map((candidate, index) => ({
      id: candidate.pokemonId,
      title: candidate.displayName,
      reason: isKorean
        ? index === 0
          ? "현재 조건에서 가장 높은 우선순위의 합법 후보"
          : "현재 필터와 팀 구조를 만족하는 합법 후보"
        : index === 0
          ? "The highest-priority legal candidate under the current requirements."
          : "A legal candidate that fits the current filters and team structure.",
      priority: index === 0 ? "high" : "medium",
    })),
  };
}

function formatOptimizationSpread(evs: StatBlock) {
  return statKeys
    .filter((stat) => evs[stat] > 0)
    .map((stat) => `${statLabels[stat]} ${evs[stat]}`)
    .join(" / ");
}

function formatLocalOptimizationReason(
  candidate: CopilotSetOptimizationCandidateSnapshot,
) {
  const offense = candidate.offenseBenchmarks[0];
  const defense = candidate.defenseBenchmarks[0];
  const parts = [formatOptimizationSpread(candidate.evs)];

  if (offense) {
    parts.push(
      `${offense.moveDisplayName} ${offense.optimized.minPercent.toFixed(1)}-${offense.optimized.maxPercent.toFixed(1)}%`,
    );
  }
  if (defense) {
    parts.push(
      `${defense.moveDisplayName} ${defense.optimized.minPercent.toFixed(1)}-${defense.optimized.maxPercent.toFixed(1)}%`,
    );
  }
  parts.push(
    `Spe ${candidate.speedBenchmark.current.playerSpeed}->${candidate.speedBenchmark.optimized.playerSpeed}`,
  );

  return parts.join(" · ");
}

function analyzeOptimizationRequest(
  request: CopilotAnalysisRequest,
  locale: Locale,
): CopilotAnalysisResponse {
  const optimization = request.optimization;
  const isKorean = locale === "ko";

  if (!optimization) {
    return {
      version: 1,
      source: "local",
      scope: "optimization",
      title: isKorean ? "계산기 설정 필요" : "Calculator setup required",
      summary: isKorean
        ? "계산기에서 내 포켓몬, 상대 포켓몬과 공격 방향을 먼저 설정해야 함"
        : "Choose both Pokemon and the attack direction in the calculator first.",
      playstyle: isKorean ? "정확한 대상 최적화" : "Exact-target optimization",
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
  }

  const candidates = optimization.candidates.slice(0, 3);
  const playstyleLabel = isKorean
    ? "공격·내구·스피드 통합 조정"
    : "Combined offense, bulk, and Speed tuning";

  return {
    version: 1,
    source: "local",
    scope: "optimization",
    title: `${optimization.playerDisplayName} vs. ${optimization.opponentDisplayName}`,
    summary: isKorean
      ? `계산기에 설정된 조건을 그대로 사용해 ${optimization.playerDisplayName}의 성격과 노력치 후보를 검증함`
      : `Verified nature and Stat Point options for ${optimization.playerDisplayName} under the exact calculator conditions.`,
    playstyle: playstyleLabel,
    strengths: [
      isKorean
        ? "표시된 대미지 수치는 계산기 엔진으로 재검증됨"
        : "Every displayed damage result is rechecked by the calculator engine.",
    ],
    weaknesses: [
      isKorean
        ? "현재 도구와 계산기 조건은 고정되며 다른 매치업까지 보장하지 않음"
        : "The current item and calculator conditions stay fixed; other matchups are not guaranteed.",
    ],
    recommendations: candidates.map((candidate, index) => ({
      id: candidate.id,
      title: isKorean
        ? `${candidate.natureDisplayName} 샘플`
        : `${candidate.natureDisplayName} sample`,
      reason: formatLocalOptimizationReason(candidate),
      priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    })),
  };
}

export function createLocalCopilotAnalysis(
  request: CopilotAnalysisRequest,
  locale: Locale = "en",
): CopilotAnalysisResponse {
  if (request.scope === "team") {
    return analyzeTeamRequest(request, locale);
  }

  if (request.scope === "pokemon") {
    return analyzePokemonRequest(request, locale);
  }

  return request.scope === "recommendation"
    ? analyzeRecommendationRequest(request, locale)
    : analyzeOptimizationRequest(request, locale);
}
