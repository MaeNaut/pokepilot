import type {
  CopilotDefensiveCoverage,
  CopilotSetSnapshot,
  CopilotTeamTacticsSnapshot,
} from "./copilotContracts";
import type { CopilotMechanicsSnapshot } from "./copilotMechanics";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { normalizeShowdownId } from "../api/showdownIds";

const allyTargetableMoves = new Set([
  "adjacent-ally",
  "adjacent-ally-or-self",
  "any-adjacent",
]);

function getItemSpeedMultiplier(
  set: CopilotSetSnapshot,
  mechanics: CopilotMechanicsSnapshot,
) {
  const itemId = normalizeShowdownId(set.item ?? "");
  const effect = mechanics.items.find(
    (item) => normalizeShowdownId(item.id) === itemId,
  )?.effect;
  const numericMatch = effect?.normalize("NFKC").replace(/\u00d7/g, "x").toLowerCase().match(
    /holder(?:'s|’s) speed is (\d+(?:\.\d+)?)x\b/,
  );
  if (numericMatch) {
    const multiplier = Number(numericMatch[1]);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }
  return /holder(?:'s|’s) speed is halved\b/i.test(effect ?? "") ? 0.5 : 1;
}

function supportsSharedMoveSequence(effect: string | undefined) {
  if (!effect) return false;
  return /\b(?:ally|another|other(?: pokemon)?|others)\b[\s\S]{0,100}\b(?:move|used|turn)\b|\b(?:move|used)\b[\s\S]{0,100}\b(?:ally|another|other(?: pokemon)?|others)\b/i.test(
    effect,
  );
}

function createDefensiveCoverage(sets: CopilotSetSnapshot[]) {
  const coverage: CopilotDefensiveCoverage[] = [];
  for (const protectedSet of sets) {
    for (const weakness of protectedSet.defensiveProfile.weaknesses) {
      for (const defenderSet of sets) {
        if (defenderSet.slotIndex === protectedSet.slotIndex) continue;
        const relation = defenderSet.defensiveProfile.immunities.some(
          (immunity) => immunity.type === weakness.type,
        )
          ? "immune"
          : defenderSet.defensiveProfile.resistances.some(
              (resistance) => resistance.type === weakness.type,
            )
            ? "resists"
            : null;
        if (relation) {
          coverage.push({
            protectedSlotIndex: protectedSet.slotIndex,
            defenderSlotIndex: defenderSet.slotIndex,
            type: weakness.type,
            relation,
          });
        }
      }
    }
  }
  return coverage;
}

/**
 * Converts selected-set mechanics into bounded, deterministic facts. It never
 * decides a lead, recipient, or strategic purpose for the model.
 */
export function createCopilotTeamTactics(
  sets: CopilotSetSnapshot[],
  mechanics: CopilotMechanicsSnapshot,
  battleFormat: BattleFormat,
): CopilotTeamTacticsSnapshot {
  const mechanicsByMoveId = new Map(
    mechanics.moves.map((move) => [normalizeShowdownId(move.id), move]),
  );
  const slotIndexes = sets.map((set) => set.slotIndex);
  const allyTargetOpportunities = battleFormat === "doubles"
    ? sets.flatMap((set) =>
        set.moves.flatMap((move) => {
          const mechanic = mechanicsByMoveId.get(normalizeShowdownId(move.id));
          if (!mechanic?.target || !allyTargetableMoves.has(mechanic.target)) {
            return [];
          }
          // Any selected status move may be deliberately aimed at an ally when
          // its Showdown target permits it. Direct ally targets are useful even
          // for non-status moves such as support attacks.
          if (
            move.category !== "status" &&
            mechanic.target !== "adjacent-ally" &&
            mechanic.target !== "adjacent-ally-or-self"
          ) {
            return [];
          }
          const targetSlotIndexes = slotIndexes.filter(
            (slotIndex) => slotIndex !== set.slotIndex,
          );
          return targetSlotIndexes.length > 0
            ? [{
                sourceSlotIndex: set.slotIndex,
                moveId: move.id,
                target: mechanic.target,
                targetSlotIndexes,
              }]
            : [];
        }),
      )
    : [];
  const setBySlot = new Map(sets.map((set) => [set.slotIndex, set]));
  const abilityById = new Map(
    mechanics.abilities.map((ability) => [normalizeShowdownId(ability.id), ability]),
  );
  const allyStatChangeInteractions = allyTargetOpportunities.flatMap(
    (opportunity) => {
      const move = mechanicsByMoveId.get(normalizeShowdownId(opportunity.moveId));
      const targetStatChanges = move?.targetStatChanges;
      if (!targetStatChanges?.length) return [];
      return opportunity.targetSlotIndexes.flatMap((targetSlotIndex) => {
        const targetSet = setBySlot.get(targetSlotIndex);
        if (!targetSet) return [];
        const abilityStates = [
          { abilityId: targetSet.ability, state: "current" as const },
          { abilityId: targetSet.megaEvolution?.ability ?? null, state: "mega" as const },
        ];
        return abilityStates.flatMap(({ abilityId, state }) => {
          const ability = abilityById.get(normalizeShowdownId(abilityId ?? ""));
          return ability?.statChangeMode
            ? [{
                sourceSlotIndex: opportunity.sourceSlotIndex,
                targetSlotIndex,
                moveId: opportunity.moveId,
                abilityId: ability.id,
                state,
                mode: ability.statChangeMode,
                targetStatChanges: targetStatChanges.map((change) => ({ ...change })),
              }]
            : [];
        });
      });
    },
  );

  const ownersByMoveId = new Map<string, number[]>();
  for (const set of sets) {
    for (const move of set.moves) {
      const moveId = normalizeShowdownId(move.id);
      const owners = ownersByMoveId.get(moveId) ?? [];
      owners.push(set.slotIndex);
      ownersByMoveId.set(moveId, owners);
    }
  }
  const sharedMoveSequences = [...ownersByMoveId.entries()].flatMap(
    ([moveId, ownerSlotIndexes]) => {
      const mechanic = mechanicsByMoveId.get(moveId);
      return ownerSlotIndexes.length >= 2 && supportsSharedMoveSequence(mechanic?.effect)
        ? [{ moveId, slotIndexes: ownerSlotIndexes }]
        : [];
    },
  );

  const fieldSetters = sets.flatMap((set) =>
    set.moves.flatMap((move) =>
      (mechanicsByMoveId.get(normalizeShowdownId(move.id))?.fieldEffects ?? []).map(
        (fieldEffect) => ({
          sourceSlotIndex: set.slotIndex,
          moveId: move.id,
          fieldEffect: { ...fieldEffect },
        }),
      ),
    ),
  );

  const unconditionalSpeedOrder = sets.flatMap((leftSet, leftIndex) =>
    sets.slice(leftIndex + 1).flatMap((rightSet) => {
      const leftSpeed = (leftSet.stats?.speed ?? 0) *
        getItemSpeedMultiplier(leftSet, mechanics);
      const rightSpeed = (rightSet.stats?.speed ?? 0) *
        getItemSpeedMultiplier(rightSet, mechanics);
      if (leftSpeed === rightSpeed) return [];
      return [{
        fasterSlotIndex: leftSpeed > rightSpeed ? leftSet.slotIndex : rightSet.slotIndex,
        slowerSlotIndex: leftSpeed > rightSpeed ? rightSet.slotIndex : leftSet.slotIndex,
      }];
    }),
  );

  return {
    allyTargetOpportunities: allyTargetOpportunities.slice(0, 24),
    allyStatChangeInteractions: allyStatChangeInteractions.slice(0, 24),
    sharedMoveSequences: sharedMoveSequences.slice(0, 12),
    fieldSetters: fieldSetters.slice(0, 24),
    unconditionalSpeedOrder,
    defensiveCoverage: createDefensiveCoverage(sets).slice(0, 48),
  };
}
