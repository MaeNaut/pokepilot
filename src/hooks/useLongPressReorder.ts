import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type ReorderGesture = {
  pointerId: number;
  pointerType: string;
  sourceIndex: number;
  targetIndex: number;
  startX: number;
  startY: number;
  itemCenters: Array<{ x: number; y: number }>;
  isDragging: boolean;
  holdTimer: number | null;
};

export type ReorderDragState = {
  sourceIndex: number;
  targetIndex: number;
  offsetX: number;
  offsetY: number;
  isDropping: boolean;
};

type UseLongPressReorderOptions = {
  containerRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  itemSelector: string;
  onDragStart?: () => void;
  onReorder: (sourceIndex: number, targetIndex: number) => void;
};

const mouseDragDistance = 7;
const touchHoldDelay = 300;
const touchMoveTolerance = 10;
const dropSettleDuration = 150;

export function useLongPressReorder({
  containerRef,
  disabled = false,
  itemSelector,
  onDragStart,
  onReorder,
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
  ) {
    if (disabled || isDragging || event.button !== 0 || !event.isPrimary) {
      return;
    }

    const gesture: ReorderGesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceIndex,
      targetIndex: sourceIndex,
      startX: event.clientX,
      startY: event.clientY,
      itemCenters: Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? [],
        (element) => {
          const rect = element.getBoundingClientRect();
          return {
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
    const nextTargetIndex = gesture.itemCenters.reduce(
      (closestIndex, center, index) =>
        distanceToPointer(center) < distanceToPointer(gesture.itemCenters[closestIndex])
          ? index
          : closestIndex,
      gesture.sourceIndex,
    );

    gesture.targetIndex = nextTargetIndex;
    setDragState({
      sourceIndex: gesture.sourceIndex,
      targetIndex: nextTargetIndex,
      offsetX,
      offsetY,
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

    const sourceCenter = gesture.itemCenters[gesture.sourceIndex] ?? {
      x: gesture.startX,
      y: gesture.startY,
    };
    const targetCenter = gesture.itemCenters[gesture.targetIndex] ?? sourceCenter;

    gestureRef.current = null;
    setDragState({
      sourceIndex: gesture.sourceIndex,
      targetIndex: gesture.targetIndex,
      offsetX: targetCenter.x - sourceCenter.x,
      offsetY: targetCenter.y - sourceCenter.y,
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
