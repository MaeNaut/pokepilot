import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export async function renderHook<P, T>(hook: (props: P) => T, props: P, strict = false) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let current!: T;
  function Harness(value: { props: P }) {
    current = hook(value.props);
    return null;
  }
  async function rerender(next: P) {
    await act(async () => {
      const child = createElement(Harness, { props: next });
      root.render(strict ? createElement(StrictMode, null, child) : child);
    });
  }
  await rerender(props);
  return {
    get current() { return current; },
    rerender,
    async unmount() {
      await act(async () => { root.unmount(); });
      container.remove();
    },
  };
}
