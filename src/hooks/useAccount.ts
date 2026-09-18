import { useEffect, useState } from "react";
import { accountAuthEnabled, deleteAccount, loginAccount, logoutAccount, readAccount } from "../api/accountAuth";

export function useAccount() {
  const [status, setStatus] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);
  useEffect(() => {
    if (!accountAuthEnabled) return;
    let active = true;
    const refresh = () => readAccount().then(user => {
      if (active) setStatus(user ? "ready" : "guest");
    }).catch(() => { if (active) setStatus("error"); });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);

  async function ensureAuthenticated() {
    if (!accountAuthEnabled) return true;
    try {
      const user = await readAccount();
      setStatus(user ? "ready" : "guest");
      setPrompt(!user);
      return Boolean(user);
    } catch { setStatus("error"); return false; }
  }

  async function act(action: "login" | "logout" | "delete") {
    if (busy) return;
    setBusy(true);
    try {
      if (action === "login") await loginAccount();
      else {
        await (action === "delete" ? deleteAccount() : logoutAccount());
        setStatus("guest");
      }
    } catch { setStatus("error"); }
    finally { setBusy(false); }
  }
  return { enabled: accountAuthEnabled, status, busy, prompt, act, ensureAuthenticated };
}
