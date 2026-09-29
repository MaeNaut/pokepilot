type CollectionSyncState = {
  issue: boolean;
  pending: boolean;
  retry: () => Promise<boolean>;
};

const sessions = new Map<symbol, CollectionSyncState>();
const listeners = new Set<() => void>();
let snapshot = "0:0";

function publish() {
  const next = `${[...sessions.values()].filter((session) => session.issue).length}:${
    [...sessions.values()].filter((session) => session.pending).length
  }`;
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function registerAccountCollectionSync(token: symbol, retry: () => Promise<boolean>) {
  sessions.set(token, { issue: false, pending: false, retry });
  publish();
  return () => {
    sessions.delete(token);
    publish();
  };
}

export function reportAccountCollectionSync(token: symbol, issue: boolean, pending: boolean) {
  const session = sessions.get(token);
  if (!session) return;
  sessions.set(token, { ...session, issue, pending });
  publish();
}

export function subscribeAccountCollectionSync(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAccountCollectionSyncSnapshot() {
  return snapshot;
}

export function hasPendingAccountCollectionSync() {
  return [...sessions.values()].some((session) => session.pending);
}

export async function retryAccountCollections() {
  await Promise.all([...sessions.values()]
    .filter((session) => session.issue)
    .map((session) => session.retry()));
}
