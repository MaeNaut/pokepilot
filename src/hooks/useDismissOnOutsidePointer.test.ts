// @vitest-environment jsdom
import { act, createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook } from "../test/renderHook";
import { useDismissOnOutsidePointer } from "./useDismissOnOutsidePointer";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function element() {
  const ref = createRef<HTMLDivElement>();
  ref.current = document.createElement("div");
  document.body.append(ref.current);
  return ref;
}
function options() {
  return { container: element(), enabled: true, dismiss: vi.fn(), portals: [element()] };
}
async function mount(props = options()) {
  const hook = await renderHook((input: typeof props) =>
    useDismissOnOutsidePointer(input.container, input.enabled, input.dismiss, input.portals),
  props, true);
  cleanups.push(hook.unmount);
  return { hook, props };
}
async function pointer(target: Node) {
  await act(async () => { target.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
}

it("ignores the anchor and nested content inside a portalled menu", async () => {
  const { props } = await mount();
  const child = document.createElement("button");
  props.portals[0].current!.append(child);
  await pointer(props.container.current!);
  await pointer(child);
  expect(props.dismiss).not.toHaveBeenCalled();
  await pointer(document.body);
  expect(props.dismiss).toHaveBeenCalledTimes(1);
});

it("subscribes only while enabled and cleans up on disable", async () => {
  const { hook, props } = await mount({ ...options(), enabled: false });
  await pointer(document.body);
  expect(props.dismiss).not.toHaveBeenCalled();
  await hook.rerender({ ...props, enabled: true });
  await pointer(document.body);
  expect(props.dismiss).toHaveBeenCalledTimes(1);
  await hook.rerender(props);
  await pointer(document.body);
  expect(props.dismiss).toHaveBeenCalledTimes(1);
});

it("uses the latest callback and portal refs without resubscribing", async () => {
  const { hook, props } = await mount();
  const add = vi.spyOn(document, "addEventListener");
  const dismiss = vi.fn();
  const portal = element();
  await hook.rerender({ ...props, dismiss, portals: [portal] });
  await pointer(portal.current!);
  expect(dismiss).not.toHaveBeenCalled();
  await pointer(props.portals[0].current!);
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(props.dismiss).not.toHaveBeenCalled();
  expect(add.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(0);
});

it("stops handling events after unmount", async () => {
  const { hook, props } = await mount();
  await hook.unmount();
  cleanups.pop();
  await pointer(document.body);
  expect(props.dismiss).not.toHaveBeenCalled();
});

it("supports the original single-container API and late ref attachment", async () => {
  const ref = createRef<HTMLDivElement>();
  const dismiss = vi.fn();
  const hook = await renderHook(() => useDismissOnOutsidePointer(ref, true, dismiss), undefined);
  cleanups.push(hook.unmount);
  ref.current = document.createElement("div");
  document.body.append(ref.current);
  await pointer(ref.current);
  expect(dismiss).not.toHaveBeenCalled();
  await pointer(document.body);
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it("leaves Escape behavior to the consuming component", async () => {
  const { props } = await mount();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(props.dismiss).not.toHaveBeenCalled();
});
