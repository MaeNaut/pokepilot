// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SAVED_TEAM_SCHEMA_VERSION, type SavedTeamSummary } from "../utils/teamStorage";
import { TeamSyncConflictDialog } from "./TeamSyncConflictDialog";

vi.mock("../i18n/useLocalization", () => ({
  useLocalization: () => ({ locale: "en", t: (key: string) => key }),
}));

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

function team(name: string): SavedTeamSummary {
  return {
    version: SAVED_TEAM_SCHEMA_VERSION, id: "team-a", name, battleFormat: "singles",
    slots: [{ pokemonId: "pikachu", name: "Pikachu" }], bench: [],
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
  };
}

it("shows both versions and lets the visitor choose which one to keep", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const onResolve = vi.fn().mockReturnValue(true);
  await act(async () => {
    root.render(<TeamSyncConflictDialog conflicts={[{
      id: "team-a", local: team("Mobile"), remote: team("Desktop"),
    }]} onResolve={onResolve} />);
  });
  const dialog = document.querySelector<HTMLDialogElement>(".team-sync-conflict-dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain("Mobile");
  expect(dialog.textContent).toContain("Desktop");
  expect(dialog.querySelector<HTMLInputElement>('input[value="both"]')?.checked).toBe(true);
  await act(async () => { dialog.querySelector<HTMLInputElement>('input[value="remote"]')?.click(); });
  await act(async () => { dialog.querySelector<HTMLButtonElement>("footer button")?.click(); });
  expect(onResolve).toHaveBeenCalledWith({ "team-a": "remote" });
});

it("defaults to the account deletion when an old browser still has the team", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => {
    root.render(<TeamSyncConflictDialog conflicts={[{
      id: "team-a", local: team("Mobile"), remote: null,
    }]} onResolve={() => true} />);
  });
  const dialog = document.querySelector<HTMLDialogElement>(".team-sync-conflict-dialog")!;
  expect(dialog.querySelector<HTMLInputElement>('input[value="remote"]')?.checked).toBe(true);
});

it("requires an explicit team removal for a capacity conflict", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const onResolve = vi.fn().mockReturnValue(true);
  await act(async () => {
    root.render(<TeamSyncConflictDialog conflicts={[{
      id: "team-a", local: team("Mobile"), remote: team("Desktop"), reason: "capacity",
    }]} onResolve={onResolve} />);
  });
  const dialog = document.querySelector<HTMLDialogElement>(".team-sync-conflict-dialog")!;
  expect(dialog.textContent).toContain("team.syncCapacityDescription");
  expect(dialog.querySelector<HTMLInputElement>('input[value="remote"]')?.checked).toBe(true);
  await act(async () => { dialog.querySelector<HTMLInputElement>('input[value="discard"]')?.click(); });
  await act(async () => { dialog.querySelector<HTMLButtonElement>("footer button")?.click(); });
  expect(onResolve).toHaveBeenCalledWith({ "team-a": "discard" });
});
