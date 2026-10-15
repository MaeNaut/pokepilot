// @vitest-environment jsdom
import { act, useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CopilotAnalyzeControl } from "./CopilotAnalyzeControl";
import { CopilotModelControl } from "./CopilotModelControl";
import { estimateCopilotAnalysis } from "../utils/copilotEstimate";
import type { CopilotAnalysisRequest } from "../utils/copilotContracts";
import { deferred } from "../test/renderHook";

vi.mock("../utils/copilotEstimate", () => ({ estimateCopilotAnalysis: vi.fn() }));
const request = { scope: "team" } as CopilotAnalysisRequest;
beforeEach(() => {
  vi.mocked(estimateCopilotAnalysis).mockReset().mockResolvedValue({
    inputTokens: 12000, totalTokens: [14000, 16000], seconds: [12, 24], costUsd: [0.002, 0.0032],
  });
});

vi.mock("../i18n/useLocalization", () => ({
  useLocalization: () => ({
    locale: "en",
    t: (key: string, values?: Record<string, unknown>) => values ? key + JSON.stringify(values) : key,
  }),
}));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function mount(node: ReactNode) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async (next: ReactNode) => { await act(async () => { root.render(next); }); };
  await render(node);
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  return { container, render };
}
async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => { (element as HTMLElement).click(); });
}
type AnalyzeProps = ComponentProps<typeof CopilotAnalyzeControl>;
function AnalyzeHarness(props: Partial<AnalyzeProps>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <CopilotAnalyzeControl scope="team" request={request} reasoningEffort="low"
    isAnalyzeDisabled={false} isBusy={false} hasResponse={false}
    hasPersonalApiKey={true} analyzeLabel="Analyze" onConfirm={() => {}}
    {...props} isAnalyzeConfirmationOpen={open}
    onRequest={() => setOpen(true)} onClose={close} />;
}

it("asks for confirmation before analysis and displays the matching estimates", async () => {
  const onConfirm = vi.fn();
  const { container } = await mount(<AnalyzeHarness onConfirm={onConfirm} />);
  await click(container.querySelector(".copilot-analyze-button"));
  expect(onConfirm).not.toHaveBeenCalled();
  const dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('12–24');
  expect(dialog.textContent).toContain('14,000–16,000');
  expect(dialog.textContent).toContain('$0.0020–$0.0032');
  expect(dialog.textContent).toContain("copilot.autoSaveNotice");
  expect(document.activeElement).toBe(dialog.querySelector("strong"));
  await click(dialog.querySelectorAll("button")[1]);
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it("does not submit while estimating, aborts on dismiss, and ignores a late estimate", async () => {
  const pending = deferred<null>();
  vi.mocked(estimateCopilotAnalysis).mockReturnValueOnce(pending.promise);
  const onConfirm = vi.fn();
  const { container } = await mount(<AnalyzeHarness onConfirm={onConfirm} />);
  await click(container.querySelector(".copilot-analyze-button"));
  expect(container.textContent).toContain("copilot.estimateLoading");
  const confirm = container.querySelector<HTMLButtonElement>(".copilot-analyze-confirmation-actions button:last-child")!;
  expect(confirm.disabled).toBe(true);
  await click(confirm);
  expect(onConfirm).not.toHaveBeenCalled();
  const signal = vi.mocked(estimateCopilotAnalysis).mock.calls[0][2];
  await click(container.querySelector(".copilot-analyze-confirmation-actions button"));
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(null));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("allows explicit confirmation without a fabricated price if the estimate fails", async () => {
  vi.mocked(estimateCopilotAnalysis).mockRejectedValueOnce(new Error("Worker unavailable"));
  const onConfirm = vi.fn();
  const { container } = await mount(<AnalyzeHarness onConfirm={onConfirm} />);
  await click(container.querySelector(".copilot-analyze-button"));
  expect(container.textContent).toContain("copilot.estimateUnavailable");
  await click(container.querySelector(".copilot-analyze-confirmation-actions button:last-child"));
  expect(onConfirm).toHaveBeenCalledOnce();
});

it("shows elapsed time only during analysis and resets it for the next request", async () => {
  vi.useFakeTimers();
  try {
    const start = new Date("2026-10-14T12:00:00Z").getTime();
    vi.setSystemTime(start);
    const { container, render } = await mount(<AnalyzeHarness isBusy isAnalyzeDisabled startedAt={start} />);
    expect(container.querySelector(".copilot-analyze-timer")?.textContent).toBe("0:00");
    await act(async () => { vi.advanceTimersByTime(65000); });
    expect(container.querySelector(".copilot-analyze-timer")?.textContent).toBe("1:05");
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("copilot.analyzing");
    await render(<AnalyzeHarness />);
    expect(container.querySelector(".copilot-analyze-timer")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await render(<AnalyzeHarness isBusy isAnalyzeDisabled startedAt={Date.now()} />);
    expect(container.querySelector(".copilot-analyze-timer")?.textContent).toBe("0:00");
  } finally { vi.useRealTimers(); }
});

it.each(["cancel", "Escape"])("returns focus to the analysis button on %s", async (action) => {
  const { container } = await mount(<AnalyzeHarness />);
  const trigger = container.querySelector(".copilot-analyze-button")!;
  await click(trigger);
  const dialog = container.querySelector('[role="dialog"]')!;
  if (action === "cancel") await click(dialog.querySelector("button"));
  else await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it.each([
  { scope: "pokemon" }, { reasoningEffort: "medium" }, { isAnalyzeDisabled: true },
] as Partial<AnalyzeProps>[])("closes confirmation when the analysis context changes: %j", async (props) => {
  const { container, render } = await mount(<AnalyzeHarness />);
  await click(container.querySelector(".copilot-analyze-button"));
  await render(<AnalyzeHarness {...props} />);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("keeps keyless model choices locked with their explanatory tooltip", async () => {
  const onChange = vi.fn();
  const { container } = await mount(<CopilotModelControl reasoningEffort="low" isPersonalModelAvailable={false} onChange={onChange} />);
  await click(container.querySelector(".copilot-reasoning-trigger"));
  const choices = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  expect(choices).toHaveLength(2);
  expect(choices.every((button) => button.disabled)).toBe(true);
  expect(container.querySelector('[role="tooltip"]')?.textContent).toContain("Requires your OpenAI API key");
  await click(choices[0]);
  expect(onChange).not.toHaveBeenCalled();
});

it("selects medium, closes the menu, and keeps stronger models first", async () => {
  const onChange = vi.fn();
  const { container } = await mount(<CopilotModelControl reasoningEffort="low" isPersonalModelAvailable onChange={onChange} />);
  await click(container.querySelector(".copilot-reasoning-trigger"));
  const choices = container.querySelectorAll('[role="menuitemradio"]');
  expect(choices[0].textContent).toContain("Luna medium");
  expect(choices[1].getAttribute("aria-checked")).toBe("true");
  await click(choices[0]);
  expect(onChange).toHaveBeenCalledWith("medium");
  expect(container.querySelector('[role="menu"]')).toBeNull();
});

it("dismisses the model menu on Escape and outside pointer input", async () => {
  const { container } = await mount(<CopilotModelControl reasoningEffort="low" isPersonalModelAvailable onChange={() => {}} />);
  const trigger = container.querySelector(".copilot-reasoning-trigger");
  await click(trigger);
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
  expect(container.querySelector('[role="menu"]')).toBeNull();
  await click(trigger);
  await act(async () => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
  expect(container.querySelector('[role="menu"]')).toBeNull();
});
