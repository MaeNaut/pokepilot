import { normalizeShowdownId } from "../api/showdownIds";
import { pokemonTypes, type PokemonType } from "../types";
import type { CopilotAnalysisRequest } from "./copilotContracts";
import { inferCopilotResponsibilities, type CopilotResponsibilityId } from "./copilotResponsibilities";
import type { CopilotRecommendationCandidateSnapshot, PokemonRecommendationCommonSet } from "./pokemonRecommendations";
import { getDefensiveMultiplier } from "./teamDiagnostics";

type SetSnapshot = CopilotAnalysisRequest["sets"][number];
type Context = Pick<CopilotAnalysisRequest, "mechanics" | "battleFormat"> & {
  sets: Array<Pick<SetSnapshot, "slotIndex" | "item" | "ability"> & {
    moves: Array<Pick<SetSnapshot["moves"][number], "id" | "category" | "type">>;
    megaEvolution?: Pick<NonNullable<SetSnapshot["megaEvolution"]>, "ability"> | null;
  }>;
};
type Move = Pick<PokemonRecommendationCommonSet["moves"][number], "category" | "type">;

const doublesOnlyRoles = new Set<CopilotResponsibilityId>([
  "attack-redirection", "ally-damage-reduction", "ally-damage-amplification",
  "spread-protection", "ally-recovery",
]);

function coveredTypes(moves: Move[]): PokemonType[] {
  return pokemonTypes.filter((type) => moves.some((move) =>
    ["physical", "special"].includes(move.category.toLowerCase()) &&
    getDefensiveMultiplier(move.type, [type]) > 1,
  ));
}

// Curate only the request payload. The full observed usage remains available to
// sample optimization, and the compact serializer stays lossless.
export function selectRecommendationUsageOptions(
  candidates: CopilotRecommendationCandidateSnapshot[],
  { sets, mechanics, battleFormat }: Context,
): CopilotRecommendationCandidateSnapshot[] {
  const moveMechanics = new Map(mechanics.moves.map((move) => [normalizeShowdownId(move.id), move]));
  const abilityMechanics = new Map(mechanics.abilities.map((ability) => [normalizeShowdownId(ability.id), ability]));
  const teamRoles = new Map(sets.map((set) => [set.slotIndex, inferCopilotResponsibilities({
    abilities: [set.ability, set.megaEvolution?.ability].flatMap((ability) => ability
      ? [abilityMechanics.get(normalizeShowdownId(ability)) ?? { id: ability }] : []),
    moves: set.moves.map((move) => moveMechanics.get(normalizeShowdownId(move.id)) ?? move),
  })]));

  return candidates.map((candidate) => {
    const usage = candidate.usageOptions;
    if (!usage) return candidate;
    const representative = { ...candidate };
    delete representative.usageOptions;
    const common = candidate.commonSet;
    if (!common) return representative;
    const teammates = sets.filter((set) => candidate.target.mode !== "replacement" || set.slotIndex !== candidate.target.slotIndex);
    const roles = new Set([...candidate.responsibilityIds, ...teammates.flatMap((set) => teamRoles.get(set.slotIndex) ?? [])]);
    const coverage = new Set(coveredTypes([...common.moves, ...teammates.flatMap((set) => set.moves)]));
    const seenMoves = new Set(common.moves.map((move) => normalizeShowdownId(move.id)));
    const options = usage.alternativeMoves.filter((move) => {
      const id = normalizeShowdownId(move.id);
      if (seenMoves.has(id)) return false;
      seenMoves.add(id);
      return true;
    }).map((move) => ({
      move,
      roles: inferCopilotResponsibilities({ moves: [move] }).filter((role) => battleFormat === "doubles" || !doublesOnlyRoles.has(role)),
      coverage: coveredTypes([move]),
    }));
    const alternativeMoves: typeof usage.alternativeMoves = [];
    while (alternativeMoves.length < 3 && options.length) {
      const ranked = options.map((option) => ({
        option,
        roles: option.roles.filter((role) => !roles.has(role)),
        coverage: option.coverage.filter((type) => !coverage.has(type)),
      })).sort((a, b) => b.roles.length - a.roles.length || b.coverage.length - a.coverage.length ||
        (b.option.move.usagePercent ?? -1) - (a.option.move.usagePercent ?? -1));
      const best = ranked[0];
      if (!best.roles.length && !best.coverage.length) break;
      alternativeMoves.push(best.option.move);
      best.roles.forEach((role) => roles.add(role));
      best.coverage.forEach((type) => coverage.add(type));
      options.splice(options.indexOf(best.option), 1);
    }

    const heldItems = new Set(teammates.flatMap((set) => set.item ? [normalizeShowdownId(set.item)] : []));
    const commonItem = normalizeShowdownId(common.item ?? "");
    const seenItems = new Set([commonItem, ...heldItems]);
    const items = !candidate.requiresMegaStone && (!commonItem || heldItems.has(commonItem))
      ? usage.items.filter((item) => {
          const id = normalizeShowdownId(item.id);
          if (seenItems.has(id)) return false;
          seenItems.add(id);
          return true;
        }).slice(0, 2)
      : [];
    if (!alternativeMoves.length && !items.length) return representative;
    return { ...representative, usageOptions: { ...usage, alternativeMoves, items, natures: [], statPointSpreads: [] } };
  });
}
