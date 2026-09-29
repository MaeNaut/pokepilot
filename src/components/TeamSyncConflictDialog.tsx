import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocalization } from "../i18n/useLocalization";
import type { TeamConflictChoice, TeamSyncConflict } from "../utils/accountStorageSync";
import type { SavedTeamSummary } from "../utils/teamStorage";

type Props = {
  conflicts: TeamSyncConflict[];
  onResolve: (choices: Record<string, TeamConflictChoice>) => boolean;
};

function initialChoices(conflicts: TeamSyncConflict[]) {
  return Object.fromEntries(conflicts.map((conflict) => [
    conflict.id,
    conflict.reason === "capacity"
      ? conflict.remote ? "remote" : "local"
      : conflict.local && conflict.remote ? "both" : "remote",
  ])) as Record<string, TeamConflictChoice>;
}

export function TeamSyncConflictDialog({ conflicts, onResolve }: Props) {
  const { locale, t } = useLocalization();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState(() => initialChoices(conflicts));
  const [capacityError, setCapacityError] = useState(false);
  const hasCapacityConflict = conflicts.some((conflict) => conflict.reason === "capacity");

  useEffect(() => {
    setChoices(initialChoices(conflicts));
    setCapacityError(false);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [conflicts]);

  function preview(team: SavedTeamSummary | null) {
    if (!team) return <span>{t("team.syncDeleted")}</span>;
    const pokemon = team.slots.filter((slot) => Boolean(slot)).map((slot) => slot!.name);
    return <>
      <strong>{team.name}</strong>
      <span>{pokemon.length ? pokemon.join(" · ") : t("team.syncEmpty")}</span>
      <time dateTime={team.updatedAt}>
        {new Date(team.updatedAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
      </time>
    </>;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="team-sync-conflict-dialog"
      aria-labelledby="team-sync-conflict-title"
      aria-describedby="team-sync-conflict-description"
      onCancel={(event) => event.preventDefault()}
    >
      <header>
        <h2 id="team-sync-conflict-title">{t("team.syncConflictTitle")}</h2>
        <p id="team-sync-conflict-description">{t(hasCapacityConflict
          ? "team.syncCapacityDescription" : "team.syncConflictDescription")}</p>
      </header>
      <div className="team-sync-conflict-list">
        {conflicts.map((conflict) => (
          <fieldset key={conflict.id}>
            <legend>{conflict.local?.name ?? conflict.remote?.name}</legend>
            <div className="team-sync-conflict-versions">
              <div><span>{t("team.syncThisDevice")}</span>{preview(conflict.local)}</div>
              <div><span>{t("team.syncOtherDevice")}</span>{preview(conflict.remote)}</div>
            </div>
            <div className="team-sync-conflict-choices">
              {(["both", "local", "remote", "discard"] as const)
                .filter((choice) => choice !== "both" || (conflict.local && conflict.remote))
                .filter((choice) => choice !== "discard" || conflict.reason === "capacity")
                .map((choice) => (
                  <label key={choice}>
                    <input
                      type="radio"
                      name={`team-conflict-${conflict.id}`}
                      value={choice}
                      checked={choices[conflict.id] === choice}
                      onChange={() => { setChoices((current) => ({ ...current, [conflict.id]: choice })); setCapacityError(false); }}
                    />
                    {t(choice === "both" ? "team.syncBoth" : choice === "local" ? "team.syncLocal"
                      : choice === "discard" ? "team.syncDiscard" : "team.syncRemote")}
                  </label>
                ))}
            </div>
          </fieldset>
        ))}
      </div>
      <footer>
        {capacityError ? <span role="alert">{t("team.syncCapacity")}</span> : <span />}
        <button type="button" onClick={() => { if (!onResolve(choices)) setCapacityError(true); }}>
          {t("team.syncResolve")}
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
