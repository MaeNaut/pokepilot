import { fetchPokemon } from "../api/pokeApi";
import { fetchItem } from "../api/showdownCatalog";
import { normalizeShowdownId } from "../api/showdownIds";
import {
  loadPopularUsageSet,
  resolveBattleUsageAbility,
  resolveBattleUsageMoveIds,
  type BattleUsageSet,
} from "../api/battleUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { PokemonIndexEntry, PokemonItem, TeamMember } from "../types";
import { isMegaPokemonName } from "./megaEvolution";
import {
  getPreferredPokeApiId,
  shouldKeepSelectedPokemonForUsageTarget,
} from "./pokemonAliases";
import { isFullShowdownSpriteUrl } from "./pokemonSprites";
import { normalizeImportedEvs, resolveImportedPokemonId } from "./showdownImport";
import { toPokemonId } from "./showdownText";
import {
  clearBuildStateSlot,
  patchBuildStateSlot,
  type TeamBuildState,
  type TeamSlotBuildPatch,
} from "./teamBuildState";

type ResolvedUsageSetPatch = {
  patch: TeamSlotBuildPatch;
  itemLoadFailed: boolean;
};

export function getCompatiblePokemonAbility(member: TeamMember, ability?: string) {
  return ability && member.abilities?.includes(ability)
    ? ability
    : member.abilities?.[0] ?? "";
}

export function resolveMegaAbilityTransition({
  previousMember,
  targetMember,
  nextAbility,
  previousAbility,
  rememberedAbility,
  rememberedPokemonId,
  pokemonIndex,
}: {
  previousMember: TeamMember | null;
  targetMember: TeamMember;
  nextAbility: string;
  previousAbility: string;
  rememberedAbility?: string | null;
  rememberedPokemonId?: string;
  pokemonIndex: PokemonIndexEntry[];
}) {
  const previousSpecies = pokemonIndex.find((entry) => entry.name === previousMember?.id)?.speciesKey;
  const targetSpecies = pokemonIndex.find((entry) => entry.name === targetMember.id)?.speciesKey;
  const sameSpecies = Boolean(previousSpecies && previousSpecies === targetSpecies);
  const wasMega = Boolean(previousMember && isMegaPokemonName(previousMember.id));
  const isMega = isMegaPokemonName(targetMember.id);
  const enteringMega = sameSpecies && !wasMega && isMega;
  const returningFromMega = sameSpecies && wasMega && !isMega &&
    (!rememberedPokemonId || rememberedPokemonId === targetMember.id);

  return {
    ability: getCompatiblePokemonAbility(
      targetMember,
      returningFromMega && rememberedAbility ? rememberedAbility : nextAbility,
    ),
    preMegaAbility: enteringMega
      ? previousAbility
      : sameSpecies && isMega && wasMega
        ? rememberedAbility ?? null
        : null,
  };
}

async function resolvePokemonMember(lookup: string, customPool: TeamMember[]) {
  const canonicalLookup = getPreferredPokeApiId(lookup) ?? lookup;
  const localMember = customPool.find((member) => member.id === canonicalLookup);
  if (
    localMember?.baseStats && localMember.abilities &&
    !isFullShowdownSpriteUrl(localMember.iconSpriteUrl)
  ) {
    return localMember;
  }
  return fetchPokemon(canonicalLookup);
}

export async function resolveUsageTargetMember(
  usagePokemonId: string,
  selectedMember: TeamMember,
) {
  if (
    normalizeShowdownId(usagePokemonId) === normalizeShowdownId(selectedMember.id) ||
    shouldKeepSelectedPokemonForUsageTarget(selectedMember.id, usagePokemonId)
  ) {
    return selectedMember;
  }

  try {
    return await fetchPokemon(usagePokemonId);
  } catch {
    return selectedMember;
  }
}

async function resolveUsageSetPatch(
  usageSet: BattleUsageSet,
  selectedMember: TeamMember,
  targetMember: TeamMember,
): Promise<ResolvedUsageSetPatch> {
  const ability = resolveBattleUsageAbility(targetMember, usageSet.ability);
  const resolvedMoveIds = resolveBattleUsageMoveIds(
    targetMember.moves,
    usageSet.moveIds,
  );
  const moveIds = usageSet.moveIds.length
    ? [...resolvedMoveIds, "", "", "", ""].slice(0, 4)
    : undefined;
  let item: PokemonItem | null = null;
  let itemLoadFailed = false;

  if (usageSet.itemName) {
    try {
      item = await fetchItem(normalizeShowdownId(usageSet.itemName));
    } catch {
      itemLoadFailed = true;
    }
  }

  return {
    patch: {
      item,
      ...(ability ? { ability } : {}),
      ...(usageSet.nature ? { nature: usageSet.nature } : {}),
      ...(usageSet.evs ? { evs: normalizeImportedEvs(usageSet.evs) } : {}),
      ...(moveIds ? { moveIds } : {}),
      preMegaPokemon:
        toPokemonId(targetMember.id).includes("-mega") &&
        !toPokemonId(selectedMember.id).includes("-mega")
          ? selectedMember.id
          : null,
    },
    itemLoadFailed,
  };
}

type ResolvePokemonChoiceOptions = {
  slotIndex: number;
  lookup: string;
  applyUsageStats: boolean;
  battleFormat: BattleFormat;
  customPool: TeamMember[];
  pokemonIndex: PokemonIndexEntry[];
  getBuildStateSnapshot: () => TeamBuildState;
};

// Resolve data without committing UI state. Callers retain stale-request and legality guards.
export async function resolvePokemonChoice({
  slotIndex,
  lookup,
  applyUsageStats,
  battleFormat,
  customPool,
  pokemonIndex,
  getBuildStateSnapshot,
}: ResolvePokemonChoiceOptions) {
  const selectedMember = await resolvePokemonMember(lookup, customPool);
  let targetMember = selectedMember;
  let usageSetPatch: ResolvedUsageSetPatch | null = null;
  let usageSetFound = false;

  if (applyUsageStats) {
    const usageSet = await loadPopularUsageSet(lookup, battleFormat);
    usageSetFound = Boolean(usageSet);
    if (usageSet) {
      targetMember = await resolveUsageTargetMember(
        resolveImportedPokemonId(usageSet.pokemonName, pokemonIndex),
        selectedMember,
      );
      usageSetPatch = await resolveUsageSetPatch(
        usageSet,
        selectedMember,
        targetMember,
      );
    }
  }

  const currentBuildState = getBuildStateSnapshot();
  const clearedBuildState = applyUsageStats
    ? clearBuildStateSlot(currentBuildState, slotIndex)
    : currentBuildState;
  const proposedBuildState = usageSetPatch
    ? patchBuildStateSlot(clearedBuildState, slotIndex, usageSetPatch.patch)
    : clearedBuildState;

  return {
    selectedMember,
    targetMember,
    usageSetPatch,
    proposedBuildState,
    usageSetFound,
  };
}
