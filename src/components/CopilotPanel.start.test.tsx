// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CopilotPanel } from "./CopilotPanel";
import { deferred } from "../test/renderHook";
import { loadBattleUsageSource } from "../api/battleUsage";

const state = vi.hoisted(() => ({
  save: vi.fn(), prepare: vi.fn(), analyze: vi.fn(), authenticate: vi.fn(),
  analysis: { status: "idle" } as Record<string, unknown>,
  response: undefined as Record<string, unknown> | undefined,
}));
const source = { provider: "champions-battle-data" as const, season: "M7", sourceDate: "2026-10-02", generatedAt: "2026-10-02T00:00:00Z" };
vi.mock("../api/battleUsage", () => ({ loadBattleUsageSource: vi.fn() }));
vi.mock("../i18n/useLocalization", () => ({ useLocalization: () => ({ locale: "en", t: (key: string, vars: unknown) => key + (vars ? JSON.stringify(vars) : "") }) }));
vi.mock("../hooks/useCopilotRequestPreparation", () => ({ useCopilotRequestPreparation: () => ({
  request: { scope: "pokemon", sets: [] }, prepareRequest: state.prepare, isAnalysisPreparing: false,
  recommendationState: {}, optimizationState: {}, matchupState: {},
}) }));
vi.mock("../hooks/useCopilotAnalysisSession", () => ({ useCopilotAnalysisSession: () => ({
  analysisState: state.analysis, response: state.response, requestFingerprint: "context", teamHistory: [], analyze: state.analyze,
}) }));
vi.mock("./CopilotAnalysisResult", () => ({ CopilotAnalysisResult: () => <p>Analysis result</p> }));

const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadBattleUsageSource).mockResolvedValue(source);
  state.analysis = { status: "idle" }; state.response = undefined;
  state.authenticate.mockResolvedValue(true);
  state.save.mockResolvedValue({ teamId: "saved", isCurrent: () => true });
  state.prepare.mockResolvedValue({ scope: "pokemon", sets: [] });
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
type Props = ComponentProps<typeof CopilotPanel>;
async function mount(scope: "pokemon" | "optimization" = "pokemon") {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const props = {
    analysisPreference: { scope, reasoningEffort: "low" }, setAnalysisPreference: () => {},
    account: { enabled: true, status: "ready", user: { id: "a" }, hasPersonalApiKey: true,
      personalApiKeyStatus: "ready", ensureAuthenticated: state.authenticate },
    savedTeamId: null, onSaveTeamForAnalysis: state.save, battleFormat: "singles", team: [{ id: "garchomp" }],
    selectedSlot: 0, abilityIndexStatus: "ready", showdownLegalityStatus: "ready",
  } as unknown as Props;
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const render = async () => { await act(async () => { root.render(<CopilotPanel {...props} />); }); };
  await render();
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  const confirm = async () => {
    await act(async () => { container.querySelector<HTMLButtonElement>(".copilot-analyze-button")!.click(); });
    const button = container.querySelector<HTMLButtonElement>(".copilot-analyze-confirmation-actions button:last-child")!;
    await act(async () => { button.click(); button.click(); });
  };
  return { container, props, render, confirm };
}

it("waits for team save before preparation/AI and prevents duplicate submissions", async () => {
  const saved = deferred<{ teamId: string; isCurrent: () => boolean }>();
  state.save.mockReturnValue(saved.promise);
  const app = await mount();
  await app.confirm();
  expect(state.save).toHaveBeenCalledTimes(1);
  expect(state.prepare).not.toHaveBeenCalled();
  expect(state.analyze).not.toHaveBeenCalled();
  await act(async () => { saved.resolve({ teamId: "new-team", isCurrent: () => true }); });
  expect(state.analyze).toHaveBeenCalledWith({ scope: "pokemon", sets: [] }, { teamId: "new-team" });
});

it.each(["failed", "conflict", "auth"])("does not call AI or preparation when saving/auth is blocked: %s", async (kind) => {
  if (kind === "auth") state.authenticate.mockResolvedValue(false);
  else state.save.mockResolvedValue(null);
  const app = await mount(); await app.confirm();
  expect(state.prepare).not.toHaveBeenCalled(); expect(state.analyze).not.toHaveBeenCalled();
  if (kind !== "auth") expect(app.container.querySelector('[role="alert"]')?.textContent).toContain("copilot.autoSaveFailed");
});

it("does not call AI after the team changes during request preparation", async () => {
  let current = true;
  state.save.mockResolvedValue({ teamId: "saved", isCurrent: () => current });
  const prepared = deferred<unknown>(); state.prepare.mockReturnValue(prepared.promise);
  const app = await mount(); await app.confirm(); current = false;
  await act(async () => { prepared.resolve({ scope: "pokemon", sets: [] }); });
  expect(state.analyze).not.toHaveBeenCalled();
});

it("records the statistics snapshot for a new usage-based analysis", async () => {
  const app = await mount("optimization"); await app.confirm();
  expect(state.analyze).toHaveBeenCalledWith(expect.anything(), { teamId: "saved", usageSource: source });
});

it("does not call AI if statistics roll over during request preparation", async () => {
  const app = await mount("optimization");
  vi.mocked(loadBattleUsageSource).mockResolvedValueOnce(source)
    .mockResolvedValue({ ...source, season: "M8", sourceDate: "2026-10-03" });
  await app.confirm();
  expect(state.analyze).not.toHaveBeenCalled();
  expect(app.container.querySelector('[role="alert"]')?.textContent).toContain("copilot.autoSaveFailed");
});

it.each([false, true])("never labels old history with the current statistics date (legacy=%s)", async (legacy) => {
  state.response = { title: "Old result" };
  state.analysis = { status: "ready", ...(legacy ? {} : { usageSource: { ...source, season: "M6", sourceDate: "2026-10-01" } }) };
  const app = await mount("optimization");
  const footer = app.container.querySelector(".copilot-footer")!.textContent;
  expect(footer).not.toContain("2026-10-02");
  expect(footer).toContain(legacy ? "copilot.analysisUsageUnknown" : "2026-10-01");
  expect(app.container.textContent?.includes("copilot.usageChanged")).toBe(!legacy);
});
