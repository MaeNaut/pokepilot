import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileImport, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";

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
  const { t } = useLocalization();

  return (
    <div className="new-team-control">
      <button
        className="team-action-button"
        type="button"
        aria-label={t("team.newOrImport")}
        title={t("team.newOrImport")}
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
          aria-label={t("team.create")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
          }}
        >
          <button type="button" role="menuitem" onClick={onCreateTeam}>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            <span>{t("team.new")}</span>
          </button>
          <button type="button" role="menuitem" onClick={onOpenImport}>
            <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
            <span>{t("team.importShowdown")}</span>
          </button>
        </div>
      ) : null}

      {isImportOpen ? (
        <div
          className="new-team-import-panel"
          role="dialog"
          aria-label={t("team.importShowdown")}
        >
          <div className="new-team-import-header">
            <strong>{t("team.importShowdown")}</strong>
          </div>
          <textarea
            autoFocus
            aria-label={t("team.showdownTeamText")}
            value={showdownDraft}
            placeholder={t("team.pasteShowdown")}
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
              {isImporting ? t("team.importing") : t("common.import")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
