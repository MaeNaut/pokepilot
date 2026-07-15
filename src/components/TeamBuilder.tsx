import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, UIEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChair,
  faFileExport,
  faFileImport,
  faFileLines,
  faChevronDown,
  faCircleCheck,
  faCircleQuestion,
  faImage,
  faPlus,
  faRotateRight,
  faSpinner,
  faTrash,
  faTriangleExclamation,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPokemon } from "../api/pokeApi";
import { loadShowdownData } from "../api/showdownData";
import { fetchAbility, itemFromIndexEntry } from "../api/showdownCatalog";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import {
  getShowdownLookupKeys,
  type ShowdownLegalitySnapshot,
  getLegalAbilities,
  getLegalMoves,
  isPokemonLegal,
  isItemLegal,
} from "../api/showdownLegality";
import { loadSmogonUsagePokemonIds } from "../api/smogonUsage";
import type {
  DataLoadStatus,
  ItemIndexEntry,
  PokemonAbility,
  PokemonCandidateFilterValue,
  PokemonItem,
  PokemonMove,
  PokemonIndexEntry,
  PokemonType,
  StatBlock,
  StatKey,
  TeamMember,
  TeamSlot,
} from "../types";
import type { TeamBuildStateController } from "../hooks/useTeamBuildState";
import {
  getReorderDisplacement,
  useLongPressReorder,
} from "../hooks/useLongPressReorder";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import {
  emptyPokemonCandidateFilters,
  hasPokemonCandidateFilters,
  matchesPokemonCandidateFilters,
  togglePokemonTypeFilter,
} from "../utils/pokemonCandidateFilters";
import type { BenchPokemon } from "../utils/benchPokemon";
import {
  getMegaSpeciesKey,
  getMegaStoneItemName,
  isMegaPokemonName,
} from "../utils/megaEvolution";
import type { TeamValidityResult } from "../utils/teamValidity";
import { getBattleFormGroup } from "../data/battleForms";
import {
  MAX_BENCH_POKEMON,
  canAddBenchPokemon,
} from "../data/teamLimits";
import {
  battleStatKeys,
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  defaultEvs,
  getNatureByAlignment,
  getNatureById,
  natureStatLabels,
  statKeys,
  statLabels,
  type Nature,
} from "../data/natures";
import { PokemonIcon } from "./PokemonIcon";
import { ItemSprite } from "./ItemSprite";
import {
  PokemonShareCard,
  type PokemonShareBuild,
} from "./PokemonShareCard";
import { ShareImageDialog } from "./ShareImageDialog";
import { TeamShareCard } from "./TeamShareCard";
import { MoveSummary, MoveTooltip } from "./MoveDetails";
import { TypeBadge } from "./TypeBadge";
import {
  CandidateFilterPanel,
  type CandidateFilterOption,
  type CandidateFilterPicker,
} from "./CandidateFilterPanel";

type TeamBuilderProps = {
  teamName: string;
  team: TeamSlot[];
  bench: BenchPokemon[];
  selectedSlot: number;
  pool: TeamMember[];
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  showdownLegality?: ShowdownLegalitySnapshot | null;
  pokemonIndexStatus: DataLoadStatus;
  itemIndexStatus: DataLoadStatus;
  showdownLegalityStatus: DataLoadStatus;
  showdownLegalityError: string | null;
  selectingPokemonSlot: number | null;
  searchError: string | null;
  searchNotice: { slotIndex: number; message: string } | null;
  failedPokemonSelectionSlot: number | null;
  buildState: TeamBuildStateController;
  validity: TeamValidityResult;
  onSelectedSlotChange: (slotIndex: number) => void;
  onChangeSlot: (slotIndex: number, memberId: string) => void;
  onSelectPokemon: (
    slotIndex: number,
    lookup: string,
    options?: { applyUsageStats?: boolean; allowBattleForm?: boolean },
  ) => Promise<void>;
  onClearSlot: (slotIndex: number) => void;
  onReorderSlots: (sourceIndex: number, targetIndex: number) => void;
  onMoveTeamPokemonToBench: (slotIndex: number) => void;
  onMoveBenchPokemonToTeam: (benchIndex: number, slotIndex: number) => void;
  onReorderBenchPokemon: (sourceIndex: number, targetIndex: number) => void;
  onRemoveBenchPokemon: (benchId: string) => void;
  onExportShowdown: (slotIndex: number) => string;
  onImportShowdown: (slotIndex: number, text: string) => Promise<void>;
  onRetryPokemonIndex: () => void;
  onRetryItemIndex: () => void;
  onRetryShowdownLegality: () => void;
  onRetryPokemonSelection: () => void;
};

type PokemonSelectOption = {
  id: string;
  name: string;
  number: number;
  types: PokemonType[];
  abilityOptions: PokemonCandidateFilterValue[];
  moveIds: string[];
};


function DataStatusRow({
  message,
  isLoading = false,
  onRetry,
}: {
  message: string;
  isLoading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="data-status-row" role={onRetry ? "alert" : "status"}>
      {isLoading ? (
        <FontAwesomeIcon className="is-spinning" icon={faSpinner} aria-hidden="true" />
      ) : null}
      <span>{message}</span>
      {onRetry ? (
        <button type="button" aria-label="Retry loading data" title="Retry" onClick={onRetry}>
          <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

const optionPageSize = 20;
const optionScrollThreshold = 32;

function getExpandedOptionLimit(current: number, total: number) {
  return Math.min(total, current + optionPageSize);
}

function isNearOptionListEnd(target: HTMLDivElement) {
  return target.scrollHeight - target.scrollTop - target.clientHeight <= optionScrollThreshold;
}

function getBaseUsageLookup(value: string) {
  const withoutMega = value.replace(/-mega(?:-.+)?$/, "");
  const regionalMatch = withoutMega.match(/^(.+)-(alola|galar|hisui|paldea)$/);

  if (regionalMatch) {
    return withoutMega;
  }

  return withoutMega.split("-")[0];
}

type NatureGridPosition = {
  upIndex: number;
  downIndex: number;
};

type MoveOptionScrollMode = "start" | "nearest";
type ShareImageTarget = "team" | number | null;

function getIndexAfterSwap(index: number, sourceIndex: number, targetIndex: number) {
  if (index === sourceIndex) {
    return targetIndex;
  }

  if (index === targetIndex) {
    return sourceIndex;
  }

  return index;
}

const defaultStats: StatBlock = {
  hp: 80,
  attack: 80,
  defense: 80,
  specialAttack: 80,
  specialDefense: 80,
  speed: 80,
};

const defaultAbilityOptions = ["Ability pending"];

function fallbackMoves(types: PokemonType[]): PokemonMove[] {
  const primary = types[0] ?? "normal";
  const secondary = types[1] ?? primary;

  return [
    {
      id: "primary-attack",
      name: `${primary} attack`,
      type: primary,
      power: null,
      accuracy: null,
      pp: 10,
      category: "Status",
      description: "Move details will come from the Champions M-B legal move dataset.",
    },
    {
      id: "secondary-attack",
      name: `${secondary} attack`,
      type: secondary,
      power: null,
      accuracy: null,
      pp: 10,
      category: "Status",
      description: "Move details will come from the Champions M-B legal move dataset.",
    },
    {
      id: "protect",
      name: "Protect",
      type: "normal",
      power: null,
      accuracy: null,
      pp: 10,
      category: "Status",
      description: "Protects the user from most attacks for the turn.",
    },
    {
      id: "utility",
      name: "Utility",
      type: "normal",
      power: null,
      accuracy: null,
      pp: 10,
      category: "Status",
      description: "Utility move placeholder until legal moves are connected.",
    },
  ];
}

function findMoveByLookup(moves: PokemonMove[], value: string) {
  const lookup = normalizeShowdownId(value);

  return moves.find(
    (move) =>
      normalizeShowdownId(move.id) === lookup ||
      normalizeShowdownId(move.name) === lookup,
  );
}

function resolveShareMoves(
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

function handleShareImageNavigationKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
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
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  const nextTab = tabs[nextIndex];

  nextTab.focus();
  nextTab.click();
}

function getItemEffectText(item: PokemonItem) {
  return (
    item.effect
      ?.replace(/\$effect_chance/g, "effect chance")
      .replace(/\s+/g, " ")
      .trim() || "Item details are not available from Showdown."
  );
}

function getAbilityEffectText(ability: PokemonAbility) {
  return (
    (ability.shortEffect ?? ability.effect)
      ?.replace(/\$effect_chance/g, "effect chance")
      .replace(/\s+/g, " ")
      .trim() || "Ability details are not available from Showdown."
  );
}

function isExactPokemonFormLegal(
  showdownLegality: ShowdownLegalitySnapshot | null | undefined,
  pokemonId: string,
) {
  if (!showdownLegality || showdownLegality.pokemonIds.size === 0) {
    return true;
  }

  return getShowdownLookupKeys(pokemonId).some((lookup) =>
    showdownLegality.pokemonIds.has(lookup),
  );
}

function getNextOptionIndex(currentIndex: number, optionCount: number, direction: 1 | -1) {
  if (optionCount === 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction > 0 ? 0 : optionCount - 1;
  }

  return (currentIndex + direction + optionCount) % optionCount;
}

function getActiveOption<T>(options: T[], activeIndex: number) {
  return options[activeIndex >= 0 ? activeIndex : 0];
}

function getNaturePosition(nature: Nature): NatureGridPosition {
  return {
    upIndex: Math.max(0, battleStatKeys.indexOf(nature.up)),
    downIndex: Math.max(0, battleStatKeys.indexOf(nature.down)),
  };
}

function getNatureFromPosition(position: NatureGridPosition) {
  const upStat = battleStatKeys[position.upIndex];
  const downStat = battleStatKeys[position.downIndex];

  return getNatureByAlignment(upStat, downStat);
}

export function TeamBuilder({
  teamName,
  team,
  bench,
  selectedSlot,
  pool,
  pokemonIndex,
  itemIndex,
  showdownLegality,
  pokemonIndexStatus,
  itemIndexStatus,
  showdownLegalityStatus,
  showdownLegalityError,
  selectingPokemonSlot,
  searchError,
  searchNotice,
  failedPokemonSelectionSlot,
  buildState,
  validity,
  onSelectedSlotChange,
  onChangeSlot,
  onSelectPokemon,
  onClearSlot,
  onReorderSlots,
  onMoveTeamPokemonToBench,
  onMoveBenchPokemonToTeam,
  onReorderBenchPokemon,
  onRemoveBenchPokemon,
  onExportShowdown,
  onImportShowdown,
  onRetryPokemonIndex,
  onRetryItemIndex,
  onRetryShowdownLegality,
  onRetryPokemonSelection,
}: TeamBuilderProps) {
  const {
    itemBySlot,
    abilityBySlot,
    natureBySlot,
    evsBySlot,
    moveIdsBySlot,
    preMegaPokemonBySlot,
    candidateFiltersBySlot,
    setItemBySlot,
    setAbilityBySlot,
    setNatureBySlot,
    setEvsBySlot,
    setMoveIdsBySlot,
    setPreMegaPokemonBySlot,
    patchSlot,
    clearSlot,
  } = buildState;
  const [isNamePickerOpen, setIsNamePickerOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [candidateMoveIndex, setCandidateMoveIndex] = useState<PokemonMove[]>([]);
  const [openCandidateFilterPicker, setOpenCandidateFilterPicker] =
    useState<CandidateFilterPicker | null>(null);
  const [candidateMoveFilterSlot, setCandidateMoveFilterSlot] = useState<
    number | null
  >(null);
  const [candidateFilterQuery, setCandidateFilterQuery] = useState("");
  const [activeCandidateFilterOptionIndex, setActiveCandidateFilterOptionIndex] =
    useState(0);
  const [usagePokemonIds, setUsagePokemonIds] = useState<string[] | null>(null);
  const [pokemonOptionLimit, setPokemonOptionLimit] = useState(optionPageSize);
  const [itemOptionLimit, setItemOptionLimit] = useState(optionPageSize);
  const [abilityOptionLimit, setAbilityOptionLimit] = useState(optionPageSize);
  const [moveOptionLimit, setMoveOptionLimit] = useState(optionPageSize);
  const [candidateFilterOptionLimit, setCandidateFilterOptionLimit] =
    useState(optionPageSize);
  const [isUsageOrderLoading, setIsUsageOrderLoading] = useState(false);
  const [usageOrderError, setUsageOrderError] = useState<string | null>(null);
  const [pendingClearSlot, setPendingClearSlot] = useState<number | null>(null);
  const [isShowdownPanelOpen, setIsShowdownPanelOpen] = useState(false);
  const [showdownText, setShowdownText] = useState("");
  const [showdownPanelMessage, setShowdownPanelMessage] = useState<string | null>(null);
  const [isImportingShowdown, setIsImportingShowdown] = useState(false);
  const [isValidityPanelOpen, setIsValidityPanelOpen] = useState(false);
  const [isBenchOpen, setIsBenchOpen] = useState(false);
  const [benchLimitMessage, setBenchLimitMessage] = useState<string | null>(null);
  const [pendingBenchRemovalId, setPendingBenchRemovalId] = useState<string | null>(null);
  const [shareImageTarget, setShareImageTarget] = useState<ShareImageTarget>(null);
  const builderCardLayoutRef = useRef<HTMLDivElement | null>(null);
  const teamTabsRef = useRef<HTMLDivElement | null>(null);
  const benchShellRef = useRef<HTMLDivElement | null>(null);
  const showdownToolbarRef = useRef<HTMLDivElement | null>(null);
  const showdownPanelRef = useRef<HTMLDivElement | null>(null);
  const showdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const validityPanelRef = useRef<HTMLDivElement | null>(null);
  const clearConfirmRef = useRef<HTMLDivElement | null>(null);
  const namePickerRef = useRef<HTMLDivElement | null>(null);
  const candidateFilterPickerRef = useRef<HTMLDivElement | null>(null);
  const battleFormPickerRef = useRef<HTMLDivElement | null>(null);
  const [isBattleFormPickerOpen, setIsBattleFormPickerOpen] = useState(false);
  const [activeBattleFormOptionIndex, setActiveBattleFormOptionIndex] = useState(0);
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const itemPickerRef = useRef<HTMLDivElement | null>(null);
  const traitPickerRef = useRef<HTMLDivElement | null>(null);
  const movePickerRef = useRef<HTMLDivElement | null>(null);
  const moveResultsRef = useRef<HTMLDivElement | null>(null);
  const moveOptionScrollModeRef = useRef<MoveOptionScrollMode | null>(null);
  const [openTraitPicker, setOpenTraitPicker] = useState<"ability" | "nature" | null>(
    null,
  );
  const [openMoveSlot, setOpenMoveSlot] = useState<number | null>(null);
  const [suppressedMoveTooltipSlot, setSuppressedMoveTooltipSlot] = useState<
    number | null
  >(null);
  const [moveQuery, setMoveQuery] = useState("");
  const [hoveredItemOption, setHoveredItemOption] = useState<PokemonItem | null>(null);
  const [activePokemonOptionIndex, setActivePokemonOptionIndex] = useState(-1);
  const [activeItemOptionIndex, setActiveItemOptionIndex] = useState(-1);
  const [activeAbilityOptionIndex, setActiveAbilityOptionIndex] = useState(-1);
  const [activeNaturePosition, setActiveNaturePosition] = useState<NatureGridPosition>({
    upIndex: 0,
    downIndex: 0,
  });
  const [activeMoveOptionIndex, setActiveMoveOptionIndex] = useState(-1);
  const [hoveredAbilityOption, setHoveredAbilityOption] =
    useState<PokemonAbility | null>(null);
  const [abilityDetailsByName, setAbilityDetailsByName] = useState<
    Record<string, PokemonAbility>
  >({});
  const [hoveredMoveOption, setHoveredMoveOption] = useState<PokemonMove | null>(null);
  const [preMegaMovesByPokemonId, setPreMegaMovesByPokemonId] = useState<
    Record<string, PokemonMove[]>
  >({});

  const pokemonIndexByName = useMemo(
    () => new Map(pokemonIndex.map((entry) => [entry.name, entry])),
    [pokemonIndex],
  );
  const activeMember = team[selectedSlot];
  const activePokemonId = activeMember?.id ?? "";
  const isNamePickerVisible = isNamePickerOpen || !activeMember;
  const activeCandidateFilters =
    candidateFiltersBySlot[selectedSlot] ?? emptyPokemonCandidateFilters;
  const activeItem = itemBySlot[selectedSlot] ?? null;
  const abilityOptions = activeMember?.abilities ?? defaultAbilityOptions;
  const activeIndexEntry = pokemonIndexByName.get(activePokemonId);
  const activeFormKind =
    activeIndexEntry?.formKind ?? (isMegaPokemonName(activePokemonId) ? "mega" : "base");
  const activeSpeciesKey =
    activeIndexEntry?.speciesKey ??
    (activePokemonId ? getMegaSpeciesKey(activePokemonId) : "");
  const legalAbilitySet = getLegalAbilities(
    showdownLegality ?? null,
    activePokemonId,
    activeSpeciesKey,
  );
  const displayedAbilityOptions = useMemo(() => {
    const legalAbilityOptions = legalAbilitySet
      ? abilityOptions.filter((ability) =>
          legalAbilitySet.has(normalizeShowdownId(ability)),
        )
      : abilityOptions;

    return legalAbilityOptions.length > 0 ? legalAbilityOptions : abilityOptions;
  }, [abilityOptions, legalAbilitySet]);
  const visibleAbilityOptions = useMemo(
    () => displayedAbilityOptions.slice(0, abilityOptionLimit),
    [abilityOptionLimit, displayedAbilityOptions],
  );
  const selectedAbility =
    abilityBySlot[selectedSlot] ??
    displayedAbilityOptions[0] ??
    abilityOptions[0] ??
    "";
  const defaultSelectedAbility = displayedAbilityOptions[0] ?? abilityOptions[0] ?? "";
  const displayedAbilityOptionKey = displayedAbilityOptions.join("|");
  const selectedAbilityOptionIndex = useMemo(
    () => displayedAbilityOptions.findIndex((ability) => ability === selectedAbility),
    [displayedAbilityOptions, selectedAbility],
  );
  const selectedNature = getNatureById(natureBySlot[selectedSlot] ?? "hardy");
  const baseStats = activeMember?.baseStats ?? defaultStats;
  const evs = evsBySlot[selectedSlot] ?? defaultEvs;
  const evTotal = statKeys.reduce((total, stat) => total + evs[stat], 0);
  const preMegaPokemonId = activeFormKind === "mega" ? preMegaPokemonBySlot[selectedSlot] : "";
  const legalMoveIds = useMemo(() => {
    const activeLegalMoveIds = getLegalMoves(
      showdownLegality ?? null,
      activePokemonId,
      activeSpeciesKey,
    );
    const preMegaLegalMoveIds = preMegaPokemonId
      ? getLegalMoves(showdownLegality ?? null, preMegaPokemonId, activeSpeciesKey)
      : null;

    if (!activeLegalMoveIds) {
      return preMegaLegalMoveIds;
    }

    if (!preMegaLegalMoveIds) {
      return activeLegalMoveIds;
    }

    return new Set([...activeLegalMoveIds, ...preMegaLegalMoveIds]);
  }, [activePokemonId, activeSpeciesKey, preMegaPokemonId, showdownLegality]);
  const preMegaMoves = useMemo(
    () => (preMegaPokemonId ? (preMegaMovesByPokemonId[preMegaPokemonId] ?? []) : []),
    [preMegaMovesByPokemonId, preMegaPokemonId],
  );
  const availableMoves = useMemo(() => {
    if (!activeMember) {
      return [];
    }

    if (activeFormKind === "mega" && preMegaMoves.length > 0) {
      const merged = new Map<string, PokemonMove>();

      for (const move of activeMember.moves ?? []) {
        merged.set(normalizeShowdownId(move.id), move);
      }

      for (const move of preMegaMoves) {
        const key = normalizeShowdownId(move.id);

        if (!merged.has(key)) {
          merged.set(key, move);
        }
      }

      return Array.from(merged.values());
    }

    return activeMember.moves ?? [];
  }, [activeFormKind, activeMember, preMegaMoves]);
  const moves = useMemo(() => {
    const legalMoves =
      legalMoveIds && availableMoves.length > 0
        ? availableMoves.filter((move) => {
            const moveId = normalizeShowdownId(move.id);
            const moveName = normalizeShowdownId(move.name);

            return legalMoveIds.has(moveId) || legalMoveIds.has(moveName);
          })
        : availableMoves;

    return legalMoves.length ? legalMoves : fallbackMoves(activeMember?.types ?? []);
  }, [activeMember?.types, availableMoves, legalMoveIds]);
  const selectedMoveIds = moveIdsBySlot[selectedSlot] ?? [];
  const selectedMoves = [0, 1, 2, 3].map((index) => {
    const selectedMoveId = selectedMoveIds[index];

    if (selectedMoveId === "") {
      return null;
    }

    if (selectedMoveId) {
      return findMoveByLookup(moves, selectedMoveId) ?? null;
    }

    return moves[index] ?? null;
  });
  const displayedValidityIssues = useMemo(() => {
    const issues = [
      ...validity.slotResults.flatMap((result) => result.issues),
      ...validity.teamIssues,
    ];
    const unavailableIssue = issues.find((issue) => issue.severity === "unavailable");

    return [
      ...issues.filter((issue) => issue.severity === "error"),
      ...(unavailableIssue ? [unavailableIssue] : []),
    ];
  }, [validity]);
  const moveReorder = useLongPressReorder({
    containerRef: movePickerRef,
    disabled: openMoveSlot !== null,
    itemSelector: "[data-move-slot-index]",
    onDragStart: closeMovePicker,
    onReorder: reorderMoves,
  });
  const teamReorder = useLongPressReorder({
    containerRef: builderCardLayoutRef,
    itemIndexAttribute: "data-team-drag-index",
    itemSelector: "[data-team-drag-index]",
    onDragStart: closeBuilderPopovers,
    onReorder: handleTeamAndBenchDrop,
    shouldAnimateSwapTarget: (sourceIndex, targetIndex) => {
      const firstBenchPokemonIndex = team.length + 1;
      const reordersTeam = sourceIndex < team.length && targetIndex < team.length;
      const reordersBench =
        sourceIndex >= firstBenchPokemonIndex && targetIndex >= firstBenchPokemonIndex;

      return reordersTeam || reordersBench;
    },
  });
  const openMovePickerMoveId =
    openMoveSlot !== null ? (selectedMoves[openMoveSlot]?.id ?? "") : "";
  const calculatedStats = useMemo(
    () => calculateChampionsStats(baseStats, evs, selectedNature),
    [baseStats, evs, selectedNature],
  );
  const knownMegaStoneNames = useMemo(
    () =>
      new Set(itemIndex.filter((item) => item.isMegaStone).map((item) => item.name)),
    [itemIndex],
  );
  const activeHeaderName = activeIndexEntry
    ? formatIdLabel(activeIndexEntry.speciesKey)
    : activeMember?.name;

  function getMemberDisplayName(member: TeamMember) {
    const indexEntry = pokemonIndexByName.get(member.id);

    return indexEntry ? formatIdLabel(indexEntry.speciesKey) : member.name;
  }

  const megaOptions = useMemo(
    () =>
      activeSpeciesKey && activeFormKind !== "regional"
        ? pokemonIndex.filter(
            (entry) =>
              entry.speciesKey === activeSpeciesKey &&
              entry.formKind === "mega" &&
              isExactPokemonFormLegal(
                showdownLegality,
                entry.showdownId,
              ),
          )
        : [],
    [activeFormKind, activeSpeciesKey, pokemonIndex, showdownLegality],
  );
  const visibleMegaOptions = useMemo(() => {
    const seenLabels = new Set<string>();

    return megaOptions.filter((option) => {
      const label = option.formLabel ?? "Mega";
      const key = label.toLowerCase();

      if (seenLabels.has(key)) {
        return false;
      }

      seenLabels.add(key);
      return true;
    });
  }, [megaOptions]);
  const battleFormGroup = getBattleFormGroup(activeSpeciesKey || activePokemonId);
  const activeBattleFormOptionIndexFromPokemon = Math.max(
    0,
    battleFormGroup?.options.findIndex((option) => option.pokemonId === activePokemonId) ?? 0,
  );
  const activeBattleFormOption = battleFormGroup?.options[activeBattleFormOptionIndexFromPokemon];
  const shareMoveCatalog = useMemo(() => {
    const catalog = new Map<string, PokemonMove>();
    const teamMembers = team.filter((slot): slot is TeamMember => Boolean(slot));

    for (const member of [...pool, ...teamMembers]) {
      for (const move of member.moves ?? []) {
        catalog.set(normalizeShowdownId(move.id), move);
        catalog.set(normalizeShowdownId(move.name), move);
      }
    }

    for (const cachedMoves of Object.values(preMegaMovesByPokemonId)) {
      for (const move of cachedMoves) {
        catalog.set(normalizeShowdownId(move.id), move);
        catalog.set(normalizeShowdownId(move.name), move);
      }
    }

    return catalog;
  }, [pool, preMegaMovesByPokemonId, team]);

  const sharePokemonBuilds: Array<PokemonShareBuild | null> = team.map(
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
            (formKind === "form" ? indexEntry?.formLabel : undefined);

      return {
        member,
        displayName: getMemberDisplayName(member),
        formLabel,
        item: itemBySlot[slotIndex] ?? null,
        ability:
          abilityBySlot[slotIndex] ?? member.abilities?.[0] ?? "No ability",
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
  const selectedShareBuild =
    typeof shareImageTarget === "number"
      ? (sharePokemonBuilds[shareImageTarget] ?? null)
      : null;
  const relevantMegaStoneNames = useMemo(
    () => {
      const names = new Set(
        megaOptions
          .map((option) => getMegaStoneItemName(option.name, knownMegaStoneNames))
          .filter((name): name is string => Boolean(name)),
      );
      const activeStone =
        activeFormKind === "mega"
          ? getMegaStoneItemName(activeIndexEntry?.name ?? activePokemonId, knownMegaStoneNames)
          : null;

      if (activeStone) {
        names.add(activeStone);
      }

      return names;
    },
    [
      activeFormKind,
      activeIndexEntry?.name,
      activePokemonId,
      knownMegaStoneNames,
      megaOptions,
    ],
  );
  const activeMegaStoneName =
    activeFormKind === "mega"
      ? getMegaStoneItemName(activeIndexEntry?.name ?? activePokemonId, knownMegaStoneNames)
      : null;
  const activeMegaStoneOption = activeMegaStoneName
    ? itemIndex.find((option) => option.name === activeMegaStoneName)
    : undefined;
  const isItemLocked = Boolean(activeMegaStoneName);
  const megaBaseOption = activeSpeciesKey
    ? pokemonIndex.find(
        (entry) =>
          entry.speciesKey === activeSpeciesKey &&
          entry.isSelectorOption &&
          entry.formKind !== "regional",
      )
    : undefined;
  const savedPreMegaOption = preMegaPokemonBySlot[selectedSlot]
    ? pokemonIndex.find(
        (entry) =>
          entry.name === preMegaPokemonBySlot[selectedSlot] &&
          entry.speciesKey === activeSpeciesKey &&
          entry.formKind !== "mega",
      )
    : undefined;
  const megaReturnOption = savedPreMegaOption ?? megaBaseOption;
  const selectOptions = useMemo(
    (): PokemonSelectOption[] =>
      pokemonIndex.length > 0
        ? pokemonIndex
            .filter((entry) => entry.isSelectorOption)
            .filter((entry) =>
              isPokemonLegal(
                showdownLegality ?? null,
                entry.showdownId,
                entry.speciesKey,
              ),
            )
            .map((entry) => {
              const abilityNamesById = new Map(
                entry.abilities.map((ability) => [normalizeShowdownId(ability), ability]),
              );
              const legalAbilityIds = getLegalAbilities(
                showdownLegality ?? null,
                entry.showdownId,
                entry.speciesKey,
              );
              const abilityIds = legalAbilityIds ?? new Set(abilityNamesById.keys());
              const moveIds = getLegalMoves(
                showdownLegality ?? null,
                entry.showdownId,
                entry.speciesKey,
              );

              return {
                id: entry.name,
                name: entry.displayName,
                number: entry.sortNumber,
                types: entry.types,
                abilityOptions: [...abilityIds].map((abilityId) => ({
                  id: abilityId,
                  name: abilityNamesById.get(abilityId) ?? formatIdLabel(abilityId),
                })),
                moveIds: [...(moveIds ?? [])],
              };
            })
        : pool.map((member) => ({
            id: member.id,
            name: member.name,
            number: 0,
            types: member.types,
            abilityOptions: (member.abilities ?? []).map((ability) => ({
              id: normalizeShowdownId(ability),
              name: ability,
            })),
            moveIds: (member.moves ?? []).map((move) => normalizeShowdownId(move.id)),
          })),
    [pokemonIndex, pool, showdownLegality],
  );
  const candidateFilteredSelectOptions = useMemo(
    () =>
      selectOptions.filter((option) =>
        matchesPokemonCandidateFilters(
          {
            types: option.types,
            abilityIds: option.abilityOptions.map((ability) => ability.id),
            moveIds: option.moveIds,
          },
          activeCandidateFilters,
        ),
      ),
    [activeCandidateFilters, selectOptions],
  );
  const popularSelectOptions = useMemo(() => {
    const optionsByLookup = new Map<string, PokemonSelectOption>();

    for (const option of candidateFilteredSelectOptions) {
      for (const lookup of getPokemonLookupAliases(option.id)) {
        optionsByLookup.set(normalizeShowdownId(lookup), option);
      }
    }

    const seenOptionIds = new Set<string>();
    const orderedOptions: PokemonSelectOption[] = [];

    for (const usageId of usagePokemonIds ?? []) {
      const exactOption = getPokemonLookupAliases(usageId)
        .map((lookup) => optionsByLookup.get(normalizeShowdownId(lookup)))
        .find((option): option is PokemonSelectOption => Boolean(option));
      const baseOption = optionsByLookup.get(
        normalizeShowdownId(getBaseUsageLookup(usageId)),
      );
      const option = exactOption ?? baseOption;

      if (!option || seenOptionIds.has(option.id)) {
        continue;
      }

      seenOptionIds.add(option.id);
      orderedOptions.push(option);
    }

    for (const option of candidateFilteredSelectOptions) {
      if (!seenOptionIds.has(option.id)) {
        orderedOptions.push(option);
      }
    }

    return orderedOptions;
  }, [candidateFilteredSelectOptions, usagePokemonIds]);
  const usageRankByOptionId = useMemo(() => {
    const optionsByLookup = new Map<string, PokemonSelectOption>();

    for (const option of candidateFilteredSelectOptions) {
      for (const lookup of getPokemonLookupAliases(option.id)) {
        optionsByLookup.set(normalizeShowdownId(lookup), option);
      }
    }

    const ranks = new Map<string, number>();

    for (const [usageIndex, usageId] of (usagePokemonIds ?? []).entries()) {
      const exactOption = getPokemonLookupAliases(usageId)
        .map((lookup) => optionsByLookup.get(normalizeShowdownId(lookup)))
        .find((option): option is PokemonSelectOption => Boolean(option));
      const option =
        exactOption ??
        optionsByLookup.get(normalizeShowdownId(getBaseUsageLookup(usageId)));

      if (option && !ranks.has(option.id)) {
        ranks.set(option.id, usageIndex + 1);
      }
    }

    return ranks;
  }, [candidateFilteredSelectOptions, usagePokemonIds]);
  const itemOptions = useMemo(
    () =>
      itemIndex.filter(
        (option) =>
          isItemLegal(showdownLegality ?? null, option.name) &&
          (!knownMegaStoneNames.has(option.name) || relevantMegaStoneNames.has(option.name)),
      ),
    [itemIndex, knownMegaStoneNames, relevantMegaStoneNames, showdownLegality],
  );
  const normalizedNameQuery = nameQuery.trim().toLowerCase();
  const normalizedItemQuery = itemQuery.trim().toLowerCase();
  const normalizedMoveQuery = moveQuery.trim().toLowerCase();
  const normalizedCandidateFilterQuery = candidateFilterQuery.trim().toLowerCase();
  const matchingPokemonOptions = useMemo(
    () =>
      normalizedNameQuery
        ? candidateFilteredSelectOptions
            .filter(
              (option) =>
                option.name.toLowerCase().includes(normalizedNameQuery) ||
                option.id.toLowerCase().includes(normalizedNameQuery) ||
                String(option.number).includes(normalizedNameQuery),
            )
        : popularSelectOptions,
    [candidateFilteredSelectOptions, normalizedNameQuery, popularSelectOptions],
  );
  const filteredOptions = useMemo(
    () => matchingPokemonOptions.slice(0, pokemonOptionLimit),
    [matchingPokemonOptions, pokemonOptionLimit],
  );
  const candidateAbilityOptions = useMemo(() => {
    const optionsById = new Map<string, PokemonCandidateFilterValue>();
    const filtersWithoutAbility = { ...activeCandidateFilters, ability: null };

    for (const option of selectOptions) {
      if (
        !matchesPokemonCandidateFilters(
          {
            types: option.types,
            abilityIds: option.abilityOptions.map((ability) => ability.id),
            moveIds: option.moveIds,
          },
          filtersWithoutAbility,
        )
      ) {
        continue;
      }

      for (const ability of option.abilityOptions) {
        optionsById.set(ability.id, ability);
      }
    }

    return [...optionsById.values()].sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }, [activeCandidateFilters, selectOptions]);
  const candidateMoveById = useMemo(
    () =>
      new Map(
        candidateMoveIndex.map((move) => [normalizeShowdownId(move.id), move]),
      ),
    [candidateMoveIndex],
  );
  const selectedCandidateMoveOptions = useMemo(
    () =>
      activeCandidateFilters.moves.map((filter): CandidateFilterOption => {
        const move = candidateMoveById.get(filter.id);

        return {
          ...filter,
          type: move?.type,
          power: move?.power,
        };
      }),
    [activeCandidateFilters.moves, candidateMoveById],
  );
  const candidateMoveOptions = useMemo(() => {
    const editedMoveIndex = Math.min(
      candidateMoveFilterSlot ?? activeCandidateFilters.moves.length,
      activeCandidateFilters.moves.length,
    );
    const retainedMoves = activeCandidateFilters.moves.filter(
      (_, moveIndex) => moveIndex !== editedMoveIndex,
    );
    const filtersWithoutEditedMove = {
      ...activeCandidateFilters,
      moves: retainedMoves,
    };
    const selectedMoveIds = new Set(retainedMoves.map((move) => move.id));
    const moveIds = new Set<string>();

    for (const option of selectOptions) {
      if (
        !matchesPokemonCandidateFilters(
          {
            types: option.types,
            abilityIds: option.abilityOptions.map((ability) => ability.id),
            moveIds: option.moveIds,
          },
          filtersWithoutEditedMove,
        )
      ) {
        continue;
      }

      for (const moveId of option.moveIds) {
        if (!selectedMoveIds.has(moveId)) {
          moveIds.add(moveId);
        }
      }
    }

    return [...moveIds]
      .map((moveId): CandidateFilterOption => {
        const move = candidateMoveById.get(moveId);
        return {
          id: moveId,
          name: move?.name ?? formatIdLabel(moveId),
          type: move?.type,
          power: move?.power,
        };
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [
    activeCandidateFilters,
    candidateMoveById,
    candidateMoveFilterSlot,
    selectOptions,
  ]);
  const matchingCandidateFilterOptions = useMemo(() => {
    const options: CandidateFilterOption[] =
      openCandidateFilterPicker === "ability"
        ? candidateAbilityOptions
        : candidateMoveOptions;

    return options.filter(
        (option) =>
          !normalizedCandidateFilterQuery ||
          option.name.toLowerCase().includes(normalizedCandidateFilterQuery) ||
          option.id.includes(normalizedCandidateFilterQuery),
      );
  }, [
    candidateAbilityOptions,
    candidateMoveOptions,
    normalizedCandidateFilterQuery,
    openCandidateFilterPicker,
  ]);
  const filteredCandidateFilterOptions = useMemo(
    () => matchingCandidateFilterOptions.slice(0, candidateFilterOptionLimit),
    [candidateFilterOptionLimit, matchingCandidateFilterOptions],
  );
  const filteredItemOptions = useMemo(
    () =>
      normalizedItemQuery
        ? itemOptions
            .filter(
              (option) =>
                option.displayName.toLowerCase().includes(normalizedItemQuery) ||
                option.name.toLowerCase().includes(normalizedItemQuery) ||
                String(option.id).includes(normalizedItemQuery),
            )
        : itemOptions,
    [itemOptions, normalizedItemQuery],
  );
  const visibleItemOptions = useMemo(
    () => filteredItemOptions.slice(0, itemOptionLimit),
    [filteredItemOptions, itemOptionLimit],
  );
  const displayedItemOptions = useMemo(
    () => (activeItem ? [null, ...visibleItemOptions] : visibleItemOptions),
    [activeItem, visibleItemOptions],
  );
  const filteredMoveOptions = useMemo(
    () =>
      normalizedMoveQuery
        ? moves.filter(
            (move) =>
              move.name.toLowerCase().includes(normalizedMoveQuery) ||
              move.id.toLowerCase().includes(normalizedMoveQuery) ||
              move.type.toLowerCase().includes(normalizedMoveQuery),
          )
        : moves,
    [moves, normalizedMoveQuery],
  );
  const visibleMoveOptions = useMemo(
    () => filteredMoveOptions.slice(0, moveOptionLimit),
    [filteredMoveOptions, moveOptionLimit],
  );

  useEffect(() => {
    let isCurrent = true;

    void loadShowdownData()
      .then((snapshot) => {
        if (isCurrent) {
          setCandidateMoveIndex(Object.values(snapshot.movesById));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setCandidateMoveIndex([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (canAddBenchPokemon(bench.length)) {
      setBenchLimitMessage(null);
    }
  }, [bench.length]);

  useEffect(() => {
    setPokemonOptionLimit(optionPageSize);
  }, [activeCandidateFilters, isNamePickerVisible, normalizedNameQuery]);

  useEffect(() => {
    setCandidateFilterOptionLimit(optionPageSize);
    setActiveCandidateFilterOptionIndex(
      matchingCandidateFilterOptions.length > 0 ? 0 : -1,
    );
  }, [
    candidateMoveFilterSlot,
    matchingCandidateFilterOptions.length,
    normalizedCandidateFilterQuery,
    openCandidateFilterPicker,
  ]);

  useEffect(() => {
    setItemOptionLimit(optionPageSize);
  }, [isItemPickerOpen, normalizedItemQuery]);

  useEffect(() => {
    setAbilityOptionLimit(optionPageSize);
  }, [activePokemonId, openTraitPicker]);

  useEffect(() => {
    if (!isNamePickerVisible || usagePokemonIds !== null) {
      return undefined;
    }

    let isCurrent = true;
    setIsUsageOrderLoading(true);
    setUsageOrderError(null);

    void loadSmogonUsagePokemonIds()
      .then((pokemonIds) => {
        if (!isCurrent) {
          return;
        }

        setUsagePokemonIds(pokemonIds);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setUsagePokemonIds([]);
        setUsageOrderError("Popular usage data is unavailable.");
      })
      .finally(() => {
        if (isCurrent) {
          setIsUsageOrderLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isNamePickerVisible, usagePokemonIds]);

  useEffect(() => {
    setActivePokemonOptionIndex((current) => {
      if (filteredOptions.length === 0) {
        return -1;
      }

      return current >= 0 && current < filteredOptions.length ? current : 0;
    });
  }, [filteredOptions]);

  useEffect(() => {
    if (displayedItemOptions.length === 0) {
      setActiveItemOptionIndex(-1);
      return;
    }

    setActiveItemOptionIndex((current) =>
      current >= 0 && current < displayedItemOptions.length
        ? current
        : activeItem && filteredItemOptions.length > 0
          ? 1
          : 0,
    );
  }, [activeItem, displayedItemOptions.length, filteredItemOptions.length, normalizedItemQuery]);

  useEffect(() => {
    if (filteredMoveOptions.length === 0) {
      setActiveMoveOptionIndex(0);
      setHoveredMoveOption(null);
      return;
    }

    const selectedOptionIndex = openMovePickerMoveId
      ? filteredMoveOptions.findIndex((move) => move.id === openMovePickerMoveId)
      : -1;
    const nextOptionIndex =
      selectedOptionIndex >= 0 ? selectedOptionIndex + 1 : filteredMoveOptions.length ? 1 : 0;

    setMoveOptionLimit(
      Math.max(optionPageSize, Math.ceil(nextOptionIndex / optionPageSize) * optionPageSize),
    );

    if (openMoveSlot !== null) {
      requestMoveOptionScroll("start", { preserveExisting: true });
    }

    setActiveMoveOptionIndex(nextOptionIndex);
    setHoveredMoveOption(
      nextOptionIndex > 0 ? (filteredMoveOptions[nextOptionIndex - 1] ?? null) : null,
    );
  }, [
    activePokemonId,
    filteredMoveOptions,
    openMovePickerMoveId,
    openMoveSlot,
    selectedSlot,
  ]);

  useEffect(() => {
    setActiveAbilityOptionIndex(
      selectedAbilityOptionIndex >= 0 ? selectedAbilityOptionIndex : 0,
    );
    setHoveredAbilityOption(null);
  }, [activePokemonId, displayedAbilityOptionKey, selectedAbilityOptionIndex, selectedSlot]);

  useEffect(() => {
    setActiveNaturePosition(getNaturePosition(selectedNature));
  }, [selectedNature]);

  useEffect(() => {
    if (!activeMember) {
      return;
    }

    setAbilityBySlot((current) => {
      const currentAbility = current[selectedSlot];

      if (
        !defaultSelectedAbility ||
        (currentAbility && displayedAbilityOptions.includes(currentAbility))
      ) {
        return current;
      }

      return {
        ...current,
        [selectedSlot]: defaultSelectedAbility,
      };
    });

    setNatureBySlot((current) => {
      if (current[selectedSlot]) {
        return current;
      }

      return {
        ...current,
        [selectedSlot]: selectedNature.id,
      };
    });

    setMoveIdsBySlot((current) => {
      const currentMoveIds = current[selectedSlot] ?? [];
      const defaultMoveIds = moves.slice(0, 4).map((move) => move.id);

      if (defaultMoveIds.length === 0) {
        return current;
      }

      const nextMoveIds = [0, 1, 2, 3].map((index) => {
        const currentMoveId = currentMoveIds[index];

        if (currentMoveId === "") {
          return "";
        }

        const matchedMove = currentMoveId
          ? findMoveByLookup(moves, currentMoveId)
          : null;

        return matchedMove?.id ?? defaultMoveIds[index] ?? "";
      });
      const isUnchanged =
        currentMoveIds.length === nextMoveIds.length &&
        currentMoveIds.every((moveId, index) => moveId === nextMoveIds[index]);

      if (isUnchanged) {
        return current;
      }

      return {
        ...current,
        [selectedSlot]: nextMoveIds,
      };
    });
  }, [
    activeMember,
    defaultSelectedAbility,
    displayedAbilityOptions,
    moves,
    selectedNature.id,
    selectedSlot,
    setAbilityBySlot,
    setMoveIdsBySlot,
    setNatureBySlot,
  ]);

  useEffect(() => {
    namePickerRef.current
      ?.querySelector(".pokemon-name-option[aria-selected='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [activePokemonOptionIndex]);

  useEffect(() => {
    itemPickerRef.current
      ?.querySelector(".item-option[aria-selected='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [activeItemOptionIndex]);

  useEffect(() => {
    traitPickerRef.current
      ?.querySelector(".trait-option[aria-selected='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [activeAbilityOptionIndex]);

  useEffect(() => {
    const scrollMode = moveOptionScrollModeRef.current;

    if (!scrollMode) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const resultsElement = moveResultsRef.current;
      const selectedOption = resultsElement?.querySelector<HTMLElement>(
        ".move-option[aria-selected='true']",
      );

      moveOptionScrollModeRef.current = null;

      if (!resultsElement || !selectedOption) {
        return;
      }

      if (scrollMode === "nearest") {
        selectedOption.scrollIntoView({ block: "nearest" });
        return;
      }

      const resultsRect = resultsElement.getBoundingClientRect();
      const selectedRect = selectedOption.getBoundingClientRect();

      resultsElement.scrollTop += selectedRect.top - resultsRect.top;
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeMoveOptionIndex, openMoveSlot, visibleMoveOptions]);

  useEffect(() => {
    if (!isNamePickerVisible || !activeMember) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!namePickerRef.current?.contains(event.target as Node)) {
        setIsNamePickerOpen(false);
        setNameQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeMember, isNamePickerVisible]);

  useEffect(() => {
    if (!openCandidateFilterPicker) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!candidateFilterPickerRef.current?.contains(event.target as Node)) {
        setOpenCandidateFilterPicker(null);
        setCandidateFilterQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openCandidateFilterPicker]);

  useEffect(() => {
    setOpenCandidateFilterPicker(null);
    setCandidateMoveFilterSlot(null);
    setCandidateFilterQuery("");
  }, [selectedSlot]);

  useEffect(() => {
    if (!isBattleFormPickerOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!battleFormPickerRef.current?.contains(event.target as Node)) {
        setIsBattleFormPickerOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isBattleFormPickerOpen]);

  useEffect(() => {
    setIsBattleFormPickerOpen(false);
    setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
  }, [activeBattleFormOptionIndexFromPokemon, selectedSlot]);

  useEffect(() => {
    if (pendingClearSlot === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        clearConfirmRef.current?.contains(target) ||
        showdownToolbarRef.current?.contains(target)
      ) {
        return;
      }

      setPendingClearSlot(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [pendingClearSlot]);

  useEffect(() => {
    if (!isItemPickerOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!itemPickerRef.current?.contains(event.target as Node)) {
        setIsItemPickerOpen(false);
        setItemQuery("");
        setHoveredItemOption(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isItemPickerOpen]);

  useEffect(() => {
    if (!openTraitPicker) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!traitPickerRef.current?.contains(event.target as Node)) {
        setOpenTraitPicker(null);
        setHoveredAbilityOption(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openTraitPicker]);

  useEffect(() => {
    if (openMoveSlot === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!movePickerRef.current?.contains(event.target as Node)) {
        closeMovePicker();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMoveSlot]);

  useEffect(() => {
    if (!isShowdownPanelOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        showdownPanelRef.current?.contains(target) ||
        showdownToolbarRef.current?.contains(target)
      ) {
        return;
      }

      setIsShowdownPanelOpen(false);
      setShowdownPanelMessage(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isShowdownPanelOpen]);

  useEffect(() => {
    if (!isShowdownPanelOpen) {
      return;
    }

    showdownTextareaRef.current?.focus();
    showdownTextareaRef.current?.select();
  }, [isShowdownPanelOpen]);

  useEffect(() => {
    if (!isValidityPanelOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        validityPanelRef.current?.contains(target) ||
        showdownToolbarRef.current?.contains(target)
      ) {
        return;
      }

      setIsValidityPanelOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isValidityPanelOpen]);

  useEffect(() => {
    if (!isBenchOpen) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (!benchShellRef.current?.contains(event.target as Node)) {
        setIsBenchOpen(false);
        setPendingBenchRemovalId(null);
      }
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [isBenchOpen]);

  useEffect(() => {
    if (!activeMegaStoneName || !activeMegaStoneOption) {
      return;
    }

    const item = itemFromIndexEntry(activeMegaStoneOption);

    setItemBySlot((current) =>
      current[selectedSlot]?.id === activeMegaStoneName
        ? current
        : {
            ...current,
            [selectedSlot]: item,
          },
    );
    setIsItemPickerOpen(false);
    setItemQuery("");
    setHoveredItemOption(null);
  }, [activeMegaStoneName, activeMegaStoneOption, selectedSlot, setItemBySlot]);

  useEffect(() => {
    if (!activeItem || activeItem.category !== "Mega Stones") {
      return;
    }

    const isItemAvailableForActivePokemon = itemOptions.some(
      (option) => option.name === activeItem.id,
    );

    if (activeMegaStoneName || isItemAvailableForActivePokemon) {
      return;
    }

    setItemBySlot((current) => ({
      ...current,
      [selectedSlot]: null,
    }));
  }, [
    activeItem,
    activeMegaStoneName,
    itemOptions,
    selectedSlot,
    setItemBySlot,
  ]);

  useEffect(() => {
    if (
      !preMegaPokemonId ||
      preMegaPokemonId === activePokemonId ||
      preMegaMovesByPokemonId[preMegaPokemonId] !== undefined
    ) {
      return;
    }

    let isCurrent = true;

    void (async () => {
      try {
        const preMegaMember = await fetchPokemon(preMegaPokemonId);

        if (!isCurrent) {
          return;
        }

        setPreMegaMovesByPokemonId((current) => ({
          ...current,
          [preMegaPokemonId]: preMegaMember.moves ?? [],
        }));
      } catch {
        if (!isCurrent) {
          return;
        }

        setPreMegaMovesByPokemonId((current) => ({
          ...current,
          [preMegaPokemonId]: [],
        }));
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [activePokemonId, preMegaMovesByPokemonId, preMegaPokemonId]);

  function closeNamePicker() {
    setIsNamePickerOpen(false);
    setNameQuery("");
  }

  function togglePokemonType(type: PokemonType) {
    patchSlot(selectedSlot, {
      candidateFilters: {
        ...activeCandidateFilters,
        types: togglePokemonTypeFilter(activeCandidateFilters.types, type),
      },
    });
    setActivePokemonOptionIndex(0);
  }

  function closeCandidateFilterPicker() {
    setOpenCandidateFilterPicker(null);
    setCandidateMoveFilterSlot(null);
    setCandidateFilterQuery("");
  }

  function openCandidatePicker(picker: CandidateFilterPicker) {
    setCandidateMoveFilterSlot(null);
    setOpenCandidateFilterPicker((current) => (current === picker ? null : picker));
    setCandidateFilterQuery("");
    setCandidateFilterOptionLimit(optionPageSize);
    setActiveCandidateFilterOptionIndex(0);
  }

  function openCandidateMovePicker(slotIndex: number) {
    const isSameOpenSlot =
      openCandidateFilterPicker === "move" &&
      candidateMoveFilterSlot === slotIndex;

    setOpenCandidateFilterPicker(isSameOpenSlot ? null : "move");
    setCandidateMoveFilterSlot(isSameOpenSlot ? null : slotIndex);
    setCandidateFilterQuery("");
    setCandidateFilterOptionLimit(optionPageSize);
    setActiveCandidateFilterOptionIndex(0);
  }

  function selectCandidateFilterOption(option: CandidateFilterOption) {
    if (openCandidateFilterPicker === "ability") {
      patchSlot(selectedSlot, {
        candidateFilters: { ...activeCandidateFilters, ability: option },
      });
      closeCandidateFilterPicker();
      return;
    }

    if (openCandidateFilterPicker === "move") {
      const targetIndex = Math.min(
        candidateMoveFilterSlot ?? activeCandidateFilters.moves.length,
        activeCandidateFilters.moves.length,
      );
      const nextMoves = [...activeCandidateFilters.moves];
      nextMoves[targetIndex] = { id: option.id, name: option.name };

      patchSlot(selectedSlot, {
        candidateFilters: {
          ...activeCandidateFilters,
          moves: nextMoves,
        },
      });
      closeCandidateFilterPicker();
    }
  }

  function moveCandidateFilterKeyboardOption(direction: 1 | -1) {
    const hasClearMoveOption =
      openCandidateFilterPicker === "move" &&
      candidateMoveFilterSlot !== null &&
      Boolean(activeCandidateFilters.moves[candidateMoveFilterSlot]);
    setActiveCandidateFilterOptionIndex((current) => {
      const nextIndex = getNextOptionIndex(
        current,
        matchingCandidateFilterOptions.length + (hasClearMoveOption ? 1 : 0),
        direction,
      );
      const optionIndex = nextIndex - (hasClearMoveOption ? 1 : 0);

      if (optionIndex >= candidateFilterOptionLimit) {
        setCandidateFilterOptionLimit((limit) =>
          getExpandedOptionLimit(limit, matchingCandidateFilterOptions.length),
        );
      }

      return nextIndex;
    });
  }

  function handleCandidateFilterMenuScroll(event: UIEvent<HTMLDivElement>) {
    if (
      filteredCandidateFilterOptions.length >= matchingCandidateFilterOptions.length ||
      !isNearOptionListEnd(event.currentTarget)
    ) {
      return;
    }

    setCandidateFilterOptionLimit((current) =>
      getExpandedOptionLimit(current, matchingCandidateFilterOptions.length),
    );
  }

  function closeItemPicker() {
    setIsItemPickerOpen(false);
    setItemQuery("");
    setHoveredItemOption(null);
  }

  function closeTraitPicker() {
    setOpenTraitPicker(null);
    setHoveredAbilityOption(null);
  }

  function closeMovePicker() {
    setOpenMoveSlot(null);
    setMoveQuery("");
    setHoveredMoveOption(null);
    moveOptionScrollModeRef.current = null;
  }

  function closeBuilderPopovers() {
    setPendingClearSlot(null);
    closeNamePicker();
    setIsBattleFormPickerOpen(false);
    closeItemPicker();
    closeTraitPicker();
    closeMovePicker();
    setIsShowdownPanelOpen(false);
    setIsValidityPanelOpen(false);
  }

  function requestMoveOptionScroll(
    mode: MoveOptionScrollMode,
    options: { preserveExisting?: boolean } = {},
  ) {
    if (options.preserveExisting && moveOptionScrollModeRef.current) {
      return;
    }

    moveOptionScrollModeRef.current = mode;
  }

  function getMoveOptionIndex(moveId: string) {
    const selectedOptionIndex = moves.findIndex((option) => option.id === moveId);

    return selectedOptionIndex >= 0 ? selectedOptionIndex + 1 : moves.length ? 1 : 0;
  }

  function setMoveOptionPreview(optionIndex: number) {
    setActiveMoveOptionIndex(optionIndex);
    setHoveredMoveOption(optionIndex > 0 ? (moves[optionIndex - 1] ?? null) : null);
  }

  function toggleMovePicker(index: number, moveId: string) {
    if (openMoveSlot === index) {
      setSuppressedMoveTooltipSlot(index);
      closeMovePicker();
      return;
    }

    setSuppressedMoveTooltipSlot(null);
    requestMoveOptionScroll("start");
    const selectedOptionIndex = getMoveOptionIndex(moveId);

    setMoveOptionLimit(
      Math.max(
        optionPageSize,
        Math.ceil(selectedOptionIndex / optionPageSize) * optionPageSize,
      ),
    );
    setMoveOptionPreview(selectedOptionIndex);
    setMoveQuery("");
    setOpenMoveSlot(index);
  }

  function reorderMoves(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    setMoveIdsBySlot((current) => {
      const currentMoveIds = current[selectedSlot] ?? [];
      const nextMoveIds = selectedMoves.map(
        (move, index) => currentMoveIds[index] ?? move?.id ?? "",
      );
      const sourceMoveId = nextMoveIds[sourceIndex];

      if (!sourceMoveId) {
        return current;
      }

      [nextMoveIds[sourceIndex], nextMoveIds[targetIndex]] = [
        nextMoveIds[targetIndex],
        sourceMoveId,
      ];

      return {
        ...current,
        [selectedSlot]: nextMoveIds,
      };
    });
  }

  function handleReorderTeamSlots(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex || !team[sourceIndex]) {
      return;
    }

    onReorderSlots(sourceIndex, targetIndex);
    onSelectedSlotChange(
      getIndexAfterSwap(selectedSlot, sourceIndex, targetIndex),
    );
  }

  function tryMoveTeamPokemonToBench(sourceIndex: number) {
    setIsBenchOpen(true);

    if (!canAddBenchPokemon(bench.length)) {
      setBenchLimitMessage(
        `Bench limit reached (${bench.length}/${MAX_BENCH_POKEMON}). Delete one first.`,
      );
      return false;
    }

    setBenchLimitMessage(null);
    onMoveTeamPokemonToBench(sourceIndex);
    return true;
  }

  function handleTeamAndBenchDrop(sourceIndex: number, targetIndex: number) {
    const benchTabIndex = team.length;
    const firstBenchPokemonIndex = benchTabIndex + 1;

    if (sourceIndex < benchTabIndex) {
      if (targetIndex < benchTabIndex) {
        handleReorderTeamSlots(sourceIndex, targetIndex);
        return;
      }

      tryMoveTeamPokemonToBench(sourceIndex);
      onSelectedSlotChange(sourceIndex);
      return;
    }

    if (sourceIndex < firstBenchPokemonIndex) {
      return;
    }

    const benchIndex = sourceIndex - firstBenchPokemonIndex;

    if (targetIndex < benchTabIndex) {
      closeBuilderPopovers();
      onMoveBenchPokemonToTeam(benchIndex, targetIndex);
      return;
    }

    if (targetIndex >= firstBenchPokemonIndex) {
      onReorderBenchPokemon(
        benchIndex,
        targetIndex - firstBenchPokemonIndex,
      );
    }
  }

  function selectTeamSlot(index: number) {
    const member = team[index];

    onSelectedSlotChange(index);
    closeBuilderPopovers();

    if (!member) {
      setIsNamePickerOpen(true);
      setNameQuery("");
    }
  }

  function handleTeamTabClick(index: number) {
    if (teamReorder.shouldSuppressClick()) {
      return;
    }

    setIsBenchOpen(false);
    setPendingBenchRemovalId(null);
    selectTeamSlot(index);
  }

  function handleTeamTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (event.altKey && event.key === "End" && team[sourceIndex]) {
      event.preventDefault();
      closeBuilderPopovers();
      tryMoveTeamPokemonToBench(sourceIndex);
      return;
    }

    const isPrevious = event.key === "ArrowUp" || event.key === "ArrowLeft";
    const isNext = event.key === "ArrowDown" || event.key === "ArrowRight";

    if (!event.altKey || (!isPrevious && !isNext) || !team[sourceIndex]) {
      return;
    }

    event.preventDefault();
    closeBuilderPopovers();

    const targetIndex = Math.max(
      0,
      Math.min(team.length - 1, sourceIndex + (isPrevious ? -1 : 1)),
    );

    if (targetIndex === sourceIndex) {
      return;
    }

    handleReorderTeamSlots(sourceIndex, targetIndex);
    window.requestAnimationFrame(() => {
      builderCardLayoutRef.current
        ?.querySelector<HTMLButtonElement>(
          `button[data-team-slot-index="${targetIndex}"], [data-team-slot-index="${targetIndex}"] .team-tab`,
        )
        ?.focus();
    });
  }

  function handleBenchPokemonClick(benchIndex: number) {
    if (teamReorder.shouldSuppressClick()) {
      return;
    }

    closeBuilderPopovers();
    onMoveBenchPokemonToTeam(benchIndex, selectedSlot);
  }

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
      Math.min(bench.length - 1, benchIndex + (event.key === "ArrowUp" ? -1 : 1)),
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

  function handleMovePillKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
      return;
    }

    event.preventDefault();
    closeMovePicker();

    const direction = event.key === "ArrowUp" ? -1 : 1;
    const targetIndex = Math.max(
      0,
      Math.min(selectedMoves.length - 1, sourceIndex + direction),
    );

    if (targetIndex === sourceIndex) {
      return;
    }

    reorderMoves(sourceIndex, targetIndex);
    window.requestAnimationFrame(() => {
      movePickerRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-move-slot-index="${targetIndex}"] .move-pill`,
        )
        ?.focus();
    });
  }

  function handleClearSlot(slotIndex: number) {
    onClearSlot(slotIndex);
    clearSlot(slotIndex);
    setPendingClearSlot(null);
    if (slotIndex === selectedSlot) {
      setIsNamePickerOpen(true);
      setNameQuery("");
    } else {
      closeNamePicker();
    }
    closeItemPicker();
    closeTraitPicker();
    closeMovePicker();
  }

  function handleSelectOption(value: string, applyUsageStats = false) {
    closeNamePicker();

    if (pokemonIndex.length === 0) {
      onChangeSlot(selectedSlot, value);
      patchSlot(selectedSlot, { candidateFilters: null });
      return;
    }

    void onSelectPokemon(selectedSlot, value, { applyUsageStats });
  }

  function handleToggleMega(optionName: string, isActiveMega: boolean) {
    if (isActiveMega) {
      if (megaReturnOption) {
        handleSelectOption(megaReturnOption.name);
      }

      return;
    }

    if (activePokemonId && activeFormKind !== "mega") {
      setPreMegaPokemonBySlot((current) => ({
        ...current,
        [selectedSlot]: activePokemonId,
      }));
    }

    handleSelectOption(optionName);
  }

  function handleSelectBattleForm(optionName: string) {
    setIsBattleFormPickerOpen(false);
    void onSelectPokemon(selectedSlot, optionName, { allowBattleForm: true });
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
      handleSelectBattleForm(
        battleFormGroup.options[activeBattleFormOptionIndex].pokemonId,
      );
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;

    if (!isBattleFormPickerOpen) {
      setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
      setIsBattleFormPickerOpen(true);
      return;
    }

    setActiveBattleFormOptionIndex((current) =>
      (current + direction + battleFormGroup.options.length) %
      battleFormGroup.options.length,
    );
  }

  function handleSelectItem(value: string) {
    closeItemPicker();

    if (isItemLocked) {
      return;
    }

    const option = itemIndex.find((entry) => entry.name === value);

    if (option) {
      setItemBySlot((current) => ({
        ...current,
        [selectedSlot]: itemFromIndexEntry(option),
      }));
    }
  }

  function clearItem() {
    if (isItemLocked) {
      return;
    }

    setItemBySlot((current) => ({
      ...current,
      [selectedSlot]: null,
    }));
    closeItemPicker();
  }

  function previewItem(itemId: string, fallbackItem: PokemonItem) {
    const lookup = normalizeShowdownId(itemId);
    const option = itemIndex.find(
      (entry) =>
        normalizeShowdownId(entry.name) === lookup ||
        normalizeShowdownId(entry.showdownId) === lookup,
    );

    setHoveredItemOption(option ? itemFromIndexEntry(option) : fallbackItem);
  }

  async function previewAbility(abilityName: string) {
    const abilityId = normalizeShowdownId(abilityName);

    if (!abilityId || !activeMember) {
      return;
    }

    const cachedAbility = abilityDetailsByName[abilityId];
    const fallbackAbility: PokemonAbility = {
      id: abilityId,
      name: abilityName,
    };

    setHoveredAbilityOption(cachedAbility ?? fallbackAbility);

    if (cachedAbility?.effect || cachedAbility?.shortEffect) {
      return;
    }

    try {
      const ability = await fetchAbility(abilityName);

      setAbilityDetailsByName((current) => ({
        ...current,
        [abilityId]: ability,
      }));
      setHoveredAbilityOption((current) =>
        current?.id === abilityId ? ability : current,
      );
    } catch {
      // Keep the name-only preview when the local Showdown catalog is unavailable.
    }
  }

  function movePokemonKeyboardOption(direction: 1 | -1) {
    setActivePokemonOptionIndex((current) =>
      getNextOptionIndex(current, filteredOptions.length, direction),
    );
  }

  function selectActivePokemonOption() {
    const option = getActiveOption(filteredOptions, activePokemonOptionIndex);

    if (option) {
      handleSelectOption(option.id, true);
    }
  }

  function handlePokemonMenuScroll(event: UIEvent<HTMLDivElement>) {
    if (
      filteredOptions.length >= matchingPokemonOptions.length ||
      !isNearOptionListEnd(event.currentTarget)
    ) {
      return;
    }

    setPokemonOptionLimit((current) =>
      getExpandedOptionLimit(current, matchingPokemonOptions.length),
    );
  }

  function getItemOptionAt(index: number) {
    if (activeItem) {
      return index === 0 ? null : filteredItemOptions[index - 1];
    }

    return filteredItemOptions[index];
  }

  function previewItemOptionAt(index: number) {
    const option = getItemOptionAt(index);

    if (!option) {
      setHoveredItemOption(null);
      return;
    }

    previewItem(option.name, itemFromIndexEntry(option));
  }

  function moveItemKeyboardOption(direction: 1 | -1) {
    setActiveItemOptionIndex((current) => {
      const totalOptionCount = filteredItemOptions.length + (activeItem ? 1 : 0);
      const nextIndex = getNextOptionIndex(current, totalOptionCount, direction);

      if (nextIndex - (activeItem ? 1 : 0) >= itemOptionLimit) {
        setItemOptionLimit((limit) =>
          getExpandedOptionLimit(limit, filteredItemOptions.length),
        );
      }

      previewItemOptionAt(nextIndex);
      return nextIndex;
    });
  }

  function selectActiveItemOption() {
    const option = getItemOptionAt(
      activeItemOptionIndex >= 0 ? activeItemOptionIndex : 0,
    );

    if (option === null) {
      clearItem();
      return;
    }

    if (option) {
      handleSelectItem(option.name);
    }
  }

  function handleItemMenuScroll(event: UIEvent<HTMLDivElement>) {
    if (
      visibleItemOptions.length >= filteredItemOptions.length ||
      !isNearOptionListEnd(event.currentTarget)
    ) {
      return;
    }

    setItemOptionLimit((current) =>
      getExpandedOptionLimit(current, filteredItemOptions.length),
    );
  }

  function previewAbilityOptionAt(index: number) {
    const ability = displayedAbilityOptions[index];

    if (ability) {
      void previewAbility(ability);
    }
  }

  function selectAbility(ability: string) {
    setAbilityBySlot((current) => ({
      ...current,
      [selectedSlot]: ability,
    }));
    closeTraitPicker();
  }

  function openAbilityPickerFromKeyboard(direction: 1 | -1) {
    const selectedIndex = displayedAbilityOptions.findIndex(
      (ability) => ability === selectedAbility,
    );
    const fallbackIndex = direction > 0 ? 0 : displayedAbilityOptions.length - 1;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex;

    setOpenTraitPicker("ability");
    setActiveAbilityOptionIndex(nextIndex);
    previewAbilityOptionAt(nextIndex);
  }

  function moveAbilityKeyboardOption(direction: 1 | -1) {
    setActiveAbilityOptionIndex((current) => {
      const nextIndex = getNextOptionIndex(
        current,
        displayedAbilityOptions.length,
        direction,
      );

      if (nextIndex >= abilityOptionLimit) {
        setAbilityOptionLimit((limit) =>
          getExpandedOptionLimit(limit, displayedAbilityOptions.length),
        );
      }

      previewAbilityOptionAt(nextIndex);
      return nextIndex;
    });
  }

  function handleAbilityMenuScroll(event: UIEvent<HTMLDivElement>) {
    if (
      visibleAbilityOptions.length >= displayedAbilityOptions.length ||
      !isNearOptionListEnd(event.currentTarget)
    ) {
      return;
    }

    setAbilityOptionLimit((current) =>
      getExpandedOptionLimit(current, displayedAbilityOptions.length),
    );
  }

  function selectActiveAbilityOption() {
    const ability = getActiveOption(displayedAbilityOptions, activeAbilityOptionIndex);

    if (ability) {
      selectAbility(ability);
    }
  }

  function openNaturePickerFromKeyboard() {
    setOpenTraitPicker("nature");
    setActiveNaturePosition(getNaturePosition(selectedNature));
  }

  function moveNatureKeyboardPosition(upDelta: number, downDelta: number) {
    setActiveNaturePosition((current) => ({
      upIndex:
        (current.upIndex + upDelta + battleStatKeys.length) % battleStatKeys.length,
      downIndex:
        (current.downIndex + downDelta + battleStatKeys.length) % battleStatKeys.length,
    }));
  }

  function selectActiveNature() {
    const nature = getNatureFromPosition(activeNaturePosition);

    setNatureBySlot((current) => ({
      ...current,
      [selectedSlot]: nature.id,
    }));
  }

  function moveMoveKeyboardOption(direction: 1 | -1) {
    setActiveMoveOptionIndex((current) => {
      const nextIndex = getNextOptionIndex(
        current,
        filteredMoveOptions.length + 1,
        direction,
      );

      if (nextIndex > moveOptionLimit) {
        setMoveOptionLimit((limit) =>
          getExpandedOptionLimit(limit, filteredMoveOptions.length),
        );
      }

      moveOptionScrollModeRef.current = "nearest";
      setHoveredMoveOption(
        nextIndex > 0 ? (filteredMoveOptions[nextIndex - 1] ?? null) : null,
      );
      return nextIndex;
    });
  }

  function handleMoveMenuScroll(event: UIEvent<HTMLDivElement>) {
    if (
      visibleMoveOptions.length >= filteredMoveOptions.length ||
      !isNearOptionListEnd(event.currentTarget)
    ) {
      return;
    }

    setMoveOptionLimit((current) =>
      getExpandedOptionLimit(current, filteredMoveOptions.length),
    );
  }

  function selectActiveMoveOption(slotIndex: number) {
    if (activeMoveOptionIndex === 0) {
      clearMove(slotIndex);
      return;
    }

    const move = filteredMoveOptions[activeMoveOptionIndex - 1];

    if (move) {
      selectMove(slotIndex, move.id);
    }
  }

  function updateEv(stat: StatKey, value: string) {
    const nextValue = Number.parseInt(value, 10);

    setEvsBySlot((current) => ({
      ...current,
      [selectedSlot]: (() => {
        const slotEvs = current[selectedSlot] ?? defaultEvs;
        const otherEvTotal = statKeys.reduce(
          (total, currentStat) => total + (currentStat === stat ? 0 : slotEvs[currentStat]),
          0,
        );
        const maxAllowed = Math.min(
          CHAMPIONS_MAX_EV_PER_STAT,
          Math.max(0, CHAMPIONS_MAX_EV_TOTAL - otherEvTotal),
        );
        const normalized = Number.isNaN(nextValue)
          ? 0
          : Math.max(0, Math.min(maxAllowed, nextValue));

        return {
          ...slotEvs,
          [stat]: normalized,
        };
      })(),
    }));
  }

  function getMaxAllowedEv(stat: StatKey) {
    return Math.min(
      CHAMPIONS_MAX_EV_PER_STAT,
      Math.max(0, CHAMPIONS_MAX_EV_TOTAL - (evTotal - evs[stat])),
    );
  }

  function selectMove(slotIndex: number, moveId: string) {
    setMoveIdsBySlot((current) => {
      const nextMoves = [...(current[selectedSlot] ?? [])];
      nextMoves[slotIndex] = moveId;

      return {
        ...current,
        [selectedSlot]: nextMoves,
      };
    });
    closeMovePicker();
  }

  function clearMove(slotIndex: number) {
    setMoveIdsBySlot((current) => {
      const nextMoves = [0, 1, 2, 3].map(
        (index) => current[selectedSlot]?.[index] ?? selectedMoves[index]?.id ?? "",
      );
      nextMoves[slotIndex] = "";

      return {
        ...current,
        [selectedSlot]: nextMoves,
      };
    });
    closeMovePicker();
  }

  function toggleShowdownPanel() {
    if (isShowdownPanelOpen) {
      setIsShowdownPanelOpen(false);
      setShowdownPanelMessage(null);
      return;
    }

    setIsValidityPanelOpen(false);
    setShowdownText(onExportShowdown(selectedSlot));
    setIsShowdownPanelOpen(true);
    setShowdownPanelMessage(null);
  }

  async function copyShowdownText() {
    try {
      await navigator.clipboard.writeText(showdownText);
      setShowdownPanelMessage("Copied to clipboard.");
    } catch {
      setShowdownPanelMessage("Copy failed. Select the text manually.");
    }
  }

  async function importShowdownText() {
    setIsImportingShowdown(true);
    setShowdownPanelMessage(null);

    try {
      await onImportShowdown(selectedSlot, showdownText);
      setIsShowdownPanelOpen(false);
      setShowdownText("");
    } catch (error) {
      setShowdownPanelMessage(
        error instanceof Error ? error.message : "Showdown import failed.",
      );
    } finally {
      setIsImportingShowdown(false);
    }
  }

  return (
    <section className="builder-stage" aria-label="Team builder">
      <div
        className="builder-card-toolbar"
        aria-label="Builder tools"
        ref={showdownToolbarRef}
      >
        {team.some(Boolean) ? (
          <button
            className={`builder-card-tool-button validity-trigger is-${
              showdownLegalityStatus === "loading"
                ? "loading"
                : showdownLegalityStatus === "error"
                  ? "unavailable"
                  : validity.status
            }`}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isValidityPanelOpen}
            title="Regulation M-B validity"
            onClick={() => {
              setPendingClearSlot(null);
              setIsShowdownPanelOpen(false);
              setIsValidityPanelOpen((isOpen) => !isOpen);
            }}
          >
            <FontAwesomeIcon
              icon={
                showdownLegalityStatus === "loading"
                  ? faSpinner
                  : showdownLegalityStatus === "error"
                    ? faCircleQuestion
                  : validity.status === "invalid"
                  ? faTriangleExclamation
                  : validity.status === "unavailable"
                    ? faCircleQuestion
                    : faCircleCheck
              }
              className={showdownLegalityStatus === "loading" ? "is-spinning" : undefined}
              aria-hidden="true"
            />
            {showdownLegalityStatus === "loading"
              ? "Loading"
              : showdownLegalityStatus === "error"
                ? "Unavailable"
              : validity.status === "invalid"
              ? `${validity.errorCount} ${validity.errorCount === 1 ? "Issue" : "Issues"}`
              : validity.status === "unavailable"
                ? "Unavailable"
                : "Valid"}
          </button>
        ) : null}
        <button className="builder-card-tool-button" type="button" onClick={toggleShowdownPanel}>
          <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
          Showdown Text
        </button>
        {activeMember ? (
          <button
            className="builder-card-tool-button"
            type="button"
            title={`Create an image of ${activeHeaderName}`}
            onClick={() => {
              closeBuilderPopovers();
              setIsBenchOpen(false);
              setPendingBenchRemovalId(null);
              setShareImageTarget(selectedSlot);
            }}
          >
            <FontAwesomeIcon icon={faImage} aria-hidden="true" />
            Image
          </button>
        ) : null}
        {activeMember ? (
          <button
            className="builder-card-tool-button is-danger"
            type="button"
            onClick={() => {
              setIsShowdownPanelOpen(false);
              setIsValidityPanelOpen(false);
              setPendingClearSlot((currentSlot) =>
                currentSlot === selectedSlot ? null : selectedSlot,
              );
            }}
          >
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
            Delete
          </button>
        ) : null}
      </div>

      {isValidityPanelOpen ? (
        <div
          className={`validity-panel is-${
            showdownLegalityStatus === "loading"
              ? "loading"
              : showdownLegalityStatus === "error"
                ? "unavailable"
                : validity.status
          }`}
          role="dialog"
          aria-label="Regulation M-B validity"
          ref={validityPanelRef}
        >
          <div className="validity-panel-header">
            <span className="validity-panel-icon" aria-hidden="true">
              <FontAwesomeIcon
                icon={
                  showdownLegalityStatus === "loading"
                    ? faSpinner
                    : showdownLegalityStatus === "error"
                      ? faCircleQuestion
                    : validity.status === "invalid"
                    ? faTriangleExclamation
                    : validity.status === "unavailable"
                      ? faCircleQuestion
                      : faCircleCheck
                }
                className={showdownLegalityStatus === "loading" ? "is-spinning" : undefined}
              />
            </span>
            <div>
              <strong>
                {showdownLegalityStatus === "loading"
                  ? "Loading validity data"
                  : showdownLegalityStatus === "error"
                    ? "Validity data unavailable"
                  : validity.status === "invalid"
                  ? "Team has validity issues"
                  : validity.status === "unavailable"
                    ? "Validity data unavailable"
                    : "Team is valid"}
              </strong>
              <span>Regulation M-B</span>
            </div>
          </div>
          {showdownLegalityStatus === "loading" ? (
            <DataStatusRow message="Refreshing Regulation M-B data" isLoading />
          ) : showdownLegalityStatus === "error" ? (
            <DataStatusRow
              message={showdownLegalityError ?? "Regulation M-B data is unavailable."}
              onRetry={onRetryShowdownLegality}
            />
          ) : displayedValidityIssues.length > 0 ? (
            <ul className="validity-issue-list">
              {displayedValidityIssues.map((issue) => (
                <li className={`is-${issue.severity}`} key={issue.id}>
                  {issue.slotIndex !== undefined ? (
                    <span className="validity-slot-label">Slot {issue.slotIndex + 1}</span>
                  ) : null}
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="validity-success-message">
              All configured choices pass the current legality checks.
            </p>
          )}
        </div>
      ) : null}

      {activeMember && pendingClearSlot === selectedSlot ? (
        <div
          className="clear-pokemon-confirm"
          role="dialog"
          aria-label="Confirm Pokemon deletion"
          ref={clearConfirmRef}
        >
          <strong>Delete this Pokemon?</strong>
          <span>This cannot be undone.</span>
          <div className="clear-pokemon-confirm-actions">
            <button
              className="clear-pokemon-confirm-button"
              type="button"
              onClick={() => setPendingClearSlot(null)}
            >
              Cancel
            </button>
            <button
              className="clear-pokemon-confirm-button is-danger"
              type="button"
              onClick={() => handleClearSlot(selectedSlot)}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {isShowdownPanelOpen ? (
        <div
          className="showdown-panel"
          role="dialog"
          aria-label="Showdown text"
          ref={showdownPanelRef}
        >
          <div className="showdown-panel-header">
            <strong>Pokemon Showdown Text</strong>
          </div>
          <textarea
            className="showdown-textarea"
            ref={showdownTextareaRef}
            value={showdownText}
            placeholder="Paste Showdown text here..."
            onChange={(event) => setShowdownText(event.target.value)}
          />
          <div className="showdown-panel-actions">
            {showdownPanelMessage ? (
              <span className="showdown-panel-message">{showdownPanelMessage}</span>
            ) : (
              <span />
            )}
            <div className="showdown-panel-button-group">
              <button
                className="showdown-panel-button"
                type="button"
                disabled={isImportingShowdown}
                onClick={importShowdownText}
              >
                <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
                {isImportingShowdown ? "Importing..." : "Import"}
              </button>
              <button
                className="showdown-panel-button"
                type="button"
                onClick={copyShowdownText}
              >
                <FontAwesomeIcon icon={faFileExport} aria-hidden="true" />
                Export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="builder-card-layout" ref={builderCardLayoutRef}>
        <div
          className={`team-tabs ${teamReorder.isDragging ? "is-reordering" : ""}`}
          aria-label="Current team"
          ref={teamTabsRef}
        >
        {team.map((member, index) => {
          const displacement = getReorderDisplacement(teamReorder.dragState, index);
          const railItem = itemBySlot[index] ?? null;
          const railDisplayName = member ? getMemberDisplayName(member) : "";
          const isActiveRailSlot = selectedSlot === index;

          return (
            <div
            className={`team-tab-shell ${isActiveRailSlot ? "is-active" : ""} ${
              teamReorder.dragState?.sourceIndex === index ? "is-dragging" : ""
            } ${
              teamReorder.dragState?.sourceIndex === index &&
              teamReorder.dragState.isDropping
                ? "is-dropping"
                : ""
            } ${
              teamReorder.dragState?.targetIndex === index &&
              teamReorder.dragState.sourceIndex !== index
                ? "is-drop-target"
                : ""
            } ${
              validity.slotResults[index]?.status === "invalid"
                ? "has-validity-error"
                : validity.slotResults[index]?.status === "unavailable"
                  ? "has-validity-unavailable"
                  : ""
            } ${
              displacement ? "is-reorder-displaced" : ""
            }`}
            data-team-drag-index={index}
            data-team-slot-index={index}
            key={`${member?.id ?? "empty"}-${index}`}
            style={
              teamReorder.dragState?.sourceIndex === index
                ? ({
                    "--tab-drag-x": `${teamReorder.dragState.offsetX}px`,
                    "--tab-drag-y": `${teamReorder.dragState.offsetY}px`,
                  } as CSSProperties)
                : displacement
                  ? {
                      transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
                    }
                  : undefined
            }
          >
            <button
              className={`team-tab ${isActiveRailSlot ? "is-active" : ""} ${
                member ? "" : "is-empty"
              }`}
              type="button"
              onClick={() => handleTeamTabClick(index)}
              onKeyDown={(event) => handleTeamTabKeyDown(event, index)}
              onPointerDown={(event) => {
                if (member) {
                  teamReorder.handlePointerDown(event, index);
                }
              }}
              onPointerMove={teamReorder.handlePointerMove}
              onPointerUp={teamReorder.handlePointerUp}
              onPointerCancel={teamReorder.handlePointerCancel}
              aria-label={
                member
                  ? `Show slot ${index + 1}. Drag to reorder, press Alt and an arrow key, or press Alt and End to bench.`
                  : `Add Pokemon to slot ${index + 1}`
              }
            >
              {member ? (
                <>
                  <span className="team-tab-sprite" aria-hidden="true">
                    <PokemonIcon pokemon={member} />
                  </span>
                  <span className="team-tab-copy" aria-hidden="true">
                    <strong>{railDisplayName}</strong>
                    <span className="team-tab-types">
                      {member.types.map((type) => (
                        <TypeBadge type={type} key={type} />
                      ))}
                    </span>
                  </span>
                  <span
                    className={`team-tab-item ${railItem ? "" : "is-empty"}`}
                    aria-hidden="true"
                    title={railItem?.name}
                  >
                    {railItem ? <ItemSprite item={railItem} /> : null}
                  </span>
                </>
              ) : (
                <>
                  <span className="team-tab-empty-mark" aria-hidden="true">+</span>
                  <span className="team-tab-empty-label" aria-hidden="true">
                    <strong>Add Pokemon</strong>
                  </span>
                </>
              )}
            </button>
            </div>
          );
        })}
        <div
          className={`team-tab-shell bench-tab-shell ${isBenchOpen ? "is-active" : ""} ${
            teamReorder.dragState?.targetIndex === team.length ? "is-drop-target" : ""
          }`}
          data-team-drag-index={team.length}
          ref={benchShellRef}
        >
          <button
            className={`team-tab bench-tab ${isBenchOpen ? "is-active" : ""}`}
            type="button"
            aria-label={`Bench. ${bench.length} of ${MAX_BENCH_POKEMON} Pokemon stored.`}
            aria-expanded={isBenchOpen}
            title="Bench"
            onClick={() => {
              if (teamReorder.shouldSuppressClick()) {
                return;
              }

              closeBuilderPopovers();
              setPendingBenchRemovalId(null);
              setIsBenchOpen((current) => !current);
            }}
          >
            <FontAwesomeIcon icon={faChair} aria-hidden="true" />
            <span className="bench-label" aria-hidden="true">Bench</span>
            {bench.length > 0 ? <span className="bench-count">{bench.length}</span> : null}
          </button>

          {isBenchOpen ? (
            <div className="bench-panel" role="dialog" aria-label="Bench Pokemon">
              <div className="bench-panel-header">
                <strong>Bench</strong>
                <span className={bench.length >= MAX_BENCH_POKEMON ? "is-limit" : ""}>
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
                    const benchDisplayName = getMemberDisplayName(entry.member);
                    const isDragging = teamReorder.dragState?.sourceIndex === dragIndex;
                    const displacement = getReorderDisplacement(
                      teamReorder.dragState,
                      dragIndex,
                    );
                    const isDropTarget =
                      teamReorder.dragState?.targetIndex === dragIndex &&
                      teamReorder.dragState.sourceIndex !== dragIndex;

                    return (
                      <div
                        className={`bench-pokemon-row ${isDragging ? "is-dragging" : ""} ${
                          isDragging && teamReorder.dragState?.isDropping
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
                                "--tab-drag-x": `${teamReorder.dragState?.offsetX ?? 0}px`,
                                "--tab-drag-y": `${teamReorder.dragState?.offsetY ?? 0}px`,
                                "--bench-drag-left": `${teamReorder.dragState?.originX ?? 0}px`,
                                "--bench-drag-top": `${teamReorder.dragState?.originY ?? 0}px`,
                                "--bench-drag-width": `${teamReorder.dragState?.originWidth ?? 0}px`,
                                "--bench-drag-height": `${teamReorder.dragState?.originHeight ?? 0}px`,
                              } as CSSProperties)
                            : displacement
                              ? {
                                  transform: `translate3d(${displacement.offsetX}px, ${displacement.offsetY}px, 0)`,
                                }
                              : undefined
                        }
                      >
                        {pendingBenchRemovalId === entry.id ? (
                          <div className="bench-remove-confirm" role="alertdialog">
                            <span>Delete {benchDisplayName}?</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingBenchRemovalId(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="is-danger"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRemoveBenchPokemon(entry.id);
                                setPendingBenchRemovalId(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="bench-pokemon-main"
                              type="button"
                              aria-label={`Move ${benchDisplayName} to selected slot ${selectedSlot + 1}. Drag to another slot or press Alt and an arrow key to reorder the bench.`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleBenchPokemonClick(index);
                              }}
                              onKeyDown={(event) => handleBenchPokemonKeyDown(event, index)}
                              onPointerDown={(event) =>
                                teamReorder.handlePointerDown(
                                  event,
                                  dragIndex,
                                  event.currentTarget.closest<HTMLElement>(
                                    ".bench-pokemon-row",
                                  ) ?? undefined,
                                )
                              }
                              onPointerMove={teamReorder.handlePointerMove}
                              onPointerUp={teamReorder.handlePointerUp}
                              onPointerCancel={teamReorder.handlePointerCancel}
                            >
                              <PokemonIcon pokemon={entry.member} />
                              <span>{benchDisplayName}</span>
                            </button>
                            <button
                              className="bench-pokemon-remove"
                              type="button"
                              aria-label={`Delete ${benchDisplayName} from bench`}
                              title="Delete from bench"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingBenchRemovalId(entry.id);
                              }}
                            >
                              <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="bench-empty">Bench is empty.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <article
        className="pokemon-card"
        onClick={(event) => {
          if (activeMember || isNamePickerVisible) {
            return;
          }

          const target = event.target as HTMLElement;

          if (
            target.closest(".pokemon-name-picker") ||
            target.closest(".candidate-filter-panel")
          ) {
            return;
          }

          setIsNamePickerOpen(true);
          setNameQuery("");
        }}
      >
        <div className="card-main">
          <div className="editor-column">
            <div className="name-row">
              <div className="pokemon-name-picker" ref={namePickerRef}>
                {isNamePickerVisible ? (
                  <input
                    className="pokemon-name-input"
                    aria-label="Search Pokemon"
                    autoFocus
                    value={nameQuery}
                    placeholder={activeHeaderName ?? "Pokemon"}
                    onChange={(event) => setNameQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        closeNamePicker();
                      }

                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        movePokemonKeyboardOption(event.key === "ArrowDown" ? 1 : -1);
                      }

                      if (event.key === "Enter" && filteredOptions.length > 0) {
                        event.preventDefault();
                        selectActivePokemonOption();
                      }
                    }}
                  />
                ) : (
                  <button
                    className="pokemon-name-button"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isNamePickerVisible}
                    onClick={() => setIsNamePickerOpen(true)}
                  >
                    {activeHeaderName ?? "Pokemon"}
                  </button>
                )}

                {isNamePickerVisible ? (
                  <div className="pokemon-name-menu">
                    <div
                      className="pokemon-name-results"
                      role="listbox"
                      onScroll={handlePokemonMenuScroll}
                    >
                      {filteredOptions.map((option, optionIndex) => (
                        <button
                          className="pokemon-name-option"
                          type="button"
                          role="option"
                          aria-selected={activePokemonOptionIndex === optionIndex}
                          value={option.id}
                          key={option.id}
                          onMouseEnter={() => setActivePokemonOptionIndex(optionIndex)}
                          onClick={() => handleSelectOption(option.id, true)}
                        >
                          <span>{option.name}</span>
                          {usageRankByOptionId.has(option.id) ? (
                            <small title="Usage rank">
                              #{usageRankByOptionId.get(option.id)}
                            </small>
                          ) : null}
                        </button>
                      ))}
                      {pokemonIndexStatus === "loading" && pokemonIndex.length === 0 ? (
                        <DataStatusRow message="Loading Pokemon data" isLoading />
                      ) : null}
                      {pokemonIndexStatus === "error" ? (
                        <DataStatusRow
                          message="Full Pokemon data is unavailable."
                          onRetry={onRetryPokemonIndex}
                        />
                      ) : null}
                      {!normalizedNameQuery &&
                      pokemonIndexStatus === "ready" &&
                      isUsageOrderLoading ? (
                        <DataStatusRow message="Loading popular Pokemon" isLoading />
                      ) : null}
                      {!normalizedNameQuery && usageOrderError ? (
                        <DataStatusRow
                          message={`${usageOrderError} Search is still available.`}
                          onRetry={() => {
                            setUsageOrderError(null);
                            setUsagePokemonIds(null);
                          }}
                        />
                      ) : null}
                      {!normalizedNameQuery &&
                      !isUsageOrderLoading &&
                      usagePokemonIds !== null &&
                      filteredOptions.length === 0 ? (
                        <div className="pokemon-name-empty">
                          {hasPokemonCandidateFilters(activeCandidateFilters)
                            ? "No Pokemon match these filters"
                            : "No popular Pokemon found"}
                        </div>
                      ) : null}
                      {normalizedNameQuery && filteredOptions.length === 0 ? (
                        <div className="pokemon-name-empty">No Pokemon found</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {!isNamePickerVisible && visibleMegaOptions.length > 0 ? (
                <div className="mega-controls" aria-label="Mega evolution options">
                  {visibleMegaOptions.map((option) => {
                    const isActiveMega =
                      activeFormKind === "mega" &&
                      option.speciesKey === activeSpeciesKey &&
                      (option.formLabel ?? "Mega") ===
                        (activeIndexEntry?.formLabel ?? "Mega");
                    const megaSuffix = option.formLabel?.replace("Mega", "").trim();

                    return (
                      <button
                        className={`mega-button ${isActiveMega ? "is-active" : ""}`}
                        type="button"
                        aria-label={`${isActiveMega ? "Return from" : "Use"} ${
                          option.displayName
                        }`}
                        title={option.displayName}
                        key={option.name}
                        onClick={() =>
                          handleToggleMega(option.name, isActiveMega)
                        }
                      >
                        M{megaSuffix ? ` ${megaSuffix}` : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {!isNamePickerVisible && battleFormGroup && activeBattleFormOption ? (
                <div className="form-picker" ref={battleFormPickerRef}>
                  <button
                    className="form-picker-trigger"
                    type="button"
                    aria-label={`Form: ${activeBattleFormOption.label}`}
                    aria-expanded={isBattleFormPickerOpen}
                    aria-haspopup="listbox"
                    onClick={() => {
                      setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
                      setIsBattleFormPickerOpen((isOpen) => !isOpen);
                    }}
                    onKeyDown={handleBattleFormKeyDown}
                  >
                    <span>{activeBattleFormOption.label}</span>
                    <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
                  </button>

                  {isBattleFormPickerOpen ? (
                    <div className="form-picker-menu" role="listbox" aria-label="Battle form">
                      {battleFormGroup.options.map((option, optionIndex) => {
                        const isSelected = activePokemonId === option.pokemonId;
                        const isActive = activeBattleFormOptionIndex === optionIndex;

                        return (
                          <button
                            className={`form-picker-option ${isActive ? "is-active" : ""}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            key={option.pokemonId}
                            onMouseEnter={() => setActiveBattleFormOptionIndex(optionIndex)}
                            onClick={() => handleSelectBattleForm(option.pokemonId)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

            </div>

            {searchError ? (
              <div className="search-error" role="alert">
                <span>{searchError}</span>
                {failedPokemonSelectionSlot === selectedSlot ? (
                  <button
                    type="button"
                    aria-label="Retry Pokemon loading"
                    title="Retry"
                    onClick={onRetryPokemonSelection}
                  >
                    <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {selectingPokemonSlot === selectedSlot ? (
              <div className="search-notice" role="status">
                <FontAwesomeIcon className="is-spinning" icon={faSpinner} aria-hidden="true" />
                Loading Pokemon set
              </div>
            ) : searchNotice?.slotIndex === selectedSlot ? (
              <p className="search-notice">{searchNotice.message}</p>
            ) : null}

            {activeMember ? (
            <div className="meta-row">
              <div className="set-meta-controls">
              <div
                className="item-picker"
                ref={itemPickerRef}
                onMouseEnter={() => {
                  if (!isItemPickerOpen && activeItem) {
                    previewItem(activeItem.id, activeItem);
                  }
                }}
                onMouseLeave={() => setHoveredItemOption(null)}
              >
                <button
                  className={`item-button ${activeItem ? "has-item" : ""}`}
                  type="button"
                  aria-label={activeItem ? `Change ${activeItem.name}` : "Choose item"}
                  aria-haspopup="listbox"
                  aria-expanded={isItemPickerOpen}
                  disabled={isItemLocked}
                  title={
                    isItemLocked
                      ? `${activeItem?.name ?? "Mega Stone"} is locked by Mega Evolution`
                      : activeItem?.name ?? "Choose item"
                  }
                  onBlur={() => setHoveredItemOption(null)}
                  onClick={() => {
                    if (isItemPickerOpen) {
                      closeItemPicker();
                    } else {
                      setIsItemPickerOpen(true);
                      setHoveredItemOption(null);
                    }
                  }}
                  onFocus={() => {
                    if (activeItem) {
                      previewItem(activeItem.id, activeItem);
                    }
                  }}
                  onMouseEnter={() => {
                    if (activeItem) {
                      previewItem(activeItem.id, activeItem);
                    }
                  }}
                  onMouseLeave={() => setHoveredItemOption(null)}
                >
                  {activeItem ? (
                    <ItemSprite item={activeItem} />
                  ) : (
                    <span>+</span>
                  )}
                </button>

                {isItemPickerOpen ? (
                  <div className="item-menu">
                    <input
                      className="item-search-input"
                      aria-label="Search item"
                      autoFocus
                      value={itemQuery}
                      placeholder="Search item"
                      onChange={(event) => setItemQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          closeItemPicker();
                        }

                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          moveItemKeyboardOption(event.key === "ArrowDown" ? 1 : -1);
                        }

                        if (event.key === "Enter" && displayedItemOptions.length > 0) {
                          event.preventDefault();
                          selectActiveItemOption();
                        }
                      }}
                    />

                    <div
                      className="item-results"
                      role="listbox"
                      onScroll={handleItemMenuScroll}
                    >
                      {activeItem ? (
                        <button
                          className="item-option item-clear-option"
                          type="button"
                          role="option"
                          aria-selected={activeItemOptionIndex === 0}
                          onFocus={() => {
                            setActiveItemOptionIndex(0);
                            setHoveredItemOption(null);
                          }}
                          onMouseEnter={() => {
                            setActiveItemOptionIndex(0);
                            setHoveredItemOption(null);
                          }}
                          onClick={clearItem}
                        >
                          <span className="item-option-icon" aria-hidden="true">
                            <FontAwesomeIcon icon={faXmark} />
                          </span>
                          <span className="item-option-name">Remove Item</span>
                        </button>
                      ) : null}
                      {visibleItemOptions.map((option, optionIndex) => {
                        const previewItemOption = itemFromIndexEntry(option);
                        const displayedOptionIndex = optionIndex + (activeItem ? 1 : 0);

                        return (
                          <button
                            className="item-option"
                            type="button"
                            role="option"
                            aria-selected={activeItemOptionIndex === displayedOptionIndex}
                            key={option.name}
                            aria-describedby="item-option-tooltip"
                            onBlur={() => setHoveredItemOption(null)}
                            onFocus={() => {
                              setActiveItemOptionIndex(displayedOptionIndex);
                              previewItem(option.name, previewItemOption);
                            }}
                            onMouseEnter={() => {
                              setActiveItemOptionIndex(displayedOptionIndex);
                              previewItem(option.name, previewItemOption);
                            }}
                            onMouseLeave={() => setHoveredItemOption(null)}
                            onClick={() => handleSelectItem(option.name)}
                          >
                            <span className="item-option-icon" aria-hidden="true">
                              <ItemSprite item={previewItemOption} />
                            </span>
                            <span className="item-option-name">{option.displayName}</span>
                          </button>
                        );
                      })}
                      {itemIndexStatus === "loading" && itemIndex.length === 0 ? (
                        <DataStatusRow message="Loading item data" isLoading />
                      ) : null}
                      {itemIndexStatus === "error" ? (
                        <DataStatusRow
                          message="Item data is unavailable."
                          onRetry={onRetryItemIndex}
                        />
                      ) : null}
                      {filteredItemOptions.length === 0 &&
                      itemIndexStatus === "ready" ? (
                        <div className="item-empty">No items found</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {hoveredItemOption ? (
                  <aside
                    className={`item-tooltip ${
                      isItemPickerOpen ? "item-option-tooltip" : ""
                    }`}
                    id={isItemPickerOpen ? "item-option-tooltip" : undefined}
                    role="tooltip"
                  >
                    <div className="item-tooltip-header">
                      <ItemSprite item={hoveredItemOption} />
                      <div>
                        <strong>{hoveredItemOption.name}</strong>
                        {hoveredItemOption.category ? (
                          <small>{hoveredItemOption.category}</small>
                        ) : null}
                      </div>
                    </div>

                    <p>{getItemEffectText(hoveredItemOption)}</p>
                  </aside>
                ) : null}
              </div>

              <div className="trait-row" ref={traitPickerRef}>
                <div
                  className="trait-picker"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeTraitPicker();
                      return;
                    }

                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();

                      if (openTraitPicker !== "ability") {
                        openAbilityPickerFromKeyboard(event.key === "ArrowDown" ? 1 : -1);
                        return;
                      }

                      moveAbilityKeyboardOption(event.key === "ArrowDown" ? 1 : -1);
                    }

                    if (event.key === "Enter" && openTraitPicker === "ability") {
                      event.preventDefault();
                      selectActiveAbilityOption();
                    }
                  }}
                >
                  <span className="trait-label">Ability</span>
                  <button
                    className="trait-value"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={openTraitPicker === "ability"}
                    onBlur={() => setHoveredAbilityOption(null)}
                    onClick={() => {
                      setHoveredAbilityOption(null);
                      if (openTraitPicker === "ability") {
                        closeTraitPicker();
                      } else {
                        const selectedIndex = displayedAbilityOptions.findIndex(
                          (ability) => ability === selectedAbility,
                        );
                        const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;

                        setActiveAbilityOptionIndex(nextIndex);
                        previewAbilityOptionAt(nextIndex);
                        setOpenTraitPicker("ability");
                      }
                    }}
                    onFocus={() => void previewAbility(selectedAbility)}
                    onMouseEnter={() => void previewAbility(selectedAbility)}
                    onMouseLeave={() => setHoveredAbilityOption(null)}
                  >
                    {selectedAbility}
                  </button>

                  {openTraitPicker === "ability" ? (
                    <div
                      className="trait-menu"
                      role="listbox"
                      onScroll={handleAbilityMenuScroll}
                    >
                      {visibleAbilityOptions.map((ability, optionIndex) => (
                        <button
                          className="trait-option"
                          type="button"
                          role="option"
                          aria-selected={activeAbilityOptionIndex === optionIndex}
                          aria-describedby="ability-option-tooltip"
                          key={ability}
                          onBlur={() => setHoveredAbilityOption(null)}
                          onFocus={() => {
                            setActiveAbilityOptionIndex(optionIndex);
                            void previewAbility(ability);
                          }}
                          onMouseEnter={() => {
                            setActiveAbilityOptionIndex(optionIndex);
                            void previewAbility(ability);
                          }}
                          onMouseLeave={() => setHoveredAbilityOption(null)}
                          onClick={() => selectAbility(ability)}
                        >
                          {ability}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {hoveredAbilityOption ? (
                    <aside
                      className={`ability-tooltip ${
                        openTraitPicker === "ability" ? "ability-option-tooltip" : ""
                      }`}
                      id={openTraitPicker === "ability" ? "ability-option-tooltip" : undefined}
                      role="tooltip"
                    >
                      <div className="ability-tooltip-header">
                        <strong>{hoveredAbilityOption.name}</strong>
                        <small>Ability</small>
                      </div>

                      <p>{getAbilityEffectText(hoveredAbilityOption)}</p>
                    </aside>
                  ) : null}
                </div>

                <div
                  className="trait-picker"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeTraitPicker();
                      return;
                    }

                    if (
                      event.key === "ArrowDown" ||
                      event.key === "ArrowUp" ||
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowRight"
                    ) {
                      event.preventDefault();

                      if (openTraitPicker !== "nature") {
                        openNaturePickerFromKeyboard();
                        return;
                      }

                      if (event.key === "ArrowDown") {
                        moveNatureKeyboardPosition(1, 0);
                      } else if (event.key === "ArrowUp") {
                        moveNatureKeyboardPosition(-1, 0);
                      } else if (event.key === "ArrowRight") {
                        moveNatureKeyboardPosition(0, 1);
                      } else {
                        moveNatureKeyboardPosition(0, -1);
                      }
                    }

                    if (event.key === "Enter" && openTraitPicker === "nature") {
                      event.preventDefault();
                      selectActiveNature();
                    }
                  }}
                >
                  <span className="trait-label">Nature</span>
                  <button
                    className="trait-value"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={openTraitPicker === "nature"}
                    onClick={() => {
                      if (openTraitPicker === "nature") {
                        closeTraitPicker();
                      } else {
                        setActiveNaturePosition(getNaturePosition(selectedNature));
                        setOpenTraitPicker("nature");
                      }
                    }}
                  >
                    {selectedNature.label}
                  </button>

                  {openTraitPicker === "nature" ? (
                    <div className="nature-grid-menu" role="dialog" aria-label="Select nature">
                      <div className="nature-grid">
                        <div className="nature-grid-corner" aria-hidden="true">
                          <span className="nature-axis-up">Up</span>
                          <span className="nature-axis-down">Down</span>
                        </div>
                        {battleStatKeys.map((downStat) => (
                          <div
                            className={`nature-stat-heading is-down ${
                              selectedNature.down === downStat ? "is-selected-down" : ""
                            }`}
                            key={downStat}
                          >
                            {natureStatLabels[downStat]}
                          </div>
                        ))}
                        {battleStatKeys.map((upStat) => (
                          <div className="nature-grid-row" key={upStat}>
                            <div
                              className={`nature-stat-heading is-up ${
                                selectedNature.up === upStat ? "is-selected-up" : ""
                              }`}
                            >
                              {natureStatLabels[upStat]}
                            </div>
                            {battleStatKeys.map((downStat, downIndex) => {
                              const nature = getNatureByAlignment(upStat, downStat);
                              const isNeutral = upStat === downStat;
                              const isKeyboardActive =
                                activeNaturePosition.upIndex ===
                                  battleStatKeys.indexOf(upStat) &&
                                activeNaturePosition.downIndex === downIndex;

                              return (
                                <button
                                  className={`nature-cell ${
                                    selectedNature.id === nature.id ? "is-active" : ""
                                  } ${isKeyboardActive ? "is-keyboard-active" : ""} ${
                                    isNeutral ? "is-neutral" : ""
                                  }`}
                                  type="button"
                                  role="option"
                                  aria-selected={selectedNature.id === nature.id}
                                  key={nature.id}
                                  onMouseEnter={() =>
                                    setActiveNaturePosition({
                                      upIndex: battleStatKeys.indexOf(upStat),
                                      downIndex,
                                    })
                                  }
                                  onClick={() => {
                                    setNatureBySlot((current) => ({
                                      ...current,
                                      [selectedSlot]: nature.id,
                                    }));
                                  }}
                                >
                                  {nature.label}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              </div>

              <div className="stats-editor-header stats-meta-heading">
                <h2>Stats</h2>
                <span className="ev-total">
                  EV {evTotal}/{CHAMPIONS_MAX_EV_TOTAL}
                </span>
              </div>
            </div>
            ) : null}

            <div className="editor-detail-grid">
              <div
                className={`move-list ${moveReorder.isDragging ? "is-reordering" : ""}`}
                aria-label="Selected moves"
                ref={movePickerRef}
              >
              {activeMember ? (
                selectedMoves.map((move, index) => {
                  const displacement = getReorderDisplacement(
                    moveReorder.dragState,
                    index,
                  );

                  return (
                    <div
                    className={`move-picker ${
                      moveReorder.dragState?.sourceIndex === index ? "is-dragging" : ""
                    } ${
                      moveReorder.dragState?.sourceIndex === index &&
                      moveReorder.dragState.isDropping
                        ? "is-dropping"
                        : ""
                    } ${
                      moveReorder.dragState?.targetIndex === index &&
                      moveReorder.dragState.sourceIndex !== index
                        ? "is-drop-target"
                        : ""
                    } ${
                      displacement ? "is-reorder-displaced" : ""
                    }`}
                    data-move-slot-index={index}
                    key={`${index}-${move?.id ?? "empty"}`}
                    onMouseLeave={() => {
                      if (suppressedMoveTooltipSlot === index) {
                        setSuppressedMoveTooltipSlot(null);
                      }
                    }}
                    style={
                      moveReorder.dragState?.sourceIndex === index
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
                      className={`move-pill ${move ? `type-${move.type}` : "is-empty"}`}
                      type="button"
                      aria-expanded={openMoveSlot === index}
                      aria-label={
                        move
                          ? `${move.name}, move ${index + 1}. Drag to reorder or press Alt and an arrow key.`
                          : `Choose move ${index + 1}`
                      }
                      onClick={() => {
                        if (!moveReorder.shouldSuppressClick()) {
                          toggleMovePicker(index, move?.id ?? "");
                        }
                      }}
                      onKeyDown={(event) => handleMovePillKeyDown(event, index)}
                      onPointerDown={(event) => {
                        if (move) {
                          moveReorder.handlePointerDown(event, index);
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
                          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                          Add Move
                        </span>
                      )}
                    </button>

                    {move &&
                    openMoveSlot !== index &&
                    suppressedMoveTooltipSlot !== index ? (
                      <MoveTooltip move={move} />
                    ) : null}

                    {openMoveSlot === index ? (
                      <div className="move-menu">
                        <input
                          className="move-search-input"
                          aria-label="Search available moves"
                          autoFocus
                          value={moveQuery}
                          placeholder="Search moves"
                          onChange={(event) => {
                            setMoveQuery(event.target.value);
                            setMoveOptionLimit(optionPageSize);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              closeMovePicker();
                            }

                            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                              event.preventDefault();
                              moveMoveKeyboardOption(event.key === "ArrowDown" ? 1 : -1);
                            }

                            if (event.key === "Enter") {
                              event.preventDefault();
                              selectActiveMoveOption(index);
                            }
                          }}
                        />

                        <div
                          className="move-results"
                          role="listbox"
                          ref={moveResultsRef}
                          onScroll={handleMoveMenuScroll}
                        >
                          <button
                            className={`move-option move-clear-option ${
                              activeMoveOptionIndex === 0 ? "is-keyboard-active" : ""
                            }`}
                            type="button"
                            role="option"
                            aria-selected={activeMoveOptionIndex === 0}
                            onFocus={() => {
                              setActiveMoveOptionIndex(0);
                              setHoveredMoveOption(null);
                            }}
                            onMouseEnter={() => {
                              setActiveMoveOptionIndex(0);
                              setHoveredMoveOption(null);
                            }}
                            onClick={() => clearMove(index)}
                          >
                            <span className="move-clear-icon" aria-hidden="true">
                              <FontAwesomeIcon icon={faXmark} />
                            </span>
                            <span>Empty Move Slot</span>
                          </button>
                          {filteredMoveOptions.length ? (
                            visibleMoveOptions.map((option, optionIndex) => (
                              <button
                                className={`move-option type-${option.type} ${
                                  activeMoveOptionIndex === optionIndex + 1
                                    ? "is-keyboard-active"
                                    : ""
                                }`}
                                type="button"
                                role="option"
                                key={option.id}
                                aria-selected={activeMoveOptionIndex === optionIndex + 1}
                                aria-describedby={`move-option-tooltip-${index}`}
                                onBlur={() => setHoveredMoveOption(null)}
                                onFocus={() => {
                                  setActiveMoveOptionIndex(optionIndex + 1);
                                  setHoveredMoveOption(option);
                                }}
                                onMouseEnter={() => {
                                  setActiveMoveOptionIndex(optionIndex + 1);
                                  setHoveredMoveOption(option);
                                }}
                                onMouseLeave={() => setHoveredMoveOption(null)}
                                onClick={() => selectMove(index, option.id)}
                              >
                                <MoveSummary move={option} />
                              </button>
                            ))
                          ) : (
                            <div className="move-empty">No moves found.</div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {openMoveSlot === index && hoveredMoveOption ? (
                      <MoveTooltip
                        id={`move-option-tooltip-${index}`}
                        move={hoveredMoveOption}
                        placement="option"
                      />
                    ) : null}
                    </div>
                  );
                })
              ) : null}
              </div>

              {!activeMember ? (
                <CandidateFilterPanel
                  filters={activeCandidateFilters}
                  matchingCount={candidateFilteredSelectOptions.length}
                  totalCount={selectOptions.length}
                  openPicker={openCandidateFilterPicker}
                  query={candidateFilterQuery}
                  options={filteredCandidateFilterOptions}
                  selectedMoves={selectedCandidateMoveOptions}
                  activeMoveSlot={candidateMoveFilterSlot}
                  activeOptionIndex={activeCandidateFilterOptionIndex}
                  panelRef={candidateFilterPickerRef}
                  onToggleType={togglePokemonType}
                  onClearFilters={() =>
                    patchSlot(selectedSlot, { candidateFilters: null })
                  }
                  onOpenPicker={openCandidatePicker}
                  onOpenMovePicker={openCandidateMovePicker}
                  onClosePicker={closeCandidateFilterPicker}
                  onQueryChange={(query) => {
                    setCandidateFilterQuery(query);
                    setCandidateFilterOptionLimit(optionPageSize);
                  }}
                  onResultsScroll={handleCandidateFilterMenuScroll}
                  onMoveActiveOption={moveCandidateFilterKeyboardOption}
                  onActiveOptionChange={setActiveCandidateFilterOptionIndex}
                  onSelectOption={selectCandidateFilterOption}
                  onRemoveAbility={() =>
                    patchSlot(selectedSlot, {
                      candidateFilters: {
                        ...activeCandidateFilters,
                        ability: null,
                      },
                    })
                  }
                  onRemoveMove={(moveIndex) => {
                    patchSlot(selectedSlot, {
                      candidateFilters: {
                        ...activeCandidateFilters,
                        moves: activeCandidateFilters.moves.filter(
                          (_, index) => index !== moveIndex,
                        ),
                      },
                    });
                    closeCandidateFilterPicker();
                  }}
                />
              ) : null}

              {activeMember ? (
                <section className="stats-editor" aria-label="Pokemon stats">
                  <div className="stats-editor-header stats-editor-header-mobile">
                    <h2>Stats</h2>
                    <span className="ev-total">
                      EV {evTotal}/{CHAMPIONS_MAX_EV_TOTAL}
                    </span>
                  </div>

                  <div className="stats-editor-body">
                    <div className="stat-axis-labels" aria-hidden="true">
                      <span className="is-base">Base</span>
                      <span className="is-ev">EV</span>
                      <span className="is-stat">Stat</span>
                    </div>

                    <div className="stats-editor-grid">
                      {statKeys.map((stat) => {
                        const maxAllowed = getMaxAllowedEv(stat);
                        const natureShift =
                          selectedNature.up !== selectedNature.down && stat === selectedNature.up
                            ? "up"
                            : selectedNature.up !== selectedNature.down &&
                                stat === selectedNature.down
                              ? "down"
                              : null;

                        return (
                          <div className="stat-editor-column" key={stat}>
                            <strong className="stat-editor-label">{statLabels[stat]}</strong>
                            <span className="stat-base-value">{baseStats[stat]}</span>

                            <div className="ev-vertical-track">
                              <input
                                className="ev-vertical-range"
                                type="range"
                                aria-label={`${statLabels[stat]} EV slider`}
                                min={0}
                                max={CHAMPIONS_MAX_EV_PER_STAT}
                                step={1}
                                value={evs[stat]}
                                style={
                                  {
                                    "--ev-fill": `${(evs[stat] / CHAMPIONS_MAX_EV_PER_STAT) * 100}%`,
                                  } as CSSProperties
                                }
                                onChange={(event) => updateEv(stat, event.target.value)}
                              />
                            </div>

                            <label className="ev-number-field">
                              <span className="sr-only">{statLabels[stat]} EV</span>
                              <input
                                className="ev-number-input"
                                inputMode="numeric"
                                min={0}
                                max={maxAllowed}
                                value={evs[stat]}
                                onChange={(event) => updateEv(stat, event.target.value)}
                              />
                            </label>

                            <span className="stat-result-value">
                              <span className="stat-value">
                                {calculatedStats[stat]}
                                {natureShift ? (
                                  <span
                                    className={`stat-nature-arrow is-${natureShift}`}
                                    aria-label={
                                      natureShift === "up"
                                        ? "Nature increases this stat"
                                        : "Nature decreases this stat"
                                    }
                                  />
                                ) : null}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <div className="sprite-crop">
            <div className="type-stack" aria-label="Pokemon type">
              {(activeMember?.types ?? []).map((type) => (
                <TypeBadge type={type} key={type} />
              ))}
            </div>
            {activeMember?.spriteUrl ? (
              <img
                src={activeMember.spriteUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            ) : null}
          </div>
        </div>
      </article>
      </div>
      {shareImageTarget !== null &&
      (shareImageTarget === "team" || selectedShareBuild) ? (
        <ShareImageDialog
          title={shareImageTarget === "team" ? "Team Image" : "Pokemon Image"}
          fileName={
            shareImageTarget === "team"
              ? `pokepilot-${teamName || "untitled-team"}-team`
              : `pokepilot-${selectedShareBuild?.displayName ?? "pokemon"}-${
                  selectedShareBuild?.formLabel ?? "build"
                }`
          }
          captureWidth={shareImageTarget === "team" ? 960 : 540}
          captureHeight={540}
          navigation={
            <nav
              className="share-image-navigation"
              role="tablist"
              aria-label="Image preview"
            >
              <button
                className={shareImageTarget === "team" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={shareImageTarget === "team"}
                onClick={() => setShareImageTarget("team")}
                onKeyDown={handleShareImageNavigationKeyDown}
              >
                <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
                <span>Team</span>
              </button>
              {Array.from({ length: 6 }, (_, slotIndex) => {
                const build = sharePokemonBuilds[slotIndex] ?? null;

                return (
                  <button
                    className={shareImageTarget === slotIndex ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={shareImageTarget === slotIndex}
                    aria-label={
                      build
                        ? `${build.displayName} image`
                        : `Empty party slot ${slotIndex + 1}`
                    }
                    title={build?.displayName ?? `Empty slot ${slotIndex + 1}`}
                    disabled={!build}
                    onClick={() => setShareImageTarget(slotIndex)}
                    onKeyDown={handleShareImageNavigationKeyDown}
                    key={slotIndex}
                  >
                    <span className="share-image-navigation-icon">
                      {build ? (
                        <PokemonIcon pokemon={build.member} />
                      ) : (
                        slotIndex + 1
                      )}
                    </span>
                    <span>{build?.displayName ?? "Empty"}</span>
                  </button>
                );
              })}
            </nav>
          }
          onClose={() => setShareImageTarget(null)}
        >
          {shareImageTarget === "team" ? (
            <TeamShareCard teamName={teamName} builds={sharePokemonBuilds} />
          ) : selectedShareBuild ? (
            <PokemonShareCard {...selectedShareBuild} />
          ) : null}
        </ShareImageDialog>
      ) : null}
    </section>
  );
}

