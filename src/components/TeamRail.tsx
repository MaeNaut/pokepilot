import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { faChair, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MAX_BENCH_POKEMON } from "../data/teamLimits";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import type { LongPressReorderController } from "../hooks/useLongPressReorder";
import { getReorderDisplacement } from "../hooks/useLongPressReorder";
import { useLocalization } from "../i18n/useLocalization";
import type { TeamMember, TeamSlot } from "../types";
import type { BenchPokemon } from "../utils/benchPokemon";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { TeamValidityResult } from "../utils/teamValidity";
import { ItemSprite } from "./ItemSprite";
import { PokemonIcon } from "./PokemonIcon";
import { TypeBadge } from "./TypeBadge";

type TeamRailProps = {
  team: TeamSlot[];
  bench: BenchPokemon[];
  selectedSlot: number;
  itemBySlot: TeamBuildState["itemBySlot"];
  validity: TeamValidityResult;
  isBenchOpen: boolean;
  benchLimitMessage: string | null;
  reorder: LongPressReorderController;
  getMemberDisplayName: (member: TeamMember) => string;
  onTeamTabClick: (slotIndex: number) => void;
  onTeamTabKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    slotIndex: number,
  ) => void;
  onToggleBench: () => void;
  onCloseBench: () => void;
  onBenchPokemonClick: (benchIndex: number) => void;
  onReorderBenchPokemon: (sourceIndex: number, targetIndex: number) => void;
  onRemoveBenchPokemon: (benchId: string) => void;
};

export function TeamRail({
  team,
  bench,
  selectedSlot,
  itemBySlot,
  validity,
  isBenchOpen,
  benchLimitMessage,
  reorder,
  getMemberDisplayName,
  onTeamTabClick,
  onTeamTabKeyDown,
  onToggleBench,
  onCloseBench,
  onBenchPokemonClick,
  onReorderBenchPokemon,
  onRemoveBenchPokemon,
}: TeamRailProps) {
  const { gameName, t } = useLocalization();
  const benchShellRef = useRef<HTMLDivElement | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

  useEffect(() => {
    if (!isBenchOpen) {
      setPendingRemovalId(null);
    }
  }, [isBenchOpen]);

  useDismissOnOutsidePointer(benchShellRef, isBenchOpen, () => {
    setPendingRemovalId(null);
    onCloseBench();
  });

  function handleBenchPokemonKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    benchIndex: number,
  ) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
      return;
    }

    event.preventDefault();
    const targetIndex = Math.max(
      0,
      Math.min(
        bench.length - 1,
        benchIndex + (event.key === "ArrowUp" ? -1 : 1),
      ),
    );

    if (targetIndex === benchIndex) {
      return;
    }

    onReorderBenchPokemon(benchIndex, targetIndex);
    window.requestAnimationFrame(() => {
      benchShellRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-bench-index="${targetIndex}"] .bench-pokemon-main`,
        )
        ?.focus();
    });
  }

  return (
    <div
      className={`team-tabs ${reorder.isDragging ? "is-reordering" : ""}`}
      aria-label={t("builder.currentTeam")}
    >
      {team.map((member, index) => {
        const displacement = getReorderDisplacement(reorder.dragState, index);
        const item = itemBySlot[index] ?? null;
        const displayName = member ? getMemberDisplayName(member) : "";
        const isActive = selectedSlot === index;
        const validityStatus = validity.slotResults[index]?.status;

        return (
          <div
            className={`team-tab-shell ${isActive ? "is-active" : ""} ${
              reorder.dragState?.sourceIndex === index ? "is-dragging" : ""
            } ${
              reorder.dragState?.sourceIndex === index &&
              reorder.dragState.isDropping
                ? "is-dropping"
                : ""
            } ${
              reorder.dragState?.targetIndex === index &&
              reorder.dragState.sourceIndex !== index
                ? "is-drop-target"
                : ""
            } ${
              validityStatus === "invalid"
                ? "has-validity-error"
                : validityStatus === "unavailable"
                  ? "has-validity-unavailable"
                  : ""
            } ${displacement ? "is-reorder-displaced" : ""}`}
            data-team-drag-index={index}
            data-team-slot-index={index}
            key={`${member?.id ?? "empty"}-${index}`}
            style={
              reorder.dragState?.sourceIndex === index
                ? ({
                    "--tab-drag-x": `${reorder.dragState.offsetX}px`,
                    "--tab-drag-y": `${reorder.dragState.offsetY}px`,
                  } as CSSProperties)
                : displacement
                  ? {
                      transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
                    }
                  : undefined
            }
          >
            <button
              className={`team-tab ${isActive ? "is-active" : ""} ${
                member ? "" : "is-empty"
              }`}
              type="button"
              onClick={() => onTeamTabClick(index)}
              onKeyDown={(event) => onTeamTabKeyDown(event, index)}
              onPointerDown={(event) => {
                if (member) {
                  reorder.handlePointerDown(event, index);
                }
              }}
              onPointerMove={reorder.handlePointerMove}
              onPointerUp={reorder.handlePointerUp}
              onPointerCancel={reorder.handlePointerCancel}
              aria-label={
                member
                  ? t("builder.showSlot", { slot: index + 1 })
                  : t("builder.addSlot", { slot: index + 1 })
              }
            >
              {member ? (
                <>
                  <span className="team-tab-sprite" aria-hidden="true">
                    <PokemonIcon pokemon={member} />
                  </span>
                  <span className="team-tab-copy" aria-hidden="true">
                    <strong>{displayName}</strong>
                    <span className="team-tab-types">
                      {member.types.map((type) => (
                        <TypeBadge type={type} key={type} />
                      ))}
                    </span>
                  </span>
                  <span
                    className={`team-tab-item ${item ? "" : "is-empty"}`}
                    aria-hidden="true"
                    title={
                      item
                        ? gameName(
                            "items",
                            item.showdownId ?? item.id,
                            item.name,
                          )
                        : undefined
                    }
                  >
                    {item ? <ItemSprite item={item} /> : null}
                  </span>
                </>
              ) : (
                <>
                  <span className="team-tab-empty-mark" aria-hidden="true">
                    +
                  </span>
                  <span className="team-tab-empty-label" aria-hidden="true">
                    <strong>{t("builder.addPokemon")}</strong>
                  </span>
                </>
              )}
            </button>
          </div>
        );
      })}

      <div
        className={`team-tab-shell bench-tab-shell ${
          isBenchOpen ? "is-active" : ""
        } ${
          reorder.dragState?.targetIndex === team.length ? "is-drop-target" : ""
        }`}
        data-team-drag-index={team.length}
        ref={benchShellRef}
      >
        <button
          className={`team-tab bench-tab ${isBenchOpen ? "is-active" : ""}`}
          type="button"
          aria-label={t("builder.benchAria", {
            count: bench.length,
            limit: MAX_BENCH_POKEMON,
          })}
          aria-expanded={isBenchOpen}
          title={t("builder.bench")}
          onClick={() => {
            if (reorder.shouldSuppressClick()) {
              return;
            }

            setPendingRemovalId(null);
            onToggleBench();
          }}
        >
          <FontAwesomeIcon icon={faChair} aria-hidden="true" />
          <span className="bench-label" aria-hidden="true">
            {t("builder.bench")}
          </span>
          {bench.length > 0 ? (
            <span className="bench-count">{bench.length}</span>
          ) : null}
        </button>

        {isBenchOpen ? (
          <div
            className="bench-panel"
            role="dialog"
            aria-label={t("builder.benchPokemon")}
          >
            <div className="bench-panel-header">
              <strong>{t("builder.bench")}</strong>
              <span
                className={bench.length >= MAX_BENCH_POKEMON ? "is-limit" : ""}
              >
                {bench.length} / {MAX_BENCH_POKEMON}
              </span>
            </div>
            {benchLimitMessage ? (
              <p className="bench-limit-message" role="status">
                {benchLimitMessage}
              </p>
            ) : null}
            {bench.length > 0 ? (
              <div className="bench-pokemon-list">
                {bench.map((entry, index) => {
                  const dragIndex = team.length + 1 + index;
                  const displayName = getMemberDisplayName(entry.member);
                  const isDragging =
                    reorder.dragState?.sourceIndex === dragIndex;
                  const displacement = getReorderDisplacement(
                    reorder.dragState,
                    dragIndex,
                  );
                  const isDropTarget =
                    reorder.dragState?.targetIndex === dragIndex &&
                    reorder.dragState.sourceIndex !== dragIndex;

                  return (
                    <div
                      className={`bench-pokemon-row ${
                        isDragging ? "is-dragging" : ""
                      } ${
                        isDragging && reorder.dragState?.isDropping
                          ? "is-dropping"
                          : ""
                      } ${isDropTarget ? "is-drop-target" : ""} ${
                        displacement ? "is-reorder-displaced" : ""
                      }`}
                      data-bench-index={index}
                      data-team-drag-index={dragIndex}
                      key={entry.id}
                      style={
                        isDragging
                          ? ({
                              "--tab-drag-x": `${reorder.dragState?.offsetX ?? 0}px`,
                              "--tab-drag-y": `${reorder.dragState?.offsetY ?? 0}px`,
                              "--bench-drag-left": `${reorder.dragState?.originX ?? 0}px`,
                              "--bench-drag-top": `${reorder.dragState?.originY ?? 0}px`,
                              "--bench-drag-width": `${reorder.dragState?.originWidth ?? 0}px`,
                              "--bench-drag-height": `${reorder.dragState?.originHeight ?? 0}px`,
                            } as CSSProperties)
                          : displacement
                            ? {
                                transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
                              }
                            : undefined
                      }
                    >
                      {pendingRemovalId === entry.id ? (
                        <div
                          className="bench-remove-confirm"
                          role="alertdialog"
                        >
                          <span>
                            {t("builder.deleteNamed", { name: displayName })}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingRemovalId(null);
                            }}
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            className="is-danger"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveBenchPokemon(entry.id);
                              setPendingRemovalId(null);
                            }}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="bench-pokemon-main"
                            type="button"
                            aria-label={t("builder.moveBenchNamed", {
                              name: displayName,
                              slot: selectedSlot + 1,
                            })}
                            onClick={(event) => {
                              event.stopPropagation();
                              onBenchPokemonClick(index);
                            }}
                            onKeyDown={(event) =>
                              handleBenchPokemonKeyDown(event, index)
                            }
                            onPointerDown={(event) =>
                              reorder.handlePointerDown(
                                event,
                                dragIndex,
                                event.currentTarget.closest<HTMLElement>(
                                  ".bench-pokemon-row",
                                ) ?? undefined,
                              )
                            }
                            onPointerMove={reorder.handlePointerMove}
                            onPointerUp={reorder.handlePointerUp}
                            onPointerCancel={reorder.handlePointerCancel}
                          >
                            <PokemonIcon pokemon={entry.member} />
                            <span>{displayName}</span>
                          </button>
                          <button
                            className="bench-pokemon-remove"
                            type="button"
                            aria-label={t("builder.deleteBenchNamed", {
                              name: displayName,
                            })}
                            title={t("builder.deleteFromBench")}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingRemovalId(entry.id);
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faTrash}
                              aria-hidden="true"
                            />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="bench-empty">{t("builder.benchEmpty")}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
