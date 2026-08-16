import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalculator, faUsers } from "@fortawesome/free-solid-svg-icons";
import type { AppMode } from "../appMode/appMode";
import { battleFormats, type BattleFormat } from "../battleFormat/battleFormat";
import { useLocalization } from "../i18n/useLocalization";

type BattleFormatControlProps = {
  battleFormat: BattleFormat;
  onChange: (battleFormat: BattleFormat) => void;
};

export function BattleFormatControl({
  battleFormat,
  onChange,
}: BattleFormatControlProps) {
  const { t } = useLocalization();
  const nextFormat = battleFormat === "singles" ? "doubles" : "singles";
  const switchLabel = t(
    battleFormat === "singles"
      ? "battleFormat.switchToDoubles"
      : "battleFormat.switchToSingles",
  );

  return (
    <div className="header-format-controls">
      <button
        className={`battle-format-switch is-${battleFormat}`}
        type="button"
        aria-description={switchLabel}
        title={switchLabel}
        onClick={() => onChange(nextFormat)}
      >
        {battleFormats.map((format) => (
          <span
            className={`battle-format-option${
              battleFormat === format ? " is-active" : ""
            }`}
            key={format}
          >
            {t(
              format === "singles"
                ? "battleFormat.singles"
                : "battleFormat.doubles",
            )}
          </span>
        ))}
      </button>
      <button
        className="battle-format-compact-toggle"
        type="button"
        aria-description={switchLabel}
        title={switchLabel}
        onClick={() => onChange(nextFormat)}
      >
        {battleFormat === "singles" ? "1v1" : "2v2"}
      </button>
    </div>
  );
}

type AppModeControlProps = {
  appMode: AppMode;
  onChange: (appMode: AppMode) => void;
};

export function AppModeControl({ appMode, onChange }: AppModeControlProps) {
  const { t } = useLocalization();
  const nextMode = appMode === "builder" ? "calculator" : "builder";
  const switchLabel = t(
    appMode === "builder" ? "nav.switchToCalculator" : "nav.switchToBuilder",
  );

  return (
    <div className="header-mode-controls">
      <button
        className={`app-mode-toggle is-${appMode}`}
        type="button"
        aria-label={switchLabel}
        title={switchLabel}
        onClick={() => onChange(nextMode)}
      >
        <span
          className={`app-mode-icon${appMode === "builder" ? " is-active" : ""}`}
          aria-hidden="true"
        >
          <FontAwesomeIcon icon={faUsers} />
        </span>
        <span
          className={`app-mode-icon${
            appMode === "calculator" ? " is-active" : ""
          }`}
          aria-hidden="true"
        >
          <FontAwesomeIcon icon={faCalculator} />
        </span>
      </button>
    </div>
  );
}
