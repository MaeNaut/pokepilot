import { CHAMPIONS_MAX_EV_TOTAL } from "../data/natures";
import type { TeamConceptId } from "../data/teamConcepts";
import { roleCopilotTextKeys } from "../i18n/copilotText";
import {
  translateGameName,
  translatePokemonName,
  type Locale,
} from "../i18n/gameTranslations";
import { getUiTranslation } from "../i18n/translations";
import { localizeValidityIssue } from "../i18n/validityTranslations";
import type { PokemonType } from "../types";
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

function createNarrativeParagraphs(
  introduction: string,
  supportingPoints: string[] = [],
  concerns: string[] = [],
) {
  return [
    introduction.trim(),
    supportingPoints.map((point) => point.trim()).filter(Boolean).join(" "),
    concerns.map((concern) => concern.trim()).filter(Boolean).join(" "),
  ].filter(Boolean);
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
      version: 2,
      source: "local",
      scope: "team",
      title: teamTitle,
      paragraphs: createNarrativeParagraphs(
        filterCount
          ? text(locale, "team.emptyWithFilters", {
              count: filterCount,
              slotNoun: filterCount === 1 ? "slot" : "slots",
              verb: filterCount === 1 ? "has" : "have",
            })
          : text(locale, "team.empty"),
        [],
        [text(locale, "team.noActivePokemon")],
      ),
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

  return {
    version: 2,
    source: "local",
    scope: "team",
    title: teamTitle,
    paragraphs: createNarrativeParagraphs(
      text(locale, "team.summary", {
        filled: diagnostics.filledSlots,
        article: /^[aeiou]/i.test(playstyle) ? "an" : "a",
        playstyle: locale === "en" ? playstyle.toLowerCase() : playstyle,
        coverage: diagnostics.coverageCount,
      }),
      strengths.slice(0, 3),
      weaknesses,
    ),
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
      version: 2,
      source: "local",
      scope: "pokemon",
      title: text(locale, "pokemon.slotTitle", {
        slot: request.selectedSlot + 1,
      }),
      paragraphs: createNarrativeParagraphs(
        selectedCandidateFilter
          ? text(locale, "pokemon.slotReserved", {
              requirements: filterDescription,
            })
          : text(locale, "pokemon.slotEmpty"),
        [],
        [
          selectedCandidateFilter
            ? text(locale, "pokemon.noRequirementMatch")
            : text(locale, "pokemon.notConfigured"),
        ],
      ),
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
    version: 2,
    source: "local",
    scope: "pokemon",
    title: localizedPokemonName,
    paragraphs: createNarrativeParagraphs(
      text(locale, "pokemon.summary", {
        pokemon: localizedPokemonName,
        role: roleSummary,
        abilityNature: abilitySummary,
        moves: selectedSet.moves.length,
        moveNoun: selectedSet.moves.length === 1 ? "move" : "moves",
      }),
      strengths.slice(0, 3),
      weaknesses.slice(0, 3),
    ),
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
      version: 2,
      source: "local",
      scope: "recommendation",
      title: isKorean ? "빈 슬롯 선택 필요" : "Choose an empty slot",
      paragraphs: [
        isKorean
          ? "포켓몬 추천은 현재 선택한 빈 슬롯의 필터와 팀 구성을 기준으로 진행됩니다."
          : "Pokemon recommendations use the selected empty slot, its filters, and the current team.",
      ],
      recommendations: [],
    };
  }

  return {
    version: 2,
    source: "local",
    scope: "recommendation",
    title: isKorean ? "추천 후보" : "Recommended candidates",
    paragraphs: [
      candidates.length > 0
        ? isKorean
          ? "레귤레이션 M-B 적법성, 선택한 필터, 사용률과 현재 팀의 타입 구조를 함께 반영한 후보입니다."
          : "These candidates reflect Regulation M-B legality, the selected filters, usage, and the current team's type profile."
        : isKorean
          ? "현재 조건을 모두 만족하는 후보가 없습니다."
          : "No candidate satisfies every current requirement.",
    ],
    recommendations: candidates.map((candidate, index) => ({
      id: candidate.pokemonId,
      title: isKorean
        ? `${candidate.displayName} 후보를 검토해 보세요.`
        : `Consider ${candidate.displayName}.`,
      reason: isKorean
        ? index === 0
          ? "현재 조건에서 가장 먼저 검토할 수 있는 합법적인 후보입니다."
          : "현재 필터와 팀 구조를 만족하는 합법적인 후보입니다."
        : index === 0
          ? "This is the highest-priority legal candidate under the current requirements."
          : "This candidate is legal and fits the current filters and team structure.",
      priority: index === 0 ? "high" : "medium",
    })),
  };
}

function formatLocalOptimizationReason(
  candidate: CopilotSetOptimizationCandidateSnapshot,
  locale: Locale,
) {
  const moveChange = candidate.moveChanges[0];
  const change = moveChange
    ? locale === "ko"
      ? `${moveChange.currentMoveDisplayName} 대신 ${moveChange.optimizedMoveDisplayName}을 적용하는 기술 변경도 포함됩니다.`
      : `It also replaces ${moveChange.currentMoveDisplayName} with ${moveChange.optimizedMoveDisplayName}.`
    : candidate.itemChanged
      ? locale === "ko"
        ? `${candidate.itemDisplayName ?? "도구 없음"}으로 바꾸는 조건도 함께 계산했습니다.`
        : `The calculation also includes changing to ${candidate.itemDisplayName ?? "no held item"}.`
      : "";
  const base = locale === "ko"
    ? "계산된 공격, 내구와 스피드 결과를 함께 비교한 뒤 이 조정을 추천합니다."
    : "This option is recommended after comparing its calculated offense, bulk, and Speed results together.";
  return change ? `${base} ${change}` : base;
}

function formatCurrentSampleReason(candidate: CopilotSetOptimizationCandidateSnapshot, locale: Locale) {
  const attack = candidate.offenseBenchmarks.find(({ current }) =>
    current.guaranteedKoHits !== null && current.guaranteedKoHits <= 3,
  );
  const defense = candidate.defenseBenchmarks.find(({ current }) =>
    current.maxDamage > 0 && current.possibleKoHits !== null && current.possibleKoHits >= 2,
  );
  if (locale === "ko") {
    const evidence = attack
      ? `${attack.moveDisplayName}의 현재 공격 성능을 유지할 수 있습니다.`
      : `${defense?.moveDisplayName ?? "상대의 공격"}에 대한 계산에서 현재 샘플도 한 번의 공격을 견딜 수 있습니다.`;
    return `${evidence} 기존 화력, 스피드, 내구, 도구와 기술 구성을 그대로 유지하는 선택이며, 확인한 변경안은 모두 손익 비교가 필요합니다. 다른 상대까지 검증한 결과는 아닙니다.`;
  }
  const evidence = attack
    ? `Keeping this set retains its current calculated offense with ${attack.moveDisplayName}.`
    : `The current set can survive a hit from ${defense?.moveDisplayName ?? "the checked attack"} under these conditions.`;
  return `${evidence} It keeps the existing damage, Speed, bulk, item, and moves; the checked adjustments are not clear upgrades without tradeoffs. Other matchups have not been verified.`;
}

function analyzeOptimizationRequest(
  request: CopilotAnalysisRequest,
  locale: Locale,
): CopilotAnalysisResponse {
  const optimization = request.optimization;
  const isKorean = locale === "ko";

  if (!optimization) {
    return {
      version: 2,
      source: "local",
      scope: "optimization",
      title: isKorean ? "계산기 설정 필요" : "Calculator setup required",
      paragraphs: [
        isKorean
          ? "계산기에서 내 포켓몬, 상대 포켓몬과 공격 방향을 먼저 설정해 주세요."
          : "Choose both Pokemon and the attack direction in the calculator first.",
      ],
      recommendations: [],
    };
  }

  const currentCandidate = optimization.candidates.find(
    (candidate) => candidate.id === "set-current",
  );
  const candidates = currentCandidate
    ? [currentCandidate]
    : optimization.candidates
        .filter((candidate) =>
          !candidate.itemChanged && candidate.moveChanges.length === 0,
        )
        .slice(0, 3);
  return {
    version: 2,
    source: "local",
    scope: "optimization",
    title: `${optimization.playerDisplayName} vs. ${optimization.opponentDisplayName}`,
    paragraphs: [
      isKorean
        ? `계산기에 설정된 조건을 그대로 사용해 ${optimization.playerDisplayName}의 성격, 노력치, 기술과 도구 후보를 검증했습니다.`
        : `The nature, Stat Point, move, and item options for ${optimization.playerDisplayName} were verified under the exact calculator conditions.`,
      isKorean
        ? "표시된 대미지는 계산기 엔진으로 다시 검증했지만, 입력한 상대와 전투 조건에 한정된 결과이므로 다른 상대에게도 같은 성능을 보장하지는 않습니다."
        : "The displayed damage was rechecked by the calculator engine, but the result is limited to the entered opponent and battle conditions and does not guarantee the same performance in other matchups.",
    ],
    recommendations: candidates.map((candidate, index) => ({
      id: candidate.id,
      title: candidate.id === "set-current"
        ? (isKorean ? "현재 샘플을 유지해도 좋습니다." : "Keeping the current sample is a valid choice.")
        : isKorean ? `${candidate.natureDisplayName} 성격의 샘플을 검토해 보세요.`
          : `Consider the ${candidate.natureDisplayName} sample.`,
      reason: candidate.id === "set-current"
        ? formatCurrentSampleReason(candidate, locale)
        : formatLocalOptimizationReason(candidate, locale),
      priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    })),
  };
}

function describeMatchupMember(
  member: NonNullable<CopilotAnalysisRequest["matchup"]>["members"][number],
  locale: Locale,
) {
  const offense = member.offenseBenchmarks[0];
  const defense = member.defenseBenchmarks[0];
  const movesFirst = member.speed.relation !== "slower";
  const offenseName = offense
    ? locale === "ko" && offense.source === "usage"
      ? `사용률 후보인 ${offense.moveDisplayName}`
      : locale === "en" && offense.source === "usage"
        ? `The observed usage option ${offense.moveDisplayName}`
        : offense.moveDisplayName
    : null;
  const defenseName = defense
    ? locale === "ko" && defense.source === "usage"
      ? `사용률 후보인 ${defense.moveDisplayName}`
      : locale === "en" && defense.source === "usage"
        ? `the observed usage option ${defense.moveDisplayName}`
        : defense.moveDisplayName
    : null;
  const persistentSequence = offense?.persistentSequence;
  const persistentHits = persistentSequence?.guaranteedKoHits;
  const persistentNote = persistentSequence
    ? locale === "ko"
      ? persistentSequence.boostAffectedDamage
        ? `상대 특성으로 방어가 누적되는 과정까지 계산하면 ${persistentHits ? `확정 ${persistentHits}타` : "6타 이내 확정 처리가 어려운 범위"}입니다.`
        : `상대의 방어 상승 후에도 피해량이 유지되며 ${persistentHits ? `확정 ${persistentHits}타` : "6타 이내 확정 처리가 어려운 범위"}입니다.`
      : persistentSequence.boostAffectedDamage
        ? `After recalculating each defensive boost, it is ${persistentHits ? `a guaranteed ${persistentHits}-hit KO` : "not a guaranteed KO within six hits"}.`
        : `Its damage remains unchanged after the defensive boosts, leaving ${persistentHits ? `a guaranteed ${persistentHits}-hit KO` : "no guaranteed KO within six hits"}.`
    : null;

  if (locale === "ko") {
    const parts = [
      offense
        ? `${offenseName}(으)로 실질적인 반격이 가능합니다.`
        : "확인된 공격 기술만으로는 직접 압박하기 어렵습니다.",
      defense && (defense.result.possibleKoHits ?? 0) >= 2
        ? `${defenseName}을 한 번 견딜 수 있습니다.`
        : defense
          ? `${defenseName}을 직접 받아내기는 불안정합니다.`
          : "상대의 유효한 공격 기술이 설정되지 않았습니다.",
      movesFirst ? "현재 조건에서는 상대보다 먼저 움직입니다." : "현재 조건에서는 상대보다 늦게 움직입니다.",
      persistentNote,
    ];
    return parts.filter(Boolean).join(" ");
  }

  const parts = [
    offense
      ? `${offenseName} provides its clearest verified pressure.`
      : "The selected attacks do not provide direct verified pressure.",
    defense && (defense.result.possibleKoHits ?? 0) >= 2
      ? `It can survive one ${defenseName}.`
      : defense
        ? `Switching directly into ${defenseName} is unreliable.`
        : "No damaging opponent move is configured.",
    movesFirst
      ? "It moves before the opponent under the current conditions."
      : "It moves after the opponent under the current conditions.",
    persistentNote,
  ];
  return parts.filter(Boolean).join(" ");
}

function analyzeMatchupRequest(
  request: CopilotAnalysisRequest,
  locale: Locale,
): CopilotAnalysisResponse {
  const matchup = request.matchup;
  const isKorean = locale === "ko";

  if (!matchup) {
    return {
      version: 2,
      source: "local",
      scope: "matchup",
      title: isKorean ? "대응 분석 설정이 필요합니다" : "Matchup setup required",
      paragraphs: [
        isKorean
          ? "계산기에서 상대 포켓몬과 공격 기술을 설정한 뒤 다시 분석해 주세요."
          : "Configure an opponent and attacking moves in the calculator before running this analysis.",
      ],
      recommendations: [],
    };
  }

  const answers = matchup.members.filter((member) => member.responseTier === "answer");
  const checks = matchup.members.filter((member) => member.responseTier === "check");
  const selectedResponse = matchup.members.find(
    (member) => member.slotIndex === request.selectedSlot,
  );
  const answerNames = answers.map((member) => member.displayName);
  const checkNames = checks.map((member) => member.displayName);
  const title = `${request.teamName} vs. ${matchup.opponent.displayName}`;
  const paragraphs = [
    answers.length > 0
      ? isKorean
        ? `${answerNames.join(", ")}은(는) 현재 계산 조건에서 팀이 이미 보유한 직접적인 대응책으로 확인됩니다.`
        : `${answerNames.join(", ")} ${answers.length === 1 ? "is" : "are"} already a direct answer under the configured conditions.`
      : checks.length > 0
        ? isKorean
          ? `${checkNames.join(", ")}은(는) 조건부 견제 수단이지만 안전한 교체 대응으로 보기는 어렵습니다.`
          : `${checkNames.join(", ")} ${checks.length === 1 ? "is" : "are"} a conditional check rather than a safe switch-in.`
        : isKorean
          ? "현재 팀에서는 설정된 상대를 안정적으로 상대할 수 있는 직접적인 대응책을 찾지 못했습니다."
          : "The current team has no dependable direct answer to the configured opponent.",
    isKorean
      ? "팀원은 모두 체력이 가득 찬 상태와 중립 랭크로 비교했으며, 결과는 계산기에 설정된 상대와 배틀 환경에만 해당합니다."
      : "Every team member was compared at full HP and neutral stat stages, and these findings apply only to the configured opponent and battle environment.",
  ];
  const recommendations: CopilotRecommendation[] = [];

  const primaryResponse = answers[0] ?? checks[0];
  if (primaryResponse) {
    recommendations.push({
      id: `use-slot-${primaryResponse.slotIndex}`,
      title: isKorean
        ? `${primaryResponse.displayName}을(를) 중심으로 대응하는 편이 좋습니다.`
        : `Use ${primaryResponse.displayName} as the primary response.`,
      reason: describeMatchupMember(primaryResponse, locale),
      priority: "high",
    });
  }

  const optimizationCandidate =
    answers.length === 0 && selectedResponse?.responseTier !== "answer"
      ? request.optimization?.candidates.find((candidate) => candidate.id !== "set-current")
      : undefined;
  if (optimizationCandidate) {
    recommendations.push({
      id: optimizationCandidate.id,
      title: isKorean
        ? `${optimizationCandidate.natureDisplayName} 성격의 조정 샘플을 검토해 보세요.`
        : `Consider the ${optimizationCandidate.natureDisplayName} tuned sample.`,
      reason: formatLocalOptimizationReason(optimizationCandidate, locale),
      priority: recommendations.length === 0 ? "high" : "medium",
    });
  }

  if (recommendations.length === 0 || (answers.length === 0 && !optimizationCandidate)) {
    recommendations.push({
      id: "review-roster-answer",
      title: isKorean
        ? "팀 차원의 새로운 대응책을 검토해 보세요."
        : "Consider adding a roster-level answer.",
      reason: isKorean
        ? "현재 샘플과 선택된 기술만으로는 안정적인 대응이 확인되지 않았습니다. 이후 포켓몬 교체 후보를 검토할 가치가 있습니다."
        : "The current samples and selected moves do not establish a dependable answer, so a future replacement candidate is worth evaluating.",
      priority: recommendations.length === 0 ? "high" : "medium",
    });
  }

  return {
    version: 2,
    source: "local",
    scope: "matchup",
    title,
    paragraphs,
    recommendations: recommendations.slice(0, 3),
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

  if (request.scope === "matchup") {
    return analyzeMatchupRequest(request, locale);
  }

  return request.scope === "recommendation"
    ? analyzeRecommendationRequest(request, locale)
    : analyzeOptimizationRequest(request, locale);
}
