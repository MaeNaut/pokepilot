import { useEffect, useState } from "react";
import {
  accountAuthEnabled,
  deleteAccount,
  loginAccount,
  logoutAccount,
  readAccount,
  type AccountProfile,
} from "../api/accountAuth";

export type AccountStatus = "loading" | "guest" | "ready" | "error";

export function useAccount() {
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [user, setUser] = useState<AccountProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);
  useEffect(() => {
    if (!accountAuthEnabled) return;
    let active = true;
    const refresh = () => readAccount().then((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setStatus(nextUser ? "ready" : "guest");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setStatus("error");
    });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);

  async function ensureAuthenticated() {
    if (!accountAuthEnabled) return true;
    try {
      const user = await readAccount();
      setUser(user);
      setStatus(user ? "ready" : "guest");
      setPrompt(!user);
      return Boolean(user);
    } catch {
      setUser(null);
      setStatus("error");
      return false;
    }
  }

  async function act(action: "login" | "logout" | "delete") {
    if (busy) return;
    setBusy(true);
    try {
      if (action === "login") await loginAccount();
      else {
        await (action === "delete" ? deleteAccount() : logoutAccount());
        setUser(null);
        setStatus("guest");
      }
    } catch { setStatus("error"); }
    finally { setBusy(false); }
  }
  return {
    enabled: accountAuthEnabled,
    status,
    user,
    busy,
    prompt,
    act,
    ensureAuthenticated,
  };
}
