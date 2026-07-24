import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type ReorderGesture = {
  pointerId: number;
  pointerType: string;
  sourceIndex: number;
  targetIndex: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  itemCenters: ReorderItemCenter[];
  isDragging: boolean;
  holdTimer: number | null;
};

type ReorderItemCenter = {
  index: number;
  x: number;
  y: number;
};

export type ReorderDisplacement = {
  index: number;
  offsetX: number;
  offsetY: number;
};

export type ReorderDragState = {
  sourceIndex: number;
  targetIndex: number;
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  displacement: ReorderDisplacement | null;
  isDropping: boolean;
};

type UseLongPressReorderOptions = {
  containerRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  itemIndexAttribute?: string;
  itemSelector: string;
  onDragStart?: () => void;
  onReorder: (sourceIndex: number, targetIndex: number) => void;
  shouldAnimateSwapTarget?: (sourceIndex: number, targetIndex: number) => boolean;
};

const mouseDragDistance = 7;
const touchHoldDelay = 300;
const touchMoveTolerance = 10;
const dropSettleDuration = 150;

export function calculateSwapDisplacement(
  itemCenters: ReorderItemCenter[],
  sourceIndex: number,
  targetIndex: number,
) {
  if (sourceIndex === targetIndex) {
    return null;
  }

  const centersByIndex = new Map(itemCenters.map((center) => [center.index, center]));
  const source = centersByIndex.get(sourceIndex);
  const target = centersByIndex.get(targetIndex);

  if (!source || !target) {
    return null;
  }

  return {
    index: targetIndex,
    offsetX: source.x - target.x,
    offsetY: source.y - target.y,
  };
}

export function getReorderDisplacement(
  dragState: ReorderDragState | null,
  index: number,
) {
  return dragState?.displacement?.index === index ? dragState.displacement : null;
}

export function useLongPressReorder({
  containerRef,
  disabled = false,
  itemIndexAttribute,
  itemSelector,
  onDragStart,
  onReorder,
  shouldAnimateSwapTarget,
}: UseLongPressReorderOptions) {
  const gestureRef = useRef<ReorderGesture | null>(null);
  const dropTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [dragState, setDragState] = useState<ReorderDragState | null>(null);
  const isDragging = dragState !== null;

  useEffect(() => {
    return () => {
      const holdTimer = gestureRef.current?.holdTimer;

      if (holdTimer !== null && holdTimer !== undefined) {
        window.clearTimeout(holdTimer);
      }

      if (dropTimerRef.current !== null) {
        window.clearTimeout(dropTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function preventTouchScroll(event: TouchEvent) {
      event.preventDefault();
    }

    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [isDragging]);

  function startDrag(gesture: ReorderGesture, element: HTMLElement) {
    gesture.isDragging = true;
    gesture.holdTimer = null;
    onDragStart?.();

    try {
      element.setPointerCapture(gesture.pointerId);
    } catch {
      // The pointer may already have been released during the hold delay.
    }

    setDragState({
      sourceIndex: gesture.sourceIndex,
      targetIndex: gesture.sourceIndex,
      offsetX: 0,
      offsetY: 0,
      originX: gesture.originX,
      originY: gesture.originY,
      originWidth: gesture.originWidth,
      originHeight: gesture.originHeight,
      displacement: null,
      isDropping: false,
    });
  }

  function clearGesture(element?: HTMLElement) {
    const gesture = gestureRef.current;

    if (!gesture) {
      return;
    }

    if (gesture.holdTimer !== null) {
      window.clearTimeout(gesture.holdTimer);
    }

    if (element?.hasPointerCapture(gesture.pointerId)) {
      element.releasePointerCapture(gesture.pointerId);
    }

    gestureRef.current = null;
    setDragState(null);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLElement>,
    sourceIndex: number,
    originElement?: HTMLElement,
  ) {
    if (disabled || isDragging || event.button !== 0 || !event.isPrimary) {
      return;
    }

    const sourceRect = (originElement ?? event.currentTarget).getBoundingClientRect();
    const gesture: ReorderGesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceIndex,
      targetIndex: sourceIndex,
      startX: event.clientX,
      startY: event.clientY,
      originX: sourceRect.left,
      originY: sourceRect.top,
      originWidth: sourceRect.width,
      originHeight: sourceRect.height,
      itemCenters: Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? [],
        (element, orderIndex) => {
          const rect = element.getBoundingClientRect();
          const explicitIndex = itemIndexAttribute
            ? Number.parseInt(element.getAttribute(itemIndexAttribute) ?? "", 10)
            : Number.NaN;

          return {
            index: Number.isNaN(explicitIndex) ? orderIndex : explicitIndex,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        },
      ),
      isDragging: false,
      holdTimer: null,
    };

    gestureRef.current = gesture;

    if (event.pointerType === "touch") {
      const element = event.currentTarget;
      gesture.holdTimer = window.setTimeout(() => {
        if (gestureRef.current === gesture) {
          startDrag(gesture, element);
        }
      }, touchHoldDelay);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const offsetX = event.clientX - gesture.startX;
    const offsetY = event.clientY - gesture.startY;
    const distance = Math.hypot(offsetX, offsetY);

    if (!gesture.isDragging) {
      if (gesture.pointerType === "touch") {
        if (distance > touchMoveTolerance) {
          clearGesture();
        }
        return;
      }

      if (distance < mouseDragDistance) {
        return;
      }

      startDrag(gesture, event.currentTarget);
    }

    event.preventDefault();

    const distanceToPointer = (center: { x: number; y: number }) =>
      Math.hypot(event.clientX - center.x, event.clientY - center.y);
    const nextTargetIndex = gesture.itemCenters.length
      ? gesture.itemCenters.reduce((closestCenter, center) =>
          distanceToPointer(center) < distanceToPointer(closestCenter)
            ? center
            : closestCenter,
        ).index
      : gesture.sourceIndex;

    gesture.targetIndex = nextTargetIndex;
    setDragState({
      sourceIndex: gesture.sourceIndex,
      targetIndex: nextTargetIndex,
      offsetX,
      offsetY,
      originX: gesture.originX,
      originY: gesture.originY,
      originWidth: gesture.originWidth,
      originHeight: gesture.originHeight,
      displacement: null,
      isDropping: false,
    });
  }

  function settleDrop(gesture: ReorderGesture, element: HTMLElement) {
    if (gesture.holdTimer !== null) {
      window.clearTimeout(gesture.holdTimer);
    }

    if (element.hasPointerCapture(gesture.pointerId)) {
      element.releasePointerCapture(gesture.pointerId);
    }

    const sourceCenter = gesture.itemCenters.find(
      (center) => center.index === gesture.sourceIndex,
    ) ?? {
      index: gesture.sourceIndex,
      x: gesture.startX,
      y: gesture.startY,
    };
    const targetCenter =
      gesture.itemCenters.find((center) => center.index === gesture.targetIndex) ??
      sourceCenter;

    gestureRef.current = null;
    const animateSwapTarget =
      shouldAnimateSwapTarget?.(gesture.sourceIndex, gesture.targetIndex) ?? true;
    const displacement = animateSwapTarget
      ? calculateSwapDisplacement(
          gesture.itemCenters,
          gesture.sourceIndex,
          gesture.targetIndex,
        )
      : null;

    setDragState({
      sourceIndex: gesture.sourceIndex,
      targetIndex: gesture.targetIndex,
      offsetX: targetCenter.x - sourceCenter.x,
      offsetY: targetCenter.y - sourceCenter.y,
      originX: gesture.originX,
      originY: gesture.originY,
      originWidth: gesture.originWidth,
      originHeight: gesture.originHeight,
      displacement,
      isDropping: true,
    });

    dropTimerRef.current = window.setTimeout(() => {
      if (gesture.sourceIndex !== gesture.targetIndex) {
        onReorder(gesture.sourceIndex, gesture.targetIndex);
      }

      setDragState(null);
      dropTimerRef.current = null;
    }, dropSettleDuration);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (gesture.isDragging) {
      suppressClickUntilRef.current = window.performance.now() + 500;
      settleDrop(gesture, event.currentTarget);
      return;
    }

    clearGesture(event.currentTarget);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLElement>) {
    if (gestureRef.current?.pointerId === event.pointerId) {
      clearGesture(event.currentTarget);
    }
  }

  function shouldSuppressClick() {
    return window.performance.now() < suppressClickUntilRef.current;
  }

  return {
    dragState,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    shouldSuppressClick,
  };
}

export type LongPressReorderController = ReturnType<
  typeof useLongPressReorder
>;
