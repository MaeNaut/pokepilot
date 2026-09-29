import { useEffect, useRef, useState } from "react";
import { readPersonalApiKeyStatus, removePersonalApiKey, savePersonalApiKey } from "../api/personalApiKey";
import { announceAccountEvent, readAccountEvent } from "../utils/accountCrossTab";

type KeyStatus = "loading" | "ready" | "error";

export function usePersonalApiKey(accountId: string | null) {
  const [state, setState] = useState<{ accountId: string | null; hasKey: boolean; status: KeyStatus }>({
    accountId: null, hasKey: false, status: "loading",
  });
  const version = useRef(0);
  const updating = useRef(false);

  useEffect(() => {
    ++version.current;
    setState({ accountId, hasKey: false, status: "loading" });
    if (!accountId) return () => { version.current += 1; };
    const refresh = () => {
      if (updating.current) return;
      const request = ++version.current;
      void readPersonalApiKeyStatus(accountId).then((hasKey) => {
        if (version.current === request) setState({ accountId, hasKey, status: "ready" });
      }).catch(() => {
        if (version.current === request) setState({ accountId, hasKey: false, status: "error" });
      });
    };
    const onStorage = (event: StorageEvent) => {
      const change = readAccountEvent(event);
      if (change?.kind === "personal-key" && change.accountId === accountId) refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      version.current += 1;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [accountId]);

  async function update(apiKey: string | null) {
    if (!accountId) return false;
    // A pending initial read must not overwrite a newer save or removal.
    updating.current = true;
    const request = ++version.current;
    try {
      if (apiKey === null) await removePersonalApiKey(accountId);
      else await savePersonalApiKey(apiKey.trim(), accountId);
      announceAccountEvent({ kind: "personal-key", accountId });
      if (version.current !== request) return false;
      setState({ accountId, hasKey: apiKey !== null, status: "ready" });
      return true;
    } catch {
      if (version.current === request) setState((current) => ({ ...current, status: "error" }));
      return false;
    } finally {
      updating.current = false;
    }
  }

  const current = state.accountId === accountId && accountId !== null;
  return {
    hasPersonalApiKey: current && state.hasKey,
    personalApiKeyStatus: current ? state.status : "loading" as KeyStatus,
    update,
  };
}
