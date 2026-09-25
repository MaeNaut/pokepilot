import { normalizeShowdownId } from "../api/showdownIds.js";
import type { CopilotAnalysisRequest } from "./copilotContracts.js";
import { hasValidCandidateFilterShape, hasValidRecommendationCandidateShape } from "./copilotRequestCandidateValidation.js";
import { hasValidMatchupShape } from "./copilotRequestMatchupValidation.js";
import { hasValidOptimizationShape } from "./copilotRequestOptimizationValidation.js";
import { hasValidMegaOptionShape, hasValidSetShape } from "./copilotRequestSetValidation.js";
import { hasValidDiagnostics, hasValidMechanicsShape, hasValidTactics, hasValidTypeLabels } from "./copilotRequestTeamValidation.js";
import { hasUniqueSlots, isSlotIndex, validateBoundedStructure } from "./copilotRequestValidationPrimitives.js";
import { isRecord } from "./typeGuards.js";

export { isValidCopilotOptimizationCandidateSnapshot } from "./copilotRequestOptimizationValidation.js";

export type CopilotRequestValidation =
  | { success: true; data: CopilotAnalysisRequest; errors: [] }
  | { success: false; data: null; errors: string[] };

const requestKeys = new Set([
  "version",
  "locale",
  "scope",
  "battleFormat",
  "teamName",
  "selectedSlot",
  "typeLabels",
  "sets",
  "megaOptions",
  "candidateFilters",
  "recommendationCandidates",
  "optimization",
  "matchup",
  "mechanics",
  "tactics",
  "diagnostics",
]);

export function validateCopilotAnalysisRequest(
  value: unknown,
): CopilotRequestValidation {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      success: false,
      data: null,
      errors: ["Analysis request must be a JSON object."],
    };
  }

  const unexpectedKeys = Object.keys(value).filter((key) => !requestKeys.has(key));
  if (unexpectedKeys.length > 0) {
    errors.push(`Unexpected request fields: ${unexpectedKeys.join(", ")}.`);
  }

  if (value.version !== 34 && value.version !== 35) {
    errors.push("version must be 34 or 35.");
  }
  if (value.locale !== "en" && value.locale !== "ko") {
    errors.push("locale must be en or ko.");
  }
  if (
    value.scope !== "team" &&
    value.scope !== "pokemon" &&
    value.scope !== "recommendation" &&
    value.scope !== "optimization" &&
    value.scope !== "matchup"
  ) {
    errors.push("scope must be team, pokemon, recommendation, optimization, or matchup.");
  }
  if (value.battleFormat !== "singles" && value.battleFormat !== "doubles") {
    errors.push("battleFormat must be singles or doubles.");
  }
  if (
    typeof value.teamName !== "string" ||
    value.teamName.length === 0 ||
    value.teamName.length > 100
  ) {
    errors.push("teamName must contain 1 to 100 characters.");
  }
  if (!isSlotIndex(value.selectedSlot)) {
    errors.push("selectedSlot must be an integer from 0 to 5.");
  }
  if (!hasValidTypeLabels(value.typeLabels)) {
    errors.push("typeLabels must contain one localized label for every type.");
  }

  const setsAreValid =
    Array.isArray(value.sets) &&
    value.sets.length <= 6 &&
    value.sets.every(hasValidSetShape) &&
    hasUniqueSlots(value.sets);
  if (!setsAreValid) {
    const invalidSetIndexes = Array.isArray(value.sets)
      ? value.sets.flatMap((set, index) =>
          hasValidSetShape(set) ? [] : [index],
        )
      : [];
    errors.push(
      invalidSetIndexes.length > 0
        ? `sets contain invalid snapshots at indexes ${invalidSetIndexes.join(", ")}.`
        : "sets must contain at most six valid snapshots with unique slots.",
    );
  }

  const megaOptionsAreValid =
    Array.isArray(value.megaOptions) &&
    value.megaOptions.length <= 6 &&
    value.megaOptions.every(hasValidMegaOptionShape) &&
    hasUniqueSlots(value.megaOptions);
  if (!megaOptionsAreValid) {
    errors.push("megaOptions must contain at most six valid entries with unique slots.");
  }

  const candidateFiltersAreValid =
    Array.isArray(value.candidateFilters) &&
    value.candidateFilters.length <= 6 &&
    value.candidateFilters.every(hasValidCandidateFilterShape) &&
    hasUniqueSlots(value.candidateFilters);
  if (!candidateFiltersAreValid) {
    errors.push("candidateFilters must contain at most six valid entries with unique slots.");
  }

  if (
    !Array.isArray(value.recommendationCandidates) ||
    value.recommendationCandidates.length > 30 ||
    !value.recommendationCandidates.every(hasValidRecommendationCandidateShape)
  ) {
    errors.push(
      "recommendationCandidates must contain at most thirty valid candidates.",
    );
  }
  if (
    value.scope !== "recommendation" &&
    value.scope !== "matchup" &&
    Array.isArray(value.recommendationCandidates) &&
    value.recommendationCandidates.length > 0
  ) {
    errors.push(
      "recommendationCandidates must be empty outside recommendation and matchup scopes.",
    );
  }
  if (
    (value.scope === "recommendation" || value.scope === "matchup") &&
    setsAreValid &&
    Array.isArray(value.recommendationCandidates) &&
    value.recommendationCandidates.every(hasValidRecommendationCandidateShape)
  ) {
    const candidates = value.recommendationCandidates as
      CopilotAnalysisRequest["recommendationCandidates"];
    const sets = value.sets as CopilotAnalysisRequest["sets"];
    if (
      value.scope === "matchup" &&
      candidates.length > 0 &&
      (candidates.length > 3 ||
        !isRecord(value.matchup) ||
        value.matchup.mode !== "meta" ||
        candidates.some(({ target }) => target.mode !== "replacement"))
    ) {
      errors.push(
        "meta matchup recommendationCandidates must contain at most three replacements.",
      );
    }
    const candidateIds = candidates.map((candidate) =>
      String(candidate.pokemonId),
    );
    if (new Set(candidateIds).size !== candidateIds.length) {
      errors.push("recommendationCandidates must use unique pokemonId values.");
    }

    const modes = new Set(
      candidates.map((candidate) =>
        String(candidate.target.mode),
      ),
    );
    if (modes.size > 1) {
      errors.push("recommendationCandidates must use one recommendation mode.");
    }

    for (const candidate of candidates) {
      const targetSet = sets.find(
        (set) => set.slotIndex === candidate.target.slotIndex,
      );
      if (candidate.target.mode === "addition" && targetSet) {
        errors.push("Addition recommendation targets must be empty slots.");
        break;
      }
      if (
        candidate.target.mode === "addition" &&
        ((candidate.target.currentRoleIds?.length ?? 0) > 0 ||
          (candidate.target.currentSetterConceptIds?.length ?? 0) > 0 ||
          (candidate.target.currentAceConceptIds?.length ?? 0) > 0 ||
          (candidate.target.currentResponsibilityIds?.length ?? 0) > 0 ||
          (candidate.target.currentSupportElements?.length ?? 0) > 0 ||
          candidate.target.megaOptionPokemonId !== null ||
          (candidate.target.allySupportLinks?.length ?? 0) > 0)
      ) {
        errors.push("Addition recommendation targets must not report replacement losses.");
        break;
      }
      if (
        candidate.target.mode === "replacement" &&
        (!targetSet || targetSet.pokemonId !== candidate.target.currentPokemonId)
      ) {
        errors.push(
          "Replacement recommendation targets must match the current set.",
        );
        break;
      }
      if (candidate.target.mode !== "replacement" || !targetSet) continue;

      const hasSameValues = (left: readonly string[], right: readonly string[]) =>
        left.length === right.length && left.every((entry) => right.includes(entry));
      if (
        !hasSameValues(candidate.target.currentRoleIds ?? [], targetSet.roleIds) ||
        !hasSameValues(
          candidate.target.currentSetterConceptIds ?? [],
          targetSet.setterConceptIds,
        ) ||
        !hasSameValues(
          candidate.target.currentAceConceptIds ?? [],
          targetSet.aceConceptIds,
        )
      ) {
        errors.push("Replacement target roles and concepts must match the current set.");
        break;
      }

      const expectedMegaOptionId = targetSet.isMegaForm
        ? targetSet.pokemonId
        : targetSet.megaEvolution?.pokemonId ?? null;
      if (candidate.target.megaOptionPokemonId !== expectedMegaOptionId) {
        errors.push("Replacement target Mega option must match the current set.");
        break;
      }

      const hasInvalidTargetSupportElement =
        candidate.target.currentSupportElements.some((element) =>
          element.kind === "move"
            ? !targetSet.moves.some(
                (move) =>
                  normalizeShowdownId(move.id) === normalizeShowdownId(element.id),
              )
            : normalizeShowdownId(targetSet.ability ?? "") !==
              normalizeShowdownId(element.id),
        );
      if (hasInvalidTargetSupportElement) {
        errors.push("Replacement target support elements must use selected elements.");
        break;
      }

      const hasInvalidSupportLink = (candidate.target.allySupportLinks ?? []).some(
        (link) => {
          if (link.sourceSlotIndex === candidate.target.slotIndex) return true;
          const sourceSet = sets.find(
            (set) => set.slotIndex === link.sourceSlotIndex,
          );
          if (!sourceSet) return true;
          return link.sourceKind === "move"
            ? !sourceSet.moves.some(
                (move) =>
                  normalizeShowdownId(move.id) ===
                  normalizeShowdownId(link.sourceId),
              )
            : normalizeShowdownId(sourceSet.ability ?? "") !==
                normalizeShowdownId(link.sourceId);
        },
      );
      if (hasInvalidSupportLink) {
        errors.push("Replacement target ally support links must use selected elements.");
        break;
      }
    }
  }
  if (
    value.optimization !== undefined &&
    value.optimization !== null &&
    !hasValidOptimizationShape(value.optimization)
  ) {
    errors.push("optimization must match the sample recommendation contract.");
  }
  if (value.scope === "optimization" && !hasValidOptimizationShape(value.optimization)) {
    errors.push("optimization scope requires verified sample candidates.");
  }
  if (
    value.scope !== "optimization" &&
    value.scope !== "matchup" &&
    value.optimization !== undefined &&
    value.optimization !== null
  ) {
    errors.push("optimization must be null outside optimization scope.");
  }
  if (
    value.matchup !== undefined &&
    value.matchup !== null &&
    !hasValidMatchupShape(value.matchup)
  ) {
    errors.push("matchup must match the verified exact or meta threat contract.");
  }
  if (value.scope === "matchup" && !hasValidMatchupShape(value.matchup)) {
    errors.push("matchup scope requires verified team matchup evidence.");
  }
  if (
    value.scope !== "matchup" &&
    value.matchup !== undefined &&
    value.matchup !== null
  ) {
    errors.push("matchup must be null outside matchup scope.");
  }
  if (!hasValidMechanicsShape(value.mechanics)) {
    errors.push("mechanics must contain bounded move, ability, and item arrays.");
  }
  if (value.version === 35 && !hasValidTactics(value.tactics)) {
    errors.push("tactics must contain bounded deterministic team relationships.");
  }
  if (value.version === 34 && "tactics" in value) {
    errors.push("version 34 must not contain tactics.");
  }
  if (!hasValidDiagnostics(value.diagnostics)) {
    errors.push("diagnostics must match the complete diagnostics contract.");
  }

  if (
    setsAreValid &&
    Array.isArray(value.sets) &&
    isRecord(value.diagnostics) &&
    value.diagnostics.filledSlots !== value.sets.length
  ) {
    errors.push("diagnostics.filledSlots must match the number of set snapshots.");
  }
  if (
    value.scope === "pokemon" &&
    setsAreValid &&
    Array.isArray(value.sets) &&
    !value.sets.some(
      (set) => isRecord(set) && set.slotIndex === value.selectedSlot,
    )
  ) {
    errors.push("pokemon scope requires a set in selectedSlot.");
  }
  if (
    (value.scope === "optimization" || value.scope === "matchup") &&
    isRecord(value.optimization) &&
    value.optimization.slotIndex !== value.selectedSlot &&
    !(
      value.scope === "matchup" &&
      isRecord(value.matchup) &&
      value.matchup.mode === "meta"
    )
  ) {
    errors.push("optimization slotIndex must match selectedSlot.");
  }
  if (
    (value.scope === "optimization" || value.scope === "matchup") &&
    isRecord(value.optimization)
  ) {
    const optimizationField = isRecord(value.optimization.field)
      ? value.optimization.field
      : null;

    if (
      value.optimization.field !== null &&
      optimizationField?.gameType !== value.battleFormat
    ) {
      errors.push("optimization field gameType must match battleFormat.");
    }
  }
  if (value.scope === "matchup" && isRecord(value.matchup)) {
    const setBySlot = new Map(
      Array.isArray(value.sets)
        ? value.sets.flatMap((set) =>
            isRecord(set) && isSlotIndex(set.slotIndex)
              ? [[set.slotIndex, set] as const]
              : [],
          )
        : [],
    );
    const matchupEntries = value.matchup.mode === "meta" &&
      Array.isArray(value.matchup.threats)
      ? value.matchup.threats.filter(isRecord)
      : [value.matchup];

    for (const matchupEntry of matchupEntries) {
      const matchupField = isRecord(matchupEntry.field)
        ? matchupEntry.field
        : null;
      if (matchupField?.gameType !== value.battleFormat) {
        errors.push("matchup field gameType must match battleFormat.");
        break;
      }

      const matchupMembers = Array.isArray(matchupEntry.members)
        ? matchupEntry.members
        : [];
      if (matchupMembers.some((member) => {
        if (!isRecord(member)) return true;
        const set = setBySlot.get(member.slotIndex);
        if (!set) return true;
        if (member.state === "current") {
          return set.pokemonId !== member.pokemonId;
        }

        return member.state !== "mega" ||
          !isRecord(set.megaEvolution) ||
          set.megaEvolution.pokemonId !== member.pokemonId;
      })) {
        errors.push("matchup members must match the supplied team sets.");
        break;
      }
    }

    if (value.matchup.mode === "meta") {
      const candidates = Array.isArray(value.recommendationCandidates)
        ? value.recommendationCandidates.filter(isRecord)
        : [];
      const evidence = Array.isArray(value.matchup.replacementEvidence)
        ? value.matchup.replacementEvidence.filter(isRecord)
        : [];
      const hasInvalidReplacementEvidence =
        candidates.length !== evidence.length ||
        new Set(evidence.map((entry) => entry.threatPokemonId)).size > 1 ||
        candidates.some((candidate) =>
          !evidence.some(
            (entry) =>
              entry.candidatePokemonId === candidate.pokemonId &&
              isRecord(candidate.target) &&
              entry.targetSlotIndex === candidate.target.slotIndex,
          ),
        ) ||
        evidence.some((entry) => {
          const threat = matchupEntries.find(
            (matchupEntry) =>
              isRecord(matchupEntry.opponent) &&
              matchupEntry.opponent.pokemonId === entry.threatPokemonId,
          );
          return !isRecord(threat) ||
            threat.answerCount !== 0 ||
            threat.checkCount !== 0;
        });
      if (hasInvalidReplacementEvidence) {
        errors.push(
          "meta matchup replacement candidates must match verified evidence for one structurally unanswered threat.",
        );
      }
    }

    if (
      value.matchup.mode === "exact" &&
      isRecord(value.optimization) &&
      isRecord(value.matchup.opponent) &&
      value.optimization.opponentPokemonId !== value.matchup.opponent.pokemonId
    ) {
      errors.push("optimization and matchup must use the same opponent.");
    }
    if (value.matchup.mode === "meta" && isRecord(value.optimization)) {
      const optimization = value.optimization;
      const optimizationOpponentId =
        typeof optimization.opponentPokemonId === "string"
        ? normalizeShowdownId(optimization.opponentPokemonId)
        : "";
      const optimizationPlayerId =
        typeof optimization.playerPokemonId === "string"
        ? normalizeShowdownId(optimization.playerPokemonId)
        : "";
      const matchingThreat = Array.isArray(value.matchup.threats)
        ? value.matchup.threats.find(
            (threat) =>
              isRecord(threat) &&
              isRecord(threat.opponent) &&
              typeof threat.opponent.pokemonId === "string" &&
              normalizeShowdownId(threat.opponent.pokemonId) ===
                optimizationOpponentId,
          )
        : undefined;
      const matchingMember =
        isRecord(matchingThreat) && Array.isArray(matchingThreat.members)
          ? matchingThreat.members.find(
              (member) =>
                isRecord(member) &&
                member.slotIndex === optimization.slotIndex &&
                typeof member.pokemonId === "string" &&
                normalizeShowdownId(member.pokemonId) === optimizationPlayerId,
            )
          : undefined;

      if (!matchingThreat || !matchingMember) {
        errors.push(
          "meta matchup optimization must target a retained member of the same threat.",
        );
      }
    }
  }

  validateBoundedStructure(value, "request", errors);

  if (errors.length > 0) {
    return { success: false, data: null, errors };
  }

  return { success: true, data: value as CopilotAnalysisRequest, errors: [] };
}
