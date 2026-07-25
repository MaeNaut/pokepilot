import {
  battleStatKeys,
  getNatureByAlignment,
  type Nature,
} from "../data/natures";
import {
  getNatureAtGridPosition,
  type NatureGridPosition,
} from "./natureGridUtils";

type NatureGridProps = {
  selectedNature: Nature;
  activePosition: NatureGridPosition;
  previewOnly?: boolean;
  upLabel: string;
  downLabel: string;
  getNatureName: (nature: Nature) => string;
  getStatLabel: (stat: (typeof battleStatKeys)[number]) => string;
  onActivePositionChange: (position: NatureGridPosition) => void;
  onSelectNature: (nature: Nature) => void;
};

export function NatureGrid({
  selectedNature,
  activePosition,
  previewOnly = false,
  upLabel,
  downLabel,
  getNatureName,
  getStatLabel,
  onActivePositionChange,
  onSelectNature,
}: NatureGridProps) {
  const displayedNature = previewOnly
    ? getNatureAtGridPosition(activePosition)
    : selectedNature;

  return (
    <div className="nature-grid">
      <div className="nature-grid-corner" aria-hidden="true">
        <span className="nature-axis-up">{upLabel}</span>
        <span className="nature-axis-down">{downLabel}</span>
      </div>
      {battleStatKeys.map((downStat) => (
        <div
          className={`nature-stat-heading is-down ${
            displayedNature.down === downStat ? "is-selected-down" : ""
          }`}
          key={downStat}
        >
          {getStatLabel(downStat)}
        </div>
      ))}
      {battleStatKeys.map((upStat, upIndex) => (
        <div className="nature-grid-row" key={upStat}>
          <div
            className={`nature-stat-heading is-up ${
              displayedNature.up === upStat ? "is-selected-up" : ""
            }`}
          >
            {getStatLabel(upStat)}
          </div>
          {battleStatKeys.map((downStat, downIndex) => {
            const nature = getNatureByAlignment(upStat, downStat);
            const isKeyboardActive =
              activePosition.upIndex === upIndex &&
              activePosition.downIndex === downIndex;

            return (
              <button
                className={`nature-cell ${
                  displayedNature.id === nature.id ? "is-active" : ""
                } ${isKeyboardActive ? "is-keyboard-active" : ""} ${
                  upStat === downStat ? "is-neutral" : ""
                }`}
                type="button"
                role="option"
                aria-selected={displayedNature.id === nature.id}
                key={nature.id}
                onFocus={() =>
                  onActivePositionChange({ upIndex, downIndex })
                }
                onMouseEnter={
                  previewOnly
                    ? undefined
                    : () =>
                        onActivePositionChange({ upIndex, downIndex })
                }
                onClick={() => {
                  onActivePositionChange({ upIndex, downIndex });
                  if (!previewOnly) {
                    onSelectNature(nature);
                  }
                }}
              >
                {getNatureName(nature)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
