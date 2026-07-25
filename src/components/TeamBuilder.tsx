import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faPlus,
  faRotateRight,
  faSpinner,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPokemon } from "../api/pokeApi";
import { loadShowdownData } from "../api/showdownData";
import { fetchAbility, itemFromIndexEntry } from "../api/showdownCatalog";
import { formatIdLabel, normalizeShowdownId } from "../api/showdownIds";
import {
  getPokemonCandidateAbilities,
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
  getOptionLimitForIndex,
  useIncrementalOptions,
} from "../hooks/useIncrementalOptions";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  getReorderDisplacement,
  useLongPressReorder,
} from "../hooks/useLongPressReorder";
import { useDismissOnOutsidePointer } from "../hooks/useDismissOnOutsidePointer";
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import {
  findMoveByLookup,
  reconcileMoveIds,
} from "../utils/pokemonMoves";
import { orderPokemonOptionsByUsage } from "../utils/pokemonUsageOrder";
import { getIndexAfterSwap } from "../utils/reorder";
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
  getNatureById,
  statKeys,
  type Nature,
} from "../data/natures";
import { ItemSprite } from "./ItemSprite";
import type { PokemonShareBuild } from "./PokemonShareCard";
import { MoveSummary, MoveTooltip } from "./MoveDetails";
import { TypeBadge } from "./TypeBadge";
import {
  CandidateFilterPanel,
  type CandidateFilterOption,
  type CandidateFilterPicker,
} from "./CandidateFilterPanel";
import { DataStatusRow } from "./DataStatusRow";
import { BuilderToolbar } from "./BuilderToolbar";
import {
  BuilderSharePreview,
  type ShareImageTarget,
} from "./BuilderSharePreview";
import {
  TouchPickerSearchInput,
  TouchSelectionDialog,
} from "./TouchSelectionDialog";
import { TeamRail } from "./TeamRail";
import {
  AbilityDetailsContent,
  ItemDetailsContent,
} from "./SelectionDetails";
import {
  NatureGrid,
} from "./NatureGrid";
import {
  getNatureAtGridPosition,
  getNatureGridPosition,
  type NatureGridPosition,
} from "./natureGridUtils";
import { useLocalization } from "../i18n/useLocalization";
import { statTranslationKeys } from "../i18n/statTranslations";
import type { BattleFormat } from "../battleFormat/battleFormat";

type TeamBuilderProps = {
  teamName: string;
  battleFormat: BattleFormat;
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
  englishName: string;
  number: number;
  types: PokemonType[];
  abilityOptions: PokemonCandidateFilterValue[];
  moveIds: string[];
};

type MoveOptionScrollMode = "start" | "nearest";
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

function findItemOptionIndex(
  options: ItemIndexEntry[],
  item: PokemonItem | null,
) {
  if (!item) {
    return -1;
  }

  return options.findIndex(
    (option) =>
      normalizeShowdownId(option.name) === normalizeShowdownId(item.id) ||
      normalizeShowdownId(option.showdownId) ===
        normalizeShowdownId(item.showdownId ?? item.id),
  );
}

export function TeamBuilder({
  teamName,
  battleFormat,
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
  const { gameName, pokemonFormName, pokemonName, t } = useLocalization();
  const isTouchPickerLayout = useMediaQuery("(max-width: 1420px)");
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
  const [isUsageOrderLoading, setIsUsageOrderLoading] = useState(false);
  const [usageOrderError, setUsageOrderError] = useState<string | null>(null);
  const [isBenchOpen, setIsBenchOpen] = useState(false);
  const [benchLimitMessage, setBenchLimitMessage] = useState<string | null>(null);
  const [shareImageTarget, setShareImageTarget] = useState<ShareImageTarget>(null);
  const builderCardLayoutRef = useRef<HTMLDivElement | null>(null);
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
  const [hoveredPokemonOption, setHoveredPokemonOption] =
    useState<PokemonSelectOption | null>(null);
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
  const [pokemonOptionPreviewArtwork, setPokemonOptionPreviewArtwork] = useState<
    string | null
  >(null);
  const [preMegaMovesByPokemonId, setPreMegaMovesByPokemonId] = useState<
    Record<string, PokemonMove[]>
  >({});

  const pokemonIndexByName = useMemo(
    () => new Map(pokemonIndex.map((entry) => [entry.name, entry])),
    [pokemonIndex],
  );
  const activeMember = team[selectedSlot];
  const activePokemonId = activeMember?.id ?? "";
  const isNamePickerVisible =
    isNamePickerOpen || (!activeMember && !isTouchPickerLayout);
  const isInlineNamePickerVisible =
    isNamePickerVisible && !isTouchPickerLayout;
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
  const {
    limit: abilityOptionLimit,
    reset: resetAbilityOptions,
    ensureIndexVisible: ensureAbilityOptionVisible,
    handleScroll: handleAbilityOptionsScroll,
  } = useIncrementalOptions(displayedAbilityOptions.length);
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
    ? pokemonName({
        id: activeIndexEntry.name,
        speciesId: activeIndexEntry.speciesKey,
        fallback: formatIdLabel(activeIndexEntry.speciesKey),
        includeForm: false,
      })
    : activeMember
      ? pokemonName({ id: activeMember.id, fallback: activeMember.name, includeForm: false })
      : undefined;

  function getMemberDisplayName(member: TeamMember) {
    const indexEntry = pokemonIndexByName.get(member.id);

    return indexEntry
      ? pokemonName({
          id: indexEntry.name,
          speciesId: indexEntry.speciesKey,
          fallback: formatIdLabel(indexEntry.speciesKey),
          includeForm: false,
        })
      : pokemonName({ id: member.id, fallback: member.name, includeForm: false });
  }

  function getLocalizedItemName(item: PokemonItem) {
    return gameName("items", item.showdownId ?? item.id, item.name);
  }

  function getLocalizedAbilityName(ability: string) {
    return gameName("abilities", ability, ability);
  }

  function getLocalizedNatureName(nature: Nature) {
    return gameName("natures", nature.id, nature.label);
  }

  function getLocalizedStatLabel(stat: StatKey) {
    return t(statTranslationKeys[stat]);
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
              const candidateAbilities = getPokemonCandidateAbilities(
                showdownLegality ?? null,
                entry,
                pokemonIndex,
              );
              const moveIds = getLegalMoves(
                showdownLegality ?? null,
                entry.showdownId,
                entry.speciesKey,
              );
              const includeForm =
                entry.formKind === "gender" ||
                entry.formKind === "regional" ||
                entry.displayName !== formatIdLabel(entry.speciesKey);

              return {
                id: entry.name,
                name: pokemonName({
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
                abilityOptions: candidateAbilities.map((ability) => ({
                  id: ability.id,
                  name: gameName(
                    "abilities",
                    ability.id,
                    ability.name,
                  ),
                })),
                moveIds: [...(moveIds ?? [])],
              };
            })
        : pool.map((member) => ({
            id: member.id,
            name: pokemonName({ id: member.id, fallback: member.name }),
            englishName: member.name,
            number: 0,
            types: member.types,
            abilityOptions: (member.abilities ?? []).map((ability) => ({
              id: normalizeShowdownId(ability),
              name: ability,
            })),
            moveIds: (member.moves ?? []).map((move) => normalizeShowdownId(move.id)),
          })),
    [gameName, pokemonIndex, pokemonName, pool, showdownLegality],
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
  const {
    orderedOptions: popularSelectOptions,
    rankByOptionId: usageRankByOptionId,
  } = useMemo(() => {
    return orderPokemonOptionsByUsage(
      candidateFilteredSelectOptions,
      usagePokemonIds,
    );
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
                option.englishName.toLowerCase().includes(normalizedNameQuery) ||
                option.id.toLowerCase().includes(normalizedNameQuery) ||
                String(option.number).includes(normalizedNameQuery),
            )
        : popularSelectOptions,
    [candidateFilteredSelectOptions, normalizedNameQuery, popularSelectOptions],
  );
  const {
    limit: pokemonOptionLimit,
    reset: resetPokemonOptions,
    handleScroll: handlePokemonOptionsScroll,
  } = useIncrementalOptions(matchingPokemonOptions.length);
  const filteredOptions = useMemo(
    () => matchingPokemonOptions.slice(0, pokemonOptionLimit),
    [matchingPokemonOptions, pokemonOptionLimit],
  );
  const activeTouchPokemonOption = getActiveOption(
    filteredOptions,
    activePokemonOptionIndex,
  );
  const previewedPokemonOption = isTouchPickerLayout
    ? activeTouchPokemonOption
    : hoveredPokemonOption;
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
          name: gameName("moves", moveId, move?.name ?? formatIdLabel(moveId)),
          type: move?.type,
          power: move?.power,
        };
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [
    activeCandidateFilters,
    candidateMoveById,
    candidateMoveFilterSlot,
    gameName,
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
  const {
    limit: candidateFilterOptionLimit,
    reset: resetCandidateFilterOptions,
    ensureIndexVisible: ensureCandidateFilterOptionVisible,
    handleScroll: handleCandidateFilterOptionsScroll,
  } = useIncrementalOptions(matchingCandidateFilterOptions.length);
  const filteredCandidateFilterOptions = useMemo(
    () =>
      matchingCandidateFilterOptions.slice(
        0,
        candidateFilterOptionLimit,
      ),
    [candidateFilterOptionLimit, matchingCandidateFilterOptions],
  );
  const filteredItemOptions = useMemo(
    () =>
      normalizedItemQuery
        ? itemOptions
            .filter(
              (option) =>
                option.displayName.toLowerCase().includes(normalizedItemQuery) ||
                gameName("items", option.showdownId || option.name, option.displayName)
                  .toLowerCase()
                  .includes(normalizedItemQuery) ||
                option.name.toLowerCase().includes(normalizedItemQuery) ||
                String(option.id).includes(normalizedItemQuery),
            )
        : itemOptions,
    [gameName, itemOptions, normalizedItemQuery],
  );
  const {
    limit: itemOptionLimit,
    reset: resetItemOptions,
    ensureIndexVisible: ensureItemOptionVisible,
    handleScroll: handleItemOptionsScroll,
  } = useIncrementalOptions(filteredItemOptions.length);
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
              gameName("moves", move.id, move.name)
                .toLowerCase()
                .includes(normalizedMoveQuery) ||
              move.id.toLowerCase().includes(normalizedMoveQuery) ||
              move.type.toLowerCase().includes(normalizedMoveQuery) ||
              gameName("types", move.type, move.type)
                .toLowerCase()
                .includes(normalizedMoveQuery),
          )
        : moves,
    [gameName, moves, normalizedMoveQuery],
  );
  const {
    limit: moveOptionLimit,
    setLimit: setMoveOptionLimit,
    reset: resetMoveOptions,
    ensureIndexVisible: ensureMoveOptionVisible,
    handleScroll: handleMoveOptionsScroll,
  } = useIncrementalOptions(filteredMoveOptions.length);
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
    resetPokemonOptions();
  }, [
    activeCandidateFilters,
    isNamePickerVisible,
    normalizedNameQuery,
    resetPokemonOptions,
  ]);

  useEffect(() => {
    resetCandidateFilterOptions();
    setActiveCandidateFilterOptionIndex(
      matchingCandidateFilterOptions.length > 0 ? 0 : -1,
    );
  }, [
    candidateMoveFilterSlot,
    matchingCandidateFilterOptions.length,
    normalizedCandidateFilterQuery,
    openCandidateFilterPicker,
    resetCandidateFilterOptions,
  ]);

  useEffect(() => {
    resetItemOptions();
  }, [isItemPickerOpen, normalizedItemQuery, resetItemOptions]);

  useEffect(() => {
    resetAbilityOptions();
  }, [activePokemonId, openTraitPicker, resetAbilityOptions]);

  useEffect(() => {
    setUsagePokemonIds(null);
    setUsageOrderError(null);
  }, [battleFormat]);

  useEffect(() => {
    if (!isNamePickerVisible || usagePokemonIds !== null) {
      return undefined;
    }

    let isCurrent = true;
    setIsUsageOrderLoading(true);
    setUsageOrderError(null);

    void loadSmogonUsagePokemonIds(battleFormat)
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
  }, [battleFormat, isNamePickerVisible, usagePokemonIds]);

  useEffect(() => {
    setActivePokemonOptionIndex((current) => {
      if (filteredOptions.length === 0) {
        return -1;
      }

      return current >= 0 && current < filteredOptions.length ? current : 0;
    });
  }, [filteredOptions]);

  useEffect(() => {
    if (!isNamePickerVisible || !previewedPokemonOption) {
      setPokemonOptionPreviewArtwork(null);
      return;
    }

    if (
      activeMember?.spriteUrl &&
      getPokemonLookupAliases(activeMember.id).some(
        (lookup) =>
          normalizeShowdownId(lookup) ===
          normalizeShowdownId(previewedPokemonOption.id),
      )
    ) {
      setPokemonOptionPreviewArtwork(activeMember.spriteUrl);
      return;
    }

    let isCurrent = true;
    setPokemonOptionPreviewArtwork(null);

    const loadTimer = window.setTimeout(() => {
      void fetchPokemon(previewedPokemonOption.id)
        .then((pokemon) => {
          if (isCurrent) {
            setPokemonOptionPreviewArtwork(pokemon.spriteUrl ?? null);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setPokemonOptionPreviewArtwork(null);
          }
        });
    }, 140);

    return () => {
      isCurrent = false;
      window.clearTimeout(loadTimer);
    };
  }, [
    activeMember?.id,
    activeMember?.spriteUrl,
    isNamePickerVisible,
    previewedPokemonOption,
  ]);

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
    if (
      !isItemPickerOpen ||
      normalizedItemQuery ||
      !activeItem ||
      itemOptions.length === 0
    ) {
      return;
    }

    const selectedItemIndex = findItemOptionIndex(itemOptions, activeItem);

    if (selectedItemIndex < 0) {
      return;
    }

    ensureItemOptionVisible(selectedItemIndex);
    setActiveItemOptionIndex(selectedItemIndex + 1);
  }, [
    activeItem,
    ensureItemOptionVisible,
    isItemPickerOpen,
    itemOptions,
    normalizedItemQuery,
  ]);

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

    setMoveOptionLimit(getOptionLimitForIndex(nextOptionIndex - 1));

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
    setMoveOptionLimit,
  ]);

  useEffect(() => {
    setActiveAbilityOptionIndex(
      selectedAbilityOptionIndex >= 0 ? selectedAbilityOptionIndex : 0,
    );
    setHoveredAbilityOption(null);
  }, [activePokemonId, displayedAbilityOptionKey, selectedAbilityOptionIndex, selectedSlot]);

  useEffect(() => {
    setActiveNaturePosition(getNatureGridPosition(selectedNature));
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
      const nextMoveIds = reconcileMoveIds(moves, currentMoveIds);

      if (nextMoveIds === currentMoveIds) {
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

  useDismissOnOutsidePointer(
    namePickerRef,
    isNamePickerVisible && Boolean(activeMember) && !isTouchPickerLayout,
    closeNamePicker,
  );

  useDismissOnOutsidePointer(
    candidateFilterPickerRef,
    Boolean(openCandidateFilterPicker),
    closeCandidateFilterPicker,
  );

  useEffect(() => {
    setOpenCandidateFilterPicker(null);
    setCandidateMoveFilterSlot(null);
    setCandidateFilterQuery("");
  }, [selectedSlot]);

  useDismissOnOutsidePointer(
    battleFormPickerRef,
    isBattleFormPickerOpen,
    () => setIsBattleFormPickerOpen(false),
  );

  useEffect(() => {
    setIsBattleFormPickerOpen(false);
    setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
  }, [activeBattleFormOptionIndexFromPokemon, selectedSlot]);

  useDismissOnOutsidePointer(
    itemPickerRef,
    isItemPickerOpen && !isTouchPickerLayout,
    closeItemPicker,
  );

  useDismissOnOutsidePointer(
    traitPickerRef,
    Boolean(openTraitPicker) && !isTouchPickerLayout,
    closeTraitPicker,
  );

  useDismissOnOutsidePointer(
    movePickerRef,
    openMoveSlot !== null && !isTouchPickerLayout,
    closeMovePicker,
  );

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
    setHoveredPokemonOption(null);
  }

  function openNamePicker() {
    setActivePokemonOptionIndex(0);
    setNameQuery("");
    resetPokemonOptions();
    setIsNamePickerOpen(true);
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
    resetCandidateFilterOptions();
    setActiveCandidateFilterOptionIndex(0);
  }

  function openCandidateMovePicker(slotIndex: number) {
    const isSameOpenSlot =
      openCandidateFilterPicker === "move" &&
      candidateMoveFilterSlot === slotIndex;

    setOpenCandidateFilterPicker(isSameOpenSlot ? null : "move");
    setCandidateMoveFilterSlot(isSameOpenSlot ? null : slotIndex);
    setCandidateFilterQuery("");
    resetCandidateFilterOptions();
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

      ensureCandidateFilterOptionVisible(optionIndex);

      return nextIndex;
    });
  }

  function closeItemPicker() {
    setIsItemPickerOpen(false);
    setItemQuery("");
    setHoveredItemOption(null);
  }

  function openItemPicker() {
    const selectedItemIndex = findItemOptionIndex(itemOptions, activeItem);
    const nextIndex = activeItem
      ? Math.max(0, selectedItemIndex) + 1
      : 0;

    setItemQuery("");
    resetItemOptions();
    ensureItemOptionVisible(nextIndex - (activeItem ? 1 : 0));
    setActiveItemOptionIndex(nextIndex);
    previewItemOptionAt(nextIndex);
    setIsItemPickerOpen(true);
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
    closeNamePicker();
    setIsBattleFormPickerOpen(false);
    closeItemPicker();
    closeTraitPicker();
    closeMovePicker();
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

    setMoveOptionLimit(getOptionLimitForIndex(selectedOptionIndex - 1));
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
        t("builder.benchLimit", {
          count: bench.length,
          limit: MAX_BENCH_POKEMON,
        }),
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
      openNamePicker();
    }
  }

  function handleTeamTabClick(index: number) {
    if (teamReorder.shouldSuppressClick()) {
      return;
    }

    setIsBenchOpen(false);
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
    if (slotIndex === selectedSlot) {
      openNamePicker();
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

      ensureItemOptionVisible(nextIndex - (activeItem ? 1 : 0));

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

  function openAbilityPicker() {
    const selectedIndex = displayedAbilityOptions.findIndex(
      (ability) => ability === selectedAbility,
    );
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;

    ensureAbilityOptionVisible(nextIndex);
    setActiveAbilityOptionIndex(nextIndex);
    previewAbilityOptionAt(nextIndex);
    setOpenTraitPicker("ability");
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

      ensureAbilityOptionVisible(nextIndex);

      previewAbilityOptionAt(nextIndex);
      return nextIndex;
    });
  }

  function selectActiveAbilityOption() {
    const ability = getActiveOption(displayedAbilityOptions, activeAbilityOptionIndex);

    if (ability) {
      selectAbility(ability);
    }
  }

  function openNaturePickerFromKeyboard() {
    setOpenTraitPicker("nature");
    setActiveNaturePosition(getNatureGridPosition(selectedNature));
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
    const nature = getNatureAtGridPosition(activeNaturePosition);

    setNatureBySlot((current) => ({
      ...current,
      [selectedSlot]: nature.id,
    }));
  }

  function confirmActiveNature() {
    selectActiveNature();
    closeTraitPicker();
  }

  function moveMoveKeyboardOption(direction: 1 | -1) {
    setActiveMoveOptionIndex((current) => {
      const nextIndex = getNextOptionIndex(
        current,
        filteredMoveOptions.length + 1,
        direction,
      );

      ensureMoveOptionVisible(nextIndex - 1);

      moveOptionScrollModeRef.current = "nearest";
      setHoveredMoveOption(
        nextIndex > 0 ? (filteredMoveOptions[nextIndex - 1] ?? null) : null,
      );
      return nextIndex;
    });
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

  function renderPokemonOptionPreview(option: PokemonSelectOption) {
    return (
      <div className="touch-pokemon-preview">
        {pokemonOptionPreviewArtwork ? (
          <img
            className="touch-pokemon-preview-artwork"
            src={pokemonOptionPreviewArtwork}
            alt=""
            aria-hidden="true"
            key={pokemonOptionPreviewArtwork}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <div className="touch-pokemon-preview-copy">
          <strong>{option.name}</strong>
          {usageRankByOptionId.has(option.id) ? (
            <small>
              {t("builder.usageRank", {
                rank: usageRankByOptionId.get(option.id) ?? "",
              })}
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

  function renderPokemonOptionRows(previewOnly: boolean) {
    return (
      <>
        {filteredOptions.map((option, optionIndex) => (
          <button
            className="pokemon-name-option"
            type="button"
            role="option"
            aria-selected={activePokemonOptionIndex === optionIndex}
            value={option.id}
            key={option.id}
            aria-describedby={
              previewOnly ? undefined : "pokemon-option-preview"
            }
            onBlur={() => {
              if (!previewOnly) {
                setHoveredPokemonOption(null);
              }
            }}
            onFocus={() => {
              setActivePokemonOptionIndex(optionIndex);

              if (!previewOnly) {
                setHoveredPokemonOption(option);
              }
            }}
            onMouseEnter={
              previewOnly
                ? undefined
                : () => {
                    setActivePokemonOptionIndex(optionIndex);
                    setHoveredPokemonOption(option);
                  }
            }
            onMouseLeave={() => {
              if (!previewOnly) {
                setHoveredPokemonOption(null);
              }
            }}
            onClick={() => {
              if (previewOnly) {
                setActivePokemonOptionIndex(optionIndex);
                return;
              }

              handleSelectOption(option.id, true);
            }}
          >
            <span>{option.name}</span>
            {usageRankByOptionId.has(option.id) ? (
              <small
                title={t("builder.usageRank", {
                  rank: usageRankByOptionId.get(option.id) ?? "",
                })}
              >
                #{usageRankByOptionId.get(option.id)}
              </small>
            ) : null}
          </button>
        ))}
        {pokemonIndexStatus === "loading" && pokemonIndex.length === 0 ? (
          <DataStatusRow message={t("builder.loadingPokemonData")} isLoading />
        ) : null}
        {pokemonIndexStatus === "error" ? (
          <DataStatusRow
            message={t("builder.pokemonDataUnavailable")}
            onRetry={onRetryPokemonIndex}
          />
        ) : null}
        {!normalizedNameQuery &&
        pokemonIndexStatus === "ready" &&
        isUsageOrderLoading ? (
          <DataStatusRow message={t("builder.loadingPopularPokemon")} isLoading />
        ) : null}
        {!normalizedNameQuery && usageOrderError ? (
          <DataStatusRow
            message={t("builder.searchStillAvailable", {
              message: usageOrderError,
            })}
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
              ? t("builder.noFilterMatches")
              : t("builder.noPopularPokemon")}
          </div>
        ) : null}
        {normalizedNameQuery && filteredOptions.length === 0 ? (
          <div className="pokemon-name-empty">{t("builder.noPokemon")}</div>
        ) : null}
      </>
    );
  }

  function renderItemOptionRows(previewOnly: boolean) {
    return (
      <>
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
            onMouseEnter={
              previewOnly
                ? undefined
                : () => {
                    setActiveItemOptionIndex(0);
                    setHoveredItemOption(null);
                  }
            }
            onClick={() => {
              if (previewOnly) {
                setActiveItemOptionIndex(0);
                setHoveredItemOption(null);
                return;
              }

              clearItem();
            }}
          >
            <span className="item-option-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faXmark} />
            </span>
            <span className="item-option-name">{t("builder.removeItem")}</span>
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
              aria-describedby={
                previewOnly ? undefined : "item-option-tooltip"
              }
              onBlur={() => {
                if (!previewOnly) {
                  setHoveredItemOption(null);
                }
              }}
              onFocus={() => {
                setActiveItemOptionIndex(displayedOptionIndex);
                previewItem(option.name, previewItemOption);
              }}
              onMouseEnter={
                previewOnly
                  ? undefined
                  : () => {
                      setActiveItemOptionIndex(displayedOptionIndex);
                      previewItem(option.name, previewItemOption);
                    }
              }
              onMouseLeave={() => {
                if (!previewOnly) {
                  setHoveredItemOption(null);
                }
              }}
              onClick={() => {
                if (previewOnly) {
                  setActiveItemOptionIndex(displayedOptionIndex);
                  previewItem(option.name, previewItemOption);
                  return;
                }

                handleSelectItem(option.name);
              }}
            >
              <span className="item-option-icon" aria-hidden="true">
                <ItemSprite item={previewItemOption} />
              </span>
              <span className="item-option-name">
                {gameName(
                  "items",
                  option.showdownId || option.name,
                  option.displayName,
                )}
              </span>
            </button>
          );
        })}
        {itemIndexStatus === "loading" && itemIndex.length === 0 ? (
          <DataStatusRow message={t("builder.loadingItemData")} isLoading />
        ) : null}
        {itemIndexStatus === "error" ? (
          <DataStatusRow
            message={t("builder.itemDataUnavailable")}
            onRetry={onRetryItemIndex}
          />
        ) : null}
        {filteredItemOptions.length === 0 && itemIndexStatus === "ready" ? (
          <div className="item-empty">{t("builder.noItems")}</div>
        ) : null}
      </>
    );
  }

  function renderAbilityOptionRows(previewOnly: boolean) {
    return visibleAbilityOptions.map((ability, optionIndex) => (
      <button
        className="trait-option"
        type="button"
        role="option"
        aria-selected={activeAbilityOptionIndex === optionIndex}
        aria-describedby={
          previewOnly ? undefined : "ability-option-tooltip"
        }
        key={ability}
        onBlur={() => {
          if (!previewOnly) {
            setHoveredAbilityOption(null);
          }
        }}
        onFocus={() => {
          setActiveAbilityOptionIndex(optionIndex);
          void previewAbility(ability);
        }}
        onMouseEnter={
          previewOnly
            ? undefined
            : () => {
                setActiveAbilityOptionIndex(optionIndex);
                void previewAbility(ability);
              }
        }
        onMouseLeave={() => {
          if (!previewOnly) {
            setHoveredAbilityOption(null);
          }
        }}
        onClick={() => {
          if (previewOnly) {
            setActiveAbilityOptionIndex(optionIndex);
            void previewAbility(ability);
            return;
          }

          selectAbility(ability);
        }}
      >
        {getLocalizedAbilityName(ability)}
      </button>
    ));
  }

  function renderNatureGrid(previewOnly: boolean) {
    return (
      <NatureGrid
        selectedNature={selectedNature}
        activePosition={activeNaturePosition}
        previewOnly={previewOnly}
        upLabel={t("builder.up")}
        downLabel={t("builder.down")}
        getNatureName={getLocalizedNatureName}
        getStatLabel={getLocalizedStatLabel}
        onActivePositionChange={setActiveNaturePosition}
        onSelectNature={(nature) =>
          setNatureBySlot((current) => ({
            ...current,
            [selectedSlot]: nature.id,
          }))
        }
      />
    );
  }

  function renderMoveOptionRows(slotIndex: number, previewOnly: boolean) {
    return (
      <>
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
          onMouseEnter={
            previewOnly
              ? undefined
              : () => {
                  setActiveMoveOptionIndex(0);
                  setHoveredMoveOption(null);
                }
          }
          onClick={() => {
            if (previewOnly) {
              setActiveMoveOptionIndex(0);
              setHoveredMoveOption(null);
              return;
            }

            clearMove(slotIndex);
          }}
        >
          <span className="move-clear-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faXmark} />
          </span>
          <span>{t("builder.emptyMove")}</span>
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
              aria-describedby={
                previewOnly ? undefined : `move-option-tooltip-${slotIndex}`
              }
              onBlur={() => {
                if (!previewOnly) {
                  setHoveredMoveOption(null);
                }
              }}
              onFocus={() => {
                setActiveMoveOptionIndex(optionIndex + 1);
                setHoveredMoveOption(option);
              }}
              onMouseEnter={
                previewOnly
                  ? undefined
                  : () => {
                      setActiveMoveOptionIndex(optionIndex + 1);
                      setHoveredMoveOption(option);
                    }
              }
              onMouseLeave={() => {
                if (!previewOnly) {
                  setHoveredMoveOption(null);
                }
              }}
              onClick={() => {
                if (previewOnly) {
                  setActiveMoveOptionIndex(optionIndex + 1);
                  setHoveredMoveOption(option);
                  return;
                }

                selectMove(slotIndex, option.id);
              }}
            >
              <MoveSummary move={option} />
            </button>
          ))
        ) : (
          <div className="move-empty">{t("builder.noMoves")}</div>
        )}
      </>
    );
  }

  function renderTouchSelectionDialog() {
    if (!isTouchPickerLayout) {
      return null;
    }

    if (isNamePickerOpen) {
      const previewOption = activeTouchPokemonOption;

      return (
        <TouchSelectionDialog
          kind="pokemon"
          title={t("builder.selectPokemon")}
          canSelect={Boolean(previewOption)}
          search={
            <TouchPickerSearchInput
              value={nameQuery}
              label={t("builder.searchPokemon")}
              placeholder={t("builder.searchPokemon")}
              onChange={setNameQuery}
              onMove={movePokemonKeyboardOption}
              onSubmit={
                filteredOptions.length > 0
                  ? selectActivePokemonOption
                  : undefined
              }
            />
          }
          preview={
            previewOption ? (
              renderPokemonOptionPreview(previewOption)
            ) : (
              <p className="touch-picker-empty-preview">
                {t("builder.noPokemon")}
              </p>
            )
          }
          onClose={closeNamePicker}
          onSelect={selectActivePokemonOption}
        >
          <div
            className="touch-picker-option-list pokemon-name-results"
            role="listbox"
            onScroll={handlePokemonOptionsScroll}
          >
            {renderPokemonOptionRows(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (isItemPickerOpen) {
      const activeItemEntry = getItemOptionAt(
        activeItemOptionIndex >= 0 ? activeItemOptionIndex : 0,
      );
      const previewedItem = activeItemEntry
        ? itemFromIndexEntry(activeItemEntry)
        : null;

      return (
        <TouchSelectionDialog
          kind="item"
          title={t("builder.selectItem")}
          canSelect={displayedItemOptions.length > 0}
          search={
            <TouchPickerSearchInput
              value={itemQuery}
              label={t("builder.searchItem")}
              placeholder={t("builder.searchItem")}
              onChange={setItemQuery}
              onMove={moveItemKeyboardOption}
              onSubmit={
                displayedItemOptions.length > 0
                  ? selectActiveItemOption
                  : undefined
              }
            />
          }
          preview={
            previewedItem ? (
              <div className="touch-item-preview">
                <ItemDetailsContent item={previewedItem} />
              </div>
            ) : (
              <p className="touch-picker-empty-preview">
                {t("builder.removeItem")}
              </p>
            )
          }
          onClose={closeItemPicker}
          onSelect={selectActiveItemOption}
        >
          <div
            className="touch-picker-option-list item-results"
            role="listbox"
            onScroll={handleItemOptionsScroll}
          >
            {renderItemOptionRows(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (openTraitPicker === "ability") {
      const previewedAbilityName = getActiveOption(
        displayedAbilityOptions,
        activeAbilityOptionIndex,
      );
      const previewedAbilityId = normalizeShowdownId(
        previewedAbilityName ?? "",
      );
      const previewedAbility =
        previewedAbilityName && previewedAbilityId
          ? hoveredAbilityOption?.id === previewedAbilityId
            ? hoveredAbilityOption
            : (abilityDetailsByName[previewedAbilityId] ?? {
                id: previewedAbilityId,
                name: previewedAbilityName,
              })
          : null;

      return (
        <TouchSelectionDialog
          kind="ability"
          title={t("builder.selectAbility")}
          canSelect={displayedAbilityOptions.length > 0}
          preview={
            previewedAbility ? (
              <div className="touch-ability-preview">
                <AbilityDetailsContent ability={previewedAbility} />
              </div>
            ) : (
              <p className="touch-picker-empty-preview">
                {t("builder.noAbility")}
              </p>
            )
          }
          onClose={closeTraitPicker}
          onSelect={selectActiveAbilityOption}
        >
          <div
            className="touch-picker-option-list touch-ability-options"
            role="listbox"
            onScroll={handleAbilityOptionsScroll}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                moveAbilityKeyboardOption(
                  event.key === "ArrowDown" ? 1 : -1,
                );
              }

              if (event.key === "Enter") {
                event.preventDefault();
                selectActiveAbilityOption();
              }
            }}
          >
            {renderAbilityOptionRows(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (openTraitPicker === "nature") {
      return (
        <TouchSelectionDialog
          kind="nature"
          title={t("builder.selectNature")}
          onClose={closeTraitPicker}
          onSelect={confirmActiveNature}
        >
          <div
            className="touch-nature-grid-wrap"
            role="listbox"
            onKeyDown={(event) => {
              if (
                event.key === "ArrowDown" ||
                event.key === "ArrowUp" ||
                event.key === "ArrowLeft" ||
                event.key === "ArrowRight"
              ) {
                event.preventDefault();

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

              if (event.key === "Enter") {
                event.preventDefault();
                confirmActiveNature();
              }
            }}
          >
            {renderNatureGrid(true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    if (openMoveSlot !== null) {
      return (
        <TouchSelectionDialog
          kind="move"
          title={t("builder.selectMove", { slot: openMoveSlot + 1 })}
          canSelect={filteredMoveOptions.length > 0 || activeMoveOptionIndex === 0}
          search={
            <TouchPickerSearchInput
              value={moveQuery}
              label={t("builder.searchAvailableMoves")}
              placeholder={t("filter.searchMoves")}
              onChange={(value) => {
                setMoveQuery(value);
                resetMoveOptions();
              }}
              onMove={moveMoveKeyboardOption}
              onSubmit={() => selectActiveMoveOption(openMoveSlot)}
            />
          }
          preview={
            hoveredMoveOption ? (
              <MoveTooltip move={hoveredMoveOption} placement="dialog" />
            ) : (
              <p className="touch-picker-empty-preview">
                {t("builder.emptyMove")}
              </p>
            )
          }
          onClose={closeMovePicker}
          onSelect={() => selectActiveMoveOption(openMoveSlot)}
        >
          <div
            className="touch-picker-option-list move-results"
            role="listbox"
            ref={moveResultsRef}
            onScroll={handleMoveOptionsScroll}
          >
            {renderMoveOptionRows(openMoveSlot, true)}
          </div>
        </TouchSelectionDialog>
      );
    }

    return null;
  }

  return (
    <section className="builder-stage" aria-label={t("builder.aria")}>
      <BuilderToolbar
        hasTeamMembers={team.some(Boolean)}
        activePokemonName={activeHeaderName ?? null}
        selectedSlot={selectedSlot}
        validity={validity}
        showdownLegalityStatus={showdownLegalityStatus}
        showdownLegalityError={showdownLegalityError}
        onRetryShowdownLegality={onRetryShowdownLegality}
        onExportShowdown={onExportShowdown}
        onImportShowdown={onImportShowdown}
        onOpenImage={() => {
          closeBuilderPopovers();
          setIsBenchOpen(false);
          setShareImageTarget(selectedSlot);
        }}
        onDeletePokemon={() => handleClearSlot(selectedSlot)}
      />

      <div className="builder-card-layout" ref={builderCardLayoutRef}>
        <TeamRail
          team={team}
          bench={bench}
          selectedSlot={selectedSlot}
          itemBySlot={itemBySlot}
          validity={validity}
          isBenchOpen={isBenchOpen}
          benchLimitMessage={benchLimitMessage}
          reorder={teamReorder}
          getMemberDisplayName={getMemberDisplayName}
          onTeamTabClick={handleTeamTabClick}
          onTeamTabKeyDown={handleTeamTabKeyDown}
          onToggleBench={() => {
            closeBuilderPopovers();
            setIsBenchOpen((current) => !current);
          }}
          onCloseBench={() => setIsBenchOpen(false)}
          onBenchPokemonClick={handleBenchPokemonClick}
          onReorderBenchPokemon={onReorderBenchPokemon}
          onRemoveBenchPokemon={onRemoveBenchPokemon}
        />

      <article
        className={`pokemon-card${activeMember ? "" : " is-empty-slot"}`}
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

          openNamePicker();
        }}
      >
        <div className="card-main">
          <div className="editor-column">
            <div className="name-row">
              <div className="pokemon-name-picker" ref={namePickerRef}>
                {isInlineNamePickerVisible ? (
                  <input
                    className="pokemon-name-input"
                    aria-label={t("builder.searchPokemon")}
                    autoFocus
                    value={nameQuery}
                    placeholder={activeHeaderName ?? t("builder.choosePokemon")}
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
                    onClick={openNamePicker}
                  >
                    {activeHeaderName ?? t("builder.choosePokemon")}
                  </button>
                )}

                {isInlineNamePickerVisible ? (
                  <div className="pokemon-name-menu">
                    <div
                      className="pokemon-name-results"
                      role="listbox"
                      onScroll={handlePokemonOptionsScroll}
                    >
                      {renderPokemonOptionRows(false)}
                    </div>
                  </div>
                ) : null}

                {isInlineNamePickerVisible && hoveredPokemonOption ? (
                  <aside
                    className="desktop-pokemon-option-preview"
                    id="pokemon-option-preview"
                    role="tooltip"
                  >
                    {renderPokemonOptionPreview(hoveredPokemonOption)}
                  </aside>
                ) : null}
              </div>

              {!isNamePickerVisible && visibleMegaOptions.length > 0 ? (
                <div className="mega-controls" aria-label={t("builder.megaOptions")}>
                  {visibleMegaOptions.map((option) => {
                    const isActiveMega =
                      activeFormKind === "mega" &&
                      option.speciesKey === activeSpeciesKey &&
                      (option.formLabel ?? "Mega") ===
                        (activeIndexEntry?.formLabel ?? "Mega");
                    const megaSuffix = option.formLabel?.replace("Mega", "").trim();
                    const megaDisplayName = pokemonName({
                      id: option.name,
                      speciesId: option.speciesKey,
                      fallback: option.displayName,
                      formLabel: option.formLabel,
                    });

                    return (
                      <button
                        className={`mega-button ${isActiveMega ? "is-active" : ""}`}
                        type="button"
                        aria-label={t(
                          isActiveMega ? "builder.returnFromMega" : "builder.useMega",
                          { name: megaDisplayName },
                        )}
                        title={megaDisplayName}
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
                    aria-label={t("builder.form", {
                      form: pokemonFormName(
                        activeBattleFormOption.pokemonId,
                        activeBattleFormOption.label,
                      ),
                    })}
                    aria-expanded={isBattleFormPickerOpen}
                    aria-haspopup="listbox"
                    onClick={() => {
                      setActiveBattleFormOptionIndex(activeBattleFormOptionIndexFromPokemon);
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
                    <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
                  </button>

                  {isBattleFormPickerOpen ? (
                    <div className="form-picker-menu" role="listbox" aria-label={t("builder.battleForm")}>
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
                            {pokemonFormName(option.pokemonId, option.label)}
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
                    aria-label={t("builder.retryPokemon")}
                    title={t("common.retry")}
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
                {t("builder.loadingPokemonSet")}
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
                  aria-label={activeItem
                    ? t("builder.changeItem", { item: getLocalizedItemName(activeItem) })
                    : t("builder.chooseItem")}
                  aria-haspopup="listbox"
                  aria-expanded={isItemPickerOpen}
                  disabled={isItemLocked}
                  title={
                    isItemLocked
                      ? t("builder.itemLocked", {
                          item: activeItem
                            ? getLocalizedItemName(activeItem)
                            : t("builder.megaStone"),
                        })
                      : activeItem
                        ? getLocalizedItemName(activeItem)
                        : t("builder.chooseItem")
                  }
                  onBlur={() => {
                    if (!isTouchPickerLayout) {
                      setHoveredItemOption(null);
                    }
                  }}
                  onClick={() => {
                    if (isItemPickerOpen) {
                      closeItemPicker();
                    } else {
                      openItemPicker();
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
                  onMouseLeave={() => {
                    if (!isTouchPickerLayout) {
                      setHoveredItemOption(null);
                    }
                  }}
                >
                  {activeItem ? (
                    <ItemSprite item={activeItem} />
                  ) : (
                    <span>+</span>
                  )}
                </button>

                {isItemPickerOpen && !isTouchPickerLayout ? (
                  <div className="item-menu">
                    <input
                      className="item-search-input"
                      aria-label={t("builder.searchItem")}
                      autoFocus
                      value={itemQuery}
                      placeholder={t("builder.searchItem")}
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
                      onScroll={handleItemOptionsScroll}
                    >
                      {renderItemOptionRows(false)}
                    </div>
                  </div>
                ) : null}

                {!isTouchPickerLayout && hoveredItemOption ? (
                  <aside
                    className={`item-tooltip ${
                      isItemPickerOpen ? "item-option-tooltip" : ""
                    }`}
                    id={isItemPickerOpen ? "item-option-tooltip" : undefined}
                    role="tooltip"
                  >
                    <ItemDetailsContent item={hoveredItemOption} />
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
                  <span className="trait-label">{t("builder.ability")}</span>
                  <button
                    className="trait-value"
                    type="button"
                    aria-haspopup={isTouchPickerLayout ? "dialog" : "listbox"}
                    aria-expanded={openTraitPicker === "ability"}
                    onBlur={() => {
                      if (!isTouchPickerLayout) {
                        setHoveredAbilityOption(null);
                      }
                    }}
                    onClick={() => {
                      if (openTraitPicker === "ability") {
                        closeTraitPicker();
                      } else {
                        openAbilityPicker();
                      }
                    }}
                    onFocus={() => void previewAbility(selectedAbility)}
                    onMouseEnter={() => void previewAbility(selectedAbility)}
                    onMouseLeave={() => {
                      if (!isTouchPickerLayout) {
                        setHoveredAbilityOption(null);
                      }
                    }}
                  >
                    {getLocalizedAbilityName(selectedAbility)}
                  </button>

                  {openTraitPicker === "ability" && !isTouchPickerLayout ? (
                    <div
                      className="trait-menu"
                      role="listbox"
                      onScroll={handleAbilityOptionsScroll}
                    >
                      {renderAbilityOptionRows(false)}
                    </div>
                  ) : null}

                  {!isTouchPickerLayout && hoveredAbilityOption ? (
                    <aside
                      className={`ability-tooltip ${
                        openTraitPicker === "ability" ? "ability-option-tooltip" : ""
                      }`}
                      id={openTraitPicker === "ability" ? "ability-option-tooltip" : undefined}
                      role="tooltip"
                    >
                      <AbilityDetailsContent ability={hoveredAbilityOption} />
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
                  <span className="trait-label">{t("builder.nature")}</span>
                  <button
                    className="trait-value"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={openTraitPicker === "nature"}
                    onClick={() => {
                      if (openTraitPicker === "nature") {
                        closeTraitPicker();
                      } else {
                        setActiveNaturePosition(getNatureGridPosition(selectedNature));
                        setOpenTraitPicker("nature");
                      }
                    }}
                  >
                    {getLocalizedNatureName(selectedNature)}
                  </button>

                  {openTraitPicker === "nature" && !isTouchPickerLayout ? (
                    <div
                      className="nature-grid-menu"
                      role="dialog"
                      aria-label={t("builder.selectNature")}
                    >
                      {renderNatureGrid(false)}
                    </div>
                  ) : null}
                </div>
              </div>
              </div>

              <div className="stats-editor-header stats-meta-heading">
                <h2>{t("builder.stats")}</h2>
                <span className="ev-total">
                  {t("builder.evTotal", {
                    current: evTotal,
                    max: CHAMPIONS_MAX_EV_TOTAL,
                  })}
                </span>
              </div>
            </div>
            ) : null}

            <div className="editor-detail-grid">
              <div
                className={`move-list ${moveReorder.isDragging ? "is-reordering" : ""}`}
                aria-label={t("builder.selectedMoves")}
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
                          ? t("builder.moveReorderAria", {
                              move: gameName("moves", move.id, move.name),
                              slot: index + 1,
                            })
                          : t("builder.chooseMoveSlot", { slot: index + 1 })
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
                          {t("builder.addMove")}
                        </span>
                      )}
                    </button>

                    {move &&
                    !isTouchPickerLayout &&
                    openMoveSlot !== index &&
                    suppressedMoveTooltipSlot !== index ? (
                      <MoveTooltip move={move} />
                    ) : null}

                    {openMoveSlot === index && !isTouchPickerLayout ? (
                      <div className="move-menu">
                        <input
                          className="move-search-input"
                          aria-label={t("builder.searchAvailableMoves")}
                          autoFocus
                          value={moveQuery}
                          placeholder={t("filter.searchMoves")}
                          onChange={(event) => {
                            setMoveQuery(event.target.value);
                            resetMoveOptions();
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
                          onScroll={handleMoveOptionsScroll}
                        >
                          {renderMoveOptionRows(index, false)}
                        </div>
                      </div>
                    ) : null}

                    {openMoveSlot === index &&
                    !isTouchPickerLayout &&
                    hoveredMoveOption ? (
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
                    resetCandidateFilterOptions();
                  }}
                  onResultsScroll={handleCandidateFilterOptionsScroll}
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
                <section className="stats-editor" aria-label={t("builder.pokemonStats")}>
                  <div className="stats-editor-header stats-editor-header-mobile">
                    <h2>{t("builder.stats")}</h2>
                    <span className="ev-total">
                      {t("builder.evTotal", {
                        current: evTotal,
                        max: CHAMPIONS_MAX_EV_TOTAL,
                      })}
                    </span>
                  </div>

                  <div className="stats-editor-body">
                    <div className="stat-axis-labels" aria-hidden="true">
                      <span className="is-base">{t("builder.base")}</span>
                      <span className="is-ev">{t("builder.ev")}</span>
                      <span className="is-stat">{t("builder.stat")}</span>
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
                            <strong className="stat-editor-label">
                              {getLocalizedStatLabel(stat)}
                            </strong>
                            <span className="stat-base-value">{baseStats[stat]}</span>

                            <div className="ev-vertical-track">
                              <input
                                className="ev-vertical-range"
                                type="range"
                                aria-label={t("builder.evSlider", {
                                  stat: getLocalizedStatLabel(stat),
                                })}
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
                              <span className="sr-only">
                                {getLocalizedStatLabel(stat)} {t("builder.ev")}
                              </span>
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
                                        ? t("builder.natureIncreases")
                                        : t("builder.natureDecreases")
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
            <div className="type-stack" aria-label={t("builder.pokemonType")}>
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
      {renderTouchSelectionDialog()}
      <BuilderSharePreview
        target={shareImageTarget}
        teamName={teamName}
        builds={sharePokemonBuilds}
        onTargetChange={setShareImageTarget}
        onClose={() => setShareImageTarget(null)}
      />
    </section>
  );
}

