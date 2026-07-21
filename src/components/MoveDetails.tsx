import type { PokemonMove } from "../types";
import { useLocalization } from "../i18n/useLocalization";
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
  const { gameName } = useLocalization();

  return (
    <>
      <span className="move-type-mark">
        <TypeBadge type={move.type} />
      </span>
      <span className="move-name">{gameName("moves", move.id, move.name)}</span>
      <span className="move-power-panel">{move.power ?? "-"}</span>
    </>
  );
}

export function MoveTooltip({ move, id, placement = "pill" }: MoveTooltipProps) {
  const { gameDescription, gameName, moveTag, t } = useLocalization();
  const category =
    move.category === "Physical"
      ? t("move.categoryPhysical")
      : move.category === "Special"
        ? t("move.categorySpecial")
        : move.category === "Status"
          ? t("move.categoryStatus")
          : t("move.categoryUnknown");
  const moveName = gameName("moves", move.id, move.name);

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
          <strong>{moveName}</strong>
          <span
            className={`move-category-icon is-${getMoveCategoryClass(move.category)}`}
            aria-label={category}
            title={category}
          />
        </div>

        <div className="move-tooltip-body">
          <dl className="move-tooltip-stats">
            <div>
              <dt>{t("move.power")}</dt>
              <dd>{move.power ?? "-"}</dd>
            </div>
            <div>
              <dt>{t("move.accuracy")}</dt>
              <dd>{move.accuracy ?? "-"}</dd>
            </div>
            <div>
              <dt>{t("move.pp")}</dt>
              <dd>{move.pp}</dd>
            </div>
          </dl>

          <p>{gameDescription("moves", move.id, move.description)}</p>

          {move.tags?.length ? (
            <div className="move-tooltip-tags" aria-label={t("move.tags")}>
              {move.tags.map((tag) => (
                <span key={tag}>#{moveTag(tag)}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
