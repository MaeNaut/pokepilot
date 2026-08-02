import type { CopilotAnalysisRequest } from "./copilotAnalysis";
import type { CopilotGroundedModelOutput } from "./copilotModelContract";

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

export function validateCopilotStrategyAuditForRequest(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
) {
  const errors: string[] = [];
  const plans = output.strategyAudit.plans;

  if (request.scope === "pokemon") {
    if (plans.length > 0) {
      errors.push("Pokemon-scope analysis must not include team strategy plans.");
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

  return errors;
}
