import type { CSSProperties } from "react";
import { statKeys, statLabels } from "../data/natures";
import { shareTypeAccentColors } from "../data/shareImage";
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
  return (
    <article className="team-share-card" aria-label={`${teamName} team image`}>
      <header className="team-share-header">
        <div className="team-share-brand">
          <span className="team-share-brand-mark" aria-hidden="true">P</span>
          <strong>PokePilot</strong>
        </div>
        <div className="team-share-title">
          <h2>{teamName.trim() || "Untitled Team"}</h2>
        </div>
        <span className="team-share-regulation">Regulation M-B</span>
      </header>

      <section className="team-share-grid" aria-label="Active party">
        {Array.from({ length: 6 }, (_, index) => {
          const build = builds[index] ?? null;

          if (!build) {
            return (
              <div className="team-share-member is-empty" key={`empty-${index}`}>
                <span>Open Slot</span>
              </div>
            );
          }

          const { member, displayName, item, ability, nature, evs, moves } = build;
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
              <div className="team-share-member-accent" aria-hidden="true" />
              <div className="team-share-member-heading">
                <div className="team-share-member-identity">
                  <div className="team-share-member-name-row">
                    <h3 className={getNameLengthClass(displayName)}>{displayName}</h3>
                  </div>
                  <div className="team-share-member-item">
                    <span className={item ? "" : "is-empty"}>
                      {item ? <ItemSprite item={item} /> : null}
                    </span>
                    <strong>{item?.name ?? "No item"}</strong>
                  </div>
                </div>
                <div className="team-share-member-types" aria-label="Pokemon types">
                  {member.types.map((type) => (
                    <TypeBadge type={type} key={type} />
                  ))}
                </div>
              </div>

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

              <div className="team-share-member-details">
                <div className="team-share-member-detail">
                  <span className="team-share-member-detail-label">Ability</span>
                  <strong>{ability || "No ability"}</strong>
                </div>
                <div className="team-share-member-detail">
                  <span className="team-share-member-detail-label">Nature</span>
                  <strong>{nature.label}</strong>
                </div>
              </div>

              <div className="team-share-member-moves" aria-label="Moves">
                {moves.map((move, moveIndex) => (
                  <div
                    className={`team-share-member-move type-${move?.type ?? "normal"} ${
                      move ? "" : "is-empty"
                    }`}
                    key={`${move?.id ?? "empty"}-${moveIndex}`}
                  >
                    <span className="team-share-member-move-icon" aria-hidden="true">
                      {move ? <TypeBadge type={move.type} /> : null}
                    </span>
                    <strong className={move && move.name.length > 18 ? "is-long" : ""}>
                      {move?.name ?? "No move"}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="team-share-member-evs">
                <span>EVs</span>
                {investedEvs.length > 0 ? (
                  investedEvs.map((stat) => (
                    <strong key={stat}>
                      {statLabels[stat]} {evs[stat]}
                    </strong>
                  ))
                ) : (
                  <strong>No investment</strong>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </article>
  );
}
