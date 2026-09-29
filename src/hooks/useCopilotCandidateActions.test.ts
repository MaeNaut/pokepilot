// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { deferred, renderHook } from "../test/renderHook";
import type { CopilotAnalysisRequest, CopilotSetOptimizationCandidateSnapshot } from "../utils/copilotContracts";
import type { RecommendedPokemonApplyResult } from "../utils/recommendedPokemonApplication";
import { useCopilotCandidateActions } from "./useCopilotCandidateActions";

type Options = Parameters<typeof useCopilotCandidateActions>[0];
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
function options(): Options {
  return {
    scope: "recommendation", isStale: false, requestFingerprint: "first",
    request: { recommendationCandidates: [{ pokemonId: "lucario", target: { slotIndex: 2, currentPokemonId: "pikachu" } }] } as CopilotAnalysisRequest,
    setScope: vi.fn(),
    onSelectRecommendedPokemon: vi.fn().mockResolvedValue({ status: "applied" }),
    onSaveRecommendedPokemon: vi.fn().mockResolvedValue({ status: "saved" }),
    onApplyOptimizationCandidate: vi.fn(), onSaveOptimizationCandidate: vi.fn().mockReturnValue(true),
  };
}
async function mount(props = options()) {
  const hook = await renderHook(useCopilotCandidateActions, props);
  cleanups.push(hook.unmount);
  return { hook, props };
}

it("applies the intended target and opens its Pokemon analysis", async () => {
  const { hook, props } = await mount();
  await act(async () => { await hook.current.handleSelectCandidate("lucario"); });
  expect(props.onSelectRecommendedPokemon).toHaveBeenCalledWith(2, "lucario", "pikachu");
  expect(props.setScope).toHaveBeenCalledWith("pokemon");
  expect(hook.current.selectingCandidateId).toBeNull();
});

it.each([true, false])("blocks stale or absent candidates (stale=%s)", async (isStale) => {
  const { hook, props } = await mount({ ...options(), isStale });
  await act(async () => { await hook.current.handleSelectCandidate("missing"); });
  expect(props.onSelectRecommendedPokemon).not.toHaveBeenCalled();
  expect(hook.current.candidateApplyFailure).toBe("stale");
});

it("keeps other candidate actions blocked while application is pending", async () => {
  const pending = deferred<RecommendedPokemonApplyResult>();
  const props = options();
  vi.mocked(props.onSelectRecommendedPokemon).mockReturnValue(pending.promise);
  const { hook } = await mount(props);
  let operation!: Promise<void>;
  await act(async () => { operation = hook.current.handleSelectCandidate("lucario"); });
  await act(async () => { await hook.current.handleSaveCandidate("lucario"); });
  expect(props.onSaveRecommendedPokemon).not.toHaveBeenCalled();
  await act(async () => {
    pending.resolve({ status: "blocked", reason: "invalid", issueCodes: [] });
    await operation;
  });
  expect(hook.current.candidateApplyFailure).toBe("invalid");
  expect(props.setScope).not.toHaveBeenCalled();
});

it("reports bench capacity and clears notices when the request changes", async () => {
  const props = options();
  vi.mocked(props.onSaveRecommendedPokemon).mockResolvedValue({ status: "blocked", reason: "bench-full", issueCodes: [] });
  const { hook } = await mount(props);
  await act(async () => { await hook.current.handleSaveCandidate("lucario"); });
  expect(hook.current.candidateSaveStatus).toBe("bench-full");
  expect(hook.current.savingCandidateId).toBeNull();
  await hook.rerender({ ...props, requestFingerprint: "second" });
  expect(hook.current.candidateSaveStatus).toBeNull();
});

it("recovers from callback failure without leaving candidate controls busy", async () => {
  const props = options();
  vi.mocked(props.onSaveRecommendedPokemon).mockRejectedValue(new Error("network"));
  const { hook } = await mount(props);
  await act(async () => { await hook.current.handleSaveCandidate("lucario"); });
  expect(hook.current.candidateApplyFailure).toBe("load-failed");
  expect(hook.current.savingCandidateId).toBeNull();
});

it("guards stale optimizations and reports a successful save", async () => {
  const props = { ...options(), isStale: true };
  const { hook } = await mount(props);
  const candidate = { slotIndex: 2 } as CopilotSetOptimizationCandidateSnapshot;
  await act(async () => { hook.current.handleApplyOptimizationCandidate(candidate); });
  expect(props.onApplyOptimizationCandidate).not.toHaveBeenCalled();
  expect(hook.current.optimizationActionStatus).toBe("stale");
  await hook.rerender({ ...props, isStale: false, scope: "optimization" });
  expect(hook.current.optimizationActionStatus).toBeNull();
  await act(async () => { hook.current.handleSaveOptimizationCandidate(candidate); });
  expect(hook.current.optimizationActionStatus).toBe("saved");
});
