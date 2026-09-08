import { normalizeShowdownId } from "../api/showdownIds";
import { itemFromIndexEntry } from "../api/showdownCatalog";
import type { ItemIndexEntry } from "../types";
import type { CopilotSetOptimizationCandidateSnapshot } from "./copilotContracts";
import type { TeamSlotBuildPatch } from "./teamBuildState";

export function resolveOptimizationCandidatePatch(
  candidate: CopilotSetOptimizationCandidateSnapshot,
  itemIndex: readonly ItemIndexEntry[],
): TeamSlotBuildPatch | null {
  let itemPatch: Pick<TeamSlotBuildPatch, "item"> | undefined;

  if (candidate.itemChanged) {
    if (candidate.itemId === null) {
      itemPatch = { item: null };
    } else {
      const candidateItemId = normalizeShowdownId(candidate.itemId);
      const item = itemIndex.find(
        (entry) => normalizeShowdownId(entry.showdownId) === candidateItemId,
      );
      if (!item) return null;
      itemPatch = { item: itemFromIndexEntry(item) };
    }
  }

  return {
    nature: candidate.natureId,
    evs: { ...candidate.evs },
    moveIds: [...candidate.moveIds],
    ...itemPatch,
  };
}
