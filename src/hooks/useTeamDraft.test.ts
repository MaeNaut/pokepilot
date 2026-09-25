// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "../test/renderHook";
import type { TeamSlot } from "../types";
import { createEmptyBuildState } from "../utils/teamStorage";
import { useTeamDraft } from "./useTeamDraft";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
function defaults(): Parameters<typeof useTeamDraft>[0] {
  return { team: Array<TeamSlot>(6).fill(null), bench: [], buildState: createEmptyBuildState(),
    battleFormat: "singles", activeSavedTeamId: null, untitledName: "Untitled Team" };
}
async function mount(props = defaults()) {
  const hook = await renderHook(useTeamDraft, props, true);
  cleanups.push(hook.unmount);
  return hook;
}

describe("team draft checkpoints", () => {
  it("keeps the initial no-checkpoint policy and compares committed drafts", async () => {
    const props = defaults();
    const hook = await mount(props);
    expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
    hook.current.markCurrentTeamCommitted();
    expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
    await hook.rerender({ ...props, battleFormat: "doubles" });
    expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
    hook.current.setCommittedSnapshot(null);
    expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
  });
  it("trims names and substitutes the localized default", async () => {
    const hook = await mount();
    await act(async () => { hook.current.setTeamNameDraft("  Rain  "); });
    await act(async () => { expect(hook.current.commitTeamName()).toBe("Rain"); });
    expect(hook.current.teamName).toBe("Rain");
    await act(async () => { hook.current.setTeamNameDraft("  "); });
    expect(hook.current.getCurrentTeamSnapshot().name).toBe("Untitled Team");
  });
  it("renames only the baseline name, preserving unsaved moves", async () => {
    const props = defaults();
    const hook = await mount(props);
    hook.current.markCurrentTeamCommitted();
    await hook.rerender({ ...props, buildState: { ...props.buildState, moveIdsBySlot: { 0: ["protect"] } } });
    await act(async () => { hook.current.setTeamNameDraft("Rain"); });
    hook.current.renameCommittedSnapshot("Rain");
    expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
    hook.current.markCurrentTeamCommitted();
    expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
  });
  it("does not treat automatic untitled-name localization as an edit", async () => {
    const props = defaults();
    const hook = await mount(props);
    hook.current.markCurrentTeamCommitted();
    await hook.rerender({ ...props, untitledName: "이름 없는 팀" });
    expect(hook.current.teamNameDraft).toBe("이름 없는 팀");
    expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
  });
  it("does not localize saved or manually edited names", async () => {
    const props = { ...defaults(), activeSavedTeamId: "saved" };
    const hook = await mount(props);
    await hook.rerender({ ...props, untitledName: "이름 없는 팀" });
    expect(hook.current.teamNameDraft).toBe("Untitled Team");
    await act(async () => { hook.current.setTeamNameDraft("Rain"); });
    await hook.rerender({ ...props, activeSavedTeamId: null, untitledName: "이름 없는 팀" });
    expect(hook.current.teamNameDraft).toBe("Rain");
  });
  it("ignores hydrated display metadata but detects member and move changes", async () => {
    const props = defaults();
    props.team[0] = { id: "charizard", name: "Charizard", types: ["fire"], roles: [], spriteUrl: "old", source: "local" };
    const hook = await mount(props);
    hook.current.markCurrentTeamCommitted();
    await hook.rerender({ ...props, team: [{ ...props.team[0]!, name: "리자몽", spriteUrl: "new" }, ...props.team.slice(1)] });
    expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
    await hook.rerender({ ...props, team: Array<TeamSlot>(6).fill(null) });
    expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
  });
});
