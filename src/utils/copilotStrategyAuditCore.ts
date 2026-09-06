import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import type {
  CopilotGroundedModelOutput,
  CopilotStrategyFact,
  CopilotStrategyInteraction,
  CopilotStrategyPokemonState,
} from "./copilotModelTypes.js";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds.js";

export function hasDuplicates(values: number[]) {
  return new Set(values).size !== values.length;
}

export function hasSameMembers(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

export function validateSlotList(
  values: number[],
  path: string,
  knownSlots: Set<number>,
  errors: string[],
) {
  if (hasDuplicates(values)) {
    errors.push(`${path} must not contain duplicate slots.`);
  }

  const unknownSlots = values.filter((slotIndex) => !knownSlots.has(slotIndex));
  if (unknownSlots.length > 0) {
    errors.push(`${path} references unknown slots: ${unknownSlots.join(", ")}.`);
  }
}

function hasDuplicateIds(values: string[]) {
  const normalizedValues = values.map(normalizeId);
  return new Set(normalizedValues).size !== normalizedValues.length;
}

export function validateBoundIds(
  values: string[],
  path: string,
  allowedIds: Array<string | null>,
  errors: string[],
) {
  if (hasDuplicateIds(values)) {
    errors.push(`${path} must not contain duplicate IDs.`);
  }

  const normalizedAllowedIds = new Set(
    allowedIds
      .filter((value): value is string => Boolean(value))
      .map(normalizeId),
  );

  values.forEach((value) => {
    if (!value.trim() || !normalizedAllowedIds.has(normalizeId(value))) {
      errors.push(`${path} contains an element not owned in the recorded state.`);
    }
  });
}

export function getSetState(
  set: CopilotAnalysisRequest["sets"][number],
  state: CopilotStrategyPokemonState,
) {
  if (state === "current") {
    return {
      ability: set.ability,
      defensiveProfile: set.defensiveProfile,
    };
  }

  if (!set.megaEvolution) {
    return null;
  }

  return {
    ability: set.megaEvolution.ability,
    defensiveProfile: set.megaEvolution.defensiveProfile,
  };
}

export function validateInteractionKind(
  interaction: CopilotStrategyInteraction,
  path: string,
  errors: string[],
) {
  const moveLists = interaction.participants.map((participant) =>
    participant.moveIds.map(normalizeId),
  );
  const moveCount = moveLists.reduce((total, moves) => total + moves.length, 0);
  const abilityCount = interaction.participants.reduce(
    (total, participant) => total + participant.abilityIds.length,
    0,
  );
  const itemCount = interaction.participants.reduce(
    (total, participant) => total + participant.itemIds.length,
    0,
  );

  if (
    interaction.kind === "ally-target" &&
    (interaction.participants.length < 2 || moveCount === 0)
  ) {
    errors.push(`${path} must bind a move and at least two active participants.`);
  }

  if (interaction.kind === "shared-move") {
    const sharedMoveIds = moveLists[0]?.filter((moveId) =>
      moveLists.slice(1).every((moves) => moves.includes(moveId)),
    );

    if (
      interaction.participants.length < 2 ||
      moveLists.some((moves) => moves.length === 0) ||
      !sharedMoveIds?.length
    ) {
      errors.push(
        `${path} must bind the same selected move to at least two active participants.`,
      );
    }
  }

  if (interaction.kind === "move-ability" && (moveCount === 0 || abilityCount === 0)) {
    errors.push(`${path} must bind at least one move and one ability.`);
  }

  if (interaction.kind === "move-item" && (moveCount === 0 || itemCount === 0)) {
    errors.push(`${path} must bind at least one move and one item.`);
  }

  if (interaction.kind === "deception" && interaction.participants.length < 2) {
    errors.push(`${path} must include the concealed and presented slots.`);
  }
}

export function getFactProfileValues(
  fact: CopilotStrategyFact,
  request: CopilotAnalysisRequest,
) {
  const set = request.sets.find(
    (candidate) => candidate.slotIndex === fact.subjectSlotIndex,
  );
  const state = set ? getSetState(set, fact.state) : null;

  if (!state) {
    return null;
  }

  if (fact.kind === "weak-to") {
    return state.defensiveProfile.weaknesses.map((entry) => entry.type);
  }
  if (fact.kind === "resists") {
    return state.defensiveProfile.resistances.map((entry) => entry.type);
  }
  if (fact.kind === "immune-to") {
    return state.defensiveProfile.immunities.map((entry) => entry.type);
  }

  return null;
}

function getUnconditionalItemSpeedMultiplier(
  set: CopilotAnalysisRequest["sets"][number],
  request: CopilotAnalysisRequest,
) {
  const itemId = normalizeId(set.item ?? "");
  if (!itemId) {
    return 1;
  }

  const effect = request.mechanics.items
    .find((item) => normalizeId(item.id) === itemId)
    ?.effect?.toLowerCase();
  if (!effect) {
    return 1;
  }

  const numericMatch = effect.match(
    /holder(?:'s|’s) speed is (\d+(?:\.\d+)?)x\b/,
  );
  if (numericMatch) {
    const multiplier = Number(numericMatch[1]);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  return /holder(?:'s|’s) speed is halved\b/.test(effect) ? 0.5 : 1;
}

function getComparableSpeed(
  set: CopilotAnalysisRequest["sets"][number],
  request: CopilotAnalysisRequest,
) {
  return (
    (set.stats?.speed ?? 0) * getUnconditionalItemSpeedMultiplier(set, request)
  );
}

export const unaryStrategyFactKinds = new Set<CopilotStrategyFact["kind"]>([
  "move-owner",
  "ability-owner",
  "item-owner",
  "mega-option",
  "weak-to",
  "resists",
  "immune-to",
]);

export function validateFactsForRequest(
  facts: CopilotGroundedModelOutput["strategyAudit"]["facts"],
  request: CopilotAnalysisRequest,
  setBySlot: Map<number, CopilotAnalysisRequest["sets"][number]>,
  errors: string[],
) {
  if (facts.length > 24) {
    errors.push("strategyAudit.facts must contain at most 24 entries.");
  }

  const factIds = new Set<string>();
  const speedFactKinds = new Set(["faster-than", "slower-than", "speed-tie"]);

  facts.forEach((fact, factIndex) => {
    const factPath = `strategyAudit.facts[${factIndex}]`;
    if (factIds.has(fact.id)) {
      errors.push(`${factPath}.id must be unique.`);
    }
    factIds.add(fact.id);

    const subject = setBySlot.get(fact.subjectSlotIndex);
    if (!subject) {
      errors.push(`${factPath}.subjectSlotIndex references an unknown set.`);
      return;
    }

    const state = getSetState(subject, fact.state);
    if (!state) {
      errors.push(`${factPath}.state records an unavailable Mega form.`);
      return;
    }

    if (unaryStrategyFactKinds.has(fact.kind) && fact.objectSlotIndex !== -1) {
      errors.push(`${factPath}.objectSlotIndex must be -1 for a unary fact.`);
    }

    if (fact.kind === "move-owner") {
      validateBoundIds(
        [fact.valueId],
        `${factPath}.valueId`,
        subject.moves.map((move) => move.id),
        errors,
      );
    } else if (fact.kind === "ability-owner") {
      validateBoundIds(
        [fact.valueId],
        `${factPath}.valueId`,
        [state.ability],
        errors,
      );
    } else if (fact.kind === "item-owner") {
      validateBoundIds(
        [fact.valueId],
        `${factPath}.valueId`,
        [subject.item],
        errors,
      );
    } else if (fact.kind === "mega-option") {
      const megaOptionIds = request.megaOptions
        .filter((option) => option.slotIndex === fact.subjectSlotIndex)
        .map((option) => option.pokemonId);
      if (
        fact.state !== "current" ||
        !megaOptionIds.some(
          (value) => normalizeId(value) === normalizeId(fact.valueId),
        )
      ) {
        errors.push(`${factPath} does not match a supplied Mega option.`);
      }
    } else if (
      fact.kind === "weak-to" ||
      fact.kind === "resists" ||
      fact.kind === "immune-to"
    ) {
      const profileValues = getFactProfileValues(fact, request) ?? [];
      if (
        !profileValues.some(
          (type) => normalizeId(type) === normalizeId(fact.valueId),
        )
      ) {
        errors.push(`${factPath} contradicts the supplied defensive profile.`);
      }
    } else if (speedFactKinds.has(fact.kind)) {
      const object = setBySlot.get(fact.objectSlotIndex);
      if (!object || fact.objectSlotIndex === fact.subjectSlotIndex) {
        errors.push(`${factPath}.objectSlotIndex must reference another set.`);
        return;
      }
      if (fact.state !== "current") {
        errors.push(
          `${factPath}.state must match the supplied form for a final-Speed fact.`,
        );
      }
      if (fact.valueId !== "") {
        errors.push(`${factPath}.valueId must be empty for a final-Speed fact.`);
      }
      if (!subject.stats || !object.stats) {
        errors.push(`${factPath} requires final stats for both sets.`);
        return;
      }

      const subjectSpeed = getComparableSpeed(subject, request);
      const objectSpeed = getComparableSpeed(object, request);
      const isCorrect =
        (fact.kind === "faster-than" && subjectSpeed > objectSpeed) ||
        (fact.kind === "slower-than" && subjectSpeed < objectSpeed) ||
        (fact.kind === "speed-tie" && subjectSpeed === objectSpeed);
      if (!isCorrect) {
        errors.push(
          `${factPath} contradicts the supplied final Speed values and unconditional held-item modifiers.`,
        );
      }
    }
  });

  return factIds;
}

export function validateRecommendationEvidenceForRequest(
  output: CopilotGroundedModelOutput,
  knownIds: {
    planIds: Set<string>;
    interactionIds: Set<string>;
    factIds: Set<string>;
    candidateFactIds: Set<string>;
  },
  errors: string[],
) {
  const { recommendationEvidence } = output.strategyAudit;

  if (recommendationEvidence.length > 3) {
    errors.push(
      "strategyAudit.recommendationEvidence must contain at most 3 entries.",
    );
  }

  const recommendationIds = new Set<string>();
  output.analysis.recommendations.forEach((recommendation, index) => {
    if (recommendationIds.has(recommendation.id)) {
      errors.push(`analysis.recommendations[${index}].id must be unique.`);
    }
    recommendationIds.add(recommendation.id);
  });

  const evidencedRecommendationIds = new Set<string>();
  recommendationEvidence.forEach((evidence, evidenceIndex) => {
    const evidencePath =
      `strategyAudit.recommendationEvidence[${evidenceIndex}]`;
    if (evidencedRecommendationIds.has(evidence.recommendationId)) {
      errors.push(`${evidencePath}.recommendationId must be unique.`);
    }
    evidencedRecommendationIds.add(evidence.recommendationId);

    if (!recommendationIds.has(evidence.recommendationId)) {
      errors.push(`${evidencePath}.recommendationId is not present in analysis.`);
    }

    for (const [key, values, validIds] of [
      ["planIds", evidence.planIds, knownIds.planIds],
      ["interactionIds", evidence.interactionIds, knownIds.interactionIds],
      ["factIds", evidence.factIds, knownIds.factIds],
      [
        "candidateFactIds",
        evidence.candidateFactIds,
        knownIds.candidateFactIds,
      ],
    ] as const) {
      if (hasDuplicateIds(values)) {
        errors.push(`${evidencePath}.${key} must not contain duplicate IDs.`);
      }
      const unknownIds = values.filter((id) => !validIds.has(id));
      if (unknownIds.length > 0) {
        errors.push(`${evidencePath}.${key} references unknown IDs.`);
      }
    }

    if (
      evidence.planIds.length === 0 &&
      evidence.interactionIds.length === 0 &&
      evidence.factIds.length === 0 &&
      evidence.candidateFactIds.length === 0
    ) {
      errors.push(`${evidencePath} must reference at least one audit entry.`);
    }
  });

  recommendationIds.forEach((recommendationId) => {
    if (!evidencedRecommendationIds.has(recommendationId)) {
      errors.push(
        `Recommendation ${recommendationId} must have private audit evidence.`,
      );
    }
  });
}

export function textMentionsDisplayName(text: string, displayName: string) {
  const label = displayName.trim();
  if (label.length < 2) {
    return false;
  }

  const isAscii = Array.from(label).every(
    (character) => (character.codePointAt(0) ?? 0) <= 0x7f,
  );

  if (isAscii) {
    const normalizedText = text.toLowerCase();
    const normalizedLabel = label.toLowerCase();
    let matchIndex = normalizedText.indexOf(normalizedLabel);

    while (matchIndex >= 0) {
      const before = normalizedText[matchIndex - 1] ?? "";
      const after = normalizedText[matchIndex + normalizedLabel.length] ?? "";
      if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) {
        return true;
      }
      matchIndex = normalizedText.indexOf(
        normalizedLabel,
        matchIndex + normalizedLabel.length,
      );
    }

    return false;
  }

  return text.normalize("NFKC").includes(label.normalize("NFKC"));
}
