export type JournalSnapshot = { storageKey: string; serialized: string };

export function matchesPendingKey(storageKey: string | null, key: string) {
  return storageKey === key || Boolean(storageKey?.startsWith(`${key}:`));
}

export function readPendingJournal<T>(
  key: string, parse: (storageKey: string, raw: string) => T | null,
): T[] {
  const records: T[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || !matchesPendingKey(storageKey, key)) continue;
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const record = parse(storageKey, raw);
        if (record !== null) records.push(record);
      } catch {
        // One damaged record must not hide another tab's pending edits.
      }
    }
  } catch {
    // Keep records already read if browser storage becomes unavailable.
  }
  return records;
}

export function clearConsumedJournal(records: JournalSnapshot[]) {
  for (const { storageKey, serialized } of records) {
    if (localStorage.getItem(storageKey) === serialized) localStorage.removeItem(storageKey);
  }
}
