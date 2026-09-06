import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import type {
  CopilotGroundedModelOutput,
  CopilotRecommendationCandidateFact,
  CopilotStrategyFact,
  CopilotStrategyPokemonState,
} from "./copilotModelTypes.js";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds.js";
import {
  getFactProfileValues,
  hasSameMembers,
  textMentionsDisplayName,
  unaryStrategyFactKinds,
  validateInteractionKind,
} from "./copilotStrategyAuditCore.js";
import {
  isCandidateFactSupported,
  matchesCandidateValue,
} from "./copilotStrategyAuditCandidateValidation.js";

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
