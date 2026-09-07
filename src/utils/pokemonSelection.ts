import { fetchPokemon } from "../api/pokeApi";
import { fetchItem } from "../api/showdownCatalog";
import { normalizeShowdownId } from "../api/showdownIds";
import {
  loadPopularSmogonSet,
  resolveSmogonUsageAbility,
  resolveSmogonUsageMoveIds,
  type SmogonUsageSet,
} from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import type { PokemonIndexEntry, PokemonItem, TeamMember } from "../types";
import { shouldKeepSelectedPokemonForUsageTarget } from "./pokemonAliases";
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

async function resolvePokemonMember(lookup: string, customPool: TeamMember[]) {
  const localMember = customPool.find((member) => member.id === lookup);
  if (
    localMember?.baseStats && localMember.abilities &&
    !isFullShowdownSpriteUrl(localMember.iconSpriteUrl)
  ) {
    return localMember;
  }
  return fetchPokemon(lookup);
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
  usageSet: SmogonUsageSet,
  selectedMember: TeamMember,
  targetMember: TeamMember,
): Promise<ResolvedUsageSetPatch> {
  const ability = resolveSmogonUsageAbility(targetMember, usageSet.ability);
  const resolvedMoveIds = resolveSmogonUsageMoveIds(
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
    const usageSet = await loadPopularSmogonSet(lookup, battleFormat);
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
