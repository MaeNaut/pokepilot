import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleQuestion,
  faFileExport,
  faFileImport,
  faFileLines,
  faImage,
  faSpinner,
  faTrash,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { DataLoadStatus } from "../types";
import type { TeamValidityResult } from "../utils/teamValidity";
import { DataStatusRow } from "./DataStatusRow";

type BuilderToolbarProps = {
  hasTeamMembers: boolean;
  activePokemonName: string | null;
  selectedSlot: number;
  validity: TeamValidityResult;
  showdownLegalityStatus: DataLoadStatus;
  showdownLegalityError: string | null;
  onRetryShowdownLegality: () => void;
  onExportShowdown: (slotIndex: number) => string;
  onImportShowdown: (slotIndex: number, text: string) => Promise<void>;
  onOpenImage: () => void;
  onDeletePokemon: () => void;
};

type ToolbarStatus = TeamValidityResult["status"] | "loading";

function getToolbarStatus(
  dataStatus: DataLoadStatus,
  validityStatus: TeamValidityResult["status"],
): ToolbarStatus {
  if (dataStatus === "loading") {
    return "loading";
  }

  if (dataStatus === "error") {
    return "unavailable";
  }

  return validityStatus;
}

function getValidityIcon(status: ToolbarStatus) {
  if (status === "loading") {
    return faSpinner;
  }

  if (status === "invalid") {
    return faTriangleExclamation;
  }

  if (status === "unavailable") {
    return faCircleQuestion;
  }

  return faCircleCheck;
}

export function BuilderToolbar({
  hasTeamMembers,
  activePokemonName,
  selectedSlot,
  validity,
  showdownLegalityStatus,
  showdownLegalityError,
  onRetryShowdownLegality,
  onExportShowdown,
  onImportShowdown,
  onOpenImage,
  onDeletePokemon,
}: BuilderToolbarProps) {
  const [isValidityPanelOpen, setIsValidityPanelOpen] = useState(false);
  const [isShowdownPanelOpen, setIsShowdownPanelOpen] = useState(false);
  const [pendingDeleteSlot, setPendingDeleteSlot] = useState<number | null>(null);
  const [showdownText, setShowdownText] = useState("");
  const [showdownPanelMessage, setShowdownPanelMessage] = useState<string | null>(
    null,
  );
  const [isImportingShowdown, setIsImportingShowdown] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const validityPanelRef = useRef<HTMLDivElement | null>(null);
  const showdownPanelRef = useRef<HTMLDivElement | null>(null);
  const showdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteConfirmRef = useRef<HTMLDivElement | null>(null);
  const toolbarStatus = getToolbarStatus(
    showdownLegalityStatus,
    validity.status,
  );
  const validityIcon = getValidityIcon(toolbarStatus);
  const validityIssues = [
    ...validity.slotResults.flatMap((result) => result.issues),
    ...validity.teamIssues,
  ];
  const unavailableIssue = validityIssues.find(
    (issue) => issue.severity === "unavailable",
  );
  const displayedValidityIssues = [
    ...validityIssues.filter((issue) => issue.severity === "error"),
    ...(unavailableIssue ? [unavailableIssue] : []),
  ];

  const closePanels = useCallback(() => {
    setIsValidityPanelOpen(false);
    setIsShowdownPanelOpen(false);
    setPendingDeleteSlot(null);
    setShowdownPanelMessage(null);
  }, []);

  function toggleShowdownPanel() {
    if (isShowdownPanelOpen) {
      setIsShowdownPanelOpen(false);
      setShowdownPanelMessage(null);
      return;
    }

    setIsValidityPanelOpen(false);
    setPendingDeleteSlot(null);
    setShowdownText(onExportShowdown(selectedSlot));
    setIsShowdownPanelOpen(true);
    setShowdownPanelMessage(null);
  }

  async function copyShowdownText() {
    try {
      await navigator.clipboard.writeText(showdownText);
      setShowdownPanelMessage("Copied to clipboard.");
    } catch {
      setShowdownPanelMessage("Copy failed. Select the text manually.");
    }
  }

  async function importShowdownText() {
    setIsImportingShowdown(true);
    setShowdownPanelMessage(null);

    try {
      await onImportShowdown(selectedSlot, showdownText);
      setIsShowdownPanelOpen(false);
      setShowdownText("");
    } catch (error) {
      setShowdownPanelMessage(
        error instanceof Error ? error.message : "Showdown import failed.",
      );
    } finally {
      setIsImportingShowdown(false);
    }
  }

  useEffect(() => {
    if (
      !isValidityPanelOpen &&
      !isShowdownPanelOpen &&
      pendingDeleteSlot === null
    ) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        toolbarRef.current?.contains(target) ||
        validityPanelRef.current?.contains(target) ||
        showdownPanelRef.current?.contains(target) ||
        deleteConfirmRef.current?.contains(target)
      ) {
        return;
      }

      closePanels();
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closePanels, isShowdownPanelOpen, isValidityPanelOpen, pendingDeleteSlot]);

  useEffect(() => {
    if (isShowdownPanelOpen) {
      showdownTextareaRef.current?.focus();
      showdownTextareaRef.current?.select();
    }
  }, [isShowdownPanelOpen]);

  return (
    <>
      <div
        className="builder-card-toolbar"
        aria-label="Builder tools"
        ref={toolbarRef}
      >
        {hasTeamMembers ? (
          <button
            className={`builder-card-tool-button validity-trigger is-${toolbarStatus}`}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isValidityPanelOpen}
            title="Regulation M-B validity"
            onClick={() => {
              setIsShowdownPanelOpen(false);
              setPendingDeleteSlot(null);
              setIsValidityPanelOpen((isOpen) => !isOpen);
            }}
          >
            <FontAwesomeIcon
              icon={validityIcon}
              className={toolbarStatus === "loading" ? "is-spinning" : undefined}
              aria-hidden="true"
            />
            {toolbarStatus === "loading"
              ? "Loading"
              : toolbarStatus === "invalid"
                ? `${validity.errorCount} ${
                    validity.errorCount === 1 ? "Issue" : "Issues"
                  }`
                : toolbarStatus === "unavailable"
                  ? "Unavailable"
                  : "Valid"}
          </button>
        ) : null}

        <button
          className="builder-card-tool-button"
          type="button"
          onClick={toggleShowdownPanel}
        >
          <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
          Showdown Text
        </button>

        {activePokemonName ? (
          <button
            className="builder-card-tool-button"
            type="button"
            title={`Create an image of ${activePokemonName}`}
            onClick={() => {
              closePanels();
              onOpenImage();
            }}
          >
            <FontAwesomeIcon icon={faImage} aria-hidden="true" />
            Image
          </button>
        ) : null}

        {activePokemonName ? (
          <button
            className="builder-card-tool-button is-danger"
            type="button"
            onClick={() => {
              setIsShowdownPanelOpen(false);
              setIsValidityPanelOpen(false);
              setPendingDeleteSlot((currentSlot) =>
                currentSlot === selectedSlot ? null : selectedSlot,
              );
            }}
          >
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
            Delete
          </button>
        ) : null}
      </div>

      {isValidityPanelOpen ? (
        <div
          className={`validity-panel is-${toolbarStatus}`}
          role="dialog"
          aria-label="Regulation M-B validity"
          ref={validityPanelRef}
        >
          <div className="validity-panel-header">
            <span className="validity-panel-icon" aria-hidden="true">
              <FontAwesomeIcon
                icon={validityIcon}
                className={toolbarStatus === "loading" ? "is-spinning" : undefined}
              />
            </span>
            <div>
              <strong>
                {toolbarStatus === "loading"
                  ? "Loading validity data"
                  : toolbarStatus === "invalid"
                    ? "Team has validity issues"
                    : toolbarStatus === "unavailable"
                      ? "Validity data unavailable"
                      : "Team is valid"}
              </strong>
              <span>Regulation M-B</span>
            </div>
          </div>

          {showdownLegalityStatus === "loading" ? (
            <DataStatusRow message="Refreshing Regulation M-B data" isLoading />
          ) : showdownLegalityStatus === "error" ? (
            <DataStatusRow
              message={
                showdownLegalityError ?? "Regulation M-B data is unavailable."
              }
              onRetry={onRetryShowdownLegality}
            />
          ) : displayedValidityIssues.length > 0 ? (
            <ul className="validity-issue-list">
              {displayedValidityIssues.map((issue) => (
                <li className={`is-${issue.severity}`} key={issue.id}>
                  {issue.slotIndex !== undefined ? (
                    <span className="validity-slot-label">
                      Slot {issue.slotIndex + 1}
                    </span>
                  ) : null}
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="validity-success-message">
              All configured choices pass the current legality checks.
            </p>
          )}
        </div>
      ) : null}

      {activePokemonName && pendingDeleteSlot === selectedSlot ? (
        <div
          className="clear-pokemon-confirm"
          role="dialog"
          aria-label="Confirm Pokemon deletion"
          ref={deleteConfirmRef}
        >
          <strong>Delete this Pokemon?</strong>
          <span>This cannot be undone.</span>
          <div className="clear-pokemon-confirm-actions">
            <button
              className="clear-pokemon-confirm-button"
              type="button"
              onClick={() => setPendingDeleteSlot(null)}
            >
              Cancel
            </button>
            <button
              className="clear-pokemon-confirm-button is-danger"
              type="button"
              onClick={() => {
                setPendingDeleteSlot(null);
                onDeletePokemon();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {isShowdownPanelOpen ? (
        <div
          className="showdown-panel"
          role="dialog"
          aria-label="Showdown text"
          ref={showdownPanelRef}
        >
          <div className="showdown-panel-header">
            <strong>Pokemon Showdown Text</strong>
          </div>
          <textarea
            className="showdown-textarea"
            ref={showdownTextareaRef}
            value={showdownText}
            placeholder="Paste Showdown text here..."
            onChange={(event) => setShowdownText(event.target.value)}
          />
          <div className="showdown-panel-actions">
            {showdownPanelMessage ? (
              <span className="showdown-panel-message">{showdownPanelMessage}</span>
            ) : (
              <span />
            )}
            <div className="showdown-panel-button-group">
              <button
                className="showdown-panel-button"
                type="button"
                disabled={isImportingShowdown}
                onClick={importShowdownText}
              >
                <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
                {isImportingShowdown ? "Importing..." : "Import"}
              </button>
              <button
                className="showdown-panel-button"
                type="button"
                onClick={copyShowdownText}
              >
                <FontAwesomeIcon icon={faFileExport} aria-hidden="true" />
                Export
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
