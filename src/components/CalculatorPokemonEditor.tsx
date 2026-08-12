import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPokemon } from "../api/pokeApi";
import {
  fetchAbility,
  itemFromIndexEntry,
} from "../api/showdownCatalog";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import {
  getLegalAbilities,
  getLegalMoves,
  getShowdownLookupKeys,
  type ShowdownLegalitySnapshot,
} from "../api/showdownLegality";
import type { CalculatorPokemonStatus } from "../calculator/damageCalculator";
import type {
  CalculatorBuildValues,
  CalculatorPokemonOption,
  CalculatorPokemonSelectOptions,
  CalculatorSideBattleState,
} from "../calculator/calculatorEditorTypes";
import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  getNatureById,
  statKeys,
} from "../data/natures";
import { getBattleFormGroup } from "../data/battleForms";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import { useCalculatorCandidateFilters } from "../hooks/useCalculatorCandidateFilters";
import {
  useIncrementalOptions,
} from "../hooks/useIncrementalOptions";
import {
  getReorderDisplacement,
  useLongPressReorder,
} from "../hooks/useLongPressReorder";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useScrubbableNumberInput } from "../hooks/useScrubbableNumberInput";
import { useLocalization } from "../i18n/useLocalization";
import type {
  ItemIndexEntry,
  PokemonAbility,
  PokemonIndexEntry,
  PokemonItem,
  PokemonMove,
  StatBlock,
  StatKey,
  TeamMember,
  TeamSlot,
} from "../types";
import { CandidateFilterPanel } from "./CandidateFilterPanel";
import {
  AbilityPickerOptions,
  ItemPickerOptions,
  MovePickerOptions,
  PokemonPickerOptions,
} from "./CalculatorPickerOptions";
import { ItemSprite } from "./ItemSprite";
import {
  NatureGrid,
} from "./NatureGrid";
import {
  getNatureAtGridPosition,
  getNatureGridPosition,
  type NatureGridPosition,
} from "./natureGridUtils";
import { MoveSummary, MoveTooltip } from "./MoveDetails";
import { PokemonIcon } from "./PokemonIcon";
import {
  AbilityDetailsContent,
  ItemDetailsContent,
} from "./SelectionDetails";
import {
  TouchPickerSearchInput,
  TouchSelectionDialog,
} from "./TouchSelectionDialog";
import { StatStagePicker } from "./StatStagePicker";
import { TypeBadge } from "./TypeBadge";

type OpenPicker =
  | "pokemon"
  | "item"
  | "ability"
  | "nature"
  | "status"
  | "move"
  | null;

const calculatorStatusOptions = [
  "healthy",
  "burned",
] as const satisfies readonly CalculatorPokemonStatus[];

type CalculatorPokemonEditorProps = {
  panelId?: string;
  panelLabelledBy?: string;
  side: "player" | "opponent";
  member: TeamMember | null;
  build: CalculatorBuildValues;
  battle: CalculatorSideBattleState;
  maxHp: number;
  moves: Array<PokemonMove | undefined>;
  team?: TeamSlot[];
  selectedSlot?: number;
  pokemonOptions: CalculatorPokemonOption[];
  candidateMoveIndex: PokemonMove[];
  pokemonIndex: PokemonIndexEntry[];
  itemOptions: ItemIndexEntry[];
  showdownLegality: ShowdownLegalitySnapshot | null;
  preMegaPokemonId?: string;
  preMegaMoves?: PokemonMove[];
  isAttacking: boolean;
  isPokemonLoading?: boolean;
  onSelectedSlotChange?: (slotIndex: number) => void;
  onReorderTeamSlots?: (sourceIndex: number, targetIndex: number) => void;
  onSelectPokemon: (
    pokemonId: string,
    options?: CalculatorPokemonSelectOptions,
  ) => Promise<void>;
  onRememberPreMegaPokemon?: (pokemonId: string) => void;
  onBuildChange: (patch: Partial<CalculatorBuildValues>) => void;
  onMoveChange: (moveIndex: number, moveId: string) => void;
  onReorderMoves: (sourceIndex: number, targetIndex: number) => void;
  onBattleChange: (
    updater: (
      current: CalculatorSideBattleState,
    ) => CalculatorSideBattleState,
  ) => void;
};

function getNextIndex(
  currentIndex: number,
  optionCount: number,
  direction: 1 | -1,
) {
  if (optionCount === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction > 0 ? 0 : optionCount - 1;
  }

  return (currentIndex + direction + optionCount) % optionCount;
}

function clampEvSpread(current: StatBlock, stat: StatKey, nextValue: number) {
  const otherTotal = statKeys.reduce(
    (total, key) => total + (key === stat ? 0 : current[key]),
    0,
  );
  const remaining = Math.max(0, CHAMPIONS_MAX_EV_TOTAL - otherTotal);

  return {
    ...current,
    [stat]: Math.max(
      0,
      Math.min(
        CHAMPIONS_MAX_EV_PER_STAT,
        remaining,
        Math.round(nextValue),
      ),
    ),
  };
}

function isExactPokemonFormLegal(
  showdownLegality: ShowdownLegalitySnapshot | null,
  pokemonId: string,
) {
  if (!showdownLegality || showdownLegality.pokemonIds.size === 0) {
    return true;
  }

  return getShowdownLookupKeys(pokemonId).some((lookup) =>
    showdownLegality.pokemonIds.has(lookup),
  );
}

export function CalculatorPokemonEditor({
  panelId,
  panelLabelledBy,
  side,
  member,
  build,
  battle,
  maxHp,
  moves,
  team,
  selectedSlot = 0,
  pokemonOptions,
  candidateMoveIndex,
  pokemonIndex,
  itemOptions,
  showdownLegality,
  preMegaPokemonId,
  preMegaMoves = [],
  isAttacking,
  isPokemonLoading = false,
  onSelectedSlotChange,
  onReorderTeamSlots,
  onSelectPokemon,
  onRememberPreMegaPokemon,
  onBuildChange,
  onMoveChange,
  onReorderMoves,
  onBattleChange,
}: CalculatorPokemonEditorProps) {
  const { gameName, pokemonFormName, pokemonName, t } = useLocalization();
  const isTouchPickerLayout = useMediaQuery("(max-width: 1420px)");
  const cardRef = useRef<HTMLElement | null>(null);
  const teamStripRef = useRef<HTMLDivElement | null>(null);
  const moveListRef = useRef<HTMLDivElement | null>(null);
  const battleFormPickerRef = useRef<HTMLDivElement | null>(null);
  const moveResultsRef = useRef<HTMLDivElement | null>(null);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [openMoveSlot, setOpenMoveSlot] = useState<number | null>(null);
  const [openRankStat, setOpenRankStat] =
    useState<Exclude<StatKey, "hp"> | null>(null);
  const [pokemonQuery, setPokemonQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [moveQuery, setMoveQuery] = useState("");
  const [activePokemonIndex, setActivePokemonIndex] = useState(0);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [activeAbilityIndex, setActiveAbilityIndex] = useState(0);
  const [activeStatusIndex, setActiveStatusIndex] = useState(0);
  const [activeMoveIndex, setActiveMoveIndex] = useState(0);
  const [activeNaturePosition, setActiveNaturePosition] =
    useState<NatureGridPosition>({ upIndex: 0, downIndex: 0 });
  const [hoveredPokemon, setHoveredPokemon] =
    useState<CalculatorPokemonOption | null>(null);
  const [hoveredItem, setHoveredItem] = useState<PokemonItem | null>(null);
  const [hoveredAbility, setHoveredAbility] =
    useState<PokemonAbility | null>(null);
  const [hoveredMove, setHoveredMove] = useState<PokemonMove | null>(null);
  const [previewArtwork, setPreviewArtwork] = useState<string | null>(null);
  const [abilityDetails, setAbilityDetails] = useState<
    Record<string, PokemonAbility>
  >({});
  const [suppressedMoveTooltipSlot, setSuppressedMoveTooltipSlot] =
    useState<number | null>(null);
  const [isBattleFormPickerOpen, setIsBattleFormPickerOpen] = useState(false);
  const [activeBattleFormOptionIndex, setActiveBattleFormOptionIndex] =
    useState(0);
  const {
    activeOptionIndex: activeCandidateFilterOptionIndex,
    filteredPokemonOptions: candidateFilteredPokemonOptions,
    filters: candidateFilters,
    moveFilterSlot: candidateMoveFilterSlot,
    openPicker: openCandidateFilterPicker,
    panelRef: candidateFilterPickerRef,
    query: candidateFilterQuery,
    selectedMoveOptions: selectedCandidateMoveOptions,
    visibleOptions: visibleCandidateFilterOptions,
    changeQuery: changeCandidateFilterQuery,
    clearFilters: clearCandidateFilters,
    closePicker: closeCandidateFilterPicker,
    handleResultsScroll: handleCandidateFilterOptionsScroll,
    moveActiveOption: moveCandidateFilterKeyboardOption,
    openFilterPicker: openCandidatePicker,
    openMovePicker: openCandidateMovePicker,
    removeAbility: removeCandidateAbility,
    removeMove: removeCandidateMove,
    selectOption: selectCandidateFilterOption,
    setActiveOptionIndex: setActiveCandidateFilterOptionIndex,
    toggleType: toggleCandidatePokemonType,
  } = useCalculatorCandidateFilters({
    pokemonOptions,
    candidateMoveIndex,
    isTouchLayout: isTouchPickerLayout,
    resetKey: `${side}:${selectedSlot ?? "none"}`,
    closeOtherPicker: closePicker,
  });

  const memberIndexEntry = useMemo(
    () =>
      pokemonIndex.find((entry) => entry.name === member?.id) ??
      pokemonOptions.find((option) => option.id === member?.id)?.entry ??
      null,
    [member?.id, pokemonIndex, pokemonOptions],
  );
  const speciesKey = memberIndexEntry?.speciesKey ?? member?.id ?? "";
  const activeFormKind = memberIndexEntry?.formKind ?? "base";
  const visibleMegaOptions = useMemo(() => {
    if (!speciesKey || activeFormKind === "regional") {
      return [];
    }

    const seenLabels = new Set<string>();

    return pokemonIndex.filter((entry) => {
      if (
        entry.speciesKey !== speciesKey ||
        entry.formKind !== "mega" ||
        !isExactPokemonFormLegal(showdownLegality, entry.showdownId)
      ) {
        return false;
      }

      const label = (entry.formLabel ?? "Mega").toLowerCase();

      if (seenLabels.has(label)) {
        return false;
      }

      seenLabels.add(label);
      return true;
    });
  }, [activeFormKind, pokemonIndex, showdownLegality, speciesKey]);
  const megaBaseOption = speciesKey
    ? pokemonIndex.find(
        (entry) =>
          entry.speciesKey === speciesKey &&
          entry.isSelectorOption &&
          entry.formKind !== "regional",
      )
    : undefined;
  const savedPreMegaOption = preMegaPokemonId
    ? pokemonIndex.find(
        (entry) =>
          entry.name === preMegaPokemonId &&
          entry.speciesKey === speciesKey &&
          entry.formKind !== "mega",
      )
    : undefined;
  const megaReturnOption = savedPreMegaOption ?? megaBaseOption;
  const battleFormGroup = getBattleFormGroup(speciesKey || member?.id || "");
  const activeBattleFormOptionIndexFromPokemon = Math.max(
    0,
    battleFormGroup?.options.findIndex(
      (option) => option.pokemonId === member?.id,
    ) ?? 0,
  );
  const activeBattleFormOption =
    battleFormGroup?.options[activeBattleFormOptionIndexFromPokemon];
  const legalAbilityIds = getLegalAbilities(
    showdownLegality,
    member?.id ?? "",
    speciesKey,
  );
  const abilityOptions = useMemo(() => {
    const options = member?.abilities ?? [];
    const legal = legalAbilityIds
      ? options.filter((ability) =>
          legalAbilityIds.has(normalizeShowdownId(ability)),
        )
      : options;

    return legal.length > 0 ? legal : options;
  }, [legalAbilityIds, member?.abilities]);
  const legalMoveIds = useMemo(() => {
    const activeLegalMoveIds = getLegalMoves(
      showdownLegality,
      member?.id ?? "",
      speciesKey,
    );
    const preMegaLegalMoveIds =
      activeFormKind === "mega" && preMegaPokemonId
        ? getLegalMoves(showdownLegality, preMegaPokemonId, speciesKey)
        : null;

    if (!activeLegalMoveIds) {
      return preMegaLegalMoveIds;
    }

    if (!preMegaLegalMoveIds) {
      return activeLegalMoveIds;
    }

    return new Set([...activeLegalMoveIds, ...preMegaLegalMoveIds]);
  }, [
    activeFormKind,
    member?.id,
    preMegaPokemonId,
    showdownLegality,
    speciesKey,
  ]);
  const availableMoves = useMemo(() => {
    const options =
      activeFormKind === "mega" && preMegaMoves.length > 0
        ? Array.from(
            [...(member?.moves ?? []), ...preMegaMoves]
              .reduce((catalog, move) => {
                const key = normalizeShowdownId(move.id);

                if (!catalog.has(key)) {
                  catalog.set(key, move);
                }

                return catalog;
              }, new Map<string, PokemonMove>())
              .values(),
          )
        : member?.moves ?? [];

    if (!legalMoveIds) {
      return options;
    }

    const legal = options.filter(
      (move) =>
        legalMoveIds.has(normalizeShowdownId(move.id)) ||
        legalMoveIds.has(normalizeShowdownId(move.name)),
    );

    return legal.length > 0 ? legal : options;
  }, [activeFormKind, legalMoveIds, member?.moves, preMegaMoves]);
  const selectedNature = getNatureById(build.natureId);
  const isItemLocked = Boolean(
    memberIndexEntry?.formKind === "mega" &&
      build.item &&
      itemOptions.some(
        (item) =>
          item.isMegaStone &&
          (normalizeShowdownId(item.showdownId) ===
            normalizeShowdownId(build.item?.showdownId ?? "") ||
            normalizeShowdownId(item.name) ===
              normalizeShowdownId(build.item?.id ?? "")),
      ),
  );
  const calculatedStats = useMemo(
    () =>
      member?.baseStats
        ? calculateChampionsStats(
            member.baseStats,
            build.evs,
            selectedNature,
          )
        : null,
    [build.evs, member?.baseStats, selectedNature],
  );
  const hpPercent = Math.max(
    0,
    Math.min(100, (battle.currentHp / Math.max(1, maxHp)) * 100),
  );
  const {
    isScrubbing: isHpScrubbing,
    updateValue: updateCurrentHp,
    handlePointerDown: handleHpScrubPointerDown,
    handlePointerMove: handleHpScrubPointerMove,
    finishPointerInteraction: finishHpScrub,
  } = useScrubbableNumberInput({
    value: battle.currentHp,
    min: 1,
    max: maxHp,
    onChange: (currentHp) =>
      onBattleChange((current) =>
        current.currentHp === currentHp
          ? current
          : {
              ...current,
              currentHp,
            },
      ),
  });

  const normalizedPokemonQuery = pokemonQuery.trim().toLowerCase();
  const matchingPokemonOptions = useMemo(
    () =>
      candidateFilteredPokemonOptions.filter(
        (option) =>
          !normalizedPokemonQuery ||
          option.label.toLowerCase().includes(normalizedPokemonQuery) ||
          option.englishName.toLowerCase().includes(normalizedPokemonQuery) ||
          option.id.toLowerCase().includes(normalizedPokemonQuery) ||
          String(option.number).includes(normalizedPokemonQuery),
      ),
    [candidateFilteredPokemonOptions, normalizedPokemonQuery],
  );
  const {
    limit: pokemonOptionLimit,
    reset: resetPokemonOptions,
    ensureIndexVisible: ensurePokemonIndexVisible,
    handleScroll: handlePokemonScroll,
  } = useIncrementalOptions(matchingPokemonOptions.length);
  const visiblePokemonOptions = matchingPokemonOptions.slice(
    0,
    pokemonOptionLimit,
  );
  const normalizedItemQuery = itemQuery.trim().toLowerCase();
  const matchingItemOptions = useMemo(
    () =>
      itemOptions.filter(
        (item) =>
          !normalizedItemQuery ||
          item.displayName.toLowerCase().includes(normalizedItemQuery) ||
          gameName("items", item.showdownId, item.displayName)
            .toLowerCase()
            .includes(normalizedItemQuery) ||
          item.name.toLowerCase().includes(normalizedItemQuery),
      ),
    [gameName, itemOptions, normalizedItemQuery],
  );
  const {
    limit: itemOptionLimit,
    reset: resetItemOptions,
    ensureIndexVisible: ensureItemIndexVisible,
    handleScroll: handleItemScroll,
  } = useIncrementalOptions(matchingItemOptions.length);
  const visibleItemOptions = matchingItemOptions.slice(0, itemOptionLimit);
  const displayedItemOptions: Array<ItemIndexEntry | null> = build.item
    ? [null, ...visibleItemOptions]
    : visibleItemOptions;
  const normalizedMoveQuery = moveQuery.trim().toLowerCase();
  const matchingMoveOptions = useMemo(
    () =>
      availableMoves.filter(
        (move) =>
          !normalizedMoveQuery ||
          move.name.toLowerCase().includes(normalizedMoveQuery) ||
          gameName("moves", move.id, move.name)
            .toLowerCase()
            .includes(normalizedMoveQuery) ||
          move.id.toLowerCase().includes(normalizedMoveQuery) ||
          move.type.includes(normalizedMoveQuery),
      ),
    [availableMoves, gameName, normalizedMoveQuery],
  );
  const {
    limit: moveOptionLimit,
    reset: resetMoveOptions,
    ensureIndexVisible: ensureMoveIndexVisible,
    handleScroll: handleMoveScroll,
  } = useIncrementalOptions(matchingMoveOptions.length);
  const visibleMoveOptions = matchingMoveOptions.slice(0, moveOptionLimit);
  const activePokemonOption =
    visiblePokemonOptions[activePokemonIndex] ?? null;
  const activeItemOption = displayedItemOptions[activeItemIndex];
  const activeAbilityOption = abilityOptions[activeAbilityIndex] ?? "";
  const activeMoveOption =
    activeMoveIndex === 0
      ? null
      : matchingMoveOptions[activeMoveIndex - 1] ?? null;

  function closePicker() {
    setOpenPicker(null);
    setOpenMoveSlot(null);
    setOpenRankStat(null);
    setPokemonQuery("");
    setItemQuery("");
    setMoveQuery("");
    setHoveredPokemon(null);
    setHoveredItem(null);
    setHoveredAbility(null);
    setHoveredMove(null);
  }

  const teamReorder = useLongPressReorder({
    containerRef: teamStripRef,
    disabled: !team || !onReorderTeamSlots,
    itemIndexAttribute: "data-calculator-team-index",
    itemSelector: "[data-calculator-team-index]",
    onDragStart: closePicker,
    onReorder: (sourceIndex, targetIndex) =>
      onReorderTeamSlots?.(sourceIndex, targetIndex),
  });
  const moveReorder = useLongPressReorder({
    containerRef: moveListRef,
    disabled: !member || openPicker === "move",
    itemIndexAttribute: "data-calculator-move-index",
    itemSelector: "[data-calculator-move-index]",
    onDragStart: closePicker,
    onReorder: onReorderMoves,
  });

  useDismissOnOutsidePointer(
    cardRef,
    openPicker !== null && !isTouchPickerLayout,
    closePicker,
  );

  useDismissOnOutsidePointer(
    battleFormPickerRef,
    isBattleFormPickerOpen,
    () => setIsBattleFormPickerOpen(false),
  );

  useEffect(() => {
    setIsBattleFormPickerOpen(false);
    setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
  }, [activeBattleFormOptionIndexFromPokemon, member?.id]);

  useEffect(() => {
    if (!hoveredPokemon && !(
      isTouchPickerLayout && openPicker === "pokemon" && activePokemonOption
    )) {
      setPreviewArtwork(null);
      return;
    }

    const option = hoveredPokemon ?? activePokemonOption;
    let isCurrent = true;

    if (!option) {
      return;
    }

    void fetchPokemon(option.id)
      .then((pokemon) => {
        if (isCurrent) {
          setPreviewArtwork(pokemon.spriteUrl ?? null);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setPreviewArtwork(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [
    activePokemonOption,
    hoveredPokemon,
    isTouchPickerLayout,
    openPicker,
  ]);

  useEffect(() => {
    if (activePokemonIndex >= visiblePokemonOptions.length) {
      setActivePokemonIndex(
        visiblePokemonOptions.length > 0
          ? visiblePokemonOptions.length - 1
          : -1,
      );
    }
  }, [activePokemonIndex, visiblePokemonOptions.length]);

  useEffect(() => {
    resetPokemonOptions();
    setActivePokemonIndex(matchingPokemonOptions.length > 0 ? 0 : -1);
  }, [
    candidateFilters,
    matchingPokemonOptions.length,
    resetPokemonOptions,
  ]);

  function openPokemonPicker() {
    const selectedIndex = matchingPokemonOptions.findIndex(
      (option) => option.id === member?.id,
    );
    const nextIndex = Math.max(0, selectedIndex);

    closeCandidateFilterPicker();
    closePicker();
    setIsBattleFormPickerOpen(false);
    setActivePokemonIndex(nextIndex);
    ensurePokemonIndexVisible(nextIndex);
    setOpenPicker("pokemon");
  }

  function openItemPicker() {
    const selectedIndex = build.item
      ? matchingItemOptions.findIndex(
          (item) =>
            normalizeShowdownId(item.showdownId) ===
              normalizeShowdownId(
                build.item?.showdownId ?? build.item?.id ?? "",
              ) ||
            normalizeShowdownId(item.name) ===
              normalizeShowdownId(build.item?.id ?? ""),
        )
      : -1;
    const nextIndex = build.item ? Math.max(0, selectedIndex) + 1 : 0;

    closePicker();
    setActiveItemIndex(nextIndex);
    ensureItemIndexVisible(Math.max(0, nextIndex - (build.item ? 1 : 0)));
    const previewEntry =
      displayedItemOptions[nextIndex] ?? matchingItemOptions[0];
    setHoveredItem(
      nextIndex === 0 && build.item
        ? null
        : previewEntry
          ? itemFromIndexEntry(previewEntry)
          : null,
    );
    setOpenPicker("item");
  }

  function openAbilityPicker() {
    const selectedIndex = abilityOptions.findIndex(
      (ability) => ability === build.ability,
    );
    const nextIndex = Math.max(0, selectedIndex);

    closePicker();
    setActiveAbilityIndex(nextIndex);
    void previewAbility(abilityOptions[nextIndex] ?? "");
    setOpenPicker("ability");
  }

  function openNaturePicker() {
    closePicker();
    setActiveNaturePosition(getNatureGridPosition(selectedNature));
    setOpenPicker("nature");
  }

  function openStatusPicker() {
    const selectedIndex = calculatorStatusOptions.indexOf(battle.status);

    closePicker();
    setActiveStatusIndex(Math.max(0, selectedIndex));
    setOpenPicker("status");
  }

  function openMovePicker(slotIndex: number, moveId: string) {
    const selectedIndex = matchingMoveOptions.findIndex(
      (move) => normalizeShowdownId(move.id) === normalizeShowdownId(moveId),
    );
    const nextIndex = selectedIndex >= 0 ? selectedIndex + 1 : 0;

    closePicker();
    setOpenMoveSlot(slotIndex);
    setActiveMoveIndex(nextIndex);
    ensureMoveIndexVisible(Math.max(0, nextIndex - 1));
    setHoveredMove(nextIndex > 0 ? matchingMoveOptions[nextIndex - 1] : null);
    setOpenPicker("move");

    requestAnimationFrame(() => {
      moveResultsRef.current
        ?.querySelector<HTMLElement>(`[data-option-index="${nextIndex}"]`)
        ?.scrollIntoView({ block: "start" });
    });
  }

  async function previewAbility(ability: string) {
    if (!ability) {
      setHoveredAbility(null);
      return;
    }

    const key = normalizeShowdownId(ability);
    const cached = abilityDetails[key];

    if (cached) {
      setHoveredAbility(cached);
      return;
    }

    try {
      const details = await fetchAbility(ability);
      setAbilityDetails((current) => ({ ...current, [key]: details }));
      setHoveredAbility(details);
    } catch {
      setHoveredAbility({ id: key, name: ability });
    }
  }

  function moveActiveIndex(
    picker: Exclude<OpenPicker, "nature" | null>,
    direction: 1 | -1,
  ) {
    if (picker === "pokemon") {
      const nextIndex = getNextIndex(
        activePokemonIndex,
        matchingPokemonOptions.length,
        direction,
      );
      setActivePokemonIndex(nextIndex);
      ensurePokemonIndexVisible(nextIndex);
      return;
    }

    if (picker === "item") {
      const nextIndex = getNextIndex(
        activeItemIndex,
        displayedItemOptions.length,
        direction,
      );
      setActiveItemIndex(nextIndex);
      const option = displayedItemOptions[nextIndex];
      setHoveredItem(option ? itemFromIndexEntry(option) : null);
      ensureItemIndexVisible(Math.max(0, nextIndex - (build.item ? 1 : 0)));
      return;
    }

    if (picker === "ability") {
      const nextIndex = getNextIndex(
        activeAbilityIndex,
        abilityOptions.length,
        direction,
      );
      setActiveAbilityIndex(nextIndex);
      void previewAbility(abilityOptions[nextIndex] ?? "");
      return;
    }

    if (picker === "status") {
      setActiveStatusIndex(
        getNextIndex(
          activeStatusIndex,
          calculatorStatusOptions.length,
          direction,
        ),
      );
      return;
    }

    const nextIndex = getNextIndex(
      activeMoveIndex,
      matchingMoveOptions.length + 1,
      direction,
    );
    setActiveMoveIndex(nextIndex);
    setHoveredMove(
      nextIndex > 0 ? matchingMoveOptions[nextIndex - 1] ?? null : null,
    );
    ensureMoveIndexVisible(Math.max(0, nextIndex - 1));
  }

  function moveNature(rowDirection: number, columnDirection: number) {
    setActiveNaturePosition((current) => ({
      upIndex:
        (current.upIndex + rowDirection + 5) % 5,
      downIndex:
        (current.downIndex + columnDirection + 5) % 5,
    }));
  }

  async function selectPokemonOption(option: CalculatorPokemonOption) {
    try {
      await onSelectPokemon(option.id, { applyUsageStats: true });
      clearCandidateFilters();
      closePicker();
    } catch {
      // The parent owns the visible lookup error; keep the picker open for retry.
    }
  }

  async function selectActivePokemon() {
    const option = matchingPokemonOptions[activePokemonIndex];

    if (!option) {
      return;
    }

    await selectPokemonOption(option);
  }

  async function handleToggleMega(
    option: PokemonIndexEntry,
    isActiveMega: boolean,
  ) {
    const target = isActiveMega ? megaReturnOption : option;

    if (!target) {
      return;
    }

    if (!isActiveMega && member?.id && activeFormKind !== "mega") {
      onRememberPreMegaPokemon?.(member.id);
    }

    try {
      await onSelectPokemon(target.name);
    } catch {
      // The parent owns the visible lookup error.
    }
  }

  async function handleSelectBattleForm(pokemonId: string) {
    setIsBattleFormPickerOpen(false);

    try {
      await onSelectPokemon(pokemonId, { allowBattleForm: true });
    } catch {
      // The parent owns the visible lookup error.
    }
  }

  function handleBattleFormKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!battleFormGroup) {
      return;
    }

    if (event.key === "Escape") {
      setIsBattleFormPickerOpen(false);
      return;
    }

    if (event.key === "Enter" && isBattleFormPickerOpen) {
      event.preventDefault();
      void handleSelectBattleForm(
        battleFormGroup.options[activeBattleFormOptionIndex].pokemonId,
      );
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();

    if (!isBattleFormPickerOpen) {
      setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
      setIsBattleFormPickerOpen(true);
      return;
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    setActiveBattleFormOptionIndex(
      (current) =>
        (current + direction + battleFormGroup.options.length) %
        battleFormGroup.options.length,
    );
  }

  function selectActiveItem() {
    const option = displayedItemOptions[activeItemIndex];
    onBuildChange({ item: option ? itemFromIndexEntry(option) : null });
    closePicker();
  }

  function selectActiveAbility() {
    const ability = abilityOptions[activeAbilityIndex];
    if (ability) {
      onBuildChange({ ability });
    }
    closePicker();
  }

  function selectActiveNature() {
    onBuildChange({
      natureId: getNatureAtGridPosition(activeNaturePosition).id,
    });
    closePicker();
  }

  function selectStatus(status: CalculatorPokemonStatus) {
    onBattleChange((current) =>
      current.status === status
        ? current
        : {
            ...current,
            status,
          },
    );
    closePicker();
  }

  function selectActiveStatus() {
    selectStatus(calculatorStatusOptions[activeStatusIndex]);
  }

  function selectActiveMove() {
    if (openMoveSlot === null) {
      return;
    }

    onMoveChange(
      openMoveSlot,
      activeMoveIndex === 0
        ? ""
        : matchingMoveOptions[activeMoveIndex - 1]?.id ?? "",
    );
    closePicker();
  }

  function handlePickerKeyDown(
    event: KeyboardEvent<HTMLElement>,
    picker: Exclude<OpenPicker, null>,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }

    if (picker === "nature") {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        if (event.key === "ArrowDown") {
          moveNature(1, 0);
        } else if (event.key === "ArrowUp") {
          moveNature(-1, 0);
        } else if (event.key === "ArrowRight") {
          moveNature(0, 1);
        } else {
          moveNature(0, -1);
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        selectActiveNature();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(picker, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (picker === "pokemon") {
        void selectActivePokemon();
      } else if (picker === "item") {
        selectActiveItem();
      } else if (picker === "ability") {
        selectActiveAbility();
      } else if (picker === "status") {
        selectActiveStatus();
      } else {
        selectActiveMove();
      }
    }
  }

  function handleTeamSlotKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    const isPrevious =
      event.key === "ArrowLeft" || event.key === "ArrowUp";
    const isNext =
      event.key === "ArrowRight" || event.key === "ArrowDown";

    if (
      !event.altKey ||
      (!isPrevious && !isNext) ||
      !team?.[sourceIndex] ||
      !onReorderTeamSlots
    ) {
      return;
    }

    event.preventDefault();
    closePicker();

    const targetIndex = Math.max(
      0,
      Math.min(team.length - 1, sourceIndex + (isPrevious ? -1 : 1)),
    );

    if (targetIndex === sourceIndex) {
      return;
    }

    onReorderTeamSlots(sourceIndex, targetIndex);
    window.requestAnimationFrame(() => {
      teamStripRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-calculator-team-index="${targetIndex}"] button`,
        )
        ?.focus();
    });
  }

  function handleMoveSlotKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (
      !event.altKey ||
      (event.key !== "ArrowUp" && event.key !== "ArrowDown") ||
      !moves[sourceIndex]
    ) {
      return;
    }

    event.preventDefault();
    closePicker();

    const targetIndex = Math.max(
      0,
      Math.min(
        moves.length - 1,
        sourceIndex + (event.key === "ArrowUp" ? -1 : 1),
      ),
    );

    if (targetIndex === sourceIndex) {
      return;
    }

    onReorderMoves(sourceIndex, targetIndex);
    window.requestAnimationFrame(() => {
      moveListRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-calculator-move-index="${targetIndex}"] .move-pill`,
        )
        ?.focus();
    });
  }

  function renderPokemonPreview(option: CalculatorPokemonOption | null) {
    if (!option) {
      return <div className="touch-picker-empty-preview" />;
    }

    return (
      <div className="touch-pokemon-preview">
        {previewArtwork ? (
          <img
            className="touch-pokemon-preview-artwork"
            src={previewArtwork}
            alt=""
            aria-hidden="true"
          />
        ) : null}
        <div className="touch-pokemon-preview-copy">
          <strong>{option.label}</strong>
          {option.usageRank ? (
            <small>
              {t("builder.usageRank", { rank: option.usageRank })}
            </small>
          ) : null}
        </div>
        <div className="touch-pokemon-preview-types">
          {option.types.map((type) => (
            <TypeBadge type={type} key={type} />
          ))}
        </div>
      </div>
    );
  }

  function renderPokemonOptions(previewOnly: boolean) {
    return (
      <PokemonPickerOptions
        options={visiblePokemonOptions}
        activeIndex={activePokemonIndex}
        previewOnly={previewOnly}
        onActiveChange={(index, option) => {
          setActivePokemonIndex(index);
          setHoveredPokemon(option);
        }}
        onPreviewClear={() => setHoveredPokemon(null)}
        onSelect={(option) => void selectPokemonOption(option)}
      />
    );
  }

  function renderItemOptions(previewOnly: boolean) {
    return (
      <ItemPickerOptions
        options={displayedItemOptions}
        activeIndex={activeItemIndex}
        previewOnly={previewOnly}
        onActiveChange={(index, item) => {
          setActiveItemIndex(index);
          setHoveredItem(item);
        }}
        onPreviewClear={() => setHoveredItem(null)}
        onSelect={(item) => {
          onBuildChange({ item });
          closePicker();
        }}
      />
    );
  }

  function renderAbilityOptions(previewOnly: boolean) {
    return (
      <AbilityPickerOptions
        abilities={abilityOptions}
        activeIndex={activeAbilityIndex}
        previewOnly={previewOnly}
        onActiveChange={(index, ability) => {
          setActiveAbilityIndex(index);
          void previewAbility(ability);
        }}
        onPreviewClear={() => setHoveredAbility(null)}
        onSelect={(ability) => {
          onBuildChange({ ability });
          closePicker();
        }}
      />
    );
  }

  function renderStatusOptions(isTouchDialog: boolean) {
    return calculatorStatusOptions.map((status, index) => (
      <button
        className="trait-option calculator-status-option"
        type="button"
        role="option"
        aria-selected={activeStatusIndex === index}
        data-touch-picker-autofocus={
          isTouchDialog && battle.status === status ? "" : undefined
        }
        key={status}
        onFocus={() => setActiveStatusIndex(index)}
        onMouseEnter={
          isTouchDialog
            ? undefined
            : () => setActiveStatusIndex(index)
        }
        onClick={() => selectStatus(status)}
      >
        {t(
          status === "healthy"
            ? "calculator.healthy"
            : "calculator.burned",
        )}
      </button>
    ));
  }

  function renderMoveOptions(previewOnly: boolean) {
    return (
      <MovePickerOptions
        moves={visibleMoveOptions}
        activeIndex={activeMoveIndex}
        previewOnly={previewOnly}
        onActiveChange={(index, move) => {
          setActiveMoveIndex(index);
          setHoveredMove(move);
        }}
        onSelect={(move) => {
          if (openMoveSlot !== null) {
            onMoveChange(openMoveSlot, move?.id ?? "");
            closePicker();
          }
        }}
      />
    );
  }

  function renderTouchDialog() {
    if (!isTouchPickerLayout || !openPicker) {
      return null;
    }

    if (openPicker === "pokemon") {
      return (
        <TouchSelectionDialog
          kind="pokemon"
          title={
            side === "player"
              ? t("builder.choosePokemon")
              : t("calculator.chooseOpponent")
          }
          canSelect={Boolean(activePokemonOption)}
          search={
            <TouchPickerSearchInput
              value={pokemonQuery}
              label={t("builder.searchPokemon")}
              placeholder={t("builder.searchPokemon")}
              onChange={(value) => {
                setPokemonQuery(value);
                resetPokemonOptions();
                setActivePokemonIndex(0);
              }}
              onMove={(direction) =>
                moveActiveIndex("pokemon", direction)
              }
              onSubmit={() => void selectActivePokemon()}
            />
          }
          preview={renderPokemonPreview(activePokemonOption)}
          onClose={closePicker}
          onSelect={() => void selectActivePokemon()}
        >
          <div
            className="touch-picker-option-list pokemon-name-results"
            onScroll={handlePokemonScroll}
          >
            {renderPokemonOptions(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (openPicker === "item") {
      const previewItem =
        activeItemOption === null
          ? null
          : activeItemOption
            ? itemFromIndexEntry(activeItemOption)
            : hoveredItem;

      return (
        <TouchSelectionDialog
          kind="item"
          title={t("builder.chooseItem")}
          canSelect={displayedItemOptions.length > 0}
          search={
            <TouchPickerSearchInput
              value={itemQuery}
              label={t("builder.searchItem")}
              placeholder={t("builder.searchItem")}
              onChange={(value) => {
                setItemQuery(value);
                resetItemOptions();
                setActiveItemIndex(0);
              }}
              onMove={(direction) => moveActiveIndex("item", direction)}
              onSubmit={selectActiveItem}
            />
          }
          preview={
            previewItem ? (
              <div className="item-tooltip touch-dialog-tooltip">
                <ItemDetailsContent item={previewItem} />
              </div>
            ) : (
              <div className="touch-picker-empty-preview" />
            )
          }
          onClose={closePicker}
          onSelect={selectActiveItem}
        >
          <div
            className="touch-picker-option-list item-results"
            onScroll={handleItemScroll}
          >
            {renderItemOptions(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (openPicker === "ability") {
      return (
        <TouchSelectionDialog
          kind="ability"
          title={t("builder.selectAbility")}
          canSelect={Boolean(activeAbilityOption)}
          preview={
            hoveredAbility ? (
              <div className="ability-tooltip touch-dialog-tooltip">
                <AbilityDetailsContent ability={hoveredAbility} />
              </div>
            ) : (
              <div className="touch-picker-empty-preview" />
            )
          }
          onClose={closePicker}
          onSelect={selectActiveAbility}
        >
          <div
            className="touch-picker-option-list touch-ability-options"
            role="listbox"
          >
            {renderAbilityOptions(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (openPicker === "nature") {
      return (
        <TouchSelectionDialog
          kind="nature"
          title={t("builder.selectNature")}
          onClose={closePicker}
          onSelect={selectActiveNature}
        >
          <NatureGrid
            selectedNature={selectedNature}
            activePosition={activeNaturePosition}
            previewOnly
            upLabel={t("builder.up")}
            downLabel={t("builder.down")}
            getNatureName={(nature) =>
              gameName("natures", nature.id, nature.label)
            }
            getStatLabel={(stat) => t(`stat.${stat}`)}
            onActivePositionChange={setActiveNaturePosition}
            onSelectNature={() => undefined}
          />
        </TouchSelectionDialog>
      );
    }

    if (openPicker === "status") {
      return (
        <TouchSelectionDialog
          kind="status"
          title={t("calculator.status")}
          showActions={false}
          onClose={closePicker}
        >
          <div
            className="touch-picker-option-list touch-status-options"
            role="listbox"
            onKeyDown={(event) =>
              handlePickerKeyDown(event, "status")
            }
          >
            {renderStatusOptions(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    return (
      <TouchSelectionDialog
        kind="move"
        title={t("builder.selectMove", {
          slot: (openMoveSlot ?? 0) + 1,
        })}
        canSelect={matchingMoveOptions.length > 0 || activeMoveIndex === 0}
        search={
          <TouchPickerSearchInput
            value={moveQuery}
            label={t("builder.searchAvailableMoves")}
            placeholder={t("filter.searchMoves")}
            onChange={(value) => {
              setMoveQuery(value);
              resetMoveOptions();
              setActiveMoveIndex(0);
            }}
            onMove={(direction) => moveActiveIndex("move", direction)}
            onSubmit={selectActiveMove}
          />
        }
        preview={
          activeMoveOption ? (
            <MoveTooltip
              move={activeMoveOption}
              placement="dialog"
            />
          ) : (
            <div className="touch-picker-empty-preview" />
          )
        }
        onClose={closePicker}
        onSelect={selectActiveMove}
      >
        <div
          className="touch-picker-option-list move-results"
          onScroll={handleMoveScroll}
        >
          {renderMoveOptions(true)}
        </div>
      </TouchSelectionDialog>
    );
  }

  function getMemberDisplayName(targetMember: TeamMember) {
    const indexEntry = pokemonIndex.find(
      (entry) => entry.name === targetMember.id,
    );

    return indexEntry
      ? pokemonName({
          id: indexEntry.name,
          speciesId: indexEntry.speciesKey,
          fallback: formatIdLabel(indexEntry.speciesKey),
          includeForm: false,
        })
      : pokemonName({
          id: targetMember.id,
          fallback: targetMember.name,
          includeForm: false,
        });
  }

  const displayName = member
    ? getMemberDisplayName(member)
    : t("builder.choosePokemon");

  return (
    <section
      id={panelId}
      ref={cardRef}
      className={`calculator-pokemon-panel calculator-set-editor is-${side}-side${
        isAttacking ? " is-attacking" : " is-defending"
      }`}
      role={panelLabelledBy ? "tabpanel" : undefined}
      aria-labelledby={panelLabelledBy}
      aria-label={
        side === "player"
          ? t("calculator.yourPokemon")
          : t("calculator.opponent")
      }
    >
      <div
        className={`calculator-side-heading${
          side === "player" && team ? " has-team-strip" : ""
        }`}
      >
        <span>
          {side === "player"
            ? t("calculator.yourPokemon")
            : t("calculator.opponent")}
        </span>

        {side === "player" && team ? (
          <div
            className={`calculator-team-strip${
              teamReorder.isDragging ? " is-reordering" : ""
            }`}
            aria-label={t("builder.currentTeam")}
            ref={teamStripRef}
          >
            {team.map((teamMember, slotIndex) => {
              const displacement = getReorderDisplacement(
                teamReorder.dragState,
                slotIndex,
              );

              return (
                <div
                  className={`calculator-team-slot${
                    teamReorder.dragState?.sourceIndex === slotIndex
                      ? " is-dragging"
                      : ""
                  }${
                    teamReorder.dragState?.sourceIndex === slotIndex &&
                    teamReorder.dragState.isDropping
                      ? " is-dropping"
                      : ""
                  }${
                    teamReorder.dragState?.targetIndex === slotIndex &&
                    teamReorder.dragState.sourceIndex !== slotIndex
                      ? " is-drop-target"
                      : ""
                  }${displacement ? " is-reorder-displaced" : ""}`}
                  data-calculator-team-index={slotIndex}
                  key={`${teamMember?.id ?? "empty"}-${slotIndex}`}
                  style={
                    teamReorder.dragState?.sourceIndex === slotIndex
                      ? ({
                          "--calculator-team-drag-x": `${teamReorder.dragState.offsetX}px`,
                          "--calculator-team-drag-y": `${teamReorder.dragState.offsetY}px`,
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
                      teamMember
                        ? getMemberDisplayName(teamMember)
                        : t("common.empty")
                    }
                    onClick={() => {
                      if (!teamReorder.shouldSuppressClick()) {
                        onSelectedSlotChange?.(slotIndex);
                      }
                    }}
                    onKeyDown={(event) =>
                      handleTeamSlotKeyDown(event, slotIndex)
                    }
                    onPointerDown={(event) => {
                      if (teamMember) {
                        teamReorder.handlePointerDown(event, slotIndex);
                      }
                    }}
                    onPointerMove={teamReorder.handlePointerMove}
                    onPointerUp={teamReorder.handlePointerUp}
                    onPointerCancel={teamReorder.handlePointerCancel}
                  >
                    {teamMember ? (
                      <PokemonIcon pokemon={teamMember} />
                    ) : (
                      <span>+</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <strong>
          {isAttacking
            ? t("calculator.attacking")
            : t("calculator.defending")}
        </strong>
      </div>

      <article className={`pokemon-card calculator-editor-card${
        member ? "" : " is-empty-slot"
      }`}>
        <div className="card-main">
          <div className="editor-column">
            <div className="name-row">
              <div className="pokemon-name-picker">
                {openPicker === "pokemon" && !isTouchPickerLayout ? (
                  <input
                    className="pokemon-name-input"
                    autoFocus
                    aria-label={t("builder.searchPokemon")}
                    value={pokemonQuery}
                    placeholder={displayName}
                    onChange={(event) => {
                      setPokemonQuery(event.target.value);
                      resetPokemonOptions();
                      setActivePokemonIndex(0);
                    }}
                    onKeyDown={(event) =>
                      handlePickerKeyDown(event, "pokemon")
                    }
                  />
                ) : (
                  <button
                    className="pokemon-name-button"
                    type="button"
                    disabled={isPokemonLoading}
                    aria-haspopup={
                      isTouchPickerLayout ? "dialog" : "listbox"
                    }
                    aria-expanded={openPicker === "pokemon"}
                    onClick={() => {
                      if (openPicker === "pokemon") {
                        closePicker();
                      } else {
                        openPokemonPicker();
                      }
                    }}
                  >
                    {isPokemonLoading ? t("common.loading") : displayName}
                  </button>
                )}

                {openPicker === "pokemon" && !isTouchPickerLayout ? (
                  <>
                    <div className="pokemon-name-menu">
                      <div
                        className="pokemon-name-results"
                        role="listbox"
                        onScroll={handlePokemonScroll}
                      >
                        {renderPokemonOptions(false)}
                      </div>
                    </div>
                    {hoveredPokemon ? (
                      <aside
                        className="desktop-pokemon-option-preview"
                        role="tooltip"
                      >
                        {renderPokemonPreview(hoveredPokemon)}
                      </aside>
                    ) : null}
                  </>
                ) : null}
              </div>

              {openPicker !== "pokemon" && visibleMegaOptions.length > 0 ? (
                <div
                  className="mega-controls"
                  aria-label={t("builder.megaOptions")}
                >
                  {visibleMegaOptions.map((option) => {
                    const isActiveMega =
                      activeFormKind === "mega" &&
                      option.speciesKey === speciesKey &&
                      (option.formLabel ?? "Mega") ===
                        (memberIndexEntry?.formLabel ?? "Mega");
                    const megaSuffix = option.formLabel
                      ?.replace("Mega", "")
                      .trim();
                    const megaDisplayName = pokemonName({
                      id: option.name,
                      speciesId: option.speciesKey,
                      fallback: option.displayName,
                      formLabel: option.formLabel,
                    });

                    return (
                      <button
                        className={`mega-button ${
                          isActiveMega ? "is-active" : ""
                        }`}
                        type="button"
                        aria-label={t(
                          isActiveMega
                            ? "builder.returnFromMega"
                            : "builder.useMega",
                          { name: megaDisplayName },
                        )}
                        title={megaDisplayName}
                        key={option.name}
                        onClick={() =>
                          void handleToggleMega(option, isActiveMega)
                        }
                      >
                        M{megaSuffix ? ` ${megaSuffix}` : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {openPicker !== "pokemon" &&
              battleFormGroup &&
              activeBattleFormOption ? (
                <div className="form-picker" ref={battleFormPickerRef}>
                  <button
                    className="form-picker-trigger"
                    type="button"
                    aria-label={t("builder.form", {
                      form: pokemonFormName(
                        activeBattleFormOption.pokemonId,
                        activeBattleFormOption.label,
                      ),
                    })}
                    aria-expanded={isBattleFormPickerOpen}
                    aria-haspopup="listbox"
                    onClick={() => {
                      setActiveBattleFormOptionIndex(
                        activeBattleFormOptionIndexFromPokemon,
                      );
                      setIsBattleFormPickerOpen((isOpen) => !isOpen);
                    }}
                    onKeyDown={handleBattleFormKeyDown}
                  >
                    <span>
                      {pokemonFormName(
                        activeBattleFormOption.pokemonId,
                        activeBattleFormOption.label,
                      )}
                    </span>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      aria-hidden="true"
                    />
                  </button>

                  {isBattleFormPickerOpen ? (
                    <div
                      className="form-picker-menu"
                      role="listbox"
                      aria-label={t("builder.battleForm")}
                    >
                      {battleFormGroup.options.map((option, optionIndex) => {
                        const isSelected = member?.id === option.pokemonId;
                        const isActive =
                          activeBattleFormOptionIndex === optionIndex;

                        return (
                          <button
                            className={`form-picker-option ${
                              isActive ? "is-active" : ""
                            }`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            key={option.pokemonId}
                            onMouseEnter={() =>
                              setActiveBattleFormOptionIndex(optionIndex)
                            }
                            onClick={() =>
                              void handleSelectBattleForm(option.pokemonId)
                            }
                          >
                            {pokemonFormName(option.pokemonId, option.label)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {member ? (
              <>
                <div className="meta-row">
                  <div className="set-meta-controls">
                    <div
                      className="item-picker"
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <button
                        className={`item-button ${
                          build.item ? "has-item" : ""
                        }`}
                        type="button"
                        disabled={isItemLocked}
                        aria-label={
                          build.item
                            ? t("builder.changeItem", {
                                item: gameName(
                                  "items",
                                  build.item.showdownId ?? build.item.id,
                                  build.item.name,
                                ),
                              })
                            : t("builder.chooseItem")
                        }
                        aria-haspopup={
                          isTouchPickerLayout ? "dialog" : "listbox"
                        }
                        aria-expanded={openPicker === "item"}
                        onFocus={() => setHoveredItem(build.item)}
                        onMouseEnter={() => setHoveredItem(build.item)}
                        onClick={() => {
                          if (openPicker === "item") {
                            closePicker();
                          } else {
                            openItemPicker();
                          }
                        }}
                      >
                        {build.item ? (
                          <ItemSprite item={build.item} />
                        ) : (
                          <span>+</span>
                        )}
                      </button>

                      {openPicker === "item" && !isTouchPickerLayout ? (
                        <div className="item-menu">
                          <input
                            className="item-search-input"
                            autoFocus
                            aria-label={t("builder.searchItem")}
                            value={itemQuery}
                            placeholder={t("builder.searchItem")}
                            onChange={(event) => {
                              setItemQuery(event.target.value);
                              resetItemOptions();
                              setActiveItemIndex(0);
                            }}
                            onKeyDown={(event) =>
                              handlePickerKeyDown(event, "item")
                            }
                          />
                          <div
                            className="item-results"
                            role="listbox"
                            onScroll={handleItemScroll}
                          >
                            {renderItemOptions(false)}
                          </div>
                        </div>
                      ) : null}

                      {!isTouchPickerLayout && hoveredItem ? (
                        <aside
                          className={`item-tooltip ${
                            openPicker === "item"
                              ? "item-option-tooltip"
                              : ""
                          }`}
                          role="tooltip"
                        >
                          <ItemDetailsContent item={hoveredItem} />
                        </aside>
                      ) : null}
                    </div>

                    <div className="trait-row">
                      <div
                        className="trait-picker"
                        onKeyDown={(event) =>
                          handlePickerKeyDown(event, "ability")
                        }
                      >
                        <span className="trait-label">
                          {t("builder.ability")}
                        </span>
                        <button
                          className="trait-value"
                          type="button"
                          aria-haspopup={
                            isTouchPickerLayout ? "dialog" : "listbox"
                          }
                          aria-expanded={openPicker === "ability"}
                          onFocus={() => void previewAbility(build.ability)}
                          onMouseEnter={() =>
                            void previewAbility(build.ability)
                          }
                          onMouseLeave={() => {
                            if (!isTouchPickerLayout) {
                              setHoveredAbility(null);
                            }
                          }}
                          onClick={() => {
                            if (openPicker === "ability") {
                              closePicker();
                            } else {
                              openAbilityPicker();
                            }
                          }}
                        >
                          {gameName(
                            "abilities",
                            build.ability,
                            build.ability,
                          )}
                        </button>

                        {openPicker === "ability" &&
                        !isTouchPickerLayout ? (
                          <div className="trait-menu" role="listbox">
                            {renderAbilityOptions(false)}
                          </div>
                        ) : null}

                        {!isTouchPickerLayout && hoveredAbility ? (
                          <aside
                            className={`ability-tooltip ${
                              openPicker === "ability"
                                ? "ability-option-tooltip"
                                : ""
                            }`}
                            role="tooltip"
                          >
                            <AbilityDetailsContent
                              ability={hoveredAbility}
                            />
                          </aside>
                        ) : null}
                      </div>

                      <div
                        className="trait-picker"
                        onKeyDown={(event) =>
                          handlePickerKeyDown(event, "nature")
                        }
                      >
                        <span className="trait-label">
                          {t("builder.nature")}
                        </span>
                        <button
                          className="trait-value"
                          type="button"
                          aria-haspopup={
                            isTouchPickerLayout ? "dialog" : "listbox"
                          }
                          aria-expanded={openPicker === "nature"}
                          onClick={() => {
                            if (openPicker === "nature") {
                              closePicker();
                            } else {
                              openNaturePicker();
                            }
                          }}
                        >
                          {gameName(
                            "natures",
                            selectedNature.id,
                            selectedNature.label,
                          )}
                        </button>

                        {openPicker === "nature" &&
                        !isTouchPickerLayout ? (
                          <div
                            className="nature-grid-menu"
                            role="dialog"
                            aria-label={t("builder.selectNature")}
                          >
                            <NatureGrid
                              selectedNature={selectedNature}
                              activePosition={activeNaturePosition}
                              upLabel={t("builder.up")}
                              downLabel={t("builder.down")}
                              getNatureName={(nature) =>
                                gameName(
                                  "natures",
                                  nature.id,
                                  nature.label,
                                )
                              }
                              getStatLabel={(stat) => t(`stat.${stat}`)}
                              onActivePositionChange={
                                setActiveNaturePosition
                              }
                              onSelectNature={(nature) =>
                                onBuildChange({ natureId: nature.id })
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                </div>

                <div className="calculator-vitals-row">
                  <div
                    className="calculator-hp-strip"
                    role="group"
                    aria-label={t("calculator.currentHp")}
                  >
                    <span className="calculator-vitals-label">
                      {t("calculator.currentHp")}
                    </span>
                    <input
                      type="range"
                      className={`calculator-hp-track ${
                        hpPercent <= 20
                          ? "is-low"
                          : hpPercent <= 50
                            ? "is-mid"
                            : ""
                      }`}
                      min={1}
                      max={maxHp}
                      step={1}
                      value={battle.currentHp}
                      aria-label={t("calculator.currentHpSlider")}
                      style={
                        {
                          "--calculator-hp-fill": `${hpPercent}%`,
                        } as CSSProperties
                      }
                      onChange={(event) =>
                        updateCurrentHp(Number(event.target.value))
                      }
                    />
                    <span
                      className={`calculator-hp-value${
                        isHpScrubbing ? " is-scrubbing" : ""
                      }`}
                    >
                      <input
                        className="calculator-hp-number-input"
                        type="number"
                        min={1}
                        max={maxHp}
                        value={battle.currentHp}
                        aria-label={t("calculator.currentHpInput")}
                        onChange={(event) =>
                          updateCurrentHp(Number(event.target.value))
                        }
                        onFocus={(event) => event.currentTarget.select()}
                        onPointerDown={handleHpScrubPointerDown}
                        onPointerMove={handleHpScrubPointerMove}
                        onPointerUp={(event) => finishHpScrub(event, true)}
                        onPointerCancel={(event) => finishHpScrub(event, false)}
                      />
                      <small>/ {maxHp}</small>
                    </span>
                  </div>

                  <div
                    className="calculator-status-control"
                    onKeyDown={(event) =>
                      handlePickerKeyDown(event, "status")
                    }
                  >
                    <span className="calculator-vitals-label">
                      {t("calculator.status")}
                    </span>
                    <button
                      className="calculator-status-trigger"
                      type="button"
                      aria-haspopup={
                        isTouchPickerLayout ? "dialog" : "listbox"
                      }
                      aria-expanded={openPicker === "status"}
                      onClick={() => {
                        if (openPicker === "status") {
                          closePicker();
                        } else {
                          openStatusPicker();
                        }
                      }}
                    >
                      <span>
                        {t(
                          battle.status === "healthy"
                            ? "calculator.healthy"
                            : "calculator.burned",
                        )}
                      </span>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        aria-hidden="true"
                      />
                    </button>

                    {openPicker === "status" &&
                    !isTouchPickerLayout ? (
                      <div
                        className="trait-menu calculator-status-menu"
                        role="listbox"
                      >
                        {renderStatusOptions(false)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="editor-detail-grid">
                  <div
                    className={`move-list calculator-shared-move-list${
                      moveReorder.isDragging ? " is-reordering" : ""
                    }`}
                    aria-label={t("builder.selectedMoves")}
                    ref={moveListRef}
                  >
                    {moves.map((move, moveIndex) => {
                      const displacement = getReorderDisplacement(
                        moveReorder.dragState,
                        moveIndex,
                      );

                      return (
                        <div
                          className="calculator-move-entry"
                          key={`${moveIndex}-${move?.id ?? "empty"}`}
                          onMouseLeave={() => {
                            if (
                              suppressedMoveTooltipSlot === moveIndex
                            ) {
                              setSuppressedMoveTooltipSlot(null);
                            }
                          }}
                        >
                        <div
                          className={`move-picker${
                            moveReorder.dragState?.sourceIndex === moveIndex
                              ? " is-dragging"
                              : ""
                          }${
                            moveReorder.dragState?.sourceIndex === moveIndex &&
                            moveReorder.dragState.isDropping
                              ? " is-dropping"
                              : ""
                          }${
                            moveReorder.dragState?.targetIndex === moveIndex &&
                            moveReorder.dragState.sourceIndex !== moveIndex
                              ? " is-drop-target"
                              : ""
                          }${displacement ? " is-reorder-displaced" : ""}`}
                          data-calculator-move-index={moveIndex}
                          style={
                            moveReorder.dragState?.sourceIndex === moveIndex
                              ? ({
                                  "--move-drag-x": `${moveReorder.dragState.offsetX}px`,
                                  "--move-drag-y": `${moveReorder.dragState.offsetY}px`,
                                } as CSSProperties)
                              : displacement
                                ? {
                                    transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
                                  }
                                : undefined
                          }
                        >
                          <button
                            className={`move-pill ${
                              move
                                ? `type-${move.type}`
                                : "is-empty"
                            }`}
                            type="button"
                            aria-label={
                              move
                                ? t("builder.moveReorderAria", {
                                    move: gameName(
                                      "moves",
                                      move.id,
                                      move.name,
                                    ),
                                    slot: moveIndex + 1,
                                  })
                                : t("builder.chooseMoveSlot", {
                                    slot: moveIndex + 1,
                                  })
                            }
                            aria-expanded={
                              openPicker === "move" &&
                              openMoveSlot === moveIndex
                            }
                            onClick={() => {
                              if (moveReorder.shouldSuppressClick()) {
                                return;
                              }

                              if (
                                openPicker === "move" &&
                                openMoveSlot === moveIndex
                              ) {
                                setSuppressedMoveTooltipSlot(moveIndex);
                                closePicker();
                              } else {
                                openMovePicker(
                                  moveIndex,
                                  move?.id ?? "",
                                );
                              }
                            }}
                            onKeyDown={(event) =>
                              handleMoveSlotKeyDown(event, moveIndex)
                            }
                            onPointerDown={(event) => {
                              if (move) {
                                moveReorder.handlePointerDown(
                                  event,
                                  moveIndex,
                                );
                              }
                            }}
                            onPointerMove={moveReorder.handlePointerMove}
                            onPointerUp={moveReorder.handlePointerUp}
                            onPointerCancel={moveReorder.handlePointerCancel}
                          >
                            {move ? (
                              <MoveSummary move={move} />
                            ) : (
                              <span className="empty-move-label">
                                <FontAwesomeIcon
                                  icon={faPlus}
                                  aria-hidden="true"
                                />
                                {t("builder.addMove")}
                              </span>
                            )}
                          </button>

                          {move &&
                          !isTouchPickerLayout &&
                          !(
                            openPicker === "move" &&
                            openMoveSlot === moveIndex
                          ) &&
                          suppressedMoveTooltipSlot !== moveIndex ? (
                            <MoveTooltip move={move} />
                          ) : null}

                          {openPicker === "move" &&
                          openMoveSlot === moveIndex &&
                          !isTouchPickerLayout ? (
                            <>
                              <div className="move-menu">
                                <input
                                  className="move-search-input"
                                  autoFocus
                                  aria-label={t(
                                    "builder.searchAvailableMoves",
                                  )}
                                  value={moveQuery}
                                  placeholder={t(
                                    "filter.searchMoves",
                                  )}
                                  onChange={(event) => {
                                    setMoveQuery(event.target.value);
                                    resetMoveOptions();
                                    setActiveMoveIndex(0);
                                  }}
                                  onKeyDown={(event) =>
                                    handlePickerKeyDown(
                                      event,
                                      "move",
                                    )
                                  }
                                />
                                <div
                                  className="move-results"
                                  ref={moveResultsRef}
                                  role="listbox"
                                  onScroll={handleMoveScroll}
                                >
                                  {renderMoveOptions(false)}
                                </div>
                              </div>
                              {hoveredMove ? (
                                <MoveTooltip
                                  move={hoveredMove}
                                  placement="option"
                                />
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        </div>
                      );
                    })}
                  </div>

                  <section
                    className="stats-editor"
                    aria-label={t("builder.pokemonStats")}
                  >
                    <div className="stats-editor-body">
                      <div
                        className="stat-axis-labels"
                        aria-hidden="true"
                      >
                        <span className="is-base">
                          {t("builder.base")}
                        </span>
                        <span className="is-ev">
                          {t("builder.ev")}
                        </span>
                        <span className="is-stat">
                          {t("builder.stat")}
                        </span>
                        <span className="is-stage">
                          {t("calculator.statStage")}
                        </span>
                      </div>
                      <div className="stats-editor-grid">
                        {statKeys.map((stat) => {
                          const natureShift =
                            selectedNature.up !==
                              selectedNature.down &&
                            stat === selectedNature.up
                              ? "up"
                              : selectedNature.up !==
                                    selectedNature.down &&
                                  stat === selectedNature.down
                                ? "down"
                                : null;

                          return (
                            <div
                              className="stat-editor-column"
                              key={stat}
                            >
                              <strong className="stat-editor-label">
                                {t(`stat.${stat}`)}
                              </strong>
                              <span className="stat-base-value">
                                {member.baseStats?.[stat] ?? 0}
                              </span>
                              <div className="ev-vertical-track">
                                <input
                                  className="ev-vertical-range"
                                  type="range"
                                  aria-label={t("builder.evSlider", {
                                    stat: t(`stat.${stat}`),
                                  })}
                                  min={0}
                                  max={CHAMPIONS_MAX_EV_PER_STAT}
                                  step={1}
                                  value={build.evs[stat]}
                                  style={
                                    {
                                      "--ev-fill": `${
                                        (build.evs[stat] /
                                          CHAMPIONS_MAX_EV_PER_STAT) *
                                        100
                                      }%`,
                                    } as CSSProperties
                                  }
                                  onChange={(event) =>
                                    onBuildChange({
                                      evs: clampEvSpread(
                                        build.evs,
                                        stat,
                                        Number(event.target.value),
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <label className="ev-number-field">
                                <span className="sr-only">
                                  {t(`stat.${stat}`)}{" "}
                                  {t("builder.ev")}
                                </span>
                                <input
                                  className="ev-number-input"
                                  inputMode="numeric"
                                  min={0}
                                  max={CHAMPIONS_MAX_EV_PER_STAT}
                                  value={build.evs[stat]}
                                  onChange={(event) =>
                                    onBuildChange({
                                      evs: clampEvSpread(
                                        build.evs,
                                        stat,
                                        Number(event.target.value),
                                      ),
                                    })
                                  }
                                  onFocus={(event) =>
                                    event.currentTarget.select()
                                  }
                                  onClick={(event) => {
                                    if (isTouchPickerLayout) {
                                      event.currentTarget.select();
                                    }
                                  }}
                                />
                              </label>
                              <span className="stat-result-value">
                                <span className="stat-value">
                                  {calculatedStats?.[stat] ?? 0}
                                  {natureShift ? (
                                    <span
                                      className={`stat-nature-arrow is-${natureShift}`}
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </span>
                              </span>
                              {stat === "hp" ? (
                                <span
                                  className="calculator-stat-stage is-empty"
                                  aria-hidden="true"
                                >
                                  -
                                </span>
                              ) : (
                                <StatStagePicker
                                  label={t(`stat.${stat}`)}
                                  value={battle.boosts[stat] ?? 0}
                                  isOpen={openRankStat === stat}
                                  isTouchLayout={isTouchPickerLayout}
                                  onOpen={() => {
                                    closePicker();
                                    setIsBattleFormPickerOpen(false);
                                    setOpenRankStat(stat);
                                  }}
                                  onClose={() => setOpenRankStat(null)}
                                  onChange={(stage) =>
                                    onBattleChange((current) => ({
                                      ...current,
                                      boosts: {
                                        ...current.boosts,
                                        [stat]: stage,
                                      },
                                    }))
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <CandidateFilterPanel
                filters={candidateFilters}
                matchingCount={candidateFilteredPokemonOptions.length}
                totalCount={pokemonOptions.length}
                openPicker={openCandidateFilterPicker}
                query={candidateFilterQuery}
                options={visibleCandidateFilterOptions}
                selectedMoves={selectedCandidateMoveOptions}
                activeMoveSlot={candidateMoveFilterSlot}
                activeOptionIndex={activeCandidateFilterOptionIndex}
                isTouchLayout={isTouchPickerLayout}
                panelRef={candidateFilterPickerRef}
                onToggleType={toggleCandidatePokemonType}
                onClearFilters={clearCandidateFilters}
                onOpenPicker={openCandidatePicker}
                onOpenMovePicker={openCandidateMovePicker}
                onClosePicker={closeCandidateFilterPicker}
                onQueryChange={changeCandidateFilterQuery}
                onResultsScroll={handleCandidateFilterOptionsScroll}
                onMoveActiveOption={moveCandidateFilterKeyboardOption}
                onActiveOptionChange={
                  setActiveCandidateFilterOptionIndex
                }
                onSelectOption={selectCandidateFilterOption}
                onRemoveAbility={removeCandidateAbility}
                onRemoveMove={removeCandidateMove}
              />
            )}
          </div>

          <div className="sprite-crop">
            <div className="type-stack">
              {(member?.types ?? []).map((type) => (
                <TypeBadge type={type} key={type} />
              ))}
            </div>
            {member?.spriteUrl ? (
              <img src={member.spriteUrl} alt="" />
            ) : null}
          </div>
        </div>
      </article>

      {renderTouchDialog()}
    </section>
  );
}
