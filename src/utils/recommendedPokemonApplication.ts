import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
} from "../types";
import type { TeamBuildState } from "./teamBuildState";
import {
  validateTeam,
  type TeamValidityResult,
  type ValidityIssue,
  type ValidityIssueCode,
} from "./teamValidity";

export type RecommendedPokemonApplyResult =
  | { status: "applied" }
  | {
      status: "blocked";
      reason: "stale" | "invalid" | "legality-unavailable" | "load-failed";
      issueCodes: ValidityIssueCode[];
    };

export type RecommendedPokemonApplicationValidation =
  | {
      status: "valid";
      proposedTeam: TeamSlot[];
      validity: TeamValidityResult;
      issues: [];
    }
  | {
      status: "blocked";
      reason: "stale-target" | "invalid" | "legality-unavailable";
      proposedTeam: TeamSlot[];
      validity: TeamValidityResult | null;
      issues: ValidityIssue[];
    };

type ValidateRecommendedPokemonApplicationInput = {
  currentTeam: TeamSlot[];
  slotIndex: number;
  candidate: TeamMember;
  proposedBuildState: TeamBuildState;
  legality: ShowdownLegalitySnapshot | null;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
};

function getIssueSlotNumbers(issue: ValidityIssue) {
  const slots = issue.values?.slots;

  if (typeof slots !== "string") {
    return [];
  }

  return slots
    .split(",")
    .map((slot) => Number.parseInt(slot.trim(), 10))
    .filter(Number.isFinite);
}

function getTeamIssuesForSlot(
  validity: TeamValidityResult,
  slotIndex: number,
) {
  const displayedSlotNumber = slotIndex + 1;
  return validity.teamIssues.filter((issue) =>
    getIssueSlotNumbers(issue).includes(displayedSlotNumber),
  );
}

export function validateRecommendedPokemonApplication({
  currentTeam,
  slotIndex,
  candidate,
  proposedBuildState,
  legality,
  pokemonIndex,
  itemIndex,
}: ValidateRecommendedPokemonApplicationInput): RecommendedPokemonApplicationValidation {
  const proposedTeam = currentTeam.map((member, index) =>
    index === slotIndex ? candidate : member,
  );

  if (
    slotIndex < 0 ||
    slotIndex >= currentTeam.length ||
    currentTeam[slotIndex]
  ) {
    return {
      status: "blocked",
      reason: "stale-target",
      proposedTeam,
      validity: null,
      issues: [],
    };
  }

  const validity = validateTeam(
    proposedTeam,
    proposedBuildState,
    legality,
    pokemonIndex,
    itemIndex,
  );
  const slotIssues = validity.slotResults[slotIndex]?.issues ?? [];
  const issues = [
    ...slotIssues,
    ...getTeamIssuesForSlot(validity, slotIndex),
  ];

  if (issues.some((issue) => issue.severity === "error")) {
    return {
      status: "blocked",
      reason: "invalid",
      proposedTeam,
      validity,
      issues,
    };
  }

  if (issues.some((issue) => issue.severity === "unavailable")) {
    return {
      status: "blocked",
      reason: "legality-unavailable",
      proposedTeam,
      validity,
      issues,
    };
  }

  return {
    status: "valid",
    proposedTeam,
    validity,
    issues: [],
  };
}
