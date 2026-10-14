// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { HeaderAccountMenu } from "./HeaderAccountMenu";
import { LocalizationProvider } from "../i18n/LocalizationProvider";
import { registerAccountCollectionSync, reportAccountCollectionSync } from "../utils/accountCollectionSyncStatus";

type Account = ComponentProps<typeof HeaderAccountMenu>["account"];

describe("personal API key settings", () => {
  it.each(["guest-b", "direct-b", "error-a", "guest-a", "reopen"])("does not retain an unsaved key after %s", async (transition) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.setItem("pokepilot:locale", "en");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const updatePersonalApiKey = vi.fn(async () => true);
    const account = {
      enabled: true, status: "ready", user: { id: "a" }, busy: false,
      personalApiKeyStatus: "ready", hasPersonalApiKey: false,
      act: vi.fn(), updatePersonalApiKey,
    } as unknown as Account;
    const render = async (next: Account) => act(async () => root.render(
      <LocalizationProvider><HeaderAccountMenu account={next} locale="en"
        onLocaleChange={vi.fn()} themePreference="system" onThemePreferenceChange={vi.fn()} /></LocalizationProvider>,
    ));
    try {
      await render(account);
      await act(async () => container.querySelector<HTMLButtonElement>('button.header-account-trigger')!.click());
      const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "sk-test-draft-key-123456789");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(input.value).toBe("sk-test-draft-key-123456789");
      if (transition === "reopen") {
        await act(async () => container.querySelector<HTMLButtonElement>('button.header-account-trigger')!.click());
        await act(async () => container.querySelector<HTMLButtonElement>('button.header-account-trigger')!.click());
      } else {
        if (transition.startsWith("guest")) await render({ ...account, status: "guest", user: null });
        if (transition === "error-a") await render({ ...account, status: "error" });
        await render({ ...account, user: { id: transition.endsWith("b") ? "b" : "a" } });
      }
      expect(container.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe("");
      await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      expect(updatePersonalApiKey).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      container.remove(); localStorage.clear();
    }
  });

  it.each(["save", "remove"])("ignores a late %s completion after the same account signs in again", async (operation) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.setItem("pokepilot:locale", "en");
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    let finish: (value: boolean) => void = () => {};
    const update = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const account = {
      enabled: true, status: "ready", user: { id: "a" }, busy: false,
      personalApiKeyStatus: "ready", hasPersonalApiKey: operation === "remove",
      act: vi.fn(), updatePersonalApiKey: update,
    } as unknown as Account;
    const render = async (next: Account) => act(async () => root.render(
      <LocalizationProvider><HeaderAccountMenu account={next} locale="en"
        onLocaleChange={vi.fn()} themePreference="system" onThemePreferenceChange={vi.fn()} /></LocalizationProvider>,
    ));
    const enterKey = async (value: string) => act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    try {
      await render(account);
      await act(async () => container.querySelector<HTMLButtonElement>('button.header-account-trigger')!.click());
      if (operation === "save") {
        await enterKey("sk-old-draft-1234567890");
        await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      } else {
        await act(async () => container.querySelector<HTMLButtonElement>(".header-account-key-remove")!.click());
      }
      expect(update).toHaveBeenCalledOnce();
      await render({ ...account, status: "guest", user: null });
      await render({ ...account, hasPersonalApiKey: false });
      await enterKey("sk-new-draft-1234567890");
      await act(async () => finish(true));
      expect(container.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe("sk-new-draft-1234567890");
      expect(container.querySelector('[role="status"].header-account-key-status')).toBeNull();
    } finally {
      await act(async () => root.unmount()); container.remove(); localStorage.clear();
    }
  });

  it.each([false, true])("opens setting choices only on request (mobile=%s)", async (mobile) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: mobile, addEventListener() {}, removeEventListener() {} })));
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    localStorage.setItem("pokepilot:locale", "en");
    const container = document.createElement("div"); container.id = "root"; document.body.append(container);
    const root = createRoot(container);
    const onLocaleChange = vi.fn(); const onThemePreferenceChange = vi.fn();
    try {
      await act(async () => root.render(<LocalizationProvider><HeaderAccountMenu
        account={{ enabled: false, status: "guest" } as Account} locale="en" onLocaleChange={onLocaleChange}
        themePreference="system" onThemePreferenceChange={onThemePreferenceChange} /></LocalizationProvider>));
      await act(async () => container.querySelector<HTMLButtonElement>("button.header-account-trigger")!.click());
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(container.querySelectorAll('.header-account-setting-trigger [data-icon="chevron-left"]'))
        .toHaveLength(mobile ? 0 : 2);
      const trigger = container.querySelector<HTMLButtonElement>('.header-account-setting-trigger[aria-label="Theme"]')!;
      await act(async () => trigger.click());
      const menu = document.querySelector('[role="menu"]')!;
      expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(3);
      expect(Boolean(menu.closest('[aria-modal="true"]'))).toBe(mobile);
      expect(Boolean(container.inert)).toBe(mobile);
      await act(async () => { menu.querySelectorAll<HTMLButtonElement>("button")[2].click(); });
      expect(onThemePreferenceChange).toHaveBeenCalledWith("dark");
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(Boolean(container.inert)).toBe(false);
      expect(document.activeElement).toBe(trigger);
      const language = container.querySelector<HTMLButtonElement>('.header-account-setting-trigger[aria-label="Language"]')!;
      await act(async () => language.click());
      await act(async () => document.querySelector<HTMLButtonElement>('[role="menuitemradio"][lang="ko"]')!.click());
      expect(onLocaleChange).toHaveBeenCalledWith("ko");
      await act(async () => trigger.click());
      await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(container.querySelector(".header-account-popover")).not.toBeNull();
      await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
      expect(container.querySelector(".header-account-popover")).toBeNull();
    } finally {
      await act(async () => root.unmount()); container.remove(); localStorage.clear();
      vi.unstubAllGlobals(); vi.restoreAllMocks();
    }
  });

  it("shows registration only without a key and deletion only with a key", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.setItem("pokepilot:locale", "en");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const account = {
      enabled: true, status: "ready", user: { id: "a", name: "Tester" },
      busy: false, personalApiKeyStatus: "ready", hasPersonalApiKey: false,
      act: vi.fn(), updatePersonalApiKey: vi.fn(), removePersonalApiKey: vi.fn(),
    } as unknown as Account;
    async function render(hasKey: boolean) {
      await act(async () => root.render(
        <LocalizationProvider>
          <HeaderAccountMenu account={{ ...account, hasPersonalApiKey: hasKey }} locale="en"
            onLocaleChange={vi.fn()} themePreference="system" onThemePreferenceChange={vi.fn()} />
        </LocalizationProvider>,
      ));
    }
    try {
      await render(false);
      await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
      expect(container.querySelector('input[type="password"]')).not.toBeNull();
      expect(container.textContent).not.toContain("No key registered");
      expect(container.querySelector(".header-account-key-remove")).toBeNull();
      await render(true);
      expect(container.querySelector('input[type="password"]')).toBeNull();
      expect(container.querySelector(".header-account-key-form")).toBeNull();
      expect(container.querySelector(".header-account-key-remove")).not.toBeNull();
      expect(container.querySelector(".header-account-key-status")?.textContent).toBeTruthy();
      await render(false);
      expect(container.querySelector('input[type="password"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
      localStorage.clear();
    }
  });

  it("warns about unsynced changes and requires confirmation before signing out", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.setItem("pokepilot:locale", "en");
    const token = Symbol("test-sync");
    const retry = vi.fn().mockResolvedValue(true);
    const unregister = registerAccountCollectionSync(token, retry);
    reportAccountCollectionSync(token, true, true);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const account = {
      enabled: true, status: "ready", user: { id: "a", name: "Tester" },
      busy: false, personalApiKeyStatus: "ready", hasPersonalApiKey: false,
      act: vi.fn(), updatePersonalApiKey: vi.fn(),
    } as unknown as Account;
    try {
      await act(async () => root.render(
        <LocalizationProvider>
          <HeaderAccountMenu account={account} locale="en" onLocaleChange={vi.fn()}
            themePreference="system" onThemePreferenceChange={vi.fn()} />
        </LocalizationProvider>,
      ));
      await act(async () => container.querySelector<HTMLButtonElement>('button.header-account-trigger')!.click());
      expect(container.textContent).toContain("Some account data could not sync");
      expect(container.querySelector("button.header-account-trigger.has-sync-issue")).not.toBeNull();
      const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>("button")]
        .find((element) => element.textContent?.includes(label))!;
      const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "sk-unsaved-draft-1234567890");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => button("Retry sync").click());
      expect(retry).toHaveBeenCalledOnce();
      await act(async () => button("Sign out").click());
      expect(account.act).not.toHaveBeenCalled();
      expect(input.value).toBe("sk-unsaved-draft-1234567890");
      await act(async () => reportAccountCollectionSync(token, false, false));
      localStorage.setItem("pokepilot.savedTeams.pending.v1:other-tab",
        JSON.stringify({ accountId: "a", baseline: [], items: [] }));
      confirm.mockClear();
      await act(async () => button("Sign out").click());
      expect(confirm).toHaveBeenCalledOnce();
      expect(account.act).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      await act(async () => button("Sign out").click());
      expect(account.act).toHaveBeenCalledWith("logout");
      expect(input.value).toBe("");
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "sk-delete-draft-1234567890");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      confirm.mockReturnValue(false);
      await act(async () => button("Delete account").click());
      expect(input.value).toBe("sk-delete-draft-1234567890");
      confirm.mockReturnValue(true);
      await act(async () => button("Delete account").click());
      expect(account.act).toHaveBeenCalledWith("delete");
      expect(input.value).toBe("");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      unregister();
      confirm.mockRestore();
      localStorage.clear();
    }
  });
});
