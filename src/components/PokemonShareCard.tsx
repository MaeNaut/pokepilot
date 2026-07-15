import type { CSSProperties } from "react";
import { statKeys, statLabels, type Nature } from "../data/natures";
import type {
  PokemonItem,
  PokemonMove,
  PokemonType,
  StatBlock,
  TeamMember,
} from "../types";
import { ItemSprite } from "./ItemSprite";
import { TypeBadge } from "./TypeBadge";

type PokemonShareCardProps = {
  member: TeamMember;
  displayName: string;
  formLabel?: string;
  item: PokemonItem | null;
  ability: string;
  nature: Nature;
  evs: StatBlock;
  moves: Array<PokemonMove | null>;
};

const typeAccentColors: Record<PokemonType, string> = {
  normal: "#8f9598",
  fire: "#e4693f",
  water: "#4f8fd6",
  electric: "#d6a918",
  grass: "#5c9c4a",
  ice: "#55aebb",
  fighting: "#b95445",
  poison: "#9255a6",
  ground: "#ad7440",
  flying: "#6e8fc5",
  psychic: "#d96189",
  bug: "#789635",
  rock: "#9a8350",
  ghost: "#6763a3",
  dragon: "#6573c7",
  dark: "#5b5f69",
  steel: "#668b99",
  fairy: "#d66da4",
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
}: PokemonShareCardProps) {
  const primaryType = member.types[0] ?? "normal";
  const artworkUrl = member.spriteUrl ?? member.iconSpriteUrl;
  const identityLength = displayName.length + (formLabel?.length ?? 0);
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
      style={{ "--share-accent": typeAccentColors[primaryType] } as CSSProperties}
      aria-label={`${displayName} share image`}
    >
      <header className="pokemon-share-header">
        <div className="pokemon-share-brand">
          <span className="pokemon-share-brand-mark" aria-hidden="true">P</span>
          <strong>PokePilot</strong>
        </div>
        <span className="pokemon-share-regulation">Regulation M-B</span>
      </header>

      <section className="pokemon-share-hero">
        <div className="pokemon-share-identity">
          <div className="pokemon-share-name-row">
            <h2 className={nameLengthClass}>{displayName}</h2>
            {formLabel ? <span className="pokemon-share-form">{formLabel}</span> : null}
          </div>
          <div className="pokemon-share-types" aria-label="Pokemon types">
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

      <section className="pokemon-share-build" aria-label="Pokemon build details">
        <div className="pokemon-share-detail is-item">
          <span className="pokemon-share-detail-label">Item</span>
          <div className="pokemon-share-detail-value">
            <span className={`pokemon-share-item-icon ${item ? "" : "is-empty"}`}>
              {item ? <ItemSprite item={item} /> : null}
            </span>
            <strong>{item?.name ?? "No item"}</strong>
          </div>
        </div>
        <div className="pokemon-share-detail">
          <span className="pokemon-share-detail-label">Ability</span>
          <strong>{ability || "No ability"}</strong>
        </div>
        <div className="pokemon-share-detail">
          <span className="pokemon-share-detail-label">Nature</span>
          <strong>{nature.label}</strong>
        </div>
      </section>

      <section className="pokemon-share-moves" aria-label="Moves">
        {moves.map((move, index) => (
          <div
            className={`pokemon-share-move type-${move?.type ?? "normal"} ${
              move ? "" : "is-empty"
            }`}
            key={`${move?.id ?? "empty"}-${index}`}
          >
            <span className="pokemon-share-move-icon" aria-hidden="true">
              {move ? <TypeBadge type={move.type} /> : null}
            </span>
            <strong className={move && move.name.length > 17 ? "is-long" : ""}>
              {move?.name ?? "No move"}
            </strong>
          </div>
        ))}
      </section>

      <section className="pokemon-share-stats" aria-label="EVs">
        <div className="pokemon-share-stats-heading">
          <strong>EVs</strong>
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
                  {statLabels[stat]}
                  {natureShift ? (
                    <span
                      className={`pokemon-share-nature-arrow is-${natureShift}`}
                      aria-label={
                        natureShift === "up"
                          ? "Nature increases this stat"
                          : "Nature decreases this stat"
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
