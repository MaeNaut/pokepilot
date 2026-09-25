import { useEffect, useRef, useState } from "react";
import { readPersonalApiKeyStatus, removePersonalApiKey, savePersonalApiKey } from "../api/personalApiKey";

type KeyStatus = "loading" | "ready" | "error";

export function usePersonalApiKey(accountId: string | null) {
  const [state, setState] = useState<{ accountId: string | null; hasKey: boolean; status: KeyStatus }>({
    accountId: null, hasKey: false, status: "loading",
  });
  const version = useRef(0);

  useEffect(() => {
    const request = ++version.current;
    setState({ accountId, hasKey: false, status: "loading" });
    if (accountId) {
      void readPersonalApiKeyStatus().then((hasKey) => {
        if (version.current === request) setState({ accountId, hasKey, status: "ready" });
      }).catch(() => {
        if (version.current === request) setState({ accountId, hasKey: false, status: "error" });
      });
    }
    return () => { version.current += 1; };
  }, [accountId]);

  async function update(apiKey: string | null) {
    if (!accountId) return false;
    // A pending initial read must not overwrite a newer save or removal.
    const request = ++version.current;
    try {
      if (apiKey === null) await removePersonalApiKey();
      else await savePersonalApiKey(apiKey.trim());
      if (version.current !== request) return false;
      setState({ accountId, hasKey: apiKey !== null, status: "ready" });
      return true;
    } catch {
      if (version.current === request) setState((current) => ({ ...current, status: "error" }));
      return false;
    }
  }

  const current = state.accountId === accountId && accountId !== null;
  return {
    hasPersonalApiKey: current && state.hasKey,
    personalApiKeyStatus: current ? state.status : "loading" as KeyStatus,
    update,
  };
}
