// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadPopularSmogonSet, type SmogonUsageSet } from "../api/smogonUsage";
import { deferred, renderHook } from "../test/renderHook";
import type { TeamMember } from "../types";
import { useCalculatorUsage } from "./useCalculatorUsage";

vi.mock("../api/smogonUsage", async (original) => ({
  ...await original<typeof import("../api/smogonUsage")>(),
  loadPopularSmogonSet: vi.fn(),
}));

const member: TeamMember = {
  id: "garchomp", name: "Garchomp", types: ["dragon", "ground"], roles: [],
  moves: [{
    id: "earthquake", name: "Earthquake", type: "ground", category: "Physical",
    power: 100, accuracy: 100, pp: 10, description: "",
  }],
};
const usage: SmogonUsageSet = {
  pokemonId: member.id, pokemonName: member.name, sourceMonth: "2026-09",
  cutoff: 1630, moveIds: ["earthquake"], itemName: "Life Orb",
};
const options: Parameters<typeof useCalculatorUsage>[0] = {
  member, fallbackMoves: [], battleFormat: "singles",
  itemOptions: [{ id: 1, name: "lifeorb", showdownId: "lifeorb", displayName: "Life Orb", isMegaStone: false }],
};
const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => { vi.mocked(loadPopularSmogonSet).mockReset().mockResolvedValue(usage); });
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

it("shares one usage load between moves and items and reapplies item eligibility locally", async () => {
  const hook = await renderHook(useCalculatorUsage, options);
  cleanups.push(hook.unmount);
  expect(hook.current.moves.map(({ id }) => id)).toEqual(["earthquake"]);
  expect(hook.current.items.map(({ showdownId }) => showdownId)).toEqual(["lifeorb"]);

  await hook.rerender({ ...options, itemOptions: [] });
  expect(hook.current.moves.map(({ id }) => id)).toEqual(["earthquake"]);
  expect(hook.current.items).toEqual([]);
  expect(loadPopularSmogonSet).toHaveBeenCalledTimes(1);
});

it("clears both suggestions on format change and ignores the abandoned format response", async () => {
  const singles = deferred<SmogonUsageSet | null>();
  const doubles = deferred<SmogonUsageSet | null>();
  vi.mocked(loadPopularSmogonSet)
    .mockReturnValueOnce(singles.promise)
    .mockReturnValueOnce(doubles.promise);
  const hook = await renderHook(useCalculatorUsage, options);
  cleanups.push(hook.unmount);
  await hook.rerender({ ...options, battleFormat: "doubles" });
  await act(async () => { singles.resolve(usage); });
  expect(hook.current).toEqual({ moves: [], items: [] });

  await act(async () => { doubles.resolve({ ...usage, itemName: undefined }); });
  expect(hook.current.moves.map(({ id }) => id)).toEqual(["earthquake"]);
  expect(hook.current.items).toEqual([]);
  expect(loadPopularSmogonSet).toHaveBeenCalledTimes(2);
});
