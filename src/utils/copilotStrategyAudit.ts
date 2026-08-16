import type { CopilotAnalysisRequest } from "./copilotAnalysis.js";
import type {
  CopilotGroundedModelOutput,
  CopilotRecommendationCandidateFact,
  CopilotStrategyFact,
  CopilotStrategyInteraction,
  CopilotStrategyPokemonState,
} from "./copilotModelContract.js";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds.js";

function hasDuplicates(values: number[]) {
  return new Set(values).size !== values.length;
}

function hasSameMembers(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function validateSlotList(
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

function validateBoundIds(
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

function getSetState(
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

function validateInteractionKind(
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

function getFactProfileValues(
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

const unaryStrategyFactKinds = new Set<CopilotStrategyFact["kind"]>([
  "move-owner",
  "ability-owner",
  "item-owner",
  "mega-option",
  "weak-to",
  "resists",
  "immune-to",
]);

function validateFactsForRequest(
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

function validateRecommendationEvidenceForRequest(
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

function textMentionsDisplayName(text: string, displayName: string) {
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

function getRecommendationCandidateFactKey(
  candidateId: string,
  kind: CopilotRecommendationCandidateFact["kind"],
  valueId: string,
) {
  return `${normalizeId(candidateId)}:${kind}:${normalizeId(valueId)}`;
}

/**
 * Candidate references are deterministic request data. Normalize disposable
 * private bookkeeping and complete exact public element links so a grounded
 * answer cannot fail only because the model misstated or omitted an audit row.
 */
export function completeCopilotRecommendationAudit(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
): CopilotGroundedModelOutput {
  if (request.scope !== "recommendation") return output;

  const candidateById = new Map(
    request.recommendationCandidates.map((candidate) => [
      normalizeId(candidate.pokemonId),
      candidate,
    ]),
  );
  const activeConceptIds = request.diagnostics.concepts.map(
    (concept) => concept.id,
  );
  const candidateFacts = output.strategyAudit.candidateFacts.flatMap<
    CopilotRecommendationCandidateFact
  >((fact) => {
    const candidate = candidateById.get(normalizeId(fact.candidateId));
    if (!candidate) {
      return [{ ...fact }];
    }
    if (isCandidateFactSupported(fact, candidate, activeConceptIds)) {
      return [{ ...fact }];
    }

    if (
      fact.kind === "role-contribution" &&
      matchesCandidateValue(candidate.responsibilityIds, fact.valueId)
    ) {
      return [{
        ...fact,
        kind: "responsibility" as const,
      }];
    }

    if (
      (fact.kind === "amplifies-team-threat" ||
        fact.kind === "adds-unanswered-weakness") &&
      matchesCandidateValue(candidate.fit.weakTo, fact.valueId)
    ) {
      return [{
        ...fact,
        kind: "weak-to" as const,
      }];
    }

    return [];
  });
  const survivingCandidateFactIds = new Set(
    candidateFacts.map((fact) => fact.id),
  );
  const recommendationEvidence = output.strategyAudit.recommendationEvidence.map(
    (evidence) => ({
      ...evidence,
      planIds: [...evidence.planIds],
      interactionIds: [...evidence.interactionIds],
      factIds: [...evidence.factIds],
      candidateFactIds: evidence.candidateFactIds.filter((factId) =>
        survivingCandidateFactIds.has(factId),
      ),
    }),
  );
  const factByKey = new Map(
    candidateFacts.map((fact) => [
      getRecommendationCandidateFactKey(
        fact.candidateId,
        fact.kind,
        fact.valueId,
      ),
      fact,
    ]),
  );
  const factIds = new Set(candidateFacts.map((fact) => fact.id));

  const createFactId = (
    recommendationIndex: number,
    kind: CopilotRecommendationCandidateFact["kind"],
    valueId: string,
  ) => {
    const baseId = `r${recommendationIndex + 1}-${kind}-${normalizeId(valueId) || "value"}`;
    let factId = baseId;
    let suffix = 2;
    while (factIds.has(factId)) {
      factId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    factIds.add(factId);
    return factId;
  };

  output.analysis.recommendations.forEach((recommendation, recommendationIndex) => {
    const candidate = request.recommendationCandidates.find(
      (entry) => normalizeId(entry.pokemonId) === normalizeId(recommendation.id),
    );
    const evidence = recommendationEvidence.find(
      (entry) =>
        normalizeId(entry.recommendationId) === normalizeId(recommendation.id),
    );
    if (!candidate || !evidence) return;

    const recommendationText = `${recommendation.title}\n${recommendation.reason}`;
    const ensureFact = (
      kind: "ability" | "common-move",
      valueId: string,
    ) => {
      const factKey = getRecommendationCandidateFactKey(
        candidate.pokemonId,
        kind,
        valueId,
      );
      let fact = factByKey.get(factKey);
      if (!fact) {
        fact = {
          id: createFactId(recommendationIndex, kind, valueId),
          candidateId: candidate.pokemonId,
          kind,
          valueId,
        };
        candidateFacts.push(fact);
        factByKey.set(factKey, fact);
      }
      if (!evidence.candidateFactIds.includes(fact.id)) {
        evidence.candidateFactIds.push(fact.id);
      }
    };

    candidate.abilities.forEach((ability) => {
      if (textMentionsDisplayName(recommendationText, ability.displayName)) {
        ensureFact("ability", ability.id);
      }
    });
    candidate.commonSet?.moves.forEach((move) => {
      if (textMentionsDisplayName(recommendationText, move.displayName)) {
        ensureFact("common-move", move.id);
      }
    });

    candidateFacts.forEach((fact) => {
      if (
        normalizeId(fact.candidateId) === normalizeId(candidate.pokemonId) &&
        !evidence.candidateFactIds.includes(fact.id)
      ) {
        evidence.candidateFactIds.push(fact.id);
      }
    });
  });

  return {
    ...output,
    strategyAudit: {
      ...output.strategyAudit,
      candidateFacts,
      recommendationEvidence,
    },
  };
}

const defensiveStrategyFactKinds = new Set<CopilotStrategyFact["kind"]>([
  "weak-to",
  "resists",
  "immune-to",
]);

function textMentionsSetState(
  text: string,
  set: CopilotAnalysisRequest["sets"][number],
  state: CopilotStrategyPokemonState,
) {
  if (state === "mega") {
    return Boolean(
      set.megaEvolution &&
        textMentionsDisplayName(text, set.megaEvolution.displayName),
    );
  }

  return textMentionsDisplayName(text, set.displayName);
}

function factMatchesDefensiveProfile(
  fact: CopilotStrategyFact,
  request: CopilotAnalysisRequest,
) {
  const profileValues = getFactProfileValues(fact, request);
  return Boolean(
    profileValues?.some(
      (value) => normalizeId(value) === normalizeId(fact.valueId),
    ),
  );
}

function textDiscussesSpeedOrder(text: string) {
  return /\b(?:fast|faster|slow|slower|speed|speed-tie|outspeed|before|after)\b|(?:\uBE60\uB974|\uB290\uB9AC|\uC2A4\uD53C\uB4DC|\uC18D\uB3C4|\uCD94\uC6D4|\uBA3C\uC800|\uB098\uC911)/i.test(
    text,
  );
}

/**
 * Repair only unambiguous private-audit bookkeeping for Pokemon analysis.
 * Public prose still has to pass the same exact deterministic validation.
 */
function completePokemonRecommendationAudit(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
): CopilotGroundedModelOutput {
  if (request.scope !== "pokemon") {
    return output;
  }

  const recommendationById = new Map(
    output.analysis.recommendations.map((recommendation) => [
      normalizeId(recommendation.id),
      recommendation,
    ]),
  );
  const evidence = output.strategyAudit.recommendationEvidence.map((entry) => ({
    ...entry,
    factIds: [...entry.factIds],
  }));
  const linkedTextsByFactId = new Map<string, string[]>();

  evidence.forEach((entry) => {
    const recommendation = recommendationById.get(
      normalizeId(entry.recommendationId),
    );
    if (!recommendation) return;

    const text = `${recommendation.title}\n${recommendation.reason}`;
    entry.factIds.forEach((factId) => {
      const texts = linkedTextsByFactId.get(factId) ?? [];
      texts.push(text);
      linkedTextsByFactId.set(factId, texts);
    });
  });

  const facts = output.strategyAudit.facts.map((fact) => {
    if (
      !defensiveStrategyFactKinds.has(fact.kind) ||
      factMatchesDefensiveProfile(fact, request)
    ) {
      return { ...fact };
    }

    const linkedTexts = linkedTextsByFactId.get(fact.id) ?? [];
    const matchingSets = request.sets.filter((set) => {
      if (!linkedTexts.some((text) => textMentionsSetState(text, set, fact.state))) {
        return false;
      }

      return factMatchesDefensiveProfile(
        { ...fact, subjectSlotIndex: set.slotIndex },
        request,
      );
    });

    return matchingSets.length === 1
      ? { ...fact, subjectSlotIndex: matchingSets[0].slotIndex }
      : { ...fact };
  });
  const factById = new Map(facts.map((fact) => [fact.id, fact]));

  evidence.forEach((entry) => {
    const recommendation = recommendationById.get(
      normalizeId(entry.recommendationId),
    );
    if (!recommendation) return;

    const text = `${recommendation.title}\n${recommendation.reason}`;
    const linkedFacts = entry.factIds.flatMap((factId) => {
      const fact = factById.get(factId);
      return fact ? [fact] : [];
    });

    request.sets
      .filter(
        (set) =>
          set.slotIndex !== request.selectedSlot &&
          (textMentionsDisplayName(text, set.displayName) ||
            Boolean(
              set.megaEvolution &&
                textMentionsDisplayName(
                  text,
                  set.megaEvolution.displayName,
                ),
            )),
      )
      .forEach((set) => {
        if (
          linkedFacts.some(
            (fact) =>
              fact.subjectSlotIndex === set.slotIndex ||
              fact.objectSlotIndex === set.slotIndex,
          )
        ) {
          return;
        }

        const directFacts = textDiscussesSpeedOrder(text)
          ? facts.filter(
              (fact) =>
                (fact.kind === "faster-than" ||
                  fact.kind === "slower-than" ||
                  fact.kind === "speed-tie") &&
                ((fact.subjectSlotIndex === request.selectedSlot &&
                  fact.objectSlotIndex === set.slotIndex) ||
                  (fact.objectSlotIndex === request.selectedSlot &&
                    fact.subjectSlotIndex === set.slotIndex)),
            )
          : [];
        if (directFacts.length === 1) {
          entry.factIds.push(directFacts[0].id);
          linkedFacts.push(directFacts[0]);
        }
      });
  });

  return {
    ...output,
    strategyAudit: {
      ...output.strategyAudit,
      facts,
      recommendationEvidence: evidence,
    },
  };
}

/**
 * Normalize non-semantic audit formatting and remove only surplus interaction
 * move links when at least one action-backed link keeps the interaction valid.
 * Unsupported facts and invented sequences remain visible to strict validation.
 */
export function completeCopilotStrategyAudit(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
): CopilotGroundedModelOutput {
  const recommendationOutput = completeCopilotRecommendationAudit(
    output,
    request,
  );
  if (request.scope === "recommendation") return recommendationOutput;
  const normalizedOutput = completePokemonRecommendationAudit(
    recommendationOutput,
    request,
  );

  const referencedFactIds = new Set(
    normalizedOutput.strategyAudit.recommendationEvidence.flatMap(
      (evidence) => evidence.factIds,
    ),
  );
  const facts = normalizedOutput.strategyAudit.facts
    .map((fact) =>
      unaryStrategyFactKinds.has(fact.kind) && fact.objectSlotIndex !== -1
        ? { ...fact, objectSlotIndex: -1 }
        : fact,
    )
    .filter((fact) => {
      if (referencedFactIds.has(fact.id)) return true;
      if (
        fact.kind !== "weak-to" &&
        fact.kind !== "resists" &&
        fact.kind !== "immune-to"
      ) {
        return true;
      }

      const profileValues = getFactProfileValues(fact, request);
      if (!profileValues) return true;

      return profileValues.some(
        (type) => normalizeId(type) === normalizeId(fact.valueId),
      );
    });
  let interactions = normalizedOutput.strategyAudit.interactions;
  if (request.scope === "team") {
    const planById = new Map(
      normalizedOutput.strategyAudit.plans.map((plan) => [plan.id, plan]),
    );
    interactions = interactions.map((interaction) => {
      const plan = planById.get(interaction.planId);
      if (!plan) return interaction;

      const isSimultaneousInteraction =
        interaction.kind === "ally-target" ||
        interaction.kind === "shared-move";
      const participants = interaction.participants.map((participant) => ({
        ...participant,
        moveIds: participant.moveIds.filter((moveId) =>
          plan.actions.some(
            (action) =>
              action.actorSlotIndex === participant.slotIndex &&
              normalizeId(action.moveId) === normalizeId(moveId) &&
              action.activeSlotIndexes.includes(participant.slotIndex) &&
              (!isSimultaneousInteraction ||
                (action.phase === interaction.phase &&
                  hasSameMembers(
                    action.activeSlotIndexes,
                    interaction.activeSlotIndexes,
                  ))),
          ),
        ),
      }));
      const originalMoveCount = interaction.participants.reduce(
        (total, participant) => total + participant.moveIds.length,
        0,
      );
      const actionBackedMoveCount = participants.reduce(
        (total, participant) => total + participant.moveIds.length,
        0,
      );

      if (
        actionBackedMoveCount === 0 ||
        actionBackedMoveCount === originalMoveCount
      ) {
        return interaction;
      }

      const normalizedInteraction = {
        ...interaction,
        participants,
      };
      const kindErrors: string[] = [];
      validateInteractionKind(normalizedInteraction, "interaction", kindErrors);
      if (kindErrors.length > 0) {
        return interaction;
      }

      return normalizedInteraction;
    });
  }

  return {
    ...normalizedOutput,
    strategyAudit: {
      ...normalizedOutput.strategyAudit,
      interactions,
      facts,
    },
  };
}

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

function validateNegativeDefensiveClaims(
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

function matchesCandidateValue(values: string[], valueId: string) {
  return values.some((value) => normalizeId(value) === normalizeId(valueId));
}

function isCandidateFactSupported(
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

function validateCandidateFactsForRequest(
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

function validateRecommendationCandidateEvidenceCoverage(
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

function validatePokemonRecommendationEvidenceCoverage(
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

export function validateCopilotStrategyAuditForRequest(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
) {
  const errors: string[] = [];
  const {
    plans,
    interactions,
    facts,
    candidateFacts,
    recommendationEvidence,
  } =
    output.strategyAudit;

  if (request.scope === "recommendation") {
    if (plans.length > 0) {
      errors.push("Recommendation analysis must not include strategy plans.");
    }
    if (interactions.length > 0 || facts.length > 0) {
      errors.push("Recommendation analysis must not include audit evidence.");
    }

    const candidateFactIds = validateCandidateFactsForRequest(
      candidateFacts,
      request,
      errors,
    );
    validateRecommendationEvidenceForRequest(
      output,
      {
        planIds: new Set(),
        interactionIds: new Set(),
        factIds: new Set(),
        candidateFactIds,
      },
      errors,
    );
    validateRecommendationCandidateEvidenceCoverage(output, request, errors);

    return errors;
  }

  if (candidateFacts.length > 0) {
    errors.push(
      "Candidate facts are only allowed for recommendation analysis.",
    );
  }

  const setBySlot = new Map(request.sets.map((set) => [set.slotIndex, set]));

  if (request.scope === "pokemon") {
    if (plans.length > 0) {
      errors.push("Pokemon analysis must not include team strategy plans.");
    }
    if (interactions.length > 0) {
      errors.push("Pokemon analysis must not include team interactions.");
    }

    const selectedSet = setBySlot.get(request.selectedSlot);
    if (!selectedSet) {
      if (facts.length > 0 || recommendationEvidence.length > 0) {
        errors.push(
          "An empty Pokemon slot must use an empty private strategy audit.",
        );
      }

      return errors;
    }

    const factIds = validateFactsForRequest(
      facts,
      request,
      setBySlot,
      errors,
    );
    validateRecommendationEvidenceForRequest(
      output,
      {
        planIds: new Set(),
        interactionIds: new Set(),
        factIds,
        candidateFactIds: new Set(),
      },
      errors,
    );
    validatePokemonRecommendationEvidenceCoverage(output, request, errors);
    validateNegativeDefensiveClaims(
      output,
      request,
      selectedSet.slotIndex,
      "Pokemon",
      errors,
    );

    return errors;
  }

  if (request.sets.length === 0) {
    if (
      plans.length > 0 ||
      interactions.length > 0 ||
      facts.length > 0 ||
      candidateFacts.length > 0 ||
      recommendationEvidence.length > 0
    ) {
      errors.push("An empty team must use an empty private strategy audit.");
    }

    return errors;
  }

  const knownSlots = new Set(setBySlot.keys());
  const selectionSize = request.battleFormat === "doubles" ? 4 : 3;
  const activeSize = request.battleFormat === "doubles" ? 2 : 1;
  const expectedLineupSize = Math.min(selectionSize, request.sets.length);
  const expectedLeadSize = Math.min(activeSize, expectedLineupSize);
  const hasSelectedMove = request.sets.some((set) => set.moves.length > 0);

  if (expectedLineupSize > 0 && plans.length === 0) {
    errors.push("Team analysis must include at least one grounded strategy plan.");
    return errors;
  }

  if (plans.length > 3) {
    errors.push("strategyAudit.plans must contain at most 3 plans.");
  }

  const planIds = new Set<string>();
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  plans.forEach((plan, planIndex) => {
    const planPath = `strategyAudit.plans[${planIndex}]`;

    if (planIds.has(plan.id)) {
      errors.push(`${planPath}.id must be unique.`);
    }
    planIds.add(plan.id);

    validateSlotList(
      plan.lineupSlotIndexes,
      `${planPath}.lineupSlotIndexes`,
      knownSlots,
      errors,
    );
    validateSlotList(
      plan.leadSlotIndexes,
      `${planPath}.leadSlotIndexes`,
      knownSlots,
      errors,
    );
    validateSlotList(
      plan.backlineSlotIndexes,
      `${planPath}.backlineSlotIndexes`,
      knownSlots,
      errors,
    );

    if (plan.lineupSlotIndexes.length !== expectedLineupSize) {
      errors.push(
        `${planPath}.lineupSlotIndexes must contain ${expectedLineupSize} slots.`,
      );
    }

    if (plan.leadSlotIndexes.length !== expectedLeadSize) {
      errors.push(
        `${planPath}.leadSlotIndexes must contain ${expectedLeadSize} slots.`,
      );
    }

    const expectedBackline = plan.lineupSlotIndexes.filter(
      (slotIndex) => !plan.leadSlotIndexes.includes(slotIndex),
    );

    if (!hasSameMembers(plan.backlineSlotIndexes, expectedBackline)) {
      errors.push(
        `${planPath}.backlineSlotIndexes must be the lineup slots not used as leads.`,
      );
    }

    if (
      plan.leadSlotIndexes.some(
        (slotIndex) => !plan.lineupSlotIndexes.includes(slotIndex),
      )
    ) {
      errors.push(`${planPath}.leadSlotIndexes must be part of the lineup.`);
    }

    if (hasSelectedMove && plan.actions.length === 0) {
      errors.push(`${planPath}.actions must contain at least one action.`);
    }

    if (plan.actions.length > 12) {
      errors.push(`${planPath}.actions must contain at most 12 actions.`);
    }

    plan.actions.forEach((action, actionIndex) => {
      const actionPath = `${planPath}.actions[${actionIndex}]`;
      validateSlotList(
        action.activeSlotIndexes,
        `${actionPath}.activeSlotIndexes`,
        knownSlots,
        errors,
      );

      if (
        action.activeSlotIndexes.length < 1 ||
        action.activeSlotIndexes.length > activeSize
      ) {
        errors.push(
          `${actionPath}.activeSlotIndexes must contain between 1 and ${activeSize} slots.`,
        );
      }

      if (
        action.activeSlotIndexes.some(
          (slotIndex) => !plan.lineupSlotIndexes.includes(slotIndex),
        )
      ) {
        errors.push(`${actionPath}.activeSlotIndexes must be part of the lineup.`);
      }

      if (!action.activeSlotIndexes.includes(action.actorSlotIndex)) {
        errors.push(`${actionPath}.actorSlotIndex must be active for the action.`);
      }

      if (
        action.phase === "opening" &&
        !hasSameMembers(action.activeSlotIndexes, plan.leadSlotIndexes)
      ) {
        errors.push(
          `${actionPath}.activeSlotIndexes must match the lead pair during the opening.`,
        );
      }

      const actor = setBySlot.get(action.actorSlotIndex);
      if (!actor) {
        errors.push(`${actionPath}.actorSlotIndex references an unknown set.`);
        return;
      }

      const ownedMoveIds = new Set(actor.moves.map((move) => normalizeId(move.id)));
      if (!ownedMoveIds.has(normalizeId(action.moveId))) {
        errors.push(
          `${actionPath}.moveId is not selected by slot ${action.actorSlotIndex}.`,
        );
      }
    });
  });

  if (interactions.length > 12) {
    errors.push("strategyAudit.interactions must contain at most 12 entries.");
  }

  const interactionIds = new Set<string>();
  interactions.forEach((interaction, interactionIndex) => {
    const interactionPath = `strategyAudit.interactions[${interactionIndex}]`;
    const isSimultaneousInteraction =
      interaction.kind === "ally-target" ||
      interaction.kind === "shared-move";
    if (interactionIds.has(interaction.id)) {
      errors.push(`${interactionPath}.id must be unique.`);
    }
    interactionIds.add(interaction.id);

    const plan = planById.get(interaction.planId);
    if (!plan) {
      errors.push(`${interactionPath}.planId references an unknown plan.`);
    }

    validateSlotList(
      interaction.activeSlotIndexes,
      `${interactionPath}.activeSlotIndexes`,
      knownSlots,
      errors,
    );

    if (
      interaction.activeSlotIndexes.length < 1 ||
      interaction.activeSlotIndexes.length > activeSize
    ) {
      errors.push(
        `${interactionPath}.activeSlotIndexes must contain between 1 and ${activeSize} slots.`,
      );
    }

    if (
      plan &&
      interaction.activeSlotIndexes.some(
        (slotIndex) => !plan.lineupSlotIndexes.includes(slotIndex),
      )
    ) {
      errors.push(
        `${interactionPath}.activeSlotIndexes must be part of the referenced lineup.`,
      );
    }

    if (
      plan &&
      interaction.phase === "opening" &&
      !hasSameMembers(interaction.activeSlotIndexes, plan.leadSlotIndexes)
    ) {
      errors.push(
        `${interactionPath}.activeSlotIndexes must match the referenced lead pair during the opening.`,
      );
    }

    if (
      interaction.participants.length < 1 ||
      interaction.participants.length > 2
    ) {
      errors.push(
        `${interactionPath}.participants must contain between 1 and 2 entries.`,
      );
    }

    const participantSlots = interaction.participants.map(
      (participant) => participant.slotIndex,
    );
    if (hasDuplicates(participantSlots)) {
      errors.push(`${interactionPath}.participants must use unique slots.`);
    }

    const megaParticipants = interaction.participants.filter(
      (participant) => participant.state === "mega",
    );
    if (megaParticipants.length > 1) {
      errors.push(
        `${interactionPath} cannot activate more than one Mega Evolution.`,
      );
    }

    interaction.participants.forEach((participant, participantIndex) => {
      const participantPath = `${interactionPath}.participants[${participantIndex}]`;
      if (
        plan &&
        !plan.lineupSlotIndexes.includes(participant.slotIndex)
      ) {
        errors.push(`${participantPath}.slotIndex must be part of the lineup.`);
      }

      if (participant.moveIds.length > 4) {
        errors.push(`${participantPath}.moveIds must contain at most 4 entries.`);
      }
      if (participant.abilityIds.length > 1) {
        errors.push(`${participantPath}.abilityIds must contain at most 1 entry.`);
      }
      if (participant.itemIds.length > 1) {
        errors.push(`${participantPath}.itemIds must contain at most 1 entry.`);
      }

      const set = setBySlot.get(participant.slotIndex);
      if (!set) {
        errors.push(`${participantPath}.slotIndex references an unknown set.`);
        return;
      }

      const state = getSetState(set, participant.state);
      if (!state) {
        errors.push(
          `${participantPath}.state records a Mega form unavailable to this set.`,
        );
      }

      validateBoundIds(
        participant.moveIds,
        `${participantPath}.moveIds`,
        set.moves.map((move) => move.id),
        errors,
      );
      validateBoundIds(
        participant.abilityIds,
        `${participantPath}.abilityIds`,
        [state?.ability ?? null],
        errors,
      );
      validateBoundIds(
        participant.itemIds,
        `${participantPath}.itemIds`,
        [set.item],
        errors,
      );

      participant.moveIds.forEach((moveId) => {
        const hasMatchingAction = plan?.actions.some(
          (action) =>
            action.actorSlotIndex === participant.slotIndex &&
            normalizeId(action.moveId) === normalizeId(moveId) &&
            action.activeSlotIndexes.includes(participant.slotIndex) &&
            (!isSimultaneousInteraction ||
              (action.phase === interaction.phase &&
                hasSameMembers(
                  action.activeSlotIndexes,
                  interaction.activeSlotIndexes,
                ))),
        );

        if (!hasMatchingAction) {
          errors.push(
            isSimultaneousInteraction
              ? `${participantPath}.moveIds must reference an action in the same plan, phase, and active state.`
              : `${participantPath}.moveIds must reference an action by the same owner in the referenced plan.`,
          );
        }
      });
    });

    if (isSimultaneousInteraction) {
      interaction.participants.forEach((participant, participantIndex) => {
        if (!interaction.activeSlotIndexes.includes(participant.slotIndex)) {
          errors.push(
            `${interactionPath}.participants[${participantIndex}].slotIndex must be active for a simultaneous interaction.`,
          );
        }
      });
    }

    validateInteractionKind(interaction, interactionPath, errors);
  });

  const factIds = validateFactsForRequest(facts, request, setBySlot, errors);
  validateRecommendationEvidenceForRequest(
    output,
    {
      planIds,
      interactionIds,
      factIds,
      candidateFactIds: new Set(),
    },
    errors,
  );
  validateNegativeDefensiveClaims(output, request, null, "Team", errors);

  return errors;
}
