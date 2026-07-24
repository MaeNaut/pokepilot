import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useDismissOnOutsidePointer<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  enabled: boolean,
  onDismiss: () => void,
) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onDismissRef.current();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [containerRef, enabled]);
}
