// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { HeaderAccountMenu } from "./HeaderAccountMenu";
import { LocalizationProvider } from "../i18n/LocalizationProvider";

type Account = ComponentProps<typeof HeaderAccountMenu>["account"];

describe("personal API key settings", () => {
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
});
