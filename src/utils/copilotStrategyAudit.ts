import type { CopilotAnalysisRequest } from "./copilotAnalysis";
import type {
  CopilotGroundedModelOutput,
  CopilotStrategyFact,
  CopilotStrategyInteraction,
  CopilotStrategyPokemonState,
} from "./copilotModelContract";

function normalizeId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

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

export function validateCopilotStrategyAuditForRequest(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
) {
  const errors: string[] = [];
  const { plans, interactions, facts, recommendationEvidence } =
    output.strategyAudit;

  if (request.scope !== "team") {
    if (plans.length > 0) {
      errors.push("Non-team analysis must not include team strategy plans.");
    }
    if (interactions.length > 0 || facts.length > 0) {
      errors.push("Non-team analysis must not include team audit evidence.");
    }
    if (recommendationEvidence.length > 0) {
      errors.push(
        "Non-team analysis must not include team recommendation evidence.",
      );
    }

    return errors;
  }

  if (request.sets.length === 0) {
    if (
      plans.length > 0 ||
      interactions.length > 0 ||
      facts.length > 0 ||
      recommendationEvidence.length > 0
    ) {
      errors.push("An empty team must use an empty private strategy audit.");
    }

    return errors;
  }

  const setBySlot = new Map(request.sets.map((set) => [set.slotIndex, set]));
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

  if (facts.length > 24) {
    errors.push("strategyAudit.facts must contain at most 24 entries.");
  }

  const factIds = new Set<string>();
  const unaryFactKinds = new Set([
    "move-owner",
    "ability-owner",
    "item-owner",
    "mega-option",
    "weak-to",
    "resists",
    "immune-to",
  ]);
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

    if (unaryFactKinds.has(fact.kind) && fact.objectSlotIndex !== -1) {
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

      const subjectSpeed = subject.stats.speed;
      const objectSpeed = object.stats.speed;
      const isCorrect =
        (fact.kind === "faster-than" && subjectSpeed > objectSpeed) ||
        (fact.kind === "slower-than" && subjectSpeed < objectSpeed) ||
        (fact.kind === "speed-tie" && subjectSpeed === objectSpeed);
      if (!isCorrect) {
        errors.push(`${factPath} contradicts the supplied final Speed values.`);
      }
    }
  });

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

    for (const [key, values, knownIds] of [
      ["planIds", evidence.planIds, planIds],
      ["interactionIds", evidence.interactionIds, interactionIds],
      ["factIds", evidence.factIds, factIds],
    ] as const) {
      if (hasDuplicateIds(values)) {
        errors.push(`${evidencePath}.${key} must not contain duplicate IDs.`);
      }
      const unknownIds = values.filter((id) => !knownIds.has(id));
      if (unknownIds.length > 0) {
        errors.push(`${evidencePath}.${key} references unknown IDs.`);
      }
    }

    if (
      evidence.planIds.length === 0 &&
      evidence.interactionIds.length === 0 &&
      evidence.factIds.length === 0
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

  return errors;
}
