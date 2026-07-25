import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowLeft,
  faArrowRight,
  faRightLeft,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPokemon } from "../api/pokeApi";
import { itemFromIndexEntry } from "../api/showdownCatalog";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import {
  isItemLegal,
  isPokemonLegal,
  type ShowdownLegalitySnapshot,
} from "../api/showdownLegality";
import { loadSmogonUsagePokemonIds } from "../api/smogonUsage";
import {
  calculateChampionsDamage,
  type CalculatorBoosts,
  type CalculatorField,
  type CalculatorPokemon,
  type DamageCalculationResult,
} from "../calculator/damageCalculator";
import {
  calculateChampionsStats,
  defaultEvs,
  getNatureById,
} from "../data/natures";
import type { TeamBuildStateController } from "../hooks/useTeamBuildState";
import { useLocalization } from "../i18n/useLocalization";
import type {
  ItemIndexEntry,
  PokemonItem,
  PokemonMove,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
} from "../types";
import { getPokemonBuildSnapshot } from "../utils/benchPokemon";
import { getMegaStoneItemName } from "../utils/megaEvolution";
import {
  findMoveByLookup,
  reconcileMoveIds,
} from "../utils/pokemonMoves";
import { orderPokemonOptionsByUsage } from "../utils/pokemonUsageOrder";
import {
  CalculatorPokemonEditor,
  type CalculatorBuildValues,
  type CalculatorPokemonOption,
  type CalculatorPokemonSelectOptions,
  type CalculatorSideBattleState,
} from "./CalculatorPokemonEditor";
import { TypeBadge } from "./TypeBadge";
import type { BattleFormat } from "../battleFormat/battleFormat";

type DamageDirection = "player-to-opponent" | "opponent-to-player";

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
  onSelectPokemon: (
    slotIndex: number,
    lookup: string,
    options?: { applyUsageStats?: boolean; allowBattleForm?: boolean },
  ) => Promise<void>;
  isVisible: boolean;
};

const emptyBoosts: CalculatorBoosts = {
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

function createDefaultField(battleFormat: BattleFormat): CalculatorField {
  return {
    weather: "none",
    terrain: "none",
    room: "none",
    aura: "none",
    gameType: battleFormat,
    isCritical: false,
    isSpread: battleFormat === "doubles",
    isHelpingHand: false,
    isTailwind: false,
    isFriendGuard: false,
    isPlusMinus: false,
    isWall: false,
  };
}

function getMaxHp(member: TeamMember | null, build: CalculatorBuildValues) {
  if (!member?.baseStats) {
    return 1;
  }

  return calculateChampionsStats(
    member.baseStats,
    build.evs,
    getNatureById(build.natureId),
  ).hp;
}

function getSpeed(
  member: TeamMember | null,
  build: CalculatorBuildValues,
  stage: number,
) {
  if (!member?.baseStats) {
    return null;
  }

  const speed = calculateChampionsStats(
    member.baseStats,
    build.evs,
    getNatureById(build.natureId),
  ).speed;
  const clampedStage = Number.isFinite(stage)
    ? Math.max(-6, Math.min(6, stage))
    : 0;

  return Math.floor(
    speed *
      (clampedStage >= 0
        ? (2 + clampedStage) / 2
        : 2 / (2 - clampedStage)),
  );
}

function getMoveById(
  member: TeamMember | null,
  moveId: string,
  fallbackMoves: PokemonMove[] = [],
) {
  return findMoveByLookup(
    [...(member?.moves ?? []), ...fallbackMoves],
    moveId,
  );
}

function getMoveSlots(
  member: TeamMember | null,
  moveIds: string[],
  fallbackMoves: PokemonMove[] = [],
) {
  return [0, 1, 2, 3].map((index) =>
    getMoveById(member, moveIds[index] ?? "", fallbackMoves),
  );
}

function createBattleState(currentHp = 1): CalculatorSideBattleState {
  return {
    currentHp,
    status: "healthy",
    boosts: { ...emptyBoosts },
  };
}

function usePreMegaMoves(
  member: TeamMember | null,
  preMegaPokemonId: string,
  pokemonIndex: PokemonIndexEntry[],
) {
  const [moves, setMoves] = useState<PokemonMove[]>([]);
  const isMega =
    pokemonIndex.find((entry) => entry.name === member?.id)?.formKind ===
    "mega";

  useEffect(() => {
    if (!isMega || !preMegaPokemonId) {
      setMoves([]);
      return;
    }

    let isCurrent = true;

    void fetchPokemon(preMegaPokemonId)
      .then((pokemon) => {
        if (isCurrent) {
          setMoves(pokemon.moves ?? []);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setMoves([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isMega, preMegaPokemonId]);

  return moves;
}

function createOpponentBuild(
  member: TeamMember,
  item: PokemonItem | null = null,
): OpponentBuild {
  return {
    member,
    item,
    ability: member.abilities?.[0] ?? "",
    natureId: "hardy",
    evs: { ...defaultEvs },
    moveIds: [
      ...(member.moves
        ?.filter((move) => move.category !== "Status")
        .slice(0, 4)
        .map((move) => move.id) ?? []),
      "",
      "",
      "",
      "",
    ].slice(0, 4),
  };
}

function formatChance(value: number) {
  if (value === 0 || value === 100) {
    return `${value}%`;
  }

  return `${value.toFixed(1)}%`;
}

export function Calculator({
  battleFormat,
  team,
  selectedSlot,
  pokemonIndex,
  itemIndex,
  showdownLegality,
  buildState,
  onSelectedSlotChange,
  onSelectPokemon,
  isVisible,
}: CalculatorProps) {
  const { gameName, locale, pokemonName, t } = useLocalization();
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
    useState<CalculatorSideBattleState>(() => createBattleState());
  const [opponentBattle, setOpponentBattle] =
    useState<CalculatorSideBattleState>(() => createBattleState());
  const [field, setField] = useState<CalculatorField>(() =>
    createDefaultField(battleFormat),
  );
  const [usagePokemonIds, setUsagePokemonIds] = useState<string[] | null>(
    null,
  );
  const [isOpponentLoading, setIsOpponentLoading] = useState(false);
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [opponentPreMegaPokemonId, setOpponentPreMegaPokemonId] = useState("");
  const playerIdentityRef = useRef<string | null>(null);
  const opponentIdentityRef = useRef<string | null>(null);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US"),
    [locale],
  );

  const playerMaxHp = getMaxHp(selectedMember, playerBuild);
  const opponentMaxHp = getMaxHp(opponentBuild.member, opponentBuild);
  const playerSpeed = getSpeed(
    selectedMember,
    playerBuild,
    playerBattle.boosts.speed,
  );
  const opponentSpeed = getSpeed(
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
      getMoveSlots(
        selectedMember,
        resolvedPlayerMoveIds,
        playerPreMegaMoves,
      ),
    [playerPreMegaMoves, resolvedPlayerMoveIds, selectedMember],
  );
  const opponentMoves = useMemo(
    () =>
      getMoveSlots(
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
    let isCurrent = true;
    setUsagePokemonIds(null);

    void loadSmogonUsagePokemonIds(battleFormat)
      .then((ids) => {
        if (isCurrent) {
          setUsagePokemonIds(ids);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setUsagePokemonIds([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [battleFormat]);

  useEffect(() => {
    const identity = selectedMember
      ? `${selectedSlot}:${selectedMember.id}`
      : null;

    if (playerIdentityRef.current === identity) {
      return;
    }

    playerIdentityRef.current = identity;
    setPlayerBattle(createBattleState(playerMaxHp));
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
    setOpponentBattle(createBattleState(opponentMaxHp));
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

  const basePokemonOptions = useMemo<CalculatorPokemonOption[]>(
    () =>
      pokemonIndex
        .filter((entry) => entry.isSelectorOption)
        .filter((entry) =>
          isPokemonLegal(
            showdownLegality,
            entry.showdownId,
            entry.speciesKey,
          ),
        )
        .map((entry) => {
          const includeForm =
            entry.formKind === "gender" ||
            entry.formKind === "regional" ||
            entry.displayName !== formatIdLabel(entry.speciesKey);

          return {
            id: entry.name,
            label: pokemonName({
              id: entry.name,
              speciesId: entry.speciesKey,
              fallback: entry.displayName,
              includeForm,
              formLabel: entry.formLabel,
              formKind: entry.formKind,
            }),
            englishName: entry.displayName,
            number: entry.sortNumber,
            types: entry.types,
            entry,
          };
        }),
    [pokemonIndex, pokemonName, showdownLegality],
  );
  const pokemonOptions = useMemo(() => {
    const { orderedOptions, rankByOptionId } = orderPokemonOptionsByUsage(
      basePokemonOptions,
      usagePokemonIds,
    );

    return orderedOptions.map((option) => ({
      ...option,
      usageRank: rankByOptionId.get(option.id),
    }));
  }, [basePokemonOptions, usagePokemonIds]);
  const selectableItems = useMemo(
    () =>
      itemIndex.filter((entry) =>
        isItemLegal(showdownLegality, entry.showdownId ?? entry.name),
      ),
    [itemIndex, showdownLegality],
  );
  const knownMegaStoneNames = useMemo(
    () =>
      new Set(
        selectableItems
          .filter((entry) => entry.isMegaStone)
          .map((entry) => entry.name),
      ),
    [selectableItems],
  );
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
    setIsOpponentLoading(true);
    setOpponentError(null);

    try {
      const member = await fetchPokemon(pokemonId);
      const targetEntry = pokemonIndex.find(
        (entry) => entry.name === pokemonId,
      );
      const currentEntry = pokemonIndex.find(
        (entry) => entry.name === opponentBuild.member?.id,
      );
      const megaStoneName = getMegaStoneItemName(
        member.id,
        knownMegaStoneNames,
      );
      const megaStone = megaStoneName
        ? selectableItems.find((entry) => entry.name === megaStoneName)
        : undefined;

      if (
        targetEntry?.formKind === "mega" &&
        opponentBuild.member &&
        currentEntry?.formKind !== "mega"
      ) {
        setOpponentPreMegaPokemonId(opponentBuild.member.id);
      }

      setOpponentBuild((current) => {
        if (options.applyUsageStats) {
          return createOpponentBuild(
            member,
            megaStone ? itemFromIndexEntry(megaStone) : null,
          );
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
      setIsOpponentLoading(false);
    }
  }

  function getKoSummary(
    result: Extract<DamageCalculationResult, { status: "ready" }>,
  ) {
    if (result.oneHitKoChance === 100) {
      return t("calculator.guaranteedOhko");
    }

    if (result.oneHitKoChance > 0) {
      return t("calculator.chanceOhko", {
        chance: formatChance(result.oneHitKoChance),
      });
    }

    if (result.koHits <= 0) {
      return t("calculator.noKo");
    }

    if (result.koChance === 100) {
      return t("calculator.guaranteedHitsKo", { hits: result.koHits });
    }

    if (result.koChance !== null && result.koChance > 0) {
      return t("calculator.chanceHitsKo", {
        chance: formatChance(result.koChance),
        hits: result.koHits,
      });
    }

    return t("calculator.possibleHitsKo", { hits: result.koHits });
  }

  function getCalculationLabel(
    move: PokemonMove | undefined,
    result: DamageCalculationResult | null,
  ) {
    if (!move) {
      return t("builder.emptyMove");
    }

    if (!selectedMember || !opponentBuild.member) {
      return t("calculator.chooseBothPokemon");
    }

    if (result?.status === "ready") {
      return getKoSummary(result);
    }

    return result?.reason === "status-move"
      ? t("calculator.statusMoveShort")
      : t("calculator.unsupported");
  }

  function getEffectivenessPresentation(effectiveness: number) {
    if (effectiveness === 0) {
      return {
        className: "is-immune",
        label: "x0",
      };
    }

    if (effectiveness < 1) {
      return {
        className: "is-resisted",
        label: `x${effectiveness}`,
      };
    }

    if (effectiveness > 1) {
      return {
        className: "is-weak",
        label: `x${effectiveness}`,
      };
    }

    return {
      className: "is-neutral",
      label: "x1",
    };
  }

  return (
    <section
      className="calculator-workspace"
      aria-label={t("calculator.title")}
      hidden={!isVisible}
    >
      <div className="calculator-layout">
        <CalculatorPokemonEditor
          side="player"
          member={selectedMember}
          build={playerBuild}
          battle={playerBattle}
          maxHp={playerMaxHp}
          moves={playerMoves}
          team={team}
          selectedSlot={selectedSlot}
          pokemonOptions={pokemonOptions}
          pokemonIndex={pokemonIndex}
          itemOptions={playerItemOptions}
          showdownLegality={showdownLegality}
          preMegaPokemonId={playerPreMegaPokemonId}
          preMegaMoves={playerPreMegaMoves}
          isAttacking={direction === "player-to-opponent"}
          onSelectedSlotChange={onSelectedSlotChange}
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
          onBattleChange={setPlayerBattle}
        />

        <section className="calculator-result-panel">
          <div className="calculator-direction-control">
            <span
              className={`calculator-speed-indicator ${
                fasterSide === "player" ? "is-active" : ""
              }`}
              aria-label={
                fasterSide === "player"
                  ? t("calculator.fasterPokemon", {
                      speed: playerSpeed ?? 0,
                    })
                  : undefined
              }
              title={
                fasterSide === "player"
                  ? t("calculator.fasterPokemon", {
                      speed: playerSpeed ?? 0,
                    })
                  : undefined
              }
            >
              {fasterSide === "player" ? (
                <FontAwesomeIcon icon={faAnglesLeft} aria-hidden="true" />
              ) : null}
            </span>

            <button
              className="calculator-direction-button"
              type="button"
              aria-label={t("calculator.reverseDirection")}
              onClick={() =>
                setDirection((current) =>
                  current === "player-to-opponent"
                    ? "opponent-to-player"
                    : "player-to-opponent",
                )
              }
            >
              <FontAwesomeIcon
                icon={
                  direction === "player-to-opponent"
                    ? faArrowRight
                    : faArrowLeft
                }
                aria-hidden="true"
              />
              <FontAwesomeIcon icon={faRightLeft} aria-hidden="true" />
            </button>

            <span
              className={`calculator-speed-indicator ${
                fasterSide === "opponent" ? "is-active" : ""
              }`}
              aria-label={
                fasterSide === "opponent"
                  ? t("calculator.fasterPokemon", {
                      speed: opponentSpeed ?? 0,
                    })
                  : undefined
              }
              title={
                fasterSide === "opponent"
                  ? t("calculator.fasterPokemon", {
                      speed: opponentSpeed ?? 0,
                    })
                  : undefined
              }
            >
              {fasterSide === "opponent" ? (
                <FontAwesomeIcon icon={faAnglesRight} aria-hidden="true" />
              ) : null}
            </span>
          </div>

          <div className="calculator-result">
            <div
              className="calculator-move-results-table"
              role="table"
              aria-label={t("calculator.moveResults")}
            >
              {calculations.map(({ move, result }, moveIndex) => {
                const readyResult =
                  result?.status === "ready" ? result : null;
                const effectiveness =
                  readyResult?.offensivePower !== null &&
                  readyResult?.offensivePower !== undefined
                    ? getEffectivenessPresentation(
                        readyResult.effectiveness,
                      )
                    : null;
                const percentText = readyResult
                  ? `${readyResult.minPercent.toFixed(1)}–${readyResult.maxPercent.toFixed(1)}%`
                  : "-";
                const damageText = readyResult
                  ? `${readyResult.minDamage}–${readyResult.maxDamage}`
                  : "-";
                const offensivePowerText =
                  readyResult?.offensivePower === null ||
                  readyResult?.offensivePower === undefined
                    ? "-"
                    : numberFormatter.format(readyResult.offensivePower);

                return (
                  <div
                    className={`calculator-move-result-row ${
                      readyResult ? "" : "is-unavailable"
                    }`}
                    role="row"
                    key={`${moveIndex}-${move?.id ?? "empty"}`}
                  >
                    <div
                      className="calculator-move-result-primary"
                      role="rowheader"
                    >
                      <span className="calculator-result-move-name">
                        {move ? <TypeBadge type={move.type} /> : null}
                        <strong>
                          {move
                            ? gameName("moves", move.id, move.name)
                            : t("calculator.moveSlot", {
                                slot: moveIndex + 1,
                          })}
                        </strong>
                        {effectiveness ? (
                          <span
                            className={`calculator-effectiveness ${effectiveness.className}`}
                          >
                            {effectiveness.label}
                          </span>
                        ) : null}
                      </span>
                    </div>

                    <span className="calculator-result-verdict">
                      {getCalculationLabel(move, result)}
                    </span>

                    <div className="calculator-damage-summary" role="cell">
                      <strong
                        className="calculator-primary-percent"
                        aria-label={`${t("calculator.percent")} ${percentText}`}
                      >
                        {percentText}
                      </strong>
                      <span
                        className="calculator-raw-damage"
                        aria-label={`${t("calculator.damage")} ${damageText}`}
                      >
                        {readyResult ? `(${damageText})` : "-"}
                      </span>
                    </div>

                    <div className="calculator-offensive-power" role="cell">
                      <span>{t("calculator.offensivePower")}</span>
                      <strong>{offensivePowerText}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`calculator-field-controls is-${battleFormat}${
              canActivatePlusMinus ? " has-plus-minus" : ""
            }`}
          >
            <div className="calculator-field-heading">
              {t("calculator.battleConditions")}
            </div>
            <label>
              <span className="sr-only">{t("calculator.weather")}</span>
              <select
                value={field.weather}
                onChange={(event) =>
                  setField((current) => ({
                    ...current,
                    weather: event.target
                      .value as CalculatorField["weather"],
                  }))
                }
              >
                <option value="none">{t("calculator.weather")}</option>
                <option value="sun">{t("calculator.sun")}</option>
                <option value="rain">{t("calculator.rain")}</option>
                <option value="sand">{t("calculator.sand")}</option>
                <option value="snow">{t("calculator.snow")}</option>
              </select>
            </label>
            <label>
              <span className="sr-only">{t("calculator.terrain")}</span>
              <select
                value={field.terrain}
                onChange={(event) =>
                  setField((current) => ({
                    ...current,
                    terrain: event.target
                      .value as CalculatorField["terrain"],
                  }))
                }
              >
                <option value="none">{t("calculator.terrain")}</option>
                <option value="electric">
                  {t("calculator.electricTerrain")}
                </option>
                <option value="grassy">
                  {t("calculator.grassyTerrain")}
                </option>
                <option value="psychic">
                  {t("calculator.psychicTerrain")}
                </option>
                <option value="misty">
                  {t("calculator.mistyTerrain")}
                </option>
              </select>
            </label>
            <label>
              <span className="sr-only">{t("calculator.roomGravity")}</span>
              <select
                value={field.room}
                onChange={(event) =>
                  setField((current) => ({
                    ...current,
                    room: event.target.value as CalculatorField["room"],
                  }))
                }
              >
                <option value="none">
                  {t("calculator.roomGravity")}
                </option>
                <option value="magic">{t("calculator.magicRoom")}</option>
                <option value="wonder">{t("calculator.wonderRoom")}</option>
                <option value="gravity">{t("calculator.gravity")}</option>
              </select>
            </label>
            <label>
              <span className="sr-only">{t("calculator.aura")}</span>
              <select
                value={field.aura}
                onChange={(event) =>
                  setField((current) => ({
                    ...current,
                    aura: event.target.value as CalculatorField["aura"],
                  }))
                }
              >
                <option value="none">{t("calculator.aura")}</option>
                <option value="fairy">{t("calculator.fairyAura")}</option>
              </select>
            </label>
            {([
              ["isCritical", "calculator.critical"],
              ...(battleFormat === "doubles"
                ? ([
                    ["isHelpingHand", "calculator.helpingHand"],
                    ["isTailwind", "calculator.tailwind"],
                    ["isFriendGuard", "calculator.friendGuard"],
                    ["isWall", "calculator.wall"],
                    ...(canActivatePlusMinus
                      ? ([
                          ["isPlusMinus", "calculator.plusMinus"],
                        ] as const)
                      : []),
                  ] as const)
                : ([
                    ["isTailwind", "calculator.tailwind"],
                    ["isWall", "calculator.wall"],
                  ] as const)),
            ] as const).map(([fieldKey, labelKey]) => (
              <label
                className="calculator-toggle"
                key={fieldKey}
              >
                <input
                  type="checkbox"
                  checked={Boolean(
                    field[fieldKey as keyof CalculatorField],
                  )}
                  onChange={(event) =>
                    setField((current) => ({
                      ...current,
                      [fieldKey]: event.target.checked,
                    }))
                  }
                />
                <span>{t(labelKey as Parameters<typeof t>[0])}</span>
              </label>
            ))}
          </div>
        </section>

        <CalculatorPokemonEditor
          side="opponent"
          member={opponentBuild.member}
          build={opponentBuild}
          battle={opponentBattle}
          maxHp={opponentMaxHp}
          moves={opponentMoves}
          pokemonOptions={pokemonOptions}
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
