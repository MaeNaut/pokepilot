import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import type { CopilotGroundedModelOutput } from "./copilotModelTypes.js";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds.js";
import {
  getSetState,
  hasDuplicates,
  hasSameMembers,
  validateBoundIds,
  validateFactsForRequest,
  validateInteractionKind,
  validateRecommendationEvidenceForRequest,
  validateSlotList,
} from "./copilotStrategyAuditCore.js";
import {
  validateCandidateFactsForRequest,
  validateNegativeDefensiveClaims,
  validatePokemonRecommendationEvidenceCoverage,
  validateRecommendationCandidateEvidenceCoverage,
} from "./copilotStrategyAuditCandidateValidation.js";

export {
  completeCopilotRecommendationAudit,
  completeCopilotStrategyAudit,
} from "./copilotStrategyAuditCompletion.js";

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

  if (request.scope === "optimization") {
    if (
      plans.length > 0 ||
      interactions.length > 0 ||
      facts.length > 0 ||
      candidateFacts.length > 0 ||
      recommendationEvidence.length > 0
    ) {
      errors.push("Optimization analysis must use an empty private strategy audit.");
    }

    return errors;
  }

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
