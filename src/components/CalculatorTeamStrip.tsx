import { useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  getReorderDisplacement,
  useLongPressReorder,
} from "../hooks/useLongPressReorder";
import { useLocalization } from "../i18n/useLocalization";
import type { TeamMember, TeamSlot } from "../types";
import { PokemonIcon } from "./PokemonIcon";

type CalculatorTeamStripProps = {
  team: TeamSlot[];
  selectedSlot: number;
  getMemberDisplayName: (member: TeamMember) => string;
  onBeforeReorder: () => void;
  onReorder?: (sourceIndex: number, targetIndex: number) => void;
  onSelect: (slotIndex: number) => void;
};

export function CalculatorTeamStrip({
  team,
  selectedSlot,
  getMemberDisplayName,
  onBeforeReorder,
  onReorder,
  onSelect,
}: CalculatorTeamStripProps) {
  const { t } = useLocalization();
  const stripRef = useRef<HTMLDivElement | null>(null);
  const reorder = useLongPressReorder({
    containerRef: stripRef,
    disabled: !onReorder,
    itemIndexAttribute: "data-calculator-team-index",
    itemSelector: "[data-calculator-team-index]",
    onDragStart: onBeforeReorder,
    onReorder: (sourceIndex, targetIndex) =>
      onReorder?.(sourceIndex, targetIndex),
  });

  function handleSlotKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    const isPrevious = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";

    if (
      !event.altKey ||
      (!isPrevious && !isNext) ||
      !team[sourceIndex] ||
      !onReorder
    ) {
      return;
    }

    event.preventDefault();
    onBeforeReorder();

    const targetIndex = Math.max(
      0,
      Math.min(team.length - 1, sourceIndex + (isPrevious ? -1 : 1)),
    );

    if (targetIndex === sourceIndex) {
      return;
    }

    onReorder(sourceIndex, targetIndex);
    window.requestAnimationFrame(() => {
      stripRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-calculator-team-index="${targetIndex}"] button`,
        )
        ?.focus();
    });
  }

  return (
    <div
      className={`calculator-team-strip${
        reorder.isDragging ? " is-reordering" : ""
      }`}
      aria-label={t("builder.currentTeam")}
      ref={stripRef}
    >
      {team.map((teamMember, slotIndex) => {
        const displacement = getReorderDisplacement(
          reorder.dragState,
          slotIndex,
        );

        return (
          <div
            className={`calculator-team-slot${
              reorder.dragState?.sourceIndex === slotIndex
                ? " is-dragging"
                : ""
            }${
              reorder.dragState?.sourceIndex === slotIndex &&
              reorder.dragState.isDropping
                ? " is-dropping"
                : ""
            }${
              reorder.dragState?.targetIndex === slotIndex &&
              reorder.dragState.sourceIndex !== slotIndex
                ? " is-drop-target"
                : ""
            }${displacement ? " is-reorder-displaced" : ""}`}
            data-calculator-team-index={slotIndex}
            key={`${teamMember?.id ?? "empty"}-${slotIndex}`}
            style={
              reorder.dragState?.sourceIndex === slotIndex
                ? ({
                    "--calculator-team-drag-x": `${reorder.dragState.offsetX}px`,
                    "--calculator-team-drag-y": `${reorder.dragState.offsetY}px`,
                  } as CSSProperties)
                : displacement
                  ? {
                      transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
                    }
                  : undefined
            }
          >
            <button
              className={`${selectedSlot === slotIndex ? "is-active" : ""}${
                teamMember ? " is-reorderable" : ""
              }`}
              type="button"
              aria-label={
                teamMember
                  ? t("calculator.teamReorderAria", {
                      name: getMemberDisplayName(teamMember),
                      slot: slotIndex + 1,
                    })
                  : t("builder.addSlot", { slot: slotIndex + 1 })
              }
              title={
                teamMember ? getMemberDisplayName(teamMember) : t("common.empty")
              }
              onClick={() => {
                if (!reorder.shouldSuppressClick()) {
                  onSelect(slotIndex);
                }
              }}
              onKeyDown={(event) => handleSlotKeyDown(event, slotIndex)}
              onPointerDown={(event) => {
                if (teamMember) {
                  reorder.handlePointerDown(event, slotIndex);
                }
              }}
              onPointerMove={reorder.handlePointerMove}
              onPointerUp={reorder.handlePointerUp}
              onPointerCancel={reorder.handlePointerCancel}
            >
              {teamMember ? <PokemonIcon pokemon={teamMember} /> : <span>+</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
