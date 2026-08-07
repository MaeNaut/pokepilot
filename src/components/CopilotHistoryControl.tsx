import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClockRotateLeft,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";
import type { CopilotHistoryEntry } from "../utils/copilotHistory";

type HistoryMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type CopilotHistoryControlProps = {
  entries: CopilotHistoryEntry[];
  activeEntryId?: string;
  onSelect: (entry: CopilotHistoryEntry) => void;
  onClear: () => void;
};

const HISTORY_MENU_WIDTH = 340;
const HISTORY_MENU_VIEWPORT_MARGIN = 12;
const HISTORY_MENU_ANCHOR_GAP = 9;

function getHistoryMenuPosition(anchor: HTMLElement): HistoryMenuPosition {
  const anchorRect = anchor.getBoundingClientRect();
  const width = Math.min(
    HISTORY_MENU_WIDTH,
    Math.max(0, window.innerWidth - HISTORY_MENU_VIEWPORT_MARGIN * 2),
  );
  const left = Math.min(
    Math.max(HISTORY_MENU_VIEWPORT_MARGIN, anchorRect.right - width),
    window.innerWidth - width - HISTORY_MENU_VIEWPORT_MARGIN,
  );
  const top = anchorRect.bottom + HISTORY_MENU_ANCHOR_GAP;

  return {
    top,
    left,
    width,
    maxHeight: Math.max(
      180,
      window.innerHeight - top - HISTORY_MENU_VIEWPORT_MARGIN,
    ),
  };
}

export function CopilotHistoryControl({
  entries,
  activeEntryId,
  onSelect,
  onClear,
}: CopilotHistoryControlProps) {
  const { locale, t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [menuPosition, setMenuPosition] =
    useState<HistoryMenuPosition | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  function closeMenu() {
    setIsOpen(false);
    setIsDeletePending(false);
  }

  function updatePosition() {
    if (controlRef.current) {
      setMenuPosition(getHistoryMenuPosition(controlRef.current));
    }
  }

  function toggleMenu() {
    if (isOpen) {
      closeMenu();
      return;
    }

    updatePosition();
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        controlRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [isOpen]);

  return (
    <div className="copilot-history-control" ref={controlRef}>
      <button
        className="copilot-history-button"
        type="button"
        aria-label={t("copilot.history")}
        aria-expanded={isOpen}
        title={t("copilot.history")}
        onClick={toggleMenu}
      >
        <FontAwesomeIcon icon={faClockRotateLeft} aria-hidden="true" />
      </button>

      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              className="copilot-history-menu"
              role="dialog"
              aria-label={t("copilot.history")}
              ref={menuRef}
              style={menuPosition}
            >
              <header>
                <strong>{t("copilot.history")}</strong>
                {entries.length > 0 ? (
                  <button
                    className="copilot-history-delete-button"
                    type="button"
                    aria-label={t("copilot.clearHistory")}
                    aria-expanded={isDeletePending}
                    title={t("copilot.clearHistory")}
                    onClick={() => setIsDeletePending(true)}
                  >
                    <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                  </button>
                ) : null}
              </header>

              {isDeletePending ? (
                <div
                  className="clear-pokemon-confirm copilot-history-delete-confirm"
                  role="alertdialog"
                  aria-label={t("copilot.confirmClearHistory")}
                >
                  <strong>{t("copilot.confirmClearHistory")}</strong>
                  <span>{t("toolbar.deleteWarning")}</span>
                  <div className="clear-pokemon-confirm-actions">
                    <button
                      className="clear-pokemon-confirm-button"
                      type="button"
                      onClick={() => setIsDeletePending(false)}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      className="clear-pokemon-confirm-button is-danger"
                      type="button"
                      onClick={() => {
                        onClear();
                        closeMenu();
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              ) : null}

              {entries.length > 0 ? (
                <div className="copilot-history-list">
                  {entries.map((entry) => (
                    <button
                      className={activeEntryId === entry.id ? "is-current" : ""}
                      type="button"
                      key={entry.id}
                      onClick={() => {
                        onSelect(entry);
                        closeMenu();
                      }}
                    >
                      <span className="copilot-history-meta">
                        {t(
                          entry.scope === "team"
                            ? "copilot.team"
                            : entry.scope === "pokemon"
                              ? "copilot.pokemon"
                              : "copilot.recommend",
                        )}
                        {" \u00b7 "}
                        {t(
                          entry.locale === "ko"
                            ? "language.korean"
                            : "language.english",
                        )}
                        {" \u00b7 "}
                        <time dateTime={entry.createdAt}>
                          {dateFormatter.format(new Date(entry.createdAt))}
                        </time>
                      </span>
                      <strong>{entry.response.title}</strong>
                      <span className="copilot-history-summary">
                        {entry.response.summary}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p>{t("copilot.historyEmpty")}</p>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
