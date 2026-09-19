import { readAccountCopilotHistory, writeAccountCopilotHistory } from "../api/accountStorage";
import { mergeAccountCopilotHistory } from "../utils/accountStorageSync";
import {
  clearStoredCopilotHistory,
  getStoredCopilotHistory,
  getStoredCopilotHistoryAccountId,
  storeCopilotHistoryAccountId,
  storeCopilotHistory,
} from "../utils/copilotHistory";
import { useAccountCollection } from "./useAccountCollection";

const storage = {
  readLocal: getStoredCopilotHistory,
  writeLocal: storeCopilotHistory,
  clearLocal: clearStoredCopilotHistory,
  readOwner: getStoredCopilotHistoryAccountId,
  writeOwner: storeCopilotHistoryAccountId,
  readRemote: readAccountCopilotHistory,
  writeRemote: writeAccountCopilotHistory,
  merge: mergeAccountCopilotHistory,
};

export function useCopilotHistory(accountId: string | null) {
  return useAccountCollection(accountId, storage);
}
