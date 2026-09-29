export const ACCOUNT_EVENT_STORAGE_KEY = "pokepilot.account-event.v1";
export const ACCOUNT_REFRESH_EVENT = "pokepilot:refresh-account";

export type AccountEvent = {
  kind: "auth" | "personal-key";
  accountId: string;
};

export function announceAccountEvent(event: AccountEvent) {
  try {
    localStorage.setItem(ACCOUNT_EVENT_STORAGE_KEY, JSON.stringify({
      ...event,
      nonce: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    }));
  } catch {
    // Other tabs also refresh on focus when browser storage is unavailable.
  }
}

export function readAccountEvent(event: StorageEvent): AccountEvent | null {
  if (event.key !== ACCOUNT_EVENT_STORAGE_KEY || !event.newValue) return null;
  try {
    const value: unknown = JSON.parse(event.newValue);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if ((record.kind !== "auth" && record.kind !== "personal-key") ||
        typeof record.accountId !== "string") return null;
    return { kind: record.kind, accountId: record.accountId };
  } catch {
    return null;
  }
}
