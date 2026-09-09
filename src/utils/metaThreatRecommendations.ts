import type { ShowdownDataSnapshot } from "../api/showdownData";
import type { SmogonUsageSet } from "../api/smogonUsage";
import { normalizeShowdownId } from "../api/showdownIds";
import type { ItemIndexEntry } from "../types";
import {
  createMetaThreatUsageSide,
  type MetaThreatAnalysisPlan,
} from "../calculator/metaThreatAnalysis";
import {
  getCalculatorSpeed,
} from "../calculator/calculatorViewModel";
import { resolveAutomaticEnvironment } from "../calculator/automaticEnvironment";
import {
  createTeamMatchupPlan,
  type TeamMatchupMemberPlan,
} from "../calculator/teamMatchup";
import { getPokemonLookupAliases } from "./pokemonAliases";
import type { CopilotRecommendationCandidateSnapshot } from "./pokemonRecommendations";

const META_REPLACEMENT_CANDIDATE_LIMIT = 3;

export type MetaThreatReplacementCandidate = {
  candidate: CopilotRecommendationCandidateSnapshot;
  threatUsageRank: number;
  threatPokemonId: string;
  threatDisplayName: string;
  member: TeamMatchupMemberPlan;
};

function findUsageSet(
  candidate: CopilotRecommendationCandidateSnapshot,
  usageSets: SmogonUsageSet[],
) {
  const aliases = new Set(
    getPokemonLookupAliases(candidate.pokemonId).map(normalizeShowdownId),
  );
  return usageSets.find(({ pokemonId }) =>
    aliases.has(normalizeShowdownId(pokemonId)),
  );
}

function createReplacementEvidence({
  candidate,
  threat,
  usageSets,
  showdownData,
  itemIndex,
}: {
  candidate: CopilotRecommendationCandidateSnapshot;
  threat: Extract<MetaThreatAnalysisPlan, { status: "ready" }>["threats"][number];
  usageSets: SmogonUsageSet[];
  showdownData: ShowdownDataSnapshot;
  itemIndex: ItemIndexEntry[];
}): MetaThreatReplacementCandidate | null {
  if (candidate.target.mode !== "replacement") return null;
  const usageSet = findUsageSet(candidate, usageSets);
  if (!usageSet) return null;
  const usageSide = createMetaThreatUsageSide(usageSet, showdownData, itemIndex);
  const opponent = threat.context.opponent;
  if (!usageSide?.member || !opponent.member) return null;
  const replacementMember = usageSide.member;
  const opponentMember = opponent.member;

  const replacement = {
    ...usageSide,
    slotIndex: candidate.target.slotIndex,
  };
  const environment = resolveAutomaticEnvironment({
    player: {
      identity: replacementMember.id,
      ability: replacement.build.ability,
      speed: getCalculatorSpeed(replacementMember, replacement.build, 0),
    },
    opponent: {
      identity: opponentMember.id,
      ability: opponent.build.ability,
      speed: getCalculatorSpeed(opponentMember, opponent.build, 0),
    },
  });
  const matchup = createTeamMatchupPlan({
    ...threat.context,
    selectedSlot: replacement.slotIndex,
    player: replacement,
    roster: [replacement],
    field: {
      ...threat.context.field,
      ...environment,
    },
  });
  if (matchup.status !== "ready") return null;
  const member = matchup.members.find(
    ({ slotIndex }) => slotIndex === replacement.slotIndex,
  );
  if (!member || member.responseTier === "limited") return null;

  return {
    candidate,
    threatUsageRank: threat.usageRank,
    threatPokemonId: opponentMember.id,
    threatDisplayName: threat.matchup.opponentName,
    member,
  };
}

export function selectMetaThreatReplacementCandidates({
  plan,
  candidates,
  usageSets,
  showdownData,
  itemIndex,
}: {
  plan: MetaThreatAnalysisPlan;
  candidates: CopilotRecommendationCandidateSnapshot[];
  usageSets: SmogonUsageSet[];
  showdownData: ShowdownDataSnapshot;
  itemIndex: ItemIndexEntry[];
}): MetaThreatReplacementCandidate[] {
  if (plan.status !== "ready") return [];
  const threat = plan.threats.find(
    ({ riskSignals }) =>
      riskSignals.answerCount === 0 && riskSignals.checkCount === 0,
  );
  if (!threat) return [];

  return candidates
    .flatMap((candidate) => {
      const evidence = createReplacementEvidence({
        candidate,
        threat,
        usageSets,
        showdownData,
        itemIndex,
      });
      return evidence ? [evidence] : [];
    })
    .sort((left, right) => {
      if (left.member.responseTier !== right.member.responseTier) {
        return left.member.responseTier === "answer" ? -1 : 1;
      }
      return candidates.indexOf(left.candidate) - candidates.indexOf(right.candidate);
    })
    .slice(0, META_REPLACEMENT_CANDIDATE_LIMIT);
}
