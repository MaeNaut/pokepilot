import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useDismissOnOutsidePointer<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  enabled: boolean,
  onDismiss: () => void,
  additionalRefs: readonly RefObject<HTMLElement | null>[] = [],
) {
  const onDismissRef = useRef(onDismiss);
  const additionalRefsRef = useRef(additionalRefs);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    additionalRefsRef.current = additionalRefs;
  }, [additionalRefs]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !additionalRefsRef.current.some((ref) => ref.current?.contains(target))
      ) {
        onDismissRef.current();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [containerRef, enabled]);
}
