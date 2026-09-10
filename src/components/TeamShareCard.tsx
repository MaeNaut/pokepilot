import type { CSSProperties } from "react";
import { statKeys } from "../data/natures";
import { shareTypeAccentColors } from "../data/shareImage";
import { useLocalization } from "../i18n/useLocalization";
import { statTranslationKeys } from "../i18n/statTranslations";
import { ItemSprite } from "./ItemSprite";
import type { PokemonShareBuild } from "./PokemonShareCard";
import { TypeBadge } from "./TypeBadge";

type TeamShareCardProps = {
  teamName: string;
  builds: Array<PokemonShareBuild | null>;
};

function getNameLengthClass(name: string) {
  if (name.length > 25) {
    return "is-ultra-long";
  }

  if (name.length > 18) {
    return "is-extra-long";
  }

  if (name.length > 13) {
    return "is-long";
  }

  return "";
}

export function TeamShareCard({ teamName, builds }: TeamShareCardProps) {
  const { gameName, t } = useLocalization();

  return (
    <article className="team-share-card" aria-label={`${teamName} ${t("share.teamImage")}`}>
      <header className="team-share-header">
        <div className="team-share-brand">
          <img
            className="team-share-brand-mark"
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <strong>PokePilot</strong>
        </div>
        <div className="team-share-title">
          <h2>{teamName.trim() || t("share.untitledTeam")}</h2>
        </div>
        <span className="team-share-regulation">{t("toolbar.regulation")}</span>
      </header>

      <section className="team-share-grid" aria-label={t("share.activeParty")}>
        {Array.from({ length: 6 }, (_, index) => {
          const build = builds[index] ?? null;

          if (!build) {
            return (
              <div className="team-share-member is-empty" key={`empty-${index}`}>
                <span>{t("share.openSlot")}</span>
              </div>
            );
          }

          const {
            member,
            displayName,
            fullDisplayName,
            item,
            ability,
            nature,
            evs,
            moves,
          } = build;
          const teamDisplayName = fullDisplayName ?? displayName;
          const primaryType = member.types[0] ?? "normal";
          const artworkUrl = member.spriteUrl ?? member.iconSpriteUrl;
          const investedEvs = statKeys.filter((stat) => evs[stat] > 0);

          return (
            <article
              className={`team-share-member is-type-${primaryType}`}
              style={
                { "--share-accent": shareTypeAccentColors[primaryType] } as CSSProperties
              }
              key={`${member.id}-${index}`}
            >
              <div className="team-share-member-heading">
                <h3 className={getNameLengthClass(teamDisplayName)}>
                  {teamDisplayName}
                </h3>
                <div className="team-share-member-types" aria-label={t("share.pokemonTypes")}>
                  {member.types.map((type) => (
                    <TypeBadge type={type} key={type} />
                  ))}
                </div>
              </div>

              <div className="team-share-member-build">
                <div className="team-share-member-artwork-shell">
                  {artworkUrl ? (
                    <img
                      className="team-share-member-artwork"
                      src={artworkUrl}
                      alt=""
                      draggable={false}
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  ) : null}
                </div>
                <div className="team-share-member-summary">
                  <div className="team-share-member-item">
                    <span className={item ? "" : "is-empty"}>
                      {item ? <ItemSprite item={item} /> : null}
                    </span>
                    <strong>
                      {item
                        ? gameName("items", item.showdownId ?? item.id, item.name)
                        : t("share.noItem")}
                    </strong>
                  </div>
                  <div className="team-share-member-traits">
                    <strong>
                      {ability
                        ? gameName("abilities", ability, ability)
                        : t("share.noAbility")}
                    </strong>
                    <span aria-hidden="true">·</span>
                    <strong>{gameName("natures", nature.id, nature.label)}</strong>
                  </div>
                  <div className="team-share-member-evs">
                    <span>{t("share.evs")}</span>
                    {investedEvs.length > 0 ? (
                      investedEvs.map((stat) => (
                        <strong key={stat}>
                          {t(statTranslationKeys[stat])} {evs[stat]}
                        </strong>
                      ))
                    ) : (
                      <strong>{t("share.noInvestment")}</strong>
                    )}
                  </div>
                </div>
              </div>

              <div className="team-share-member-moves" aria-label={t("share.moves")}>
                {moves.map((move, moveIndex) => {
                  const localizedMoveName = move
                    ? gameName("moves", move.id, move.name)
                    : t("share.noMove");

                  return (
                    <div
                      className={`team-share-member-move type-${move?.type ?? "normal"} ${
                        move ? "" : "is-empty"
                      }`}
                      key={`${move?.id ?? "empty"}-${moveIndex}`}
                    >
                      <span className="team-share-member-move-icon" aria-hidden="true">
                        {move ? <TypeBadge type={move.type} /> : null}
                      </span>
                      <strong className={localizedMoveName.length > 18 ? "is-long" : ""}>
                        {localizedMoveName}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </article>
  );
}
