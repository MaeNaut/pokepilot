// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { deferred } from "../test/renderHook";
import { TeamUpdateDialog } from "./TeamUpdateDialog";

vi.mock("../i18n/useLocalization", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

it.each(["refresh", "save-draft", "discard-draft"] as const)("requires confirmation for %s and retains the notice after failure", async mode => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const completion = deferred<boolean>();
  const confirm = vi.fn(() => completion.promise);
  await act(async () => root.render(<TeamUpdateDialog mode={mode} name="B" onConfirm={confirm} />));
  const dialog = document.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  expect(dialog.querySelectorAll("button")).toHaveLength(1);
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  const button = dialog.querySelector("button")!;
  await act(async () => button.click());
  expect(button.disabled).toBe(true);
  await act(async () => button.click());
  expect(confirm).toHaveBeenCalledOnce();
  await act(async () => completion.resolve(false));
  expect(dialog.open).toBe(true);
  expect(button.disabled).toBe(false);
  expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
});
