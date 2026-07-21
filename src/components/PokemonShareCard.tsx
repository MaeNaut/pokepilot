import type { CSSProperties } from "react";
import { statKeys, type Nature } from "../data/natures";
import { shareTypeAccentColors } from "../data/shareImage";
import { useLocalization } from "../i18n/useLocalization";
import { statTranslationKeys } from "../i18n/statTranslations";
import type {
  PokemonItem,
  PokemonMove,
  StatBlock,
  TeamMember,
} from "../types";
import { ItemSprite } from "./ItemSprite";
import { TypeBadge } from "./TypeBadge";

export type PokemonShareBuild = {
  member: TeamMember;
  displayName: string;
  formLabel?: string;
  item: PokemonItem | null;
  ability: string;
  nature: Nature;
  evs: StatBlock;
  moves: Array<PokemonMove | null>;
};

export function PokemonShareCard({
  member,
  displayName,
  formLabel,
  item,
  ability,
  nature,
  evs,
  moves,
}: PokemonShareBuild) {
  const { gameName, pokemonFormName, t } = useLocalization();
  const primaryType = member.types[0] ?? "normal";
  const artworkUrl = member.spriteUrl ?? member.iconSpriteUrl;
  const localizedFormLabel = formLabel
    ? pokemonFormName(member.id, formLabel)
    : undefined;
  const identityLength = displayName.length + (localizedFormLabel?.length ?? 0);
  const nameLengthClass =
    identityLength > 24
      ? "is-ultra-long"
      : identityLength > 17
        ? "is-extra-long"
        : identityLength > 12
          ? "is-long"
          : "";

  return (
    <article
      className={`pokemon-share-card is-type-${primaryType}`}
      style={{ "--share-accent": shareTypeAccentColors[primaryType] } as CSSProperties}
      aria-label={`${displayName} ${t("share.pokemonImage")}`}
    >
      <header className="pokemon-share-header">
        <div className="pokemon-share-brand">
          <span className="pokemon-share-brand-mark" aria-hidden="true">P</span>
          <strong>PokePilot</strong>
        </div>
        <span className="pokemon-share-regulation">{t("toolbar.regulation")}</span>
      </header>

      <section className="pokemon-share-hero">
        <div className="pokemon-share-identity">
          <div className="pokemon-share-name-row">
            <h2 className={nameLengthClass}>{displayName}</h2>
            {localizedFormLabel ? (
              <span className="pokemon-share-form">{localizedFormLabel}</span>
            ) : null}
          </div>
          <div className="pokemon-share-types" aria-label={t("share.pokemonTypes")}>
            {member.types.map((type) => (
              <TypeBadge type={type} key={type} />
            ))}
          </div>
        </div>
        {artworkUrl ? (
          <img
            className="pokemon-share-artwork"
            src={artworkUrl}
            alt=""
            draggable={false}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
      </section>

      <section className="pokemon-share-build" aria-label={t("share.buildDetails")}>
        <div className="pokemon-share-detail is-item">
          <span className="pokemon-share-detail-label">{t("share.item")}</span>
          <div className="pokemon-share-detail-value">
            <span className={`pokemon-share-item-icon ${item ? "" : "is-empty"}`}>
              {item ? <ItemSprite item={item} /> : null}
            </span>
            <strong>
              {item
                ? gameName("items", item.showdownId ?? item.id, item.name)
                : t("share.noItem")}
            </strong>
          </div>
        </div>
        <div className="pokemon-share-detail">
          <span className="pokemon-share-detail-label">{t("share.ability")}</span>
          <strong>
            {ability
              ? gameName("abilities", ability, ability)
              : t("share.noAbility")}
          </strong>
        </div>
        <div className="pokemon-share-detail">
          <span className="pokemon-share-detail-label">{t("share.nature")}</span>
          <strong>{gameName("natures", nature.id, nature.label)}</strong>
        </div>
      </section>

      <section className="pokemon-share-moves" aria-label={t("share.moves")}>
        {moves.map((move, index) => {
          const localizedMoveName = move
            ? gameName("moves", move.id, move.name)
            : t("share.noMove");

          return (
            <div
              className={`pokemon-share-move type-${move?.type ?? "normal"} ${
                move ? "" : "is-empty"
              }`}
              key={`${move?.id ?? "empty"}-${index}`}
            >
              <span className="pokemon-share-move-icon" aria-hidden="true">
                {move ? <TypeBadge type={move.type} /> : null}
              </span>
              <strong className={localizedMoveName.length > 17 ? "is-long" : ""}>
                {localizedMoveName}
              </strong>
            </div>
          );
        })}
      </section>

      <section className="pokemon-share-stats" aria-label={t("share.evs")}>
        <div className="pokemon-share-stats-heading">
          <strong>{t("share.evs")}</strong>
        </div>
        <div className="pokemon-share-stat-grid">
          {statKeys.map((stat) => {
            const natureShift =
              stat === "hp" || nature.up === nature.down
                ? null
                : nature.up === stat
                  ? "up"
                  : nature.down === stat
                    ? "down"
                    : null;

            return (
              <div className="pokemon-share-stat" key={stat}>
                <strong className="pokemon-share-stat-label">
                  {t(statTranslationKeys[stat])}
                  {natureShift ? (
                    <span
                      className={`pokemon-share-nature-arrow is-${natureShift}`}
                      aria-label={
                        natureShift === "up"
                          ? t("builder.natureIncreases")
                          : t("builder.natureDecreases")
                      }
                    />
                  ) : null}
                </strong>
                <b className={evs[stat] > 0 ? "is-invested" : ""}>{evs[stat]}</b>
              </div>
            );
          })}
        </div>
      </section>
    </article>
  );
}
