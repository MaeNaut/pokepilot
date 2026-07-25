import { useRef, useState } from "react";
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import { useLocalization } from "../i18n/useLocalization";
import { TouchSelectionDialog } from "./TouchSelectionDialog";

const stageOptions = Array.from({ length: 13 }, (_, index) => index - 6);
const stageDragPixels = 10;

type StageScrubGesture = {
  pointerId: number;
  startX: number;
  startValue: number;
  isDragging: boolean;
};

type StatStageGridProps = {
  label: string;
  value: number;
  onClose: () => void;
  onSelect: (stage: number) => void;
};

type StatStagePickerProps = {
  label: string;
  value: number;
  isOpen: boolean;
  isTouchLayout: boolean;
  onChange: (stage: number) => void;
  onClose: () => void;
  onOpen: () => void;
};

function clampStage(stage: number) {
  return Math.max(-6, Math.min(6, Math.round(stage)));
}

function formatStage(stage: number) {
  return stage > 0 ? `+${stage}` : String(stage);
}

function getStageTone(stage: number) {
  return stage > 0 ? "is-positive" : stage < 0 ? "is-negative" : "is-neutral";
}

function StatStageGrid({
  label,
  value,
  onClose,
  onSelect,
}: StatStageGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  function focusStage(stage: number) {
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-stage="${clampStage(stage)}"]`)
      ?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    stage: number,
  ) {
    let nextStage: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextStage = stage + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextStage = stage - 1;
    } else if (event.key === "Home" || event.key === "0") {
      nextStage = 0;
    } else if (event.key === "End") {
      nextStage = 6;
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (nextStage === null) {
      return;
    }

    event.preventDefault();
    focusStage(nextStage);
  }

  return (
    <div
      className="stat-stage-grid"
      ref={gridRef}
      role="listbox"
      aria-label={label}
    >
      {stageOptions.map((stage) => (
        <button
          className={`stat-stage-option ${getStageTone(stage)}${
            value === stage ? " is-selected" : ""
          }`}
          type="button"
          role="option"
          aria-selected={value === stage}
          data-stage={stage}
          data-touch-picker-autofocus={value === stage ? "" : undefined}
          tabIndex={value === stage ? 0 : -1}
          key={stage}
          onClick={() => onSelect(stage)}
          onKeyDown={(event) => handleKeyDown(event, stage)}
        >
          {formatStage(stage)}
        </button>
      ))}
    </div>
  );
}

export function StatStagePicker({
  label,
  value,
  isOpen,
  isTouchLayout,
  onChange,
  onClose,
  onOpen,
}: StatStagePickerProps) {
  const { t } = useLocalization();
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<StageScrubGesture | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const pickerLabel = t("calculator.statStageNamed", { stat: label });

  useDismissOnOutsidePointer(
    pickerRef,
    isOpen && !isTouchLayout,
    onClose,
  );

  function updateStage(stage: number) {
    const nextStage = clampStage(stage);

    if (nextStage !== value) {
      onChange(nextStage);
    }
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (
      isTouchLayout ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
      isDragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const offsetX = event.clientX - gesture.startX;

    if (!gesture.isDragging && Math.abs(offsetX) < 4) {
      return;
    }

    if (!gesture.isDragging) {
      gesture.isDragging = true;
      setIsScrubbing(true);
      onClose();
    }

    event.preventDefault();
    updateStage(
      gesture.startValue + Math.trunc(offsetX / stageDragPixels),
    );
  }

  function finishScrub(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (gesture.isDragging) {
      suppressClickUntilRef.current = window.performance.now() + 300;
    }

    gestureRef.current = null;
    setIsScrubbing(false);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      updateStage(value + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      updateStage(value - 1);
    } else if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      updateStage(0);
    } else if (event.key === "End") {
      event.preventDefault();
      updateStage(6);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      onClose();
    }
  }

  function selectStage(stage: number) {
    updateStage(stage);
    onClose();
  }

  const grid = (
    <StatStageGrid
      label={pickerLabel}
      value={value}
      onClose={onClose}
      onSelect={selectStage}
    />
  );

  return (
    <div className="calculator-stat-stage" ref={pickerRef}>
      <button
        className={`calculator-stat-stage-trigger ${getStageTone(value)}${
          isScrubbing ? " is-scrubbing" : ""
        }`}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t("calculator.adjustStatStage", {
          stat: label,
          stage: formatStage(value),
        })}
        title={t("calculator.adjustStatStage", {
          stat: label,
          stage: formatStage(value),
        })}
        onClick={() => {
          if (window.performance.now() >= suppressClickUntilRef.current) {
            if (isOpen) {
              onClose();
            } else {
              onOpen();
            }
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishScrub}
        onPointerCancel={finishScrub}
      >
        {formatStage(value)}
      </button>

      {isOpen && !isTouchLayout ? (
        <div
          className="calculator-rank-menu"
          role="dialog"
          aria-label={pickerLabel}
        >
          <strong>{pickerLabel}</strong>
          {grid}
        </div>
      ) : null}

      {isOpen && isTouchLayout ? (
        <TouchSelectionDialog
          kind="rank"
          title={pickerLabel}
          showActions={false}
          onClose={onClose}
        >
          {grid}
        </TouchSelectionDialog>
      ) : null}
    </div>
  );
}
