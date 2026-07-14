import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import {
  defaultEvs,
  getNatureById,
  statKeys,
  statLabels,
} from "../data/natures";
import type { TeamBuildState } from "../hooks/useTeamBuildState";
import type { PokemonIndexEntry, PokemonMove, TeamSlot } from "../types";
import type { TeamValidityResult } from "../utils/teamValidity";
import { PokemonIcon } from "./PokemonIcon";
import { TypeBadge } from "./TypeBadge";

type TeamOverviewProps = {
  team: TeamSlot[];
  selectedSlot: number;
  pokemonIndex: PokemonIndexEntry[];
  buildState: TeamBuildState;
  validity: TeamValidityResult;
  onOpenSlot: (slotIndex: number) => void;
};

function findMemberMove(moves: PokemonMove[], value: string) {
  const lookup = normalizeShowdownId(value);

  return moves.find(
    (move) =>
      normalizeShowdownId(move.id) === lookup ||
      normalizeShowdownId(move.name) === lookup,
  );
}

function resolveMoves(member: NonNullable<TeamSlot>, moveIds: string[] | undefined) {
  const availableMoves = member.moves ?? [];

  return [0, 1, 2, 3].map((index) => {
    const moveId = moveIds?.[index];

    if (moveId === "") {
      return null;
    }

    if (moveId) {
      return (
        findMemberMove(availableMoves, moveId) ?? {
          id: moveId,
          name: formatIdLabel(moveId),
          type: "normal" as const,
          power: null,
          accuracy: null,
          pp: 0,
          description: "",
        }
      );
    }

    return availableMoves[index] ?? null;
  });
}

function ItemMark({ spriteUrl, name }: { spriteUrl?: string; name: string }) {
  return (
    <span className="team-overview-item-mark" aria-hidden="true">
      <span>{name === "No item" ? "-" : name.charAt(0)}</span>
      {spriteUrl ? (
        <img
          src={spriteUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}

export function TeamOverview({
  team,
  selectedSlot,
  pokemonIndex,
  buildState,
  validity,
  onOpenSlot,
}: TeamOverviewProps) {
  return (
    <article className="pokemon-card team-overview-card" aria-label="Team view">
      <div className="team-overview-grid">
        {team.map((member, slotIndex) => {
          const slotValidity = validity.slotResults[slotIndex];

          if (!member) {
            return (
              <button
                className="team-overview-slot is-empty"
                type="button"
                onClick={() => onOpenSlot(slotIndex)}
                key={`empty-${slotIndex}`}
              >
                <span className="team-overview-slot-number">{slotIndex + 1}</span>
                <span className="team-overview-empty-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faPlus} />
                </span>
                <strong>Add Pokemon</strong>
              </button>
            );
          }

          const item = buildState.itemBySlot[slotIndex] ?? null;
          const indexEntry = pokemonIndex.find((entry) => entry.name === member.id);
          const displayName = indexEntry
            ? formatIdLabel(indexEntry.speciesKey)
            : member.name;
          const ability =
            buildState.abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? "No ability";
          const nature = getNatureById(buildState.natureBySlot[slotIndex] ?? "hardy");
          const evs = buildState.evsBySlot[slotIndex] ?? defaultEvs;
          const evEntries = statKeys.filter((stat) => evs[stat] > 0);
          const moves = resolveMoves(member, buildState.moveIdsBySlot[slotIndex]);

          return (
            <button
              className={`team-overview-slot ${
                selectedSlot === slotIndex ? "is-selected" : ""
              } ${slotValidity?.status ? `is-${slotValidity.status}` : ""}`}
              type="button"
              aria-label={`Edit ${displayName} in slot ${slotIndex + 1}`}
              onClick={() => onOpenSlot(slotIndex)}
              key={`${member.id}-${slotIndex}`}
            >
              <span className="team-overview-slot-number">{slotIndex + 1}</span>
              <div className="team-overview-identity">
                <span className="team-overview-sprite">
                  <PokemonIcon pokemon={member} />
                </span>
                <div className="team-overview-name-block">
                  <strong>{displayName}</strong>
                  <span className="team-overview-item">
                    <ItemMark spriteUrl={item?.spriteUrl} name={item?.name ?? "No item"} />
                    <span>{item?.name ?? "No item"}</span>
                  </span>
                </div>
                <span className="team-overview-types" aria-label={`${displayName} types`}>
                  {member.types.map((type) => (
                    <TypeBadge type={type} key={type} />
                  ))}
                </span>
              </div>

              <div className="team-overview-details">
                <span>
                  <small>Ability</small>
                  <strong>{ability}</strong>
                </span>
                <span>
                  <small>Nature</small>
                  <strong>{nature.label}</strong>
                </span>
              </div>

              <div className="team-overview-moves" aria-label={`${displayName} moves`}>
                {moves.map((move, moveIndex) => (
                  <span
                    className={`team-overview-move ${
                      move ? `type-${move.type}` : "is-empty"
                    }`}
                    key={`${move?.id ?? "empty"}-${moveIndex}`}
                  >
                    {move ? <TypeBadge type={move.type} /> : null}
                    <span
                      className={`team-overview-move-name ${
                        move && move.name.length > 14 ? "is-compact" : ""
                      }`}
                    >
                      {move?.name ?? "Empty move"}
                    </span>
                  </span>
                ))}
              </div>

              <div className="team-overview-evs">
                <small>EVs</small>
                <span className="team-overview-ev-values">
                  {evEntries.length > 0 ? (
                    evEntries.map((stat) => (
                      <span className="team-overview-ev-entry" key={stat}>
                        <span>{statLabels[stat]}</span>
                        <strong>{evs[stat]}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="team-overview-no-evs">No investment</span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </article>
  );
}
