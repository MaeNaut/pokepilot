// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import {
  createPokemonRecommendationOptions,
  createUniversalPokemonRecommendationCandidates,
  type CopilotRecommendationCandidateSnapshot,
} from "../utils/pokemonRecommendations";
import { createEmptyBuildState } from "../utils/teamBuildState";
import { analyzeTeam } from "../utils/teamDiagnostics";
import { useCopilotRecommendationCandidates } from "./useCopilotRecommendationCandidates";

vi.mock("../utils/pokemonRecommendations", () => ({
  createPokemonRecommendationOptions: vi.fn(() => []),
  createPokemonRecommendationTargets: vi.fn(() => []),
  createUniversalPokemonRecommendationCandidates: vi.fn(),
}));
vi.mock("../i18n/useLocalization", () => {
  const localization = { gameName: vi.fn(), pokemonName: vi.fn() };
  return { useLocalization: () => localization };
});

type Options = Parameters<typeof useCopilotRecommendationCandidates>[0];
const options: Options = {
  scope: "recommendation", selectedSlot: 0, team: [],
  buildState: createEmptyBuildState(), battleFormat: "singles",
  diagnostics: analyzeTeam([], createEmptyBuildState()),
  pokemonIndex: [], abilityIndex: [], abilityIndexStatus: "ready",
  showdownLegality: null, showdownLegalityStatus: "ready",
};
const candidates = [{ pokemonId: "garchomp" }] as CopilotRecommendationCandidateSnapshot[];
const cleanups: Array<() => Promise<void>> = [];
const frames = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createUniversalPokemonRecommendationCandidates).mockReset().mockResolvedValue(candidates);
  let frameId = 0;
  frames.clear();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
});

async function mount() {
  const hook = await renderHook(useCopilotRecommendationCandidates, options);
  let mounted = true;
  const unmount = async () => {
    if (!mounted) return;
    mounted = false;
    await hook.unmount();
  };
  cleanups.push(unmount);
  return { hook, unmount };
}

async function paint() {
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  });
}

it("publishes candidates only after the loading state can paint", async () => {
  const { hook } = await mount();
  let result!: ReturnType<typeof hook.current.run>;
  await act(async () => { result = hook.current.run(); });
  expect(hook.current.status).toBe("loading");
  expect(createPokemonRecommendationOptions).not.toHaveBeenCalled();
  await paint();
  await expect(result).resolves.toEqual(candidates);
  expect(hook.current).toMatchObject({ status: "ready", candidates });
});

it("cancels before ranking when the recommendation tab closes before the frame", async () => {
  const { hook } = await mount();
  let result!: ReturnType<typeof hook.current.run>;
  await act(async () => { result = hook.current.run(); });
  await hook.rerender({ ...options, scope: "team" });
  await expect(result).resolves.toBeNull();
  expect(frames.size).toBe(0);
  expect(createPokemonRecommendationOptions).not.toHaveBeenCalled();
  expect(hook.current.status).toBe("idle");
});

it.each<Partial<Options>>([
  { scope: "pokemon" },
  { battleFormat: "doubles" },
  { buildState: createEmptyBuildState() },
])("discards pending candidates after an input change: %j", async (changes) => {
  const pending = deferred<CopilotRecommendationCandidateSnapshot[]>();
  vi.mocked(createUniversalPokemonRecommendationCandidates).mockReturnValue(pending.promise);
  const { hook } = await mount();
  let result!: ReturnType<typeof hook.current.run>;
  await act(async () => { result = hook.current.run(); });
  await paint();
  await hook.rerender({ ...options, ...changes });
  await expect(result).resolves.toBeNull();
  await act(async () => { pending.resolve(candidates); });
  expect(hook.current).toMatchObject({ status: "idle", candidates: [] });
});

it("releases pending work on unmount and consumes its late rejection", async () => {
  const pending = deferred<CopilotRecommendationCandidateSnapshot[]>();
  vi.mocked(createUniversalPokemonRecommendationCandidates).mockReturnValue(pending.promise);
  const { hook, unmount } = await mount();
  let result!: ReturnType<typeof hook.current.run>;
  await act(async () => { result = hook.current.run(); });
  await paint();
  await unmount();
  await expect(result).resolves.toBeNull();
  await act(async () => { pending.reject(new Error("late failure")); });
});

it("keeps the newest run when an older request finishes last", async () => {
  const pending = deferred<CopilotRecommendationCandidateSnapshot[]>();
  vi.mocked(createUniversalPokemonRecommendationCandidates).mockReturnValueOnce(pending.promise);
  const { hook } = await mount();
  let first!: ReturnType<typeof hook.current.run>;
  await act(async () => { first = hook.current.run(); });
  await paint();
  let second!: ReturnType<typeof hook.current.run>;
  await act(async () => { second = hook.current.run(); });
  await expect(first).resolves.toBeNull();
  await paint();
  await expect(second).resolves.toEqual(candidates);
  await act(async () => { pending.resolve([]); });
  expect(hook.current).toMatchObject({ status: "ready", candidates });
});

it("reports a current failure and allows a retry", async () => {
  vi.mocked(createUniversalPokemonRecommendationCandidates).mockRejectedValueOnce(new Error("offline"));
  const { hook } = await mount();
  await act(async () => { void hook.current.run(); });
  await paint();
  expect(hook.current).toMatchObject({ status: "error", candidates: [] });
  await act(async () => { void hook.current.run(); });
  await paint();
  expect(hook.current).toMatchObject({ status: "ready", candidates });
});
