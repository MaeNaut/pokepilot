import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileImport, faPlus } from "@fortawesome/free-solid-svg-icons";

type NewTeamControlProps = {
  isMenuOpen: boolean;
  isImportOpen: boolean;
  showdownDraft: string;
  importError: string | null;
  isImporting: boolean;
  onToggle: () => void;
  onCreateTeam: () => void;
  onOpenImport: () => void;
  onShowdownDraftChange: (value: string) => void;
  onImport: () => void;
  onClose: () => void;
};

export function NewTeamControl({
  isMenuOpen,
  isImportOpen,
  showdownDraft,
  importError,
  isImporting,
  onToggle,
  onCreateTeam,
  onOpenImport,
  onShowdownDraftChange,
  onImport,
  onClose,
}: NewTeamControlProps) {
  return (
    <div className="new-team-control">
      <button
        className="team-action-button"
        type="button"
        aria-label="New or import team"
        title="New or import team"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen || isImportOpen}
        onClick={onToggle}
      >
        <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
      </button>

      {isMenuOpen ? (
        <div
          className="new-team-menu"
          role="menu"
          aria-label="Create team"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
          }}
        >
          <button type="button" role="menuitem" onClick={onCreateTeam}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            <span>New Team</span>
          </button>
          <button type="button" role="menuitem" onClick={onOpenImport}>
            <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
            <span>Import Showdown</span>
          </button>
        </div>
      ) : null}

      {isImportOpen ? (
        <div
          className="new-team-import-panel"
          role="dialog"
          aria-label="Import Showdown team"
        >
          <div className="new-team-import-header">
            <strong>Import Showdown</strong>
          </div>
          <textarea
            autoFocus
            aria-label="Showdown team text"
            value={showdownDraft}
            placeholder="Paste Showdown team text..."
            disabled={isImporting}
            onChange={(event) => onShowdownDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
            }}
          />
          <div className="new-team-import-actions">
            {importError ? <span role="alert">{importError}</span> : <span />}
            <button type="button" disabled={isImporting} onClick={onImport}>
              <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
              {isImporting ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
