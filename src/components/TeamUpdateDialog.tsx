import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocalization } from "../i18n/useLocalization";
import type { TeamRefreshMode } from "../hooks/useSavedTeams";

export function TeamUpdateDialog({ mode, name, onConfirm }: {
  mode: TeamRefreshMode; name: string; onConfirm: () => Promise<boolean>;
}) {
  const { t } = useLocalization();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  useEffect(() => { setFailed(false); }, [mode]);
  return createPortal(<dialog ref={dialog} className="team-update-dialog"
    aria-labelledby="team-update-title" aria-describedby="team-update-description"
    onCancel={event => event.preventDefault()}>
    <header>
      <h2 id="team-update-title">{t("team.updateTitle")}</h2>
      <p id="team-update-description">{t(mode === "save-draft" ? "team.updateSaveDraft"
        : mode === "discard-draft" ? "team.updateDiscardDraft" : "team.updateRefresh", { name })}</p>
    </header>
    <footer>
      {failed ? <span role="alert">{t("team.updateFailed")}</span> : <span />}
      <button type="button" disabled={busy} onClick={async () => {
        if (busy) return;
        setBusy(true);
        setFailed(false);
        try { if (!await onConfirm()) setFailed(true); }
        catch { setFailed(true); }
        finally { setBusy(false); }
      }}>{t(busy ? "team.updating" : "team.updateConfirm")}</button>
    </footer>
  </dialog>, document.body);
}
