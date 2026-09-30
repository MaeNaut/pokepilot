// @vitest-environment jsdom
import { act, useState } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { renderHook } from "../test/renderHook";
import type { TeamMember } from "../types";
import { createEmptyBuildState, normalizeSavedTeam } from "../utils/teamStorage";
import { useTeamWorkspace } from "./useTeamWorkspace";
import { MAX_BENCH_POKEMON } from "../data/teamLimits";
import { getPokemonBuildSnapshot } from "../utils/benchPokemon";

const cleanups: Array<() => Promise<void>> = [];
const member: TeamMember = { id: "lucario", name: "Lucario", types: ["fighting", "steel"], roles: [], source: "local" };
const imported = {
  members: [null, member, null, null, null, null],
  buildState: { ...createEmptyBuildState(), abilityBySlot: { 1: "inner-focus" } },
};
beforeEach(() => localStorage.clear());
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount() {
  const hook = await renderHook(() => {
    const [battleFormat, setBattleFormat] = useState<BattleFormat>("singles");
    return useTeamWorkspace({ battleFormat, setBattleFormat, untitledName: "Untitled Team" });
  }, undefined, true);
  cleanups.push(hook.unmount);
  return hook;
}

it("imports all build state as dirty, then commits the selected saved identity", async () => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  expect(hook.current.selectedTeamSlot).toBe(1);
  expect(hook.current.teamBuildState.abilityBySlot).toEqual({ 1: "inner-focus" });
  expect(hook.current.teamNameDraft).toBe("Imported");
  expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
  await act(async () => { hook.current.markWorkspaceSaved("saved", "Imported"); });
  expect(hook.current.activeSavedTeamId).toBe("saved");
  expect(localStorage.getItem("pokepilot.lastActiveTeam.v1")).toBe("saved");
  expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
});

it("loads saved format and build together without changing the selected slot", async () => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  const saved = normalizeSavedTeam({
    ...hook.current.getCurrentTeamSnapshot(), id: "saved", battleFormat: "doubles",
  })!;
  await act(async () => { hook.current.loadWorkspace(saved, imported.members, []); });
  expect(hook.current.getCurrentTeamSnapshot().battleFormat).toBe("doubles");
  expect(hook.current.selectedTeamSlot).toBe(1);
  expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
  await act(async () => { hook.current.teamBuildState.patchSlot(1, { ability: "steadfast" }); });
  expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
});

it.each(["new-team", "account-change"] as const)("clears team, identity and builds on %s", async (reason) => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  await act(async () => { hook.current.markWorkspaceSaved("saved", "Imported"); });
  await act(async () => { hook.current.resetWorkspace(reason); });
  expect(hook.current.team).toEqual(Array(6).fill(null));
  expect(hook.current.bench).toEqual([]);
  expect(hook.current.teamBuildState.getBuildStateSnapshot()).toEqual(createEmptyBuildState());
  expect(hook.current.teamName).toBe("Untitled Team");
  expect(hook.current.activeSavedTeamId).toBeNull();
  expect(localStorage.getItem("pokepilot.lastActiveTeam.v1")).toBeNull();
  expect(hook.current.selectedTeamSlot).toBe(reason === "new-team" ? 1 : 0);
  expect(hook.current.hasUnsavedTeamChanges()).toBe(false);
  await act(async () => { hook.current.setTeam(imported.members); });
  expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
});

it("detaches a deleted saved team without discarding its working contents", async () => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  await act(async () => { hook.current.markWorkspaceSaved("saved", "Imported"); });
  await act(async () => { hook.current.detachSavedTeam(); });
  expect(hook.current.activeSavedTeamId).toBeNull();
  expect(hook.current.team).toEqual(imported.members);
  expect(hook.current.hasUnsavedTeamChanges()).toBe(true);
});

it("moves a Pokemon and its build to the bench and restores them in another slot", async () => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  await act(async () => {
    hook.current.teamBuildState.patchSlot(1, {
      moveIds: ["protect"], preMegaPokemon: "lucario", preMegaAbility: "inner-focus",
    });
  });
  const build = getPokemonBuildSnapshot(member, hook.current.teamBuildState.getBuildStateSnapshot(), 1);
  await act(async () => { hook.current.handleMoveTeamPokemonToBench(1); });
  expect(hook.current.team[1]).toBeNull();
  expect(hook.current.bench[0].build).toEqual(build);
  expect(hook.current.teamBuildState.abilityBySlot[1]).toBeUndefined();
  await act(async () => { hook.current.handleMoveBenchPokemonToTeam(0, 3); });
  expect(hook.current.bench).toHaveLength(0);
  expect(hook.current.team[3]).toEqual(member);
  expect(hook.current.selectedTeamSlot).toBe(3);
  expect(getPokemonBuildSnapshot(member, hook.current.teamBuildState.getBuildStateSnapshot(), 3)).toEqual(build);
});

it("reorders Pokemon and build state together without changing the selected tab", async () => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  await act(async () => { hook.current.handleReorderSlots(1, 4); });
  expect(hook.current.team[1]).toBeNull();
  expect(hook.current.team[4]).toEqual(member);
  expect(hook.current.teamBuildState.abilityBySlot[4]).toBe("inner-focus");
  expect(hook.current.teamBuildState.abilityBySlot[1]).toBeUndefined();
  expect(hook.current.selectedTeamSlot).toBe(1);
});

it("preserves an occupied destination on the bench when swapping back into the team", async () => {
  const hook = await mount();
  const other = { ...member, id: "pikachu", name: "Pikachu" };
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  await act(async () => { hook.current.handleMoveTeamPokemonToBench(1); });
  await act(async () => {
    hook.current.setTeam([other, null, null, null, null, null]);
    hook.current.teamBuildState.patchSlot(0, { ability: "static", moveIds: ["thunderbolt"] });
  });
  await act(async () => { hook.current.handleMoveBenchPokemonToTeam(0, 0); });
  expect(hook.current.team[0]?.id).toBe("lucario");
  expect(hook.current.teamBuildState.abilityBySlot[0]).toBe("inner-focus");
  expect(hook.current.bench[0]).toMatchObject({
    member: { id: "pikachu" }, build: { ability: "static", moveIds: ["thunderbolt"] },
  });
});

it("respects bench capacity, reorder and removal without altering the active team", async () => {
  const hook = await mount();
  await act(async () => { hook.current.importWorkspace(imported, "Imported"); });
  const build = getPokemonBuildSnapshot(member, imported.buildState, 1);
  await act(async () => {
    hook.current.setBench(Array.from({ length: MAX_BENCH_POKEMON }, (_, id) => ({ id: String(id), member, build })));
  });
  await act(async () => { hook.current.handleMoveTeamPokemonToBench(1); });
  expect(hook.current.team).toEqual(imported.members);
  expect(hook.current.bench).toHaveLength(MAX_BENCH_POKEMON);
  await act(async () => { hook.current.handleReorderBenchPokemon(0, 1); });
  expect(hook.current.bench.slice(0, 2).map((entry) => entry.id)).toEqual(["1", "0"]);
  await act(async () => { hook.current.handleRemoveBenchPokemon("1"); });
  expect(hook.current.bench).toHaveLength(MAX_BENCH_POKEMON - 1);
  expect(hook.current.team).toEqual(imported.members);
});
