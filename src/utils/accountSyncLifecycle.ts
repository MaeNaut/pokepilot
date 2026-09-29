import { registerAccountCollectionSync } from "./accountCollectionSyncStatus";
import { matchesPendingKey } from "./accountPendingJournal";

export function registerAccountSyncLifecycle(options: {
  token: symbol;
  retry: () => Promise<boolean>;
  session: { close: () => void };
  pendingKey?: string;
  pendingChanges: "committed" | "all";
}) {
  const { token, retry, session, pendingKey, pendingChanges } = options;
  const unregister = registerAccountCollectionSync(token, retry);
  const reconnect = () => { void retry(); };
  const pendingChanged = (event: StorageEvent) => {
    if (pendingKey && matchesPendingKey(event.key, pendingKey) &&
        (pendingChanges === "all" || event.newValue === null)) void retry();
  };
  window.addEventListener("online", reconnect);
  window.addEventListener("focus", reconnect);
  window.addEventListener("storage", pendingChanged);
  return () => {
    window.removeEventListener("online", reconnect);
    window.removeEventListener("focus", reconnect);
    window.removeEventListener("storage", pendingChanged);
    unregister();
    session.close();
  };
}
