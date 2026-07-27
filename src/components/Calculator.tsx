import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchPokemon } from "../api/pokeApi";
import { itemFromIndexEntry } from "../api/showdownCatalog";
import { normalizeShowdownId } from "../api/showdownIds";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import {
  loadPopularSmogonSet,
  type SmogonUsageSet,
} from "../api/smogonUsage";
import {
  calculateChampionsDamage,
  type CalculatorField,
  type CalculatorPokemon,
  type DamageCalculationResult,
} from "../calculator/damageCalculator";
import type {
  CalculatorBuildValues,
  CalculatorPokemonSelectOptions,
} from "../calculator/calculatorEditorTypes";
import {
  createCalculatorBattleState,
  createDefaultCalculatorField,
  getCalculatorMaxHp,
  getCalculatorMoveSlots,
  getCalculatorSpeed,
  type DamageDirection,
} from "../calculator/calculatorViewModel";
import {
  createDefaultCalculatorBuild,
  createUsageCalculatorBuild,
} from "../calculator/calculatorUsageBuild";
import { defaultEvs } from "../data/natures";
import { useCalculatorCatalog } from "../hooks/useCalculatorCatalog";
import { useCalculatorMobileNavigation } from "../hooks/useCalculatorMobileNavigation";
import { usePreMegaMoves } from "../hooks/usePreMegaMoves";
import type { TeamBuildStateController } from "../hooks/useTeamBuildState";
import { useLocalization } from "../i18n/useLocalization";
import type {
  ItemIndexEntry,
  PokemonMove,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
} from "../types";
import { getPokemonBuildSnapshot } from "../utils/benchPokemon";
import { getMegaStoneItemName } from "../utils/megaEvolution";
import {
  reconcileMoveIds,
} from "../utils/pokemonMoves";
import {
  getPreferredPokeApiId,
  shouldKeepSelectedPokemonForUsageTarget,
} from "../utils/pokemonAliases";
import { getIndexAfterSwap, swapArrayItems } from "../utils/reorder";
import { CalculatorPokemonEditor } from "./CalculatorPokemonEditor";
import { CalculatorMobileTabs } from "./CalculatorMobileNavigation";
import { CalculatorResultPanel } from "./CalculatorResultPanel";
import type { BattleFormat } from "../battleFormat/battleFormat";

type OpponentBuild = CalculatorBuildValues & {
  member: TeamMember | null;
};

type CalculatorProps = {
  battleFormat: BattleFormat;
  team: TeamSlot[];
  selectedSlot: number;
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  showdownLegality: ShowdownLegalitySnapshot | null;
  buildState: TeamBuildStateController;
  onSelectedSlotChange: (slotIndex: number) => void;
  onReorderSlots: (sourceIndex: number, targetIndex: number) => void;
  onSelectPokemon: (
    slotIndex: number,
    lookup: string,
    options?: { applyUsageStats?: boolean; allowBattleForm?: boolean },
  ) => Promise<void>;
  isVisible: boolean;
};

export function Calculator({
  battleFormat,
  team,
  selectedSlot,
  pokemonIndex,
  itemIndex,
  showdownLegality,
  buildState,
  onSelectedSlotChange,
  onReorderSlots,
  onSelectPokemon,
  isVisible,
}: CalculatorProps) {
  const { t } = useLocalization();
  const {
    candidateMoveIndex,
    knownMegaStoneNames,
    pokemonOptions,
    selectableItems,
  } = useCalculatorCatalog({
    battleFormat,
    pokemonIndex,
    itemIndex,
    showdownLegality,
  });
  const mobileNavigation = useCalculatorMobileNavigation(isVisible);
  const patchBuildStateSlot = buildState.patchSlot;
  const selectedMember = team[selectedSlot] ?? null;
  const playerBuild = useMemo<CalculatorBuildValues>(() => {
    if (!selectedMember) {
      return {
        item: null,
        ability: "",
        natureId: "hardy",
        evs: { ...defaultEvs },
        moveIds: [],
      };
    }

    const snapshot = getPokemonBuildSnapshot(
      selectedMember,
      buildState,
      selectedSlot,
    );

    return {
      item: snapshot.item,
      ability: snapshot.ability,
      natureId: snapshot.nature,
      evs: snapshot.evs,
      moveIds: snapshot.moveIds,
    };
  }, [buildState, selectedMember, selectedSlot]);
  const [opponentBuild, setOpponentBuild] = useState<OpponentBuild>({
    member: null,
    item: null,
    ability: "",
    natureId: "hardy",
    evs: { ...defaultEvs },
    moveIds: [],
  });
  const [direction, setDirection] =
    useState<DamageDirection>("player-to-opponent");
  const [playerBattle, setPlayerBattle] =
    useState(() => createCalculatorBattleState());
  const [opponentBattle, setOpponentBattle] =
    useState(() => createCalculatorBattleState());
  const [field, setField] = useState<CalculatorField>(() =>
    createDefaultCalculatorField(battleFormat),
  );
  const [isOpponentLoading, setIsOpponentLoading] = useState(false);
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [opponentPreMegaPokemonId, setOpponentPreMegaPokemonId] = useState("");
  const playerIdentityRef = useRef<string | null>(null);
  const preservePlayerBattleOnNextIdentityRef = useRef(false);
  const opponentIdentityRef = useRef<string | null>(null);
  const opponentSelectionRequestRef = useRef(0);

  const playerMaxHp = getCalculatorMaxHp(selectedMember, playerBuild);
  const opponentMaxHp = getCalculatorMaxHp(
    opponentBuild.member,
    opponentBuild,
  );
  const playerSpeed = getCalculatorSpeed(
    selectedMember,
    playerBuild,
    playerBattle.boosts.speed,
  );
  const opponentSpeed = getCalculatorSpeed(
    opponentBuild.member,
    opponentBuild,
    opponentBattle.boosts.speed,
  );
  const fasterSide =
    playerSpeed !== null &&
    opponentSpeed !== null &&
    playerSpeed !== opponentSpeed
      ? playerSpeed > opponentSpeed
        ? "player"
        : "opponent"
      : null;
  const playerPreMegaPokemonId =
    buildState.preMegaPokemonBySlot[selectedSlot] ?? "";
  const playerPreMegaMoves = usePreMegaMoves(
    selectedMember,
    playerPreMegaPokemonId,
    pokemonIndex,
  );
  const opponentPreMegaMoves = usePreMegaMoves(
    opponentBuild.member,
    opponentPreMegaPokemonId,
    pokemonIndex,
  );
  const playerAvailableMoves = useMemo(
    () => [...(selectedMember?.moves ?? []), ...playerPreMegaMoves],
    [playerPreMegaMoves, selectedMember?.moves],
  );
  const resolvedPlayerMoveIds = useMemo(
    () => reconcileMoveIds(playerAvailableMoves, playerBuild.moveIds),
    [playerAvailableMoves, playerBuild.moveIds],
  );
  const playerMoves = useMemo(
    () =>
      getCalculatorMoveSlots(
        selectedMember,
        resolvedPlayerMoveIds,
        playerPreMegaMoves,
      ),
    [playerPreMegaMoves, resolvedPlayerMoveIds, selectedMember],
  );
  const opponentMoves = useMemo(
    () =>
      getCalculatorMoveSlots(
        opponentBuild.member,
        opponentBuild.moveIds,
        opponentPreMegaMoves,
      ),
    [
      opponentBuild.member,
      opponentBuild.moveIds,
      opponentPreMegaMoves,
    ],
  );
  const attackingAbility =
    direction === "player-to-opponent"
      ? playerBuild.ability
      : opponentBuild.ability;
  const canActivatePlusMinus =
    battleFormat === "doubles" &&
    ["plus", "minus"].includes(normalizeShowdownId(attackingAbility));

  useEffect(() => {
    setField((current) => ({
      ...current,
      gameType: battleFormat,
      isSpread: battleFormat === "doubles",
      isHelpingHand:
        battleFormat === "doubles" ? current.isHelpingHand : false,
      isFriendGuard:
        battleFormat === "doubles" ? current.isFriendGuard : false,
      isPlusMinus:
        battleFormat === "doubles" ? current.isPlusMinus : false,
    }));
  }, [battleFormat]);

  useEffect(() => {
    if (canActivatePlusMinus) {
      return;
    }

    setField((current) =>
      current.isPlusMinus
        ? {
            ...current,
            isPlusMinus: false,
          }
        : current,
    );
  }, [canActivatePlusMinus]);

  useEffect(() => {
    if (
      !selectedMember ||
      resolvedPlayerMoveIds === playerBuild.moveIds
    ) {
      return;
    }

    patchBuildStateSlot(selectedSlot, {
      moveIds: [...resolvedPlayerMoveIds],
    });
  }, [
    patchBuildStateSlot,
    playerBuild.moveIds,
    resolvedPlayerMoveIds,
    selectedMember,
    selectedSlot,
  ]);

  useEffect(() => {
    const identity = selectedMember
      ? `${selectedSlot}:${selectedMember.id}`
      : null;

    if (playerIdentityRef.current === identity) {
      return;
    }

    playerIdentityRef.current = identity;

    if (preservePlayerBattleOnNextIdentityRef.current) {
      preservePlayerBattleOnNextIdentityRef.current = false;
      return;
    }

    setPlayerBattle(createCalculatorBattleState(playerMaxHp));
  }, [playerMaxHp, selectedMember, selectedSlot]);

  useEffect(() => {
    setPlayerBattle((current) => ({
      ...current,
      currentHp: Math.min(current.currentHp, playerMaxHp),
    }));
  }, [playerMaxHp]);

  useEffect(() => {
    const identity = opponentBuild.member?.id ?? null;

    if (opponentIdentityRef.current === identity) {
      return;
    }

    opponentIdentityRef.current = identity;
    setOpponentBattle(createCalculatorBattleState(opponentMaxHp));
  }, [opponentBuild.member, opponentMaxHp]);

  useEffect(() => {
    setOpponentBattle((current) => ({
      ...current,
      currentHp: Math.min(current.currentHp, opponentMaxHp),
    }));
  }, [opponentMaxHp]);

  const calculations = useMemo<
    Array<{
      move: PokemonMove | undefined;
      result: DamageCalculationResult | null;
    }>
  >(() => {
    const attackingMoves =
      direction === "player-to-opponent" ? playerMoves : opponentMoves;

    return attackingMoves.map((move) => {
      if (!selectedMember || !opponentBuild.member || !move) {
        return { move, result: null };
      }

      const player: CalculatorPokemon = {
        member: selectedMember,
        item: playerBuild.item,
        ability: playerBuild.ability,
        natureId: playerBuild.natureId,
        evs: playerBuild.evs,
        boosts: playerBattle.boosts,
        currentHp: playerBattle.currentHp,
        status: playerBattle.status,
        move,
      };
      const opponent: CalculatorPokemon = {
        member: opponentBuild.member,
        item: opponentBuild.item,
        ability: opponentBuild.ability,
        natureId: opponentBuild.natureId,
        evs: opponentBuild.evs,
        boosts: opponentBattle.boosts,
        currentHp: opponentBattle.currentHp,
        status: opponentBattle.status,
        move,
      };

      return {
        move,
        result:
          direction === "player-to-opponent"
            ? calculateChampionsDamage(player, opponent, field)
            : calculateChampionsDamage(opponent, player, field),
      };
    });
  }, [
    direction,
    field,
    opponentBattle,
    opponentBuild,
    opponentMoves,
    playerBattle,
    playerBuild,
    playerMoves,
    selectedMember,
  ]);

  const playerItemOptions = useMemo(() => {
    const megaStoneName = selectedMember
      ? getMegaStoneItemName(selectedMember.id, knownMegaStoneNames)
      : null;

    return selectableItems.filter(
      (item) => !item.isMegaStone || item.name === megaStoneName,
    );
  }, [knownMegaStoneNames, selectableItems, selectedMember]);
  const opponentItemOptions = useMemo(() => {
    const megaStoneName = opponentBuild.member
      ? getMegaStoneItemName(
          opponentBuild.member.id,
          knownMegaStoneNames,
        )
      : null;

    return selectableItems.filter(
      (item) => !item.isMegaStone || item.name === megaStoneName,
    );
  }, [knownMegaStoneNames, opponentBuild.member, selectableItems]);

  function updatePlayerBuild(patch: Partial<CalculatorBuildValues>) {
    if (!selectedMember) {
      return;
    }

    buildState.patchSlot(selectedSlot, {
      ...(Object.prototype.hasOwnProperty.call(patch, "item")
        ? { item: patch.item ?? null }
        : {}),
      ...(patch.ability !== undefined ? { ability: patch.ability } : {}),
      ...(patch.natureId !== undefined
        ? { nature: patch.natureId }
        : {}),
      ...(patch.evs !== undefined ? { evs: patch.evs } : {}),
      ...(patch.moveIds !== undefined ? { moveIds: patch.moveIds } : {}),
    });
  }

  function updateMove(
    side: "player" | "opponent",
    moveIndex: number,
    moveId: string,
  ) {
    if (side === "player") {
      const moveIds = [0, 1, 2, 3].map(
        (index) =>
          (index === moveIndex ? moveId : playerBuild.moveIds[index]) ?? "",
      );
      updatePlayerBuild({ moveIds });
      return;
    }

    setOpponentBuild((current) => ({
      ...current,
      moveIds: [0, 1, 2, 3].map(
        (index) =>
          (index === moveIndex ? moveId : current.moveIds[index]) ?? "",
      ),
    }));
  }

  function reorderMoves(
    side: "player" | "opponent",
    sourceIndex: number,
    targetIndex: number,
  ) {
    if (sourceIndex === targetIndex) {
      return;
    }

    if (side === "player") {
      const moveIds = [0, 1, 2, 3].map(
        (index) =>
          resolvedPlayerMoveIds[index] ?? playerMoves[index]?.id ?? "",
      );

      if (!moveIds[sourceIndex]) {
        return;
      }

      updatePlayerBuild({
        moveIds: swapArrayItems(moveIds, sourceIndex, targetIndex),
      });
      return;
    }

    setOpponentBuild((current) => {
      const moveIds = [0, 1, 2, 3].map(
        (index) =>
          current.moveIds[index] ?? opponentMoves[index]?.id ?? "",
      );

      if (!moveIds[sourceIndex]) {
        return current;
      }

      return {
        ...current,
        moveIds: swapArrayItems(moveIds, sourceIndex, targetIndex),
      };
    });
  }

  function reorderPlayerTeam(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex || !team[sourceIndex]) {
      return;
    }

    const nextSelectedSlot = getIndexAfterSwap(
      selectedSlot,
      sourceIndex,
      targetIndex,
    );

    preservePlayerBattleOnNextIdentityRef.current =
      nextSelectedSlot !== selectedSlot;
    onReorderSlots(sourceIndex, targetIndex);
    onSelectedSlotChange(nextSelectedSlot);
  }

  async function selectPlayerPokemon(
    pokemonId: string,
    options: CalculatorPokemonSelectOptions = {},
  ) {
    const targetEntry = pokemonIndex.find((entry) => entry.name === pokemonId);
    const currentEntry = pokemonIndex.find(
      (entry) => entry.name === selectedMember?.id,
    );

    await onSelectPokemon(selectedSlot, pokemonId, options);

    if (targetEntry?.formKind === "mega") {
      const megaStoneName = getMegaStoneItemName(
        targetEntry.name,
        knownMegaStoneNames,
      );
      const megaStone = megaStoneName
        ? selectableItems.find((entry) => entry.name === megaStoneName)
        : undefined;

      if (megaStone) {
        buildState.patchSlot(selectedSlot, {
          item: itemFromIndexEntry(megaStone),
        });
      }
    } else if (
      currentEntry?.formKind === "mega" &&
      playerBuild.item?.category === "Mega Stones"
    ) {
      buildState.patchSlot(selectedSlot, { item: null });
    }
  }

  async function selectOpponent(
    pokemonId: string,
    options: CalculatorPokemonSelectOptions = {},
  ) {
    const requestId = opponentSelectionRequestRef.current + 1;
    opponentSelectionRequestRef.current = requestId;
    setIsOpponentLoading(true);
    setOpponentError(null);

    try {
      const selectedMember = await fetchPokemon(pokemonId);
      let member = selectedMember;
      let usageSet: SmogonUsageSet | null = null;

      if (options.applyUsageStats) {
        usageSet = await loadPopularSmogonSet(pokemonId, battleFormat);

        if (usageSet) {
          member = await resolveOpponentUsageTargetMember(
            usageSet,
            selectedMember,
          );
        }
      }

      if (opponentSelectionRequestRef.current !== requestId) {
        return;
      }

      const targetEntry = pokemonIndex.find(
        (entry) => entry.name === member.id,
      );
      const megaStoneName = getMegaStoneItemName(
        member.id,
        knownMegaStoneNames,
      );
      const megaStone = megaStoneName
        ? selectableItems.find((entry) => entry.name === megaStoneName)
        : undefined;
      const usageItem = usageSet?.itemName
        ? selectableItems.find((entry) => {
            const usageItemId = normalizeShowdownId(usageSet.itemName ?? "");

            return [entry.showdownId, entry.name, entry.displayName].some(
              (value) => normalizeShowdownId(value ?? "") === usageItemId,
            );
          })
        : undefined;
      const item = usageItem ?? megaStone;

      if (
        targetEntry?.formKind === "mega" &&
        selectedMember.id !== member.id
      ) {
        setOpponentPreMegaPokemonId(selectedMember.id);
      } else if (targetEntry?.formKind !== "mega") {
        setOpponentPreMegaPokemonId("");
      }

      setOpponentBuild((current) => {
        if (options.applyUsageStats && usageSet) {
          return {
            member,
            ...createUsageCalculatorBuild(
              member,
              usageSet,
              item ? itemFromIndexEntry(item) : null,
            ),
          };
        }

        if (options.applyUsageStats) {
          return {
            member,
            ...createDefaultCalculatorBuild(
              member,
              item ? itemFromIndexEntry(item) : null,
            ),
          };
        }

        const availableMoveIds = new Set(
          member.moves?.map((move) => move.id) ?? [],
        );
        const nextItem = megaStone
          ? itemFromIndexEntry(megaStone)
          : current.item?.category === "Mega Stones"
            ? null
            : current.item;

        return {
          ...current,
          member,
          item: nextItem,
          ability: member.abilities?.includes(current.ability)
            ? current.ability
            : member.abilities?.[0] ?? "",
          moveIds: current.moveIds.map((moveId) =>
            !moveId || availableMoveIds.has(moveId) ? moveId : "",
          ),
        };
      });
    } catch (error) {
      setOpponentError(
        error instanceof Error
          ? error.message
          : t("calculator.lookupFailed"),
      );
    } finally {
      if (opponentSelectionRequestRef.current === requestId) {
        setIsOpponentLoading(false);
      }
    }
  }

  function resolveUsagePokemonId(name: string) {
    const preferredId = getPreferredPokeApiId(name);

    if (preferredId) {
      return preferredId;
    }

    const normalized = normalizeShowdownId(name);
    const matchedEntry = pokemonIndex.find((entry) =>
      [entry.name, entry.displayName, entry.displayName.replace(/\s+/g, "-")]
        .map(normalizeShowdownId)
        .includes(normalized),
    );

    return matchedEntry?.name ?? normalized;
  }

  async function resolveOpponentUsageTargetMember(
    usageSet: SmogonUsageSet,
    selectedMember: TeamMember,
  ) {
    const usagePokemonId = resolveUsagePokemonId(usageSet.pokemonName);

    if (
      normalizeShowdownId(usagePokemonId) ===
        normalizeShowdownId(selectedMember.id) ||
      shouldKeepSelectedPokemonForUsageTarget(
        selectedMember.id,
        usagePokemonId,
      )
    ) {
      return selectedMember;
    }

    try {
      return await fetchPokemon(usagePokemonId);
    } catch {
      return selectedMember;
    }
  }

  return (
    <section
      className="calculator-workspace"
      aria-label={t("calculator.title")}
      hidden={!isVisible}
    >
      <CalculatorMobileTabs
        mobilePage={mobileNavigation.mobilePage}
        direction={direction}
        onSelectPage={mobileNavigation.showMobilePage}
        onTabKeyDown={mobileNavigation.handleTabKeyDown}
      />

      <div
        className="calculator-layout"
        ref={mobileNavigation.layoutRef}
        onPointerDown={mobileNavigation.cancelScrollTarget}
        onScroll={mobileNavigation.handleLayoutScroll}
      >
        <CalculatorPokemonEditor
          panelId="calculator-mobile-panel-player"
          panelLabelledBy="calculator-mobile-tab-player"
          side="player"
          member={selectedMember}
          build={playerBuild}
          battle={playerBattle}
          maxHp={playerMaxHp}
          moves={playerMoves}
          team={team}
          selectedSlot={selectedSlot}
          pokemonOptions={pokemonOptions}
          candidateMoveIndex={candidateMoveIndex}
          pokemonIndex={pokemonIndex}
          itemOptions={playerItemOptions}
          showdownLegality={showdownLegality}
          preMegaPokemonId={playerPreMegaPokemonId}
          preMegaMoves={playerPreMegaMoves}
          isAttacking={direction === "player-to-opponent"}
          onSelectedSlotChange={onSelectedSlotChange}
          onReorderTeamSlots={reorderPlayerTeam}
          onSelectPokemon={selectPlayerPokemon}
          onRememberPreMegaPokemon={(pokemonId) =>
            buildState.setPreMegaPokemonBySlot((current) => ({
              ...current,
              [selectedSlot]: pokemonId,
            }))
          }
          onBuildChange={updatePlayerBuild}
          onMoveChange={(moveIndex, moveId) =>
            updateMove("player", moveIndex, moveId)
          }
          onReorderMoves={(sourceIndex, targetIndex) =>
            reorderMoves("player", sourceIndex, targetIndex)
          }
          onBattleChange={setPlayerBattle}
        />

        <CalculatorResultPanel
          battleFormat={battleFormat}
          direction={direction}
          calculations={calculations}
          field={field}
          hasBothPokemon={Boolean(selectedMember && opponentBuild.member)}
          canActivatePlusMinus={canActivatePlusMinus}
          playerSpeed={playerSpeed}
          opponentSpeed={opponentSpeed}
          fasterSide={fasterSide}
          onReverseDirection={() =>
            setDirection((current) =>
              current === "player-to-opponent"
                ? "opponent-to-player"
                : "player-to-opponent",
            )
          }
          onFieldChange={setField}
        />

        <CalculatorPokemonEditor
          panelId="calculator-mobile-panel-opponent"
          panelLabelledBy="calculator-mobile-tab-opponent"
          side="opponent"
          member={opponentBuild.member}
          build={opponentBuild}
          battle={opponentBattle}
          maxHp={opponentMaxHp}
          moves={opponentMoves}
          pokemonOptions={pokemonOptions}
          candidateMoveIndex={candidateMoveIndex}
          pokemonIndex={pokemonIndex}
          itemOptions={opponentItemOptions}
          showdownLegality={showdownLegality}
          preMegaPokemonId={opponentPreMegaPokemonId}
          preMegaMoves={opponentPreMegaMoves}
          isAttacking={direction === "opponent-to-player"}
          isPokemonLoading={isOpponentLoading}
          onSelectPokemon={selectOpponent}
          onRememberPreMegaPokemon={setOpponentPreMegaPokemonId}
          onBuildChange={(patch) =>
            setOpponentBuild((current) => ({
              ...current,
              ...patch,
            }))
          }
          onMoveChange={(moveIndex, moveId) =>
            updateMove("opponent", moveIndex, moveId)
          }
          onReorderMoves={(sourceIndex, targetIndex) =>
            reorderMoves("opponent", sourceIndex, targetIndex)
          }
          onBattleChange={setOpponentBattle}
        />
      </div>

      {opponentError ? (
        <p className="calculator-error" role="alert">
          {opponentError}
        </p>
      ) : null}
    </section>
  );
}
