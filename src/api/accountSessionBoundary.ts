import { ACCOUNT_REFRESH_EVENT } from "../utils/accountCrossTab";

export function requestAccountRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_REFRESH_EVENT));
}

export async function rejectChangedAccount(response: Response) {
  if (response.status !== 403) return;
  const body = await response.clone().json().catch(() => null) as {
    error?: { code?: unknown };
  } | null;
  if (body?.error?.code !== "ACCOUNT_SESSION_CHANGED") return;
  requestAccountRefresh();
  throw new Error("ACCOUNT_SESSION_CHANGED");
}
