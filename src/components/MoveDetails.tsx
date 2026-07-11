import type { PokemonMove } from "../types";
import { TypeBadge } from "./TypeBadge";

type MoveSummaryProps = {
  move: PokemonMove;
};

type MoveTooltipProps = MoveSummaryProps & {
  id?: string;
  placement?: "pill" | "option";
};

function getMoveCategoryClass(category?: string) {
  const normalized = category?.toLowerCase();

  return normalized === "physical" ||
    normalized === "special" ||
    normalized === "status"
    ? normalized
    : "status";
}

export function MoveSummary({ move }: MoveSummaryProps) {
  return (
    <>
      <span className="move-type-mark">
        <TypeBadge type={move.type} />
      </span>
      <span className="move-name">{move.name}</span>
      <span className="move-power-panel">{move.power ?? "-"}</span>
    </>
  );
}

export function MoveTooltip({ move, id, placement = "pill" }: MoveTooltipProps) {
  const category = move.category ?? "Move category";

  return (
    <aside
      className={`move-tooltip${
        placement === "option" ? " move-option-tooltip" : ""
      } type-${move.type}`}
      id={id}
      role="tooltip"
    >
      <div className="move-tooltip-shell">
        <div className="move-tooltip-header">
          <span className="move-tooltip-type">
            <TypeBadge type={move.type} />
          </span>
          <strong>{move.name}</strong>
          <span
            className={`move-category-icon is-${getMoveCategoryClass(move.category)}`}
            aria-label={category}
            title={category}
          />
        </div>

        <div className="move-tooltip-body">
          <dl className="move-tooltip-stats">
            <div>
              <dt>Power</dt>
              <dd>{move.power ?? "-"}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{move.accuracy ?? "-"}</dd>
            </div>
            <div>
              <dt>PP</dt>
              <dd>{move.pp}</dd>
            </div>
          </dl>

          <p>{move.description}</p>

          {move.tags?.length ? (
            <div className="move-tooltip-tags" aria-label="Move tags">
              {move.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
