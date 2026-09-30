import type { PendingAccountCollection } from "./accountPendingStorage";
import { jsonValueEqual } from "./jsonValueEqual";

export type CollectionMergePolicy<T> = {
  merge: (remote: T[], local: T[]) => T[];
  mergeAfterLocalEdits: (remote: T[], local: T[], baseline: T[]) => T[];
  reconcile?: (remote: T[], local: T[], baseline: T[]) => T[];
};

export function reconcileCollectionHydration<T>(options: {
  remote: T[];
  local: T[];
  baseline: T[];
  ownership: "account" | "unclaimed" | "other";
  hasInSessionEdits: boolean;
  unsynced: boolean;
  pendings: PendingAccountCollection<T>[];
}, policy: CollectionMergePolicy<T>): T[] {
  const { remote, local, baseline, ownership, hasInSessionEdits, unsynced, pendings } = options;
  if (ownership === "account" && (hasInSessionEdits || pendings.length > 0)) {
    const reconcile = policy.reconcile ?? policy.mergeAfterLocalEdits;
    let merged = remote;
    for (const entry of pendings) {
      merged = reconcile(merged, entry.items, entry.baseline);
    }
    if (hasInSessionEdits && unsynced &&
        !pendings.some((entry) => jsonValueEqual(entry.items, local))) {
      merged = reconcile(merged, local, baseline);
    }
    return merged;
  }
  return ownership === "unclaimed" ? policy.merge(remote, local) : remote;
}
