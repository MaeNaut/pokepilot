import { readAccountCopilotHistory, writeAccountCopilotHistory } from "../api/accountStorage";
import {
  mergeAccountCopilotHistory,
  mergeAccountCopilotHistoryAfterLocalEdits,
  reconcileAccountCopilotHistory,
} from "../utils/accountStorageSync";
import {
  clearStoredCopilotHistory,
  getStoredCopilotHistory,
  getStoredCopilotHistoryAccountId,
  storeCopilotHistoryAccountId,
  storeCopilotHistory,
  getPendingCopilotHistory,
  getAllPendingCopilotHistory,
  storePendingCopilotHistory,
  clearPendingCopilotHistory,
  clearConsumedPendingCopilotHistory,
  type CopilotHistoryEntry,
} from "../utils/copilotHistory";
import { useAccountCollection } from "./useAccountCollection";
import { pendingCopilotHistoryStorageKey } from "../utils/accountPendingStorage";

const storage = {
  pendingKey: pendingCopilotHistoryStorageKey,
  readLocal: getStoredCopilotHistory,
  writeLocal: storeCopilotHistory,
  clearLocal: clearStoredCopilotHistory,
  readOwner: getStoredCopilotHistoryAccountId,
  writeOwner: storeCopilotHistoryAccountId,
  readRemote: readAccountCopilotHistory,
  writeRemote: writeAccountCopilotHistory,
  readPending: getPendingCopilotHistory,
  readPendings: getAllPendingCopilotHistory,
  writePending: storePendingCopilotHistory,
  clearPending: clearPendingCopilotHistory,
  clearPendingEntries: clearConsumedPendingCopilotHistory,
  merge: mergeAccountCopilotHistory,
  mergeAfterLocalEdits: mergeAccountCopilotHistoryAfterLocalEdits,
  reconcile: (remote: CopilotHistoryEntry[], local: CopilotHistoryEntry[], baseline: CopilotHistoryEntry[]) => ({
    merged: reconcileAccountCopilotHistory(remote, local, baseline), conflicts: [],
  }),
};

export function useCopilotHistory(accountId: string | null, authResolved = true) {
  return useAccountCollection(accountId, storage, authResolved);
}
