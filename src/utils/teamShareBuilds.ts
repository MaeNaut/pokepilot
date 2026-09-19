import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import { defaultEvs, getNatureById } from "../data/natures";
import { getBattleFormGroup } from "../data/battleForms";
import type { LocalizationContextValue } from "../i18n/LocalizationContext";
import type { PokemonIndexEntry, PokemonMove, TeamMember, TeamSlot } from "../types";
import type { PokemonShareBuild } from "../components/PokemonShareCard";
import type { TeamBuildState } from "./teamBuildState";
import { findMoveByLookup } from "./pokemonMoves";
import { getMegaSpeciesKey, isMegaPokemonName } from "./megaEvolution";
import { getPokemonNameFallback, shouldIncludePokemonForm } from "./pokemonDisplay";

export function createShareMoveCatalog(
  members: TeamSlot[],
  cachedMoves: Record<string, PokemonMove[]>,
) {
  const catalog = new Map<string, PokemonMove>();
  for (const moves of [
    ...members.map((member) => member?.moves ?? []),
    ...Object.values(cachedMoves),
  ]) {
    for (const move of moves) {
      catalog.set(normalizeShowdownId(move.id), move);
      catalog.set(normalizeShowdownId(move.name), move);
    }
  }
  return catalog;
}

export function resolveShareMoves(
  member: TeamMember,
  selectedMoveIds: string[] | undefined,
  moveCatalog: Map<string, PokemonMove>,
) {
  const availableMoves = member.moves ?? [];

  return [0, 1, 2, 3].map((index) => {
    const selectedMoveId = selectedMoveIds?.[index];

    if (selectedMoveId === "") {
      return null;
    }

    if (selectedMoveId) {
      return (
        findMoveByLookup(availableMoves, selectedMoveId) ??
        moveCatalog.get(normalizeShowdownId(selectedMoveId)) ?? {
          id: selectedMoveId,
          name: formatIdLabel(selectedMoveId),
          type: "normal" as const,
          power: null,
          accuracy: null,
          pp: 0,
          description: "Move details are unavailable.",
        }
      );
    }

    return availableMoves[index] ?? null;
  });
}

type TeamShareOptions = {
  team: TeamSlot[];
  buildState: TeamBuildState;
  pokemonIndexByName: Map<string, PokemonIndexEntry>;
  selectedSlot: number;
  selectedMoves: Array<PokemonMove | null>;
  shareMoveCatalog: Map<string, PokemonMove>;
  getMemberDisplayName: (member: TeamMember) => string;
  localization: Pick<LocalizationContextValue, "pokemonName" | "gameName" | "t">;
};

export function createTeamShareBuilds({
  team, buildState, pokemonIndexByName, selectedSlot, selectedMoves,
  shareMoveCatalog, getMemberDisplayName, localization,
}: TeamShareOptions): Array<PokemonShareBuild | null> {
  const { itemBySlot, abilityBySlot, natureBySlot, evsBySlot, moveIdsBySlot } = buildState;
  const { pokemonName, gameName, t } = localization;
  return team.map(
    (member, slotIndex) => {
      if (!member) {
        return null;
      }

      const indexEntry = pokemonIndexByName.get(member.id);
      const formKind =
        indexEntry?.formKind ?? (isMegaPokemonName(member.id) ? "mega" : "base");
      const speciesKey =
        indexEntry?.speciesKey ?? (member.id ? getMegaSpeciesKey(member.id) : "");
      const memberBattleFormGroup = getBattleFormGroup(speciesKey || member.id);
      const battleFormOption = memberBattleFormGroup?.options.find(
        (option) => option.pokemonId === member.id,
      );
      const formLabel =
        formKind === "mega"
          ? (indexEntry?.formLabel ?? "Mega")
          : battleFormOption?.label ??
            (!indexEntry || shouldIncludePokemonForm(indexEntry)
              ? undefined
              : formKind === "form"
                ? indexEntry.formLabel
                : undefined);
      const includeFullForm = indexEntry?.speciesKey !== "pyroar";
      const fullDisplayName = indexEntry
        ? pokemonName({
            id: indexEntry.name,
            speciesId: indexEntry.speciesKey,
            fallback: getPokemonNameFallback(indexEntry, includeFullForm),
            includeForm: includeFullForm,
            formLabel: indexEntry.formLabel,
            formKind: indexEntry.formKind,
          })
        : getMemberDisplayName(member);

      return {
        member,
        displayName: getMemberDisplayName(member),
        fullDisplayName,
        formLabel,
        item: itemBySlot[slotIndex] ?? null,
        ability:
          gameName(
            "abilities",
            abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? "",
            abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? t("builder.noAbility"),
          ),
        nature: getNatureById(natureBySlot[slotIndex] ?? "hardy"),
        evs: evsBySlot[slotIndex] ?? defaultEvs,
        moves:
          slotIndex === selectedSlot
            ? selectedMoves
            : resolveShareMoves(
                member,
                moveIdsBySlot[slotIndex],
                shareMoveCatalog,
              ),
      };
    },
  );
}
