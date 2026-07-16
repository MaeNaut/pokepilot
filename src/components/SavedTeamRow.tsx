import type { CSSProperties, KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCopy,
  faFileExport,
  faFileImport,
  faFileLines,
  faPen,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  getReorderDisplacement,
  type useLongPressReorder,
} from "../hooks/useLongPressReorder";
import type { SavedTeamSummary } from "../utils/teamStorage";
import { PokemonIcon } from "./PokemonIcon";

type ReorderController = ReturnType<typeof useLongPressReorder>;

type SavedTeamRowProps = {
  team: SavedTeamSummary;
  index: number;
  isActive: boolean;
  isRenaming: boolean;
  renameDraft: string;
  isDeletePending: boolean;
  isShowdownOpen: boolean;
  showdownDraft: string;
  isImportingShowdown: boolean;
  reorder: ReorderController;
  onSelect: (team: SavedTeamSummary) => void;
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
    team: SavedTeamSummary,
  ) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    teamId: string,
  ) => void;
  onConfirmRename: (teamId: string) => void;
  onCancelRename: () => void;
  onStartRename: (team: SavedTeamSummary) => void;
  onDuplicate: (team: SavedTeamSummary) => void;
  onToggleShowdown: (team: SavedTeamSummary) => void;
  onToggleDelete: (teamId: string) => void;
  onCancelDelete: () => void;
  onDelete: (teamId: string) => void;
  onShowdownDraftChange: (value: string) => void;
  onImportShowdown: (team: SavedTeamSummary) => void;
  onExportShowdown: () => void;
};

export function SavedTeamRow({
  team,
  index,
  isActive,
  isRenaming,
  renameDraft,
  isDeletePending,
  isShowdownOpen,
  showdownDraft,
  isImportingShowdown,
  reorder,
  onSelect,
  onKeyDown,
  onRenameDraftChange,
  onRenameKeyDown,
  onConfirmRename,
  onCancelRename,
  onStartRename,
  onDuplicate,
  onToggleShowdown,
  onToggleDelete,
  onCancelDelete,
  onDelete,
  onShowdownDraftChange,
  onImportShowdown,
  onExportShowdown,
}: SavedTeamRowProps) {
  const displacement = getReorderDisplacement(reorder.dragState, index);
  const isSource = reorder.dragState?.sourceIndex === index;
  const isDropTarget =
    reorder.dragState?.targetIndex === index && !isSource;
  const style = isSource
    ? ({
        "--saved-team-drag-x": `${reorder.dragState?.offsetX ?? 0}px`,
        "--saved-team-drag-y": `${reorder.dragState?.offsetY ?? 0}px`,
      } as CSSProperties)
    : displacement
      ? {
          transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
        }
      : undefined;

  return (
    <div
      className={`saved-team-row ${isActive ? "is-active" : ""} ${
        isSource ? "is-dragging" : ""
      } ${isSource && reorder.dragState?.isDropping ? "is-dropping" : ""} ${
        isDropTarget ? "is-drop-target" : ""
      } ${displacement ? "is-reorder-displaced" : ""}`}
      data-saved-team-index={index}
      role="button"
      tabIndex={0}
      aria-label={`${team.name}. Drag to reorder or press Alt and an arrow key.`}
      style={style}
      onClick={() => onSelect(team)}
      onKeyDown={(event) => onKeyDown(event, index, team)}
      onPointerDown={(event) => {
        if (
          (event.target as Element).closest(
            "button, input, textarea, [contenteditable='true']",
          )
        ) {
          return;
        }

        reorder.handlePointerDown(event, index);
      }}
      onPointerMove={reorder.handlePointerMove}
      onPointerUp={reorder.handlePointerUp}
      onPointerCancel={reorder.handlePointerCancel}
    >
      <div className="saved-team-header-row">
        <div className="saved-team-info">
          {isRenaming ? (
            <input
              className="saved-team-rename-input"
              aria-label={`Rename ${team.name}`}
              autoFocus
              value={renameDraft}
              onChange={(event) => onRenameDraftChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => onRenameKeyDown(event, team.id)}
            />
          ) : (
            <span className="saved-team-name-button">{team.name}</span>
          )}
        </div>

        <div
          className="saved-team-actions"
          aria-label={`${team.name} actions`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {isRenaming ? (
            <>
              <button
                className="saved-team-action-button"
                type="button"
                aria-label="Confirm rename"
                title="Confirm rename"
                onClick={() => onConfirmRename(team.id)}
              >
                <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
              </button>
              <button
                className="saved-team-action-button"
                type="button"
                aria-label="Cancel rename"
                title="Cancel rename"
                onClick={onCancelRename}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                className="saved-team-action-button"
                type="button"
                aria-label={`Rename ${team.name}`}
                title="Rename"
                onClick={() => onStartRename(team)}
              >
                <FontAwesomeIcon icon={faPen} aria-hidden="true" />
              </button>
              <button
                className="saved-team-action-button"
                type="button"
                aria-label={`Duplicate ${team.name}`}
                title="Duplicate"
                onClick={() => onDuplicate(team)}
              >
                <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
              </button>
              <button
                className="saved-team-action-button"
                type="button"
                aria-label={`Open Showdown text tools for ${team.name}`}
                title="Showdown Text"
                onClick={() => onToggleShowdown(team)}
              >
                <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
              </button>
              <button
                className="saved-team-action-button is-danger"
                type="button"
                aria-label={`Delete ${team.name}`}
                title="Delete"
                onClick={() => onToggleDelete(team.id)}
              >
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="saved-team-preview" aria-label={`Load ${team.name}`}>
        {team.slots.map((slot, slotIndex) => (
          <span
            className="saved-team-preview-slot"
            key={`${team.id}-${slotIndex}`}
          >
            {slot ? <PokemonIcon pokemon={slot} /> : null}
          </span>
        ))}
      </div>

      {isDeletePending ? (
        <div
          className="saved-team-delete-confirm"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span>Delete permanently?</span>
          <button type="button" onClick={onCancelDelete}>
            Cancel
          </button>
          <button
            className="is-danger"
            type="button"
            onClick={() => onDelete(team.id)}
          >
            Delete
          </button>
        </div>
      ) : null}

      {isShowdownOpen ? (
        <div
          className="saved-team-import-panel"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <strong>Team Showdown Text</strong>
          <textarea
            value={showdownDraft}
            placeholder="Paste Showdown team text here..."
            onChange={(event) => onShowdownDraftChange(event.target.value)}
          />
          <div className="saved-team-import-actions">
            <button
              type="button"
              disabled={isImportingShowdown}
              onClick={() => onImportShowdown(team)}
            >
              <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
              {isImportingShowdown ? "Importing..." : "Import"}
            </button>
            <button type="button" onClick={onExportShowdown}>
              <FontAwesomeIcon icon={faFileExport} aria-hidden="true" />
              Export
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
