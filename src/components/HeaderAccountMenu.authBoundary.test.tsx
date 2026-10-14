// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { HeaderAccountMenu } from "./HeaderAccountMenu";
import { useAccount } from "../hooks/useAccount";
import { readAccount } from "../api/accountAuth";
import { savePersonalApiKey } from "../api/personalApiKey";
import { LocalizationProvider } from "../i18n/LocalizationProvider";
import { ACCOUNT_EVENT_STORAGE_KEY } from "../utils/accountCrossTab";

vi.mock("../api/accountAuth", async (original) => ({
  ...await original<typeof import("../api/accountAuth")>(),
  accountAuthEnabled: true, readAccount: vi.fn(),
}));
vi.mock("../api/personalApiKey", async (original) => ({
  ...await original<typeof import("../api/personalApiKey")>(),
  readPersonalApiKeyStatus: vi.fn(async () => false), savePersonalApiKey: vi.fn(),
}));

function Harness() {
  const account = useAccount();
  return <HeaderAccountMenu account={account} locale="en" onLocaleChange={() => {}}
    themePreference="system" onThemePreferenceChange={() => {}} />;
}

it("clears same-account drafts even when cross-tab re-login overtakes the logout read", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.setItem("pokepilot:locale", "en");
  vi.mocked(readAccount).mockResolvedValue({ id: "a" });
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  let finishLogout: (value: null) => void = () => {};
  const authEvent = () => window.dispatchEvent(new StorageEvent("storage", {
    key: ACCOUNT_EVENT_STORAGE_KEY, newValue: JSON.stringify({ kind: "auth", accountId: "a" }),
  }));
  try {
    await act(async () => root.render(<LocalizationProvider><Harness /></LocalizationProvider>));
    await act(async () => container.querySelector<HTMLButtonElement>('button.header-account-trigger')!.click());
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "sk-previous-session-1234567890");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("sk-previous-session-1234567890");
    vi.mocked(readAccount).mockImplementationOnce(() => new Promise((resolve) => { finishLogout = resolve; }));
    await act(async () => { authEvent(); });
    await act(async () => { authEvent(); });
    await act(async () => finishLogout(null));
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe("");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(savePersonalApiKey).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); container.remove(); localStorage.clear(); vi.clearAllMocks();
  }
});
