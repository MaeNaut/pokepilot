import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type ScrubGesture = {
  pointerId: number;
  startX: number;
  startValue: number;
  isDragging: boolean;
};

type UseScrubbableNumberInputOptions = {
  value: number;
  min: number;
  max: number;
  pixelsPerStep?: number;
  onChange: (value: number) => void;
};

export function useScrubbableNumberInput({
  value,
  min,
  max,
  pixelsPerStep = 2,
  onChange,
}: UseScrubbableNumberInputOptions) {
  const gestureRef = useRef<ScrubGesture | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  function updateValue(nextValue: number) {
    onChange(Math.max(min, Math.min(max, Math.round(nextValue))));
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLInputElement>,
  ) {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
      isDragging: false,
    };
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLInputElement>,
  ) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const offsetX = event.clientX - gesture.startX;

    if (!gesture.isDragging && Math.abs(offsetX) < 3) {
      return;
    }

    if (!gesture.isDragging) {
      gesture.isDragging = true;
      setIsScrubbing(true);
    }

    event.preventDefault();
    updateValue(gesture.startValue + offsetX / pixelsPerStep);
  }

  function finishPointerInteraction(
    event: ReactPointerEvent<HTMLInputElement>,
    shouldFocus: boolean,
  ) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    gestureRef.current = null;
    setIsScrubbing(false);

    if (shouldFocus && !gesture.isDragging) {
      event.currentTarget.focus();
      event.currentTarget.select();
    }
  }

  return {
    isScrubbing,
    updateValue,
    handlePointerDown,
    handlePointerMove,
    finishPointerInteraction,
  };
}
