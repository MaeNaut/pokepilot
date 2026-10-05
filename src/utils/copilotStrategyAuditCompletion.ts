import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import type {
  CopilotGroundedModelOutput,
  CopilotRecommendationCandidateFact,
} from "./copilotModelTypes.js";
import { normalizeShowdownId as normalizeId } from "../api/showdownIds.js";
import {
  textMentionsDisplayName,
  unaryStrategyFactKinds,
} from "./copilotStrategyAuditCore.js";

function getRecommendationCandidateFactKey(
  candidateId: string,
  kind: CopilotRecommendationCandidateFact["kind"],
  valueId: string,
) {
  return `${normalizeId(candidateId)}:${kind}:${normalizeId(valueId)}`;
}

/**
 * Add exact request-backed element links without erasing or weakening model claims.
 * These links establish element presence, not the correctness of public prose.
 */
export function completeCopilotRecommendationAudit(
  output: CopilotGroundedModelOutput,
  request: CopilotAnalysisRequest,
): CopilotGroundedModelOutput {
  if (request.scope !== "recommendation") return output;

  const candidateFacts = output.strategyAudit.candidateFacts.map((fact) => ({ ...fact }));
  const recommendationEvidence = output.strategyAudit.recommendationEvidence.map(
    (evidence) => ({
      ...evidence,
      planIds: [...evidence.planIds],
      interactionIds: [...evidence.interactionIds],
      factIds: [...evidence.factIds],
      candidateFactIds: [...evidence.candidateFactIds],
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
      kind: "ability" | "mega-ability" | "common-move" | "usage-move" | "usage-item" | "usage-nature",
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
    for (const [kind, options] of [
      ["mega-ability", candidate.megaEvolution?.ability ? [candidate.megaEvolution.ability] : []],
      ["usage-move", candidate.usageOptions?.alternativeMoves],
      ["usage-item", candidate.usageOptions?.items],
      ["usage-nature", candidate.usageOptions?.natures],
    ] as const) {
      for (const option of options ?? []) {
        if (textMentionsDisplayName(recommendationText, option.displayName)) ensureFact(kind, option.id);
      }
    }

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

function textDiscussesSpeedOrder(text: string) {
  return /\b(?:fast|faster|slow|slower|speed|speed-tie|outspeed|before|after)\b|(?:\uBE60\uB974|\uB290\uB9AC|\uC2A4\uD53C\uB4DC|\uC18D\uB3C4|\uCD94\uC6D4|\uBA3C\uC800|\uB098\uC911)/i.test(
    text,
  );
}

/**
 * Link an existing exact Speed comparison without changing a fact's meaning.
 * Name mentions alone cannot justify changing its subject, relation, or state.
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
  const facts = output.strategyAudit.facts.map((fact) => ({ ...fact }));
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
 * Normalize only the unused comparison slot on unary facts. Unsupported claims
 * and action links must survive so validation can report them.
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

  return {
    ...normalizedOutput,
    strategyAudit: {
      ...normalizedOutput.strategyAudit,
      facts: normalizedOutput.strategyAudit.facts.map((fact) =>
        unaryStrategyFactKinds.has(fact.kind) && fact.objectSlotIndex !== -1
          ? { ...fact, objectSlotIndex: -1 }
          : fact,
      ),
    },
  };
}
