import { useCallback, useEffect, useRef, useState } from "react";
import {
  accountAuthEnabled,
  deleteAccount,
  loginAccount,
  logoutAccount,
  readAccount,
  type AccountProfile,
} from "../api/accountAuth";
import { usePersonalApiKey } from "./usePersonalApiKey";

export type AccountStatus = "loading" | "guest" | "ready" | "error";

export function useAccount() {
  const [status, setStatus] = useState<AccountStatus>(accountAuthEnabled ? "loading" : "guest");
  const [user, setUser] = useState<AccountProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const personalKey = usePersonalApiKey(status === "ready" ? user?.id ?? null : null);
  const [prompt, setPrompt] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const refresh = useCallback(async (showPrompt = false) => {
    if (!accountAuthEnabled) return true;
    if (busyRef.current) return false;
    const version = ++requestVersion.current;
    const isCurrent = () => mounted.current && requestVersion.current === version;
    try {
      const nextUser = await readAccount();
      if (!isCurrent()) return false;
      setUser(nextUser);
      setStatus(nextUser ? "ready" : "guest");
      if (showPrompt) setPrompt(!nextUser);
      return Boolean(nextUser);
    } catch {
      if (isCurrent()) {
        setUser(null);
        setStatus("error");
      }
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!accountAuthEnabled) return;
    const onFocus = () => { void refresh(); };
    onFocus();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function updatePersonalApiKey(apiKey: string | null) {
    if (status !== "ready" || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      return await personalKey.update(apiKey);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function act(action: "login" | "logout" | "delete") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    // A focus refresh started before logout must not restore the old profile.
    requestVersion.current += 1;
    try {
      if (action === "login") await loginAccount();
      else {
        await (action === "delete" ? deleteAccount() : logoutAccount());
        if (mounted.current) {
          setUser(null);
          setStatus("guest");
          setPrompt(false);
        }
      }
    } catch {
      if (mounted.current) setStatus("error");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return {
    enabled: accountAuthEnabled,
    status,
    user,
    busy,
    hasPersonalApiKey: personalKey.hasPersonalApiKey,
    personalApiKeyStatus: personalKey.personalApiKeyStatus,
    updatePersonalApiKey,
    prompt,
    act,
    ensureAuthenticated: () => refresh(true),
  };
}
