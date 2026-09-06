import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";

type CopilotDrawerProps = {
  isCompactLayout: boolean;
  children: ReactNode;
};

export function CopilotDrawer({
  isCompactLayout,
  children,
}: CopilotDrawerProps) {
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(!isCompactLayout);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);

  const transitionDrawer = useCallback((nextOpen: boolean) => {
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    setIsTransitioning(true);
    setIsOpen(nextOpen);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 240);
  }, []);

  useEffect(() => {
    if (!isCompactLayout || isOpen) {
      setHasOpened(true);
    }
  }, [isCompactLayout, isOpen]);

  useEffect(
    () => () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isCompactLayout || !isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousScrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
    };
    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    function getFocusableElements() {
      return Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        transitionDrawer(false);
        triggerRef.current?.focus({ preventScroll: true });
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      const activeElement = document.activeElement;
      if (!drawerRef.current?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      getFocusableElements()[0]?.focus({ preventScroll: true });
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => {
        window.scrollTo(previousScrollPosition.x, previousScrollPosition.y);
      });
    };
  }, [isCompactLayout, isOpen, transitionDrawer]);

  const transitionClass = isTransitioning ? " is-transitioning" : "";
  const openClass = isOpen ? " is-open" : "";
  const closeLabel = t("copilot.closePanel");
  const openLabel = t("copilot.openPanel");

  return (
    <>
      <button
        className={`copilot-drawer-scrim${openClass}${transitionClass}`}
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={() => {
          transitionDrawer(false);
          triggerRef.current?.focus({ preventScroll: true });
        }}
      />
      <div
        ref={drawerRef}
        className={`copilot-drawer${openClass}${transitionClass}`}
        id="copilot-drawer"
        role={isCompactLayout ? "dialog" : undefined}
        aria-label={isCompactLayout ? "PokePilot" : undefined}
        aria-modal={isCompactLayout && isOpen ? true : undefined}
        aria-hidden={isCompactLayout && !isOpen ? true : undefined}
        tabIndex={isCompactLayout ? -1 : undefined}
      >
        {hasOpened || !isCompactLayout || isOpen ? children : null}
      </div>
      <button
        ref={triggerRef}
        className={`copilot-drawer-handle${openClass}${transitionClass}`}
        type="button"
        aria-controls="copilot-drawer"
        aria-expanded={isOpen}
        aria-label={isOpen ? closeLabel : openLabel}
        title={isOpen ? closeLabel : openLabel}
        onClick={() => transitionDrawer(!isOpen)}
      >
        <FontAwesomeIcon
          icon={isOpen ? faChevronRight : faChevronLeft}
          aria-hidden="true"
        />
        <span>PokePilot</span>
      </button>
    </>
  );
}
