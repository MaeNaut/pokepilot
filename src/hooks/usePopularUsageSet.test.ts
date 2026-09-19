// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadPopularSmogonSet, type SmogonUsageSet } from "../api/smogonUsage";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { deferred, renderHook } from "../test/renderHook";
import { usePopularUsageSet } from "./usePopularUsageSet";

vi.mock("../api/smogonUsage", () => ({ loadPopularSmogonSet: vi.fn() }));
const sample: SmogonUsageSet = { pokemonId: "garchomp", pokemonName: "Garchomp", sourceMonth: "2026-09", cutoff: 0, moveIds: [] };
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => { vi.mocked(loadPopularSmogonSet).mockReset().mockResolvedValue(sample); });
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(id: string | null = "garchomp") {
  const hook = await renderHook((props: { id: string | null; format: BattleFormat }) => usePopularUsageSet(props.id, props.format), { id, format: "singles" });
  cleanups.push(hook.unmount);
  return hook;
}

it("does not request usage for an empty slot", async () => {
  const hook = await mount(null);
  expect(hook.current).toBeNull();
  expect(loadPopularSmogonSet).not.toHaveBeenCalled();
});

it("reuses loaded usage when unrelated renders occur", async () => {
  const hook = await mount();
  await hook.rerender({ id: "garchomp", format: "singles" });
  expect(hook.current).toEqual(sample);
  expect(loadPopularSmogonSet).toHaveBeenCalledTimes(1);
});

it("hides old data while a different format loads", async () => {
  const hook = await mount();
  const pending = deferred<SmogonUsageSet | null>();
  vi.mocked(loadPopularSmogonSet).mockReturnValue(pending.promise);
  await hook.rerender({ id: "garchomp", format: "doubles" });
  expect(hook.current).toBeNull();
  await act(async () => { pending.resolve(sample); });
  expect(hook.current).toEqual(sample);
});

it("ignores a late response after selection changes", async () => {
  const pending = deferred<SmogonUsageSet | null>();
  vi.mocked(loadPopularSmogonSet).mockReturnValueOnce(pending.promise);
  const hook = await mount();
  await hook.rerender({ id: null, format: "singles" });
  await act(async () => { pending.resolve(sample); });
  expect(hook.current).toBeNull();
});

it("treats usage failures as unavailable data and can recover", async () => {
  vi.mocked(loadPopularSmogonSet).mockRejectedValueOnce(new Error("offline"));
  const hook = await mount();
  expect(hook.current).toBeNull();
  await hook.rerender({ id: "garchomp", format: "doubles" });
  expect(hook.current).toEqual(sample);
});
