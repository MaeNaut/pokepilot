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
import { useLocalization } from "../i18n/useLocalization";
import { localizeValidityIssue } from "../i18n/validityTranslations";
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
  const { gameName, locale, pokemonName, t } = useLocalization();
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
      setShowdownPanelMessage(t("toolbar.copied"));
    } catch {
      setShowdownPanelMessage(t("toolbar.copyFailed"));
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
        error instanceof Error ? error.message : t("toolbar.importFailed"),
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
        aria-label={t("toolbar.tools")}
        ref={toolbarRef}
      >
        {hasTeamMembers ? (
          <div className="validity-control">
            <button
              className={`builder-card-tool-button validity-trigger is-${toolbarStatus}`}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isValidityPanelOpen}
              title={t("toolbar.validityTitle")}
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
                ? t("toolbar.loading")
                : toolbarStatus === "invalid"
                  ? t(validity.errorCount === 1 ? "toolbar.issue" : "toolbar.issues", {
                      count: validity.errorCount,
                    })
                  : toolbarStatus === "unavailable"
                    ? t("toolbar.unavailable")
                    : t("toolbar.valid")}
            </button>

            {isValidityPanelOpen ? (
              <div
                className={`validity-panel is-${toolbarStatus}`}
                role="dialog"
                aria-label={t("toolbar.validityTitle")}
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
                        ? t("toolbar.loadingValidity")
                        : toolbarStatus === "invalid"
                          ? t("toolbar.teamInvalid")
                          : toolbarStatus === "unavailable"
                            ? t("toolbar.validityUnavailable")
                            : t("toolbar.teamValid")}
                    </strong>
                    <span>{t("toolbar.regulation")}</span>
                  </div>
                </div>

                {showdownLegalityStatus === "loading" ? (
                  <DataStatusRow message={t("toolbar.refreshingValidity")} isLoading />
                ) : showdownLegalityStatus === "error" ? (
                  <DataStatusRow
                    message={
                      locale === "en" && showdownLegalityError
                        ? showdownLegalityError
                        : t("toolbar.regulationUnavailable")
                    }
                    onRetry={onRetryShowdownLegality}
                  />
                ) : displayedValidityIssues.length > 0 ? (
                  <ul className="validity-issue-list">
                    {displayedValidityIssues.map((issue) => (
                      <li className={`is-${issue.severity}`} key={issue.id}>
                        {issue.slotIndex !== undefined ? (
                          <span className="validity-slot-label">
                            {t("toolbar.slot", { slot: issue.slotIndex + 1 })}
                          </span>
                        ) : null}
                        <span>
                          {localizeValidityIssue(issue, {
                            gameName,
                            pokemonName,
                            t,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="validity-success-message">
                    {t("toolbar.allPass")}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          className="builder-card-tool-button"
          type="button"
          onClick={toggleShowdownPanel}
        >
          <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
          {t("toolbar.showdownText")}
        </button>

        {activePokemonName ? (
          <button
            className="builder-card-tool-button"
            type="button"
            title={t("toolbar.imageTitle", { name: activePokemonName })}
            onClick={() => {
              closePanels();
              onOpenImage();
            }}
          >
            <FontAwesomeIcon icon={faImage} aria-hidden="true" />
            {t("toolbar.image")}
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
            {t("toolbar.delete")}
          </button>
        ) : null}
      </div>

      {activePokemonName && pendingDeleteSlot === selectedSlot ? (
        <div
          className="clear-pokemon-confirm"
          role="dialog"
          aria-label={t("toolbar.confirmDelete")}
          ref={deleteConfirmRef}
        >
          <strong>{t("toolbar.deletePokemon")}</strong>
          <span>{t("toolbar.deleteWarning")}</span>
          <div className="clear-pokemon-confirm-actions">
            <button
              className="clear-pokemon-confirm-button"
              type="button"
              onClick={() => setPendingDeleteSlot(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              className="clear-pokemon-confirm-button is-danger"
              type="button"
              onClick={() => {
                setPendingDeleteSlot(null);
                onDeletePokemon();
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
      ) : null}

      {isShowdownPanelOpen ? (
        <div
          className="showdown-panel"
          role="dialog"
          aria-label={t("toolbar.showdownAria")}
          ref={showdownPanelRef}
        >
          <div className="showdown-panel-header">
            <strong>{t("toolbar.pokemonShowdownText")}</strong>
          </div>
          <textarea
            className="showdown-textarea"
            ref={showdownTextareaRef}
            value={showdownText}
            placeholder={t("toolbar.pasteShowdown")}
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
                {isImportingShowdown ? t("team.importing") : t("common.import")}
              </button>
              <button
                className="showdown-panel-button"
                type="button"
                onClick={copyShowdownText}
              >
                <FontAwesomeIcon icon={faFileExport} aria-hidden="true" />
                {t("common.export")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
