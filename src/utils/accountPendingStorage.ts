export type PendingAccountCollection<T> = {
  accountId: string;
  baseline: T[];
  items: T[];
};

export type StoredPendingAccountCollection<T> = PendingAccountCollection<T> & {
  storageKey: string;
  serialized: string;
};

export const pendingTeamsStorageKey = "pokepilot.savedTeams.pending.v1";
export const pendingCopilotHistoryStorageKey = "pokepilot:analysis-history.pending.v1";

const pageId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function ownKey(key: string) {
  return `${key}:${pageId}`;
}

function parsePendingCollection<T>(
  storageKey: string, raw: string, normalize: (value: unknown) => T[],
): StoredPendingAccountCollection<T> | null {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.accountId !== "string" || !Array.isArray(record.baseline) || !Array.isArray(record.items)) {
    return null;
  }
  return {
    accountId: record.accountId,
    baseline: normalize(record.baseline),
    items: normalize(record.items),
    storageKey,
    serialized: raw,
  };
}

export function readPendingCollections<T>(
  key: string, normalize: (value: unknown) => T[],
): StoredPendingAccountCollection<T>[] {
  const records: StoredPendingAccountCollection<T>[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || (storageKey !== key && !storageKey.startsWith(`${key}:`))) continue;
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const record = parsePendingCollection(storageKey, raw, normalize);
        if (record) records.push(record);
      } catch {
        // A malformed record must not hide other tabs' pending edits.
      }
    }
  } catch {
    return records;
  }
  return records;
}

export function readPendingCollection<T>(
  key: string,
  normalize: (value: unknown) => T[],
): PendingAccountCollection<T> | null {
  const records = readPendingCollections(key, normalize);
  const record = records.find(({ storageKey }) => storageKey === ownKey(key)) ??
    records.find(({ storageKey }) => storageKey === key);
  return record ? { accountId: record.accountId, baseline: record.baseline, items: record.items } : null;
}

export function writePendingCollection<T>(key: string, pending: PendingAccountCollection<T>) {
  localStorage.setItem(ownKey(key), JSON.stringify(pending));
}

export function clearConsumedPendingCollections<T>(
  records: StoredPendingAccountCollection<T>[],
) {
  for (const { storageKey, serialized } of records) {
    if (localStorage.getItem(storageKey) === serialized) localStorage.removeItem(storageKey);
  }
}

export function clearPendingCollection(key: string, accountId?: string) {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (storageKey !== key && !storageKey?.startsWith(`${key}:`)) continue;
    if (accountId) {
      try {
        const record: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (record && typeof record === "object" &&
            (record as { accountId?: unknown }).accountId !== accountId) continue;
      } catch {
        // A malformed record has no reliable owner, so clear it on logout.
      }
    }
    keys.push(storageKey);
  }
  for (const storageKey of keys) localStorage.removeItem(storageKey);
}

export function hasPendingCollectionForAccount(key: string, accountId: string) {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (storageKey !== key && !storageKey?.startsWith(`${key}:`)) continue;
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const record: unknown = JSON.parse(raw);
        if (record && typeof record === "object" &&
            (record as { accountId?: unknown }).accountId === accountId) return true;
      } catch {
        // Other tab records may be partially written or malformed.
      }
    }
  } catch {
    return false;
  }
  return false;
}
