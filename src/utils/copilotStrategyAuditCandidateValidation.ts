import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import type {
  CopilotGroundedModelOutput,
  CopilotRecommendationCandidateFact,
  CopilotStrategyFact,
} from "./copilotModelTypes.js";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds.js";
import { textMentionsDisplayName } from "./copilotStrategyAuditCore.js";

function hasMatchingFact(
  facts: CopilotStrategyFact[],
  expected: Pick<
    CopilotStrategyFact,
    "kind" | "subjectSlotIndex" | "state" | "valueId"
  >,
) {
  return facts.some(
    (fact) =>
      fact.kind === expected.kind &&
      fact.subjectSlotIndex === expected.subjectSlotIndex &&
      fact.state === expected.state &&
      normalizeId(fact.valueId) === normalizeId(expected.valueId),
  );
}

function textMentionsTypeLabel(
  text: string,
  displayName: string,
  typeId: string,
) {
  const normalizedText = text.normalize("NFKC").toLowerCase();
  const labels = [displayName, typeId]
    .map((label) => label.trim().normalize("NFKC").toLowerCase())
    .filter((label, index, values) => label && values.indexOf(label) === index);

  return labels.some((label) => {
    const isAscii = Array.from(label).every(
      (character) => (character.codePointAt(0) ?? 0) <= 0x7f,
    );
    if (!isAscii) {
      if (Array.from(label).length === 1) {
        let matchIndex = normalizedText.indexOf(label);
        while (matchIndex >= 0) {
          const before = normalizedText[matchIndex - 1] ?? "";
          const after = normalizedText.slice(matchIndex + label.length);
          const hasWordCharacterBefore =
            /[a-z0-9\u3131-\u318e\uac00-\ud7a3]/i.test(before);
          const hasTypeContextAfter =
            after.length === 0 ||
            /^[\s.,:;!?()[\]{}]/.test(after) ||
            /^(?:타입|기술|공격|약점|내성|반감|저항|무효|에|을|의|과|와|로|은|는)/.test(
              after,
            );
          if (!hasWordCharacterBefore && hasTypeContextAfter) {
            return true;
          }
          matchIndex = normalizedText.indexOf(label, matchIndex + label.length);
        }

        return false;
      }

      return normalizedText.includes(label);
    }

    let matchIndex = normalizedText.indexOf(label);
    while (matchIndex >= 0) {
      const before = normalizedText[matchIndex - 1] ?? "";
      const after = normalizedText[matchIndex + label.length] ?? "";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        return true;
      }
      matchIndex = normalizedText.indexOf(label, matchIndex + label.length);
    }

    return false;
  });
}

function hasDefensiveCoverageLanguage(text: string) {
  return /\b(?:answer|cover|handle|patch|resist|immune|switch(?:-?in| into)?|defen[cs]e|protect against|pressure)\b|(?:약점|보완|대응|교대|반감|저항|무효|받아내|막아|압박)/i.test(
    text,
  );
}

function claimsNoTeammateDefense(text: string) {
  return /(?:\bno\b|\bnone\b|\bwithout\b|\black(?:s|ing)?\b)[^.!?\n]{0,140}(?:team-?mate|partner|member|resistan|immun)|(?:team-?mate|partner|member)[^.!?\n]{0,140}(?:resist|immun)[^.!?\n]{0,50}(?:\bno\b|\bnone\b|\bwithout\b)|(?:동료|팀원|파트너)[^.!?\n]{0,140}(?:반감|저항|무효)[^.!?\n]{0,50}(?:없|부재)|(?:반감|저항|무효)[^.!?\n]{0,140}(?:동료|팀원|파트너)[^.!?\n]{0,50}(?:없|부재)|팀(?:에는|에서|에게는|에|은|이)?[^.!?\n]{0,140}(?:반감|저항|무효|교대점)[^.!?\n]{0,70}(?:없|부재)/i.test(
    text,
  );
}

export function validateNegativeDefensiveClaims(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
  excludedSlotIndex: number | null,
  scopeLabel: "Pokemon" | "Team",
  errors: string[],
) {
  const publicStatements = [
    output.analysis.summary,
    output.analysis.playstyle,
    ...output.analysis.strengths,
    ...output.analysis.weaknesses,
    ...output.analysis.recommendations.flatMap((recommendation) => [
      recommendation.title,
      recommendation.reason,
    ]),
  ];

  publicStatements.forEach((statement) => {
    if (!claimsNoTeammateDefense(statement)) {
      return;
    }

    request.typeLabels.forEach((typeLabel) => {
      if (
        !textMentionsTypeLabel(statement, typeLabel.displayName, typeLabel.id)
      ) {
        return;
      }

      const matchingTeammates = request.sets.filter(
        (set) =>
          set.slotIndex !== excludedSlotIndex &&
          (set.defensiveProfile.resistances.some(
            (entry) => normalizeId(entry.type) === normalizeId(typeLabel.id),
          ) ||
            set.defensiveProfile.immunities.some(
              (entry) => normalizeId(entry.type) === normalizeId(typeLabel.id),
            )),
      );
      if (matchingTeammates.length > 0) {
        errors.push(
          `${scopeLabel} analysis claims no teammate defends against ${typeLabel.displayName}, but current slot ${matchingTeammates[0].slotIndex} does.`,
        );
      }
    });
  });
}

export function matchesCandidateValue(values: string[], valueId: string) {
  return values.some((value) => normalizeId(value) === normalizeId(valueId));
}

export function isCandidateFactSupported(
  fact: CopilotRecommendationCandidateFact,
  candidate: CopilotAnalysisRequest["recommendationCandidates"][number],
  activeConceptIds: string[],
) {
  switch (fact.kind) {
    case "type":
      return matchesCandidateValue(candidate.types, fact.valueId);
    case "ability":
      return matchesCandidateValue(
        candidate.abilities.map((ability) => ability.id),
        fact.valueId,
      );
    case "common-move":
      return matchesCandidateValue(
        candidate.commonSet?.moves.map((move) => move.id) ?? [],
        fact.valueId,
      );
    case "common-item":
      return (
        Boolean(candidate.commonSet?.item) &&
        normalizeId(candidate.commonSet?.item ?? "") === normalizeId(fact.valueId)
      );
    case "common-nature":
      return (
        Boolean(candidate.commonSet?.nature) &&
        normalizeId(candidate.commonSet?.nature ?? "") ===
          normalizeId(fact.valueId)
      );
    case "speed-tier":
      return candidate.speedTier === fact.valueId;
    case "usage-rank":
      return (
        candidate.usageRank !== null &&
        String(candidate.usageRank) === fact.valueId
      );
    case "requires-mega-stone":
      return candidate.requiresMegaStone && fact.valueId === "true";
    case "responsibility":
      return matchesCandidateValue(candidate.responsibilityIds, fact.valueId);
    case "weak-to":
      return matchesCandidateValue(candidate.fit.weakTo, fact.valueId);
    case "resists-team-threat":
      return matchesCandidateValue(
        candidate.fit.resistsTeamThreats,
        fact.valueId,
      );
    case "amplifies-team-threat":
      return matchesCandidateValue(
        candidate.fit.amplifiesTeamThreats,
        fact.valueId,
      );
    case "adds-unanswered-weakness":
      return matchesCandidateValue(
        candidate.fit.addsUnansweredWeaknesses,
        fact.valueId,
      );
    case "covers-type":
      return matchesCandidateValue(candidate.fit.coversTypes, fact.valueId);
    case "role-contribution":
      return matchesCandidateValue(
        candidate.fit.roleContributions,
        fact.valueId,
      );
    case "role-redundancy":
      return matchesCandidateValue(
        candidate.fit.roleRedundancies,
        fact.valueId,
      );
    case "concept-synergy":
      return matchesCandidateValue(
        candidate.fit.conceptSynergies,
        fact.valueId,
      );
    case "missing-concept-synergy":
      return (
        matchesCandidateValue(activeConceptIds, fact.valueId) &&
        !matchesCandidateValue(candidate.fit.conceptSynergies, fact.valueId)
      );
    case "conflict":
      return matchesCandidateValue(candidate.fit.conflicts, fact.valueId);
  }
}

export function validateCandidateFactsForRequest(
  candidateFacts: CopilotRecommendationCandidateFact[],
  request: CopilotAnalysisRequest,
  errors: string[],
) {
  if (candidateFacts.length > 40) {
    errors.push("strategyAudit.candidateFacts must contain at most 40 entries.");
  }

  const factIds = new Set<string>();
  const candidateById = new Map(
    request.recommendationCandidates.map((candidate) => [
      normalizeId(candidate.pokemonId),
      candidate,
    ]),
  );
  const activeConceptIds = request.diagnostics.concepts.map(
    (concept) => concept.id,
  );

  candidateFacts.forEach((fact, factIndex) => {
    const factPath = `strategyAudit.candidateFacts[${factIndex}]`;
    if (factIds.has(fact.id)) {
      errors.push(`${factPath}.id must be unique.`);
    }
    factIds.add(fact.id);

    const candidate = candidateById.get(normalizeId(fact.candidateId));
    if (!candidate) {
      errors.push(`${factPath}.candidateId references an unknown candidate.`);
      return;
    }

    const isValid = isCandidateFactSupported(
      fact,
      candidate,
      activeConceptIds,
    );

    if (!isValid) {
      errors.push(`${factPath} contradicts the supplied recommendation candidate.`);
    }
  });

  return factIds;
}

const recommendationFitFactKinds = new Set<
  CopilotRecommendationCandidateFact["kind"]
>([
  "type",
  "ability",
  "common-move",
  "responsibility",
  "resists-team-threat",
  "covers-type",
  "role-contribution",
  "concept-synergy",
]);

const recommendationTradeoffFactKinds = new Set<
  CopilotRecommendationCandidateFact["kind"]
>([
  "speed-tier",
  "usage-rank",
  "requires-mega-stone",
  "weak-to",
  "amplifies-team-threat",
  "adds-unanswered-weakness",
  "role-redundancy",
  "missing-concept-synergy",
  "conflict",
]);

export function validateRecommendationCandidateEvidenceCoverage(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
  errors: string[],
) {
  const factById = new Map(
    output.strategyAudit.candidateFacts.map((fact) => [fact.id, fact]),
  );
  const evidenceByRecommendation = new Map(
    output.strategyAudit.recommendationEvidence.map((evidence) => [
      evidence.recommendationId,
      evidence,
    ]),
  );
  const referencedFactIds = new Set<string>();

  output.analysis.recommendations.forEach((recommendation) => {
    const candidate = request.recommendationCandidates.find(
      (entry) => entry.pokemonId === recommendation.id,
    );
    if (!candidate) {
      errors.push(
        `Recommendation ${recommendation.id} does not match a supplied candidate.`,
      );
      return;
    }

    const evidence = evidenceByRecommendation.get(recommendation.id);
    if (!evidence) {
      return;
    }

    const linkedFacts = evidence.candidateFactIds.flatMap((factId) => {
      referencedFactIds.add(factId);
      const fact = factById.get(factId);
      return fact ? [fact] : [];
    });
    if (linkedFacts.length < 2) {
      errors.push(
        `Recommendation ${recommendation.id} must cite at least two candidate facts.`,
      );
    }
    if (
      linkedFacts.some(
        (fact) => normalizeId(fact.candidateId) !== normalizeId(candidate.pokemonId),
      )
    ) {
      errors.push(
        `Recommendation ${recommendation.id} cites facts for another candidate.`,
      );
    }
    if (!linkedFacts.some((fact) => recommendationFitFactKinds.has(fact.kind))) {
      errors.push(
        `Recommendation ${recommendation.id} must cite one concrete fit fact.`,
      );
    }
    if (
      !linkedFacts.some((fact) => recommendationTradeoffFactKinds.has(fact.kind))
    ) {
      errors.push(
        `Recommendation ${recommendation.id} must cite one concrete tradeoff fact.`,
      );
    }

    const recommendationText = `${recommendation.title}\n${recommendation.reason}`;
    if (candidate.commonSet) {
      const commonAbilityId = normalizeId(candidate.commonSet.ability ?? "");
      const commonAbility = candidate.abilities.find(
        (ability) =>
          normalizeId(ability.id) === commonAbilityId ||
          normalizeId(ability.displayName) === commonAbilityId,
      );
      const namesCommonElement =
        Boolean(
          commonAbility &&
            textMentionsDisplayName(
              recommendationText,
              commonAbility.displayName,
            ),
        ) ||
        candidate.commonSet.moves.some((move) =>
          textMentionsDisplayName(recommendationText, move.displayName),
        );

      if (!namesCommonElement) {
        errors.push(
          `Recommendation ${recommendation.id} must name at least one supplied common ability or move.`,
        );
      }
    }
    candidate.abilities.forEach((ability) => {
      if (
        textMentionsDisplayName(recommendationText, ability.displayName) &&
        !linkedFacts.some(
          (fact) =>
            fact.kind === "ability" &&
            normalizeId(fact.valueId) === normalizeId(ability.id),
        )
      ) {
        errors.push(
          `Recommendation ${recommendation.id} names ${ability.displayName} without matching candidate evidence.`,
        );
      }
    });
    candidate.commonSet?.moves.forEach((move) => {
      if (
        textMentionsDisplayName(recommendationText, move.displayName) &&
        !linkedFacts.some(
          (fact) =>
            fact.kind === "common-move" &&
            normalizeId(fact.valueId) === normalizeId(move.id),
        )
      ) {
        errors.push(
          `Recommendation ${recommendation.id} names ${move.displayName} without matching candidate evidence.`,
        );
      }
    });
  });

  output.strategyAudit.candidateFacts.forEach((fact) => {
    if (!referencedFactIds.has(fact.id)) {
      errors.push(`Candidate fact ${fact.id} is not linked to a recommendation.`);
    }
  });
}

function validatePokemonDefensiveRecommendationEvidence(
  recommendationId: string,
  recommendationText: string,
  evidenceFacts: CopilotStrategyFact[],
  mentionedSets: CopilotAnalysisRequest["sets"],
  request: CopilotAnalysisRequest,
  errors: string[],
) {
  const selectedSet = request.sets.find(
    (set) => set.slotIndex === request.selectedSlot,
  );
  if (!selectedSet) {
    return;
  }

  const selectedWeaknessFacts = evidenceFacts.filter(
    (fact) =>
      fact.kind === "weak-to" &&
      fact.subjectSlotIndex === selectedSet.slotIndex,
  );
  const teammateDefensiveFacts = evidenceFacts.filter(
    (fact) =>
      fact.subjectSlotIndex !== selectedSet.slotIndex &&
      (fact.kind === "resists" || fact.kind === "immune-to"),
  );
  const selectedWeaknessIds = new Set(
    selectedWeaknessFacts.map((fact) => normalizeId(fact.valueId)),
  );

  if (selectedWeaknessFacts.length > 0) {
    teammateDefensiveFacts.forEach((fact) => {
      if (!selectedWeaknessIds.has(normalizeId(fact.valueId))) {
        errors.push(
          `Recommendation ${recommendationId} links teammate slot ${fact.subjectSlotIndex}'s ${fact.valueId} defense to an unrelated selected-Pokemon weakness.`,
        );
      }
    });
  }

  if (
    selectedWeaknessFacts.length === 0 &&
    teammateDefensiveFacts.length === 0
  ) {
    return;
  }

  const claimedWeaknessTypes = request.typeLabels.filter(
    (label) =>
      selectedSet.defensiveProfile.weaknesses.some(
        (weakness) => normalizeId(weakness.type) === normalizeId(label.id),
      ) &&
      textMentionsTypeLabel(recommendationText, label.displayName, label.id),
  );
  if (
    claimedWeaknessTypes.length === 0 ||
    !hasDefensiveCoverageLanguage(recommendationText)
  ) {
    return;
  }

  claimedWeaknessTypes.forEach((typeLabel) => {
    const typeId = normalizeId(typeLabel.id);
    const hasSelectedWeaknessEvidence = selectedWeaknessFacts.some(
      (fact) => normalizeId(fact.valueId) === typeId,
    );
    if (!hasSelectedWeaknessEvidence) {
      errors.push(
        `Recommendation ${recommendationId} discusses covering ${typeLabel.displayName} without the selected Pokemon's matching weakness fact.`,
      );
    }

    mentionedSets
      .filter((set) => set.slotIndex !== selectedSet.slotIndex)
      .forEach((set) => {
        const hasExactDefenseEvidence = teammateDefensiveFacts.some(
          (fact) =>
            fact.subjectSlotIndex === set.slotIndex &&
            normalizeId(fact.valueId) === typeId,
        );
        if (!hasExactDefenseEvidence) {
          errors.push(
            `Recommendation ${recommendationId} names ${set.displayName} in ${typeLabel.displayName} coverage advice without matching resistance or immunity evidence.`,
          );
        }
      });
  });
}

function hasAllySequencingEffect(
  request: CopilotAnalysisRequest,
  moveId: string,
) {
  const mechanic = request.mechanics.moves.find(
    (entry) => normalizeId(entry.id) === normalizeId(moveId),
  );
  const effect = mechanic?.effect?.toLowerCase() ?? "";

  return (
    (/\bally\b/.test(effect) && /\bused\b/.test(effect) && /\bturn\b/.test(effect)) ||
    (effect.includes("함께") && effect.includes("계속"))
  );
}

export function validatePokemonRecommendationEvidenceCoverage(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
  errors: string[],
) {
  const factById = new Map(
    output.strategyAudit.facts.map((fact) => [fact.id, fact]),
  );
  const evidenceByRecommendation = new Map(
    output.strategyAudit.recommendationEvidence.map((evidence) => [
      evidence.recommendationId,
      evidence,
    ]),
  );

  output.analysis.recommendations.forEach((recommendation) => {
    const evidence = evidenceByRecommendation.get(recommendation.id);
    if (!evidence) {
      return;
    }

    const evidenceFacts = evidence.factIds.flatMap((factId) => {
      const fact = factById.get(factId);
      return fact ? [fact] : [];
    });
    const recommendationText = `${recommendation.title}\n${recommendation.reason}`;
    const mentionedSets = request.sets.filter((set) => {
      const mentionsCurrent = textMentionsDisplayName(
        recommendationText,
        set.displayName,
      );
      const mentionsMega = Boolean(
        set.megaEvolution &&
          textMentionsDisplayName(
            recommendationText,
            set.megaEvolution.displayName,
          ),
      );

      return mentionsCurrent || mentionsMega;
    });
    const mentionedSlots = new Set(mentionedSets.map((set) => set.slotIndex));

    mentionedSets
      .filter((set) => set.slotIndex !== request.selectedSlot)
      .forEach((set) => {
        if (
          !evidenceFacts.some(
            (fact) =>
              fact.subjectSlotIndex === set.slotIndex ||
              fact.objectSlotIndex === set.slotIndex,
          )
        ) {
          errors.push(
            `Recommendation ${recommendation.id} names ${set.displayName} without fact evidence for slot ${set.slotIndex}.`,
          );
        }
      });

    validatePokemonDefensiveRecommendationEvidence(
      recommendation.id,
      recommendationText,
      evidenceFacts,
      mentionedSets,
      request,
      errors,
    );

    const checkedMoveIds = new Set<string>();
    request.sets.forEach((set) => {
      set.moves.forEach((move) => {
        const moveId = normalizeId(move.id);
        if (
          checkedMoveIds.has(moveId) ||
          !textMentionsDisplayName(recommendationText, move.displayName)
        ) {
          return;
        }
        checkedMoveIds.add(moveId);

        const namedOwners = request.sets.filter(
          (candidate) =>
            mentionedSlots.has(candidate.slotIndex) &&
            candidate.moves.some(
              (candidateMove) => normalizeId(candidateMove.id) === moveId,
            ),
        );
        const requiresSharedMoveEvidence =
          namedOwners.length >= 2 && hasAllySequencingEffect(request, move.id);
        const hasSharedMoveEvidence = namedOwners.some((owner) =>
          hasMatchingFact(evidenceFacts, {
            kind: "move-owner",
            subjectSlotIndex: owner.slotIndex,
            state: "current",
            valueId: move.id,
          }),
        );

        if (requiresSharedMoveEvidence && !hasSharedMoveEvidence) {
          errors.push(
            `Recommendation ${recommendation.id} names shared move ${move.displayName} without matching owner fact evidence.`,
          );
        }
      });
    });
  });
}
