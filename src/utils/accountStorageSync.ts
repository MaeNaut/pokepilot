import {
  normalizeCopilotHistoryEntries,
  type CopilotHistoryEntry,
} from "./copilotHistory";
import { jsonValueEqual } from "./jsonValueEqual";

function withoutLocallyDeleted<T extends { id: string }>(
  remote: T[], local: T[], baseline: T[],
) {
  const localIds = new Set(local.map((entry) => entry.id));
  const deletedIds = new Set(baseline
    .filter((entry) => !localIds.has(entry.id))
    .map((entry) => entry.id));
  return remote.filter((entry) => !deletedIds.has(entry.id));
}

export function mergeAccountCopilotHistory(
  remoteEntries: CopilotHistoryEntry[],
  localEntries: CopilotHistoryEntry[],
) {
  const entriesById = new Map(remoteEntries.map((entry) => [entry.id, entry]));

  for (const localEntry of localEntries) {
    const remoteEntry = entriesById.get(localEntry.id);
    if (!remoteEntry || localEntry.createdAt > remoteEntry.createdAt) {
      entriesById.set(localEntry.id, localEntry);
    }
  }

  return normalizeCopilotHistoryEntries([...entriesById.values()]);
}

export function mergeAccountCopilotHistoryAfterLocalEdits(
  remote: CopilotHistoryEntry[], local: CopilotHistoryEntry[], baseline: CopilotHistoryEntry[],
) {
  return mergeAccountCopilotHistory(withoutLocallyDeleted(remote, local, baseline), local);
}

export function reconcileAccountCopilotHistory(
  remote: CopilotHistoryEntry[], local: CopilotHistoryEntry[], baseline: CopilotHistoryEntry[],
) {
  const byId = new Map(remote.map((entry) => [entry.id, entry]));
  const localById = new Map(local.map((entry) => [entry.id, entry]));
  const baselineById = new Map(baseline.map((entry) => [entry.id, entry]));
  for (const id of new Set([...localById.keys(), ...baselineById.keys()])) {
    const before = baselineById.get(id);
    const here = localById.get(id);
    if (jsonValueEqual(here, before)) continue;
    if (here) byId.set(id, here);
    else byId.delete(id);
  }
  return normalizeCopilotHistoryEntries([...byId.values()]);
}
