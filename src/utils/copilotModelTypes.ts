import type { CopilotAnalysisResponse } from "./copilotContracts.js";

export type CopilotModelOutput = Omit<CopilotAnalysisResponse, "source">;

export const copilotStrategyPhases = ["opening", "midgame", "endgame"] as const;
export const copilotStrategyPokemonStates = ["current", "mega"] as const;
export const copilotStrategyInteractionKinds = [
  "ally-target",
  "shared-move",
  "move-ability",
  "move-item",
  "field-control",
  "positioning",
  "deception",
  "other",
] as const;
export const copilotStrategyFactKinds = [
  "move-owner",
  "ability-owner",
  "item-owner",
  "mega-option",
  "weak-to",
  "resists",
  "immune-to",
  "faster-than",
  "slower-than",
  "speed-tie",
] as const;
export const copilotRecommendationCandidateFactKinds = [
  "type",
  "ability",
  "common-move",
  "common-item",
  "common-nature",
  "speed-tier",
  "usage-rank",
  "requires-mega-stone",
  "responsibility",
  "weak-to",
  "resists-team-threat",
  "amplifies-team-threat",
  "adds-unanswered-weakness",
  "covers-type",
  "role-contribution",
  "role-redundancy",
  "concept-synergy",
  "missing-concept-synergy",
  "conflict",
] as const;

export type CopilotStrategyPhase = (typeof copilotStrategyPhases)[number];

export type CopilotStrategyAction = {
  phase: CopilotStrategyPhase;
  actorSlotIndex: number;
  moveId: string;
  activeSlotIndexes: number[];
};

export type CopilotStrategyPlan = {
  id: string;
  lineupSlotIndexes: number[];
  leadSlotIndexes: number[];
  backlineSlotIndexes: number[];
  actions: CopilotStrategyAction[];
};

export type CopilotStrategyPokemonState =
  (typeof copilotStrategyPokemonStates)[number];

export type CopilotStrategyInteractionKind =
  (typeof copilotStrategyInteractionKinds)[number];

export type CopilotStrategyInteractionParticipant = {
  slotIndex: number;
  state: CopilotStrategyPokemonState;
  moveIds: string[];
  abilityIds: string[];
  itemIds: string[];
};

export type CopilotStrategyInteraction = {
  id: string;
  planId: string;
  kind: CopilotStrategyInteractionKind;
  phase: CopilotStrategyPhase;
  activeSlotIndexes: number[];
  participants: CopilotStrategyInteractionParticipant[];
};

export type CopilotStrategyFactKind =
  (typeof copilotStrategyFactKinds)[number];

export type CopilotStrategyFact = {
  id: string;
  kind: CopilotStrategyFactKind;
  subjectSlotIndex: number;
  objectSlotIndex: number;
  state: CopilotStrategyPokemonState;
  valueId: string;
};

export type CopilotRecommendationCandidateFactKind =
  (typeof copilotRecommendationCandidateFactKinds)[number];

export type CopilotRecommendationCandidateFact = {
  id: string;
  candidateId: string;
  kind: CopilotRecommendationCandidateFactKind;
  valueId: string;
};

export type CopilotRecommendationEvidence = {
  recommendationId: string;
  planIds: string[];
  interactionIds: string[];
  factIds: string[];
  candidateFactIds: string[];
};

export type CopilotStrategyAudit = {
  plans: CopilotStrategyPlan[];
  interactions: CopilotStrategyInteraction[];
  facts: CopilotStrategyFact[];
  candidateFacts: CopilotRecommendationCandidateFact[];
  recommendationEvidence: CopilotRecommendationEvidence[];
};

export type CopilotGroundedModelOutput = {
  analysis: CopilotModelOutput;
  strategyAudit: CopilotStrategyAudit;
};

export type CopilotModelOutputValidation =
  | { success: true; data: CopilotModelOutput; errors: [] }
  | { success: false; data: null; errors: string[] };

export type CopilotGroundedModelOutputValidation =
  | { success: true; data: CopilotGroundedModelOutput; errors: [] }
  | { success: false; data: null; errors: string[] };
