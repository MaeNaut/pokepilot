import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useLocalization } from "../i18n/useLocalization";

type TouchSelectionDialogProps = {
  kind: "pokemon" | "item" | "ability" | "nature" | "move";
  title: string;
  canSelect?: boolean;
  search?: ReactNode;
  children: ReactNode;
  preview?: ReactNode;
  onClose: () => void;
  onSelect: () => void;
};

type TouchPickerSearchInputProps = {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
  onMove?: (direction: 1 | -1) => void;
  onSubmit?: () => void;
};

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function TouchPickerSearchInput({
  value,
  label,
  placeholder,
  onChange,
  onMove,
  onSubmit,
}: TouchPickerSearchInputProps) {
  return (
    <input
      className="touch-picker-search-input"
      data-touch-picker-autofocus
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (
          onMove &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          event.preventDefault();
          onMove(event.key === "ArrowDown" ? 1 : -1);
        }

        if (onSubmit && event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}

export function TouchSelectionDialog({
  kind,
  title,
  canSelect = true,
  search,
  children,
  preview,
  onClose,
  onSelect,
}: TouchSelectionDialogProps) {
  const { t } = useLocalization();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior =
      document.body.style.overscrollBehavior;
    const appRoot = document.getElementById("root");
    const wasAppRootInert = appRoot?.inert ?? false;
    const previousAppRootAriaHidden = appRoot?.getAttribute("aria-hidden");

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const autofocusTarget =
        dialogRef.current?.querySelector<HTMLElement>(
          "[data-touch-picker-autofocus]",
        ) ?? dialogRef.current;

      autofocusTarget?.focus();
    });

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hidden);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior =
        previousBodyOverscrollBehavior;
      if (appRoot) {
        appRoot.inert = wasAppRootInert;
        if (previousAppRootAriaHidden == null) {
          appRoot.removeAttribute("aria-hidden");
        } else {
          appRoot.setAttribute("aria-hidden", previousAppRootAriaHidden);
        }
      }
      previousActiveElement?.focus();
    };
  }, []);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="touch-picker-layer">
      <button
        className="touch-picker-scrim"
        type="button"
        tabIndex={-1}
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className={`touch-picker-dialog is-${kind}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="touch-picker-header">
          <h2 id={titleId}>{title}</h2>
          <button
            className="touch-picker-close"
            type="button"
            aria-label={t("common.close")}
            title={t("common.close")}
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </header>

        {search ? <div className="touch-picker-search">{search}</div> : null}

        <div className="touch-picker-results">{children}</div>
        {preview !== undefined ? (
          <div className="touch-picker-preview" aria-live="polite">
            {preview}
          </div>
        ) : null}

        <footer className="touch-picker-actions">
          <button type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="is-primary"
            type="button"
            disabled={!canSelect}
            onClick={onSelect}
          >
            {t("common.select")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
