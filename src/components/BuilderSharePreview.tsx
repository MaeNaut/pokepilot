import type { KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import { ACTIVE_TEAM_SIZE } from "../data/teamLimits";
import { useLocalization } from "../i18n/useLocalization";
import { PokemonIcon } from "./PokemonIcon";
import {
  PokemonShareCard,
  type PokemonShareBuild,
} from "./PokemonShareCard";
import { ShareImageDialog } from "./ShareImageDialog";
import { TeamShareCard } from "./TeamShareCard";

export type ShareImageTarget = "team" | number | null;

type BuilderSharePreviewProps = {
  target: ShareImageTarget;
  teamName: string;
  builds: Array<PokemonShareBuild | null>;
  onTargetChange: (target: Exclude<ShareImageTarget, null>) => void;
  onClose: () => void;
};

function handleNavigationKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    return;
  }

  const navigation = event.currentTarget.closest(".share-image-navigation");
  const tabs = navigation
    ? Array.from(
        navigation.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      )
    : [];
  const currentIndex = tabs.indexOf(event.currentTarget);

  if (currentIndex < 0 || tabs.length === 0) {
    return;
  }

  event.preventDefault();

  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex +
            (event.key === "ArrowRight" ? 1 : -1) +
            tabs.length) %
          tabs.length;
  const nextTab = tabs[nextIndex];

  nextTab.focus();
  nextTab.click();
}

export function BuilderSharePreview({
  target,
  teamName,
  builds,
  onTargetChange,
  onClose,
}: BuilderSharePreviewProps) {
  const { t } = useLocalization();
  const selectedBuild = typeof target === "number" ? builds[target] ?? null : null;

  if (target === null || (target !== "team" && !selectedBuild)) {
    return null;
  }

  return (
    <ShareImageDialog
      title={target === "team" ? t("share.teamImage") : t("share.pokemonImage")}
      fileName={
        target === "team"
          ? `pokepilot-${teamName || "untitled-team"}-team`
          : `pokepilot-${selectedBuild?.displayName ?? "pokemon"}-${
              selectedBuild?.formLabel ?? "build"
            }`
      }
      captureWidth={target === "team" ? 960 : 540}
      captureHeight={540}
      navigation={
        <nav
          className="share-image-navigation"
          role="tablist"
          aria-label={t("share.imagePreview")}
        >
          <button
            className={target === "team" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={target === "team"}
            onClick={() => onTargetChange("team")}
            onKeyDown={handleNavigationKeyDown}
          >
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
            <span>{t("share.team")}</span>
          </button>

          {Array.from({ length: ACTIVE_TEAM_SIZE }, (_, slotIndex) => {
            const build = builds[slotIndex] ?? null;

            return (
              <button
                className={target === slotIndex ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={target === slotIndex}
                aria-label={
                  build
                    ? `${build.displayName} ${t("toolbar.image")}`
                    : t("share.emptyPartySlot", { slot: slotIndex + 1 })
                }
                title={
                  build?.displayName ?? t("share.emptySlot", { slot: slotIndex + 1 })
                }
                disabled={!build}
                onClick={() => onTargetChange(slotIndex)}
                onKeyDown={handleNavigationKeyDown}
                key={slotIndex}
              >
                <span className="share-image-navigation-icon">
                  {build ? <PokemonIcon pokemon={build.member} /> : slotIndex + 1}
                </span>
                <span>{build?.displayName ?? t("common.empty")}</span>
              </button>
            );
          })}
        </nav>
      }
      onClose={onClose}
    >
      {target === "team" ? (
        <TeamShareCard teamName={teamName} builds={builds} />
      ) : selectedBuild ? (
        <PokemonShareCard {...selectedBuild} />
      ) : null}
    </ShareImageDialog>
  );
}
