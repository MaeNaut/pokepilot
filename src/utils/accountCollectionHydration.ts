import type { PendingAccountCollection } from "./accountPendingStorage";
import { jsonValueEqual } from "./jsonValueEqual";

type Reconciled<T, C> = { merged: T[]; conflicts: C[] };

export type CollectionMergePolicy<T, C> = {
  merge: (remote: T[], local: T[]) => T[];
  mergeAfterLocalEdits: (remote: T[], local: T[], baseline: T[]) => T[];
  reconcile?: (remote: T[], local: T[], baseline: T[]) => Reconciled<T, C>;
  reconcileLegacy?: (remote: T[], local: T[]) => Reconciled<T, C>;
  reconcileUnclaimed?: (remote: T[], local: T[]) => Reconciled<T, C>;
};

export function reconcileCollectionHydration<T, C>(options: {
  remote: T[];
  local: T[];
  baseline: T[];
  ownership: "account" | "unclaimed" | "other";
  hasInSessionEdits: boolean;
  unsynced: boolean;
  legacy: boolean;
  pendings: PendingAccountCollection<T>[];
}, policy: CollectionMergePolicy<T, C>): Reconciled<T, C> & { replayedCount: number } {
  const { remote, local, baseline, ownership, hasInSessionEdits, unsynced, legacy, pendings } = options;
  if (ownership === "account" && (hasInSessionEdits || pendings.length > 0)) {
    const reconcile = (there: T[], here: T[], before: T[]) => policy.reconcile?.(there, here, before) ?? {
      merged: policy.mergeAfterLocalEdits(there, here, before), conflicts: [] as C[],
    };
    let merged = remote;
    const conflicts: C[] = [];
    let replayedCount = 0;
    for (const entry of pendings) {
      const result = reconcile(merged, entry.items, entry.baseline);
      merged = result.merged;
      conflicts.push(...result.conflicts);
      replayedCount += 1;
      // Later journals must wait for the user's decision on this conflict.
      if (result.conflicts.length > 0) break;
    }
    if (conflicts.length === 0 && hasInSessionEdits && unsynced &&
        !pendings.some((entry) => jsonValueEqual(entry.items, local))) {
      const result = reconcile(merged, local, baseline);
      merged = result.merged;
      conflicts.push(...result.conflicts);
    }
    return { merged, conflicts, replayedCount };
  }
  const result = legacy && policy.reconcileLegacy
    ? policy.reconcileLegacy(remote, local)
    : ownership === "unclaimed" && policy.reconcileUnclaimed
      ? policy.reconcileUnclaimed(remote, local)
      : { merged: ownership === "unclaimed" ? policy.merge(remote, local) : remote, conflicts: [] as C[] };
  return { ...result, replayedCount: 0 };
}
