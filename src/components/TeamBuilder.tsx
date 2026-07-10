import { useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileExport,
  faFileImport,
  faFileLines,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchAbility,
  fetchItem,
  fetchPokemon,
} from "../api/pokeApi";
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
  ItemIndexEntry,
  PokemonAbility,
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
import { getPokemonLookupAliases } from "../utils/pokemonAliases";
import { PokemonIcon } from "./PokemonIcon";
import { TypeBadge } from "./TypeBadge";

type TeamBuilderProps = {
  team: TeamSlot[];
  pool: TeamMember[];
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  showdownLegality?: ShowdownLegalitySnapshot | null;
  searchError: string | null;
  buildState: TeamBuildStateController;
  onChangeSlot: (slotIndex: number, memberId: string) => void;
  onSelectPokemon: (
    slotIndex: number,
    lookup: string,
    options?: { applyUsageStats?: boolean },
  ) => Promise<void>;
  onClearSlot: (slotIndex: number) => void;
  onExportShowdown: (slotIndex: number) => string;
  onImportShowdown: (slotIndex: number, text: string) => Promise<void>;
};

type PokemonSelectOption = {
  id: string;
  name: string;
  number: number;
};

const popularPokemonPageSize = 20;

function normalizeSelectLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getBaseUsageLookup(value: string) {
  const withoutMega = value.replace(/-mega(?:-.+)?$/, "");
  const regionalMatch = withoutMega.match(/^(.+)-(alola|galar|hisui|paldea)$/);

  if (regionalMatch) {
    return withoutMega;
  }

  return withoutMega.split("-")[0];
}

type Nature = {
  id: string;
  label: string;
  up: BattleStatKey;
  down: BattleStatKey;
};

type BattleStatKey = Exclude<StatKey, "hp">;

type NatureGridPosition = {
  upIndex: number;
  downIndex: number;
};

type MoveOptionScrollMode = "start" | "nearest";

function withoutSlot<T>(record: Record<number, T>, slotIndex: number) {
  const nextRecord = { ...record };
  delete nextRecord[slotIndex];
  return nextRecord;
}

const statKeys: StatKey[] = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

const statLabels: Record<StatKey, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  specialAttack: "Sp.A",
  specialDefense: "Sp.D",
  speed: "Spe",
};

const battleStatKeys: BattleStatKey[] = [
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

const natureStatLabels: Record<BattleStatKey, string> = {
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Speed",
};

const natures: Nature[] = [
  { id: "hardy", label: "Hardy", up: "attack", down: "attack" },
  { id: "lonely", label: "Lonely", up: "attack", down: "defense" },
  { id: "adamant", label: "Adamant", up: "attack", down: "specialAttack" },
  { id: "naughty", label: "Naughty", up: "attack", down: "specialDefense" },
  { id: "brave", label: "Brave", up: "attack", down: "speed" },
  { id: "modest", label: "Modest", up: "specialAttack", down: "attack" },
  { id: "mild", label: "Mild", up: "specialAttack", down: "defense" },
  { id: "bashful", label: "Bashful", up: "specialAttack", down: "specialAttack" },
  { id: "rash", label: "Rash", up: "specialAttack", down: "specialDefense" },
  { id: "quiet", label: "Quiet", up: "specialAttack", down: "speed" },
  { id: "timid", label: "Timid", up: "speed", down: "attack" },
  { id: "hasty", label: "Hasty", up: "speed", down: "defense" },
  { id: "jolly", label: "Jolly", up: "speed", down: "specialAttack" },
  { id: "naive", label: "Naive", up: "speed", down: "specialDefense" },
  { id: "serious", label: "Serious", up: "speed", down: "speed" },
  { id: "bold", label: "Bold", up: "defense", down: "attack" },
  { id: "docile", label: "Docile", up: "defense", down: "defense" },
  { id: "impish", label: "Impish", up: "defense", down: "specialAttack" },
  { id: "lax", label: "Lax", up: "defense", down: "specialDefense" },
  { id: "relaxed", label: "Relaxed", up: "defense", down: "speed" },
  { id: "calm", label: "Calm", up: "specialDefense", down: "attack" },
  { id: "gentle", label: "Gentle", up: "specialDefense", down: "defense" },
  { id: "careful", label: "Careful", up: "specialDefense", down: "specialAttack" },
  { id: "quirky", label: "Quirky", up: "specialDefense", down: "specialDefense" },
  { id: "sassy", label: "Sassy", up: "specialDefense", down: "speed" },
];

const natureByAlignment = new Map(
  natures.map((nature) => [`${nature.up}:${nature.down}`, nature]),
);

const defaultStats: StatBlock = {
  hp: 80,
  attack: 80,
  defense: 80,
  specialAttack: 80,
  specialDefense: 80,
  speed: 80,
};

const defaultEvs: StatBlock = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

const CHAMPIONS_IV_STAT_BONUS = 20;
const CHAMPIONS_MAX_EV_PER_STAT = 32;
const CHAMPIONS_MAX_EV_TOTAL = 66;
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

function getNatureMultiplier(nature: Nature, stat: StatKey) {
  if (stat === "hp") {
    return 1;
  }

  if (nature.up === nature.down) {
    return 1;
  }

  if (nature.up === stat) {
    return 1.1;
  }

  if (nature.down === stat) {
    return 0.9;
  }

  return 1;
}

function calculateStats(baseStats: StatBlock, evs: StatBlock, nature: Nature): StatBlock {
  return statKeys.reduce((result, stat) => {
    const base = baseStats[stat];
    const ev = Math.max(0, Math.min(CHAMPIONS_MAX_EV_PER_STAT, evs[stat]));
    const raw = base + CHAMPIONS_IV_STAT_BONUS + ev;

    result[stat] = Math.floor(raw * getNatureMultiplier(nature, stat));
    return result;
  }, {} as StatBlock);
}

function formatPokemonName(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCommonPrefixLength(first: string, second: string) {
  const maxLength = Math.min(first.length, second.length);
  let index = 0;

  while (index < maxLength && first[index] === second[index]) {
    index += 1;
  }

  return index;
}

function normalizeMoveLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeAbilityLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function itemFromIndexEntry(option: ItemIndexEntry): PokemonItem {
  return {
    id: option.name,
    name: option.displayName,
    category: option.isMegaStone ? "Mega Stones" : undefined,
  };
}

function getItemEffectText(item: PokemonItem) {
  return (
    item.effect
      ?.replace(/\$effect_chance/g, "effect chance")
      .replace(/\s+/g, " ")
      .trim() || "Item details are not available from PokeAPI."
  );
}

function getAbilityApiLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getAbilityEffectText(ability: PokemonAbility) {
  return (
    (ability.shortEffect ?? ability.effect)
      ?.replace(/\$effect_chance/g, "effect chance")
      .replace(/\s+/g, " ")
      .trim() || "Ability details are not available from PokeAPI."
  );
}

function getMoveCategoryClass(category?: string) {
  const normalized = category?.toLowerCase();

  if (normalized === "physical" || normalized === "special" || normalized === "status") {
    return normalized;
  }

  return "status";
}

function isExactPokemonFormLegal(
  showdownLegality: ShowdownLegalitySnapshot | null | undefined,
  pokemonId: string,
) {
  if (!showdownLegality || showdownLegality.pokemonIds.size === 0) {
    return true;
  }

  return getShowdownLookupKeys(pokemonId).some((lookup) =>
    showdownLegality.pokemonIds.has(normalizeSelectLookup(lookup)),
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

  return natureByAlignment.get(`${upStat}:${downStat}`) ?? natures[0];
}

function isMegaPokemonName(name: string) {
  return name.includes("-mega");
}

function getMegaSpeciesKey(name: string) {
  if (!isMegaPokemonName(name)) {
    return name;
  }

  return name.includes("-mega-") ? name.split("-mega-")[0] : name.split("-mega")[0];
}

function getMegaStoneItemName(megaPokemonName: string, knownMegaStoneNames: Set<string>) {
  const [speciesKey, suffix = ""] = megaPokemonName.includes("-mega-")
    ? megaPokemonName.split("-mega-")
    : megaPokemonName.split("-mega");

  if (!speciesKey || megaPokemonName === speciesKey) {
    return null;
  }

  const candidate = `${speciesKey}ite${suffix ? `-${suffix}` : ""}`;

  if (knownMegaStoneNames.has(candidate)) {
    return candidate;
  }

  const normalizedSpeciesKey = speciesKey.replace(/-/g, "");
  const minimumPrefixLength = Math.min(5, normalizedSpeciesKey.length);
  const matchingStones = [...knownMegaStoneNames]
    .map((itemName) => {
      const itemSuffix = itemName.match(/-(x|y|z)$/)?.[1] ?? "";

      if (suffix && itemSuffix !== suffix) {
        return null;
      }

      if (!suffix && itemSuffix) {
        return null;
      }

      const normalizedItemName = itemName.replace(/-(x|y|z)$/, "").replace(/-/g, "");
      const score = getCommonPrefixLength(normalizedSpeciesKey, normalizedItemName);

      return score >= minimumPrefixLength ? { itemName, score } : null;
    })
    .filter((entry): entry is { itemName: string; score: number } => Boolean(entry))
    .sort((first, second) => second.score - first.score);

  return matchingStones[0]?.itemName ?? null;
}

export function TeamBuilder({
  team,
  pool,
  pokemonIndex,
  itemIndex,
  showdownLegality,
  searchError,
  buildState,
  onChangeSlot,
  onSelectPokemon,
  onClearSlot,
  onExportShowdown,
  onImportShowdown,
}: TeamBuilderProps) {
  const {
    itemBySlot,
    abilityBySlot,
    natureBySlot,
    evsBySlot,
    moveIdsBySlot,
    preMegaPokemonBySlot,
    setItemBySlot,
    setAbilityBySlot,
    setNatureBySlot,
    setEvsBySlot,
    setMoveIdsBySlot,
    setPreMegaPokemonBySlot,
  } = buildState;
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [isNamePickerOpen, setIsNamePickerOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [usagePokemonIds, setUsagePokemonIds] = useState<string[] | null>(null);
  const [popularPokemonLimit, setPopularPokemonLimit] = useState(popularPokemonPageSize);
  const [isUsageOrderLoading, setIsUsageOrderLoading] = useState(false);
  const [pendingClearSlot, setPendingClearSlot] = useState<number | null>(null);
  const [isShowdownPanelOpen, setIsShowdownPanelOpen] = useState(false);
  const [showdownText, setShowdownText] = useState("");
  const [showdownPanelMessage, setShowdownPanelMessage] = useState<string | null>(null);
  const [isImportingShowdown, setIsImportingShowdown] = useState(false);
  const teamTabsRef = useRef<HTMLDivElement | null>(null);
  const showdownToolbarRef = useRef<HTMLDivElement | null>(null);
  const showdownPanelRef = useRef<HTMLDivElement | null>(null);
  const clearConfirmRef = useRef<HTMLDivElement | null>(null);
  const namePickerRef = useRef<HTMLDivElement | null>(null);
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
  const [itemDetailsByName, setItemDetailsByName] = useState<Record<string, PokemonItem>>(
    {},
  );
  const [hoveredAbilityOption, setHoveredAbilityOption] =
    useState<PokemonAbility | null>(null);
  const [abilityDetailsByName, setAbilityDetailsByName] = useState<
    Record<string, PokemonAbility>
  >({});
  const [hoveredMoveOption, setHoveredMoveOption] = useState<PokemonMove | null>(null);
  const [supplementalMovesByKey, setSupplementalMovesByKey] = useState<
    Record<string, PokemonMove[]>
  >({});

  const activeMember = team[selectedSlot];
  const activePokemonId = activeMember?.id ?? "";
  const activeItem = itemBySlot[selectedSlot] ?? null;
  const abilityOptions = activeMember?.abilities ?? defaultAbilityOptions;
  const activeIndexEntry = pokemonIndex.find((entry) => entry.name === activePokemonId);
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
          legalAbilitySet.has(normalizeAbilityLookup(ability)),
        )
      : abilityOptions;

    return legalAbilityOptions.length > 0 ? legalAbilityOptions : abilityOptions;
  }, [abilityOptions, legalAbilitySet]);
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
  const selectedNature =
    natures.find((nature) => nature.id === (natureBySlot[selectedSlot] ?? "hardy")) ??
    natures[0];
  const baseStats = activeMember?.baseStats ?? defaultStats;
  const evs = evsBySlot[selectedSlot] ?? defaultEvs;
  const evTotal = statKeys.reduce((total, stat) => total + evs[stat], 0);
  const baseSpeciesMoves = useMemo(
    () => (activeSpeciesKey ? (supplementalMovesByKey[activeSpeciesKey] ?? []) : []),
    [activeSpeciesKey, supplementalMovesByKey],
  );
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
    () => (preMegaPokemonId ? (supplementalMovesByKey[preMegaPokemonId] ?? []) : []),
    [preMegaPokemonId, supplementalMovesByKey],
  );
  const preMegaMoveLookupSet = useMemo(() => {
    if (activeFormKind !== "mega" || preMegaMoves.length === 0) {
      return null;
    }

    return new Set(
      preMegaMoves.flatMap((move) => [
        normalizeMoveLookup(move.id),
        normalizeMoveLookup(move.name),
      ]),
    );
  }, [activeFormKind, preMegaMoves]);
  const baseMoves = useMemo(() => {
    if (!activeMember) {
      return [];
    }

    if (activeFormKind === "mega" && preMegaMoves.length > 0) {
      const merged = new Map<string, PokemonMove>();

      for (const move of activeMember.moves ?? []) {
        merged.set(normalizeMoveLookup(move.id), move);
      }

      for (const move of preMegaMoves) {
        const key = normalizeMoveLookup(move.id);

        if (!merged.has(key)) {
          merged.set(key, move);
        }
      }

      return Array.from(merged.values());
    }

    if (
      activeFormKind !== "form" ||
      !activeSpeciesKey ||
      activeSpeciesKey === activePokemonId ||
      !baseSpeciesMoves?.length
    ) {
      return activeMember.moves ?? [];
    }

    const merged = new Map<string, PokemonMove>();

    for (const move of activeMember.moves ?? []) {
      const key = normalizeMoveLookup(move.id);
      merged.set(key, move);
    }

    for (const move of baseSpeciesMoves) {
      const key = normalizeMoveLookup(move.id);

      if (!merged.has(key)) {
        merged.set(key, move);
      }
    }

    return Array.from(merged.values());
  }, [
    activeFormKind,
    activeMember,
    activePokemonId,
    activeSpeciesKey,
    baseSpeciesMoves,
    preMegaMoves,
  ]);
  const moves = useMemo(() => {
    const legalMoves =
      legalMoveIds && baseMoves.length > 0
        ? baseMoves.filter((move) => {
            const moveId = normalizeMoveLookup(move.id);
            const moveName = normalizeMoveLookup(move.name);

            return (
              legalMoveIds.has(moveId) ||
              legalMoveIds.has(moveName) ||
              preMegaMoveLookupSet?.has(moveId) ||
              preMegaMoveLookupSet?.has(moveName)
            );
          })
        : baseMoves;

    return legalMoves.length ? legalMoves : fallbackMoves(activeMember?.types ?? []);
  }, [activeMember?.types, baseMoves, legalMoveIds, preMegaMoveLookupSet]);
  const selectedMoveIds = moveIdsBySlot[selectedSlot] ?? [];
  const selectedMoves = [0, 1, 2, 3]
    .map((index) => moves.find((move) => move.id === selectedMoveIds[index]) ?? moves[index])
    .filter((move): move is PokemonMove => Boolean(move));
  const openMovePickerMoveId =
    openMoveSlot !== null ? (selectedMoves[openMoveSlot]?.id ?? "") : "";
  const calculatedStats = useMemo(
    () => calculateStats(baseStats, evs, selectedNature),
    [baseStats, evs, selectedNature],
  );
  const knownMegaStoneNames = useMemo(
    () =>
      new Set(itemIndex.filter((item) => item.isMegaStone).map((item) => item.name)),
    [itemIndex],
  );
  const activeHeaderName = activeIndexEntry
    ? formatPokemonName(activeIndexEntry.speciesKey)
    : activeMember?.name;
  const megaOptions = useMemo(
    () =>
      activeSpeciesKey && activeFormKind !== "regional"
        ? pokemonIndex.filter(
            (entry) =>
              entry.speciesKey === activeSpeciesKey &&
              entry.formKind === "mega" &&
              isExactPokemonFormLegal(showdownLegality, entry.name),
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
              isPokemonLegal(showdownLegality ?? null, entry.name, entry.speciesKey),
            )
            .map((entry) => ({
              id: entry.name,
              name: entry.displayName,
              number: entry.sortNumber ?? entry.id,
            }))
        : pool.map((member) => ({
            id: member.id,
            name: member.name,
            number: 0,
          })),
    [pokemonIndex, pool, showdownLegality],
  );
  const popularSelectOptions = useMemo(() => {
    const optionsByLookup = new Map<string, PokemonSelectOption>();

    for (const option of selectOptions) {
      for (const lookup of getPokemonLookupAliases(option.id)) {
        optionsByLookup.set(normalizeSelectLookup(lookup), option);
      }
    }

    const seenOptionIds = new Set<string>();
    const orderedOptions: PokemonSelectOption[] = [];

    for (const usageId of usagePokemonIds ?? []) {
      const exactOption = getPokemonLookupAliases(usageId)
        .map((lookup) => optionsByLookup.get(normalizeSelectLookup(lookup)))
        .find((option): option is PokemonSelectOption => Boolean(option));
      const baseOption = optionsByLookup.get(normalizeSelectLookup(getBaseUsageLookup(usageId)));
      const option = exactOption ?? baseOption;

      if (!option || seenOptionIds.has(option.id)) {
        continue;
      }

      seenOptionIds.add(option.id);
      orderedOptions.push(option);
    }

    return orderedOptions;
  }, [selectOptions, usagePokemonIds]);
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
  const filteredOptions = useMemo(
    () =>
      normalizedNameQuery
        ? selectOptions
            .filter(
              (option) =>
                option.name.toLowerCase().includes(normalizedNameQuery) ||
                option.id.toLowerCase().includes(normalizedNameQuery) ||
                String(option.number).includes(normalizedNameQuery),
            )
            .slice(0, 40)
        : popularSelectOptions.slice(0, popularPokemonLimit),
    [normalizedNameQuery, popularPokemonLimit, popularSelectOptions, selectOptions],
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
            .slice(0, 40)
        : [],
    [itemOptions, normalizedItemQuery],
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

  useEffect(() => {
    setPopularPokemonLimit(popularPokemonPageSize);
  }, [isNamePickerOpen, normalizedNameQuery]);

  useEffect(() => {
    if (!isNamePickerOpen || usagePokemonIds !== null || isUsageOrderLoading) {
      return undefined;
    }

    let isCurrent = true;
    setIsUsageOrderLoading(true);

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
      })
      .finally(() => {
        if (isCurrent) {
          setIsUsageOrderLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isNamePickerOpen, isUsageOrderLoading, usagePokemonIds]);

  useEffect(() => {
    setActivePokemonOptionIndex((current) => {
      if (filteredOptions.length === 0) {
        return -1;
      }

      return current >= 0 && current < filteredOptions.length ? current : 0;
    });
  }, [filteredOptions]);

  useEffect(() => {
    setActiveItemOptionIndex(filteredItemOptions.length ? 0 : -1);
  }, [filteredItemOptions]);

  useEffect(() => {
    if (filteredMoveOptions.length === 0) {
      setActiveMoveOptionIndex(-1);
      setHoveredMoveOption(null);
      return;
    }

    const selectedOptionIndex = openMovePickerMoveId
      ? filteredMoveOptions.findIndex((move) => move.id === openMovePickerMoveId)
      : -1;
    const nextOptionIndex = selectedOptionIndex >= 0 ? selectedOptionIndex : 0;

    if (openMoveSlot !== null) {
      requestMoveOptionScroll("start", { preserveExisting: true });
    }

    setActiveMoveOptionIndex(nextOptionIndex);
    setHoveredMoveOption(filteredMoveOptions[nextOptionIndex] ?? null);
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
      const validMoveIds = new Set(moves.map((move) => move.id));

      if (defaultMoveIds.length === 0) {
        return current;
      }

      const nextMoveIds = defaultMoveIds.map(
        (moveId, index) =>
          currentMoveIds[index] && validMoveIds.has(currentMoveIds[index])
            ? currentMoveIds[index]
            : moveId,
      );
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
  }, [activeMoveOptionIndex, filteredMoveOptions, openMoveSlot]);

  useEffect(() => {
    if (!isNamePickerOpen) {
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
  }, [isNamePickerOpen]);

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
    if (!isItemPickerOpen || filteredItemOptions.length === 0) {
      return;
    }

    const missingItemOptions = filteredItemOptions.filter(
      (option) => !itemDetailsByName[option.name],
    );

    if (missingItemOptions.length === 0) {
      return;
    }

    let isCurrent = true;

    void (async () => {
      const items = await Promise.all(
        missingItemOptions.map(async (option) => {
          try {
            return await fetchItem(option.name);
          } catch {
            return null;
          }
        }),
      );

      if (!isCurrent) {
        return;
      }

      setItemDetailsByName((current) => {
        const next = { ...current };

        for (const item of items) {
          if (item) {
            next[item.id] = item;
          }
        }

        return next;
      });
    })();

    return () => {
      isCurrent = false;
    };
  }, [filteredItemOptions, isItemPickerOpen, itemDetailsByName]);

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
    if (!activeMegaStoneName || !activeMegaStoneOption) {
      return;
    }

    let isCurrent = true;
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

    async function lockMegaStone() {
      try {
        const item = await fetchItem(activeMegaStoneName!);

        if (!isCurrent) {
          return;
        }

        setItemDetailsByName((current) => ({
          ...current,
          [activeMegaStoneName!]: item,
        }));
        setItemBySlot((current) => ({
          ...current,
          [selectedSlot]: item,
        }));
      } catch {
        // The index fallback above keeps new or incomplete Mega Stones selectable.
      }
    }

    void lockMegaStone();

    return () => {
      isCurrent = false;
    };
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
      !activeMember ||
      activePokemonId.length === 0 ||
      activeFormKind !== "form" ||
      !activeSpeciesKey ||
      activeSpeciesKey === activePokemonId ||
      supplementalMovesByKey[activeSpeciesKey] !== undefined
    ) {
      return;
    }

    let isCurrent = true;

    void (async () => {
      try {
        const speciesMember = await fetchPokemon(activeSpeciesKey);

        if (!isCurrent) {
          return;
        }

        setSupplementalMovesByKey((current) => ({
          ...current,
          [activeSpeciesKey]: speciesMember.moves ?? [],
        }));
      } catch {
        if (!isCurrent) {
          return;
        }

        setSupplementalMovesByKey((current) => ({
          ...current,
          [activeSpeciesKey]: [],
        }));
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [
    activeFormKind,
    activeMember,
    activePokemonId,
    activeSpeciesKey,
    supplementalMovesByKey,
    selectedSlot,
  ]);

  useEffect(() => {
    if (
      !preMegaPokemonId ||
      preMegaPokemonId === activePokemonId ||
      supplementalMovesByKey[preMegaPokemonId] !== undefined
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

        setSupplementalMovesByKey((current) => ({
          ...current,
          [preMegaPokemonId]: preMegaMember.moves ?? [],
        }));
      } catch {
        if (!isCurrent) {
          return;
        }

        setSupplementalMovesByKey((current) => ({
          ...current,
          [preMegaPokemonId]: [],
        }));
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [activePokemonId, preMegaPokemonId, supplementalMovesByKey]);

  function closeNamePicker() {
    setIsNamePickerOpen(false);
    setNameQuery("");
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

    return selectedOptionIndex >= 0 ? selectedOptionIndex : 0;
  }

  function setMoveOptionPreview(optionIndex: number) {
    setActiveMoveOptionIndex(optionIndex);
    setHoveredMoveOption(moves[optionIndex] ?? null);
  }

  function toggleMovePicker(index: number, moveId: string) {
    if (openMoveSlot === index) {
      closeMovePicker();
      return;
    }

    requestMoveOptionScroll("start");
    setMoveOptionPreview(getMoveOptionIndex(moveId));
    setMoveQuery("");
    setOpenMoveSlot(index);
  }

  function resetSlotEditorState(slotIndex: number) {
    setItemBySlot((current) => withoutSlot(current, slotIndex));
    setAbilityBySlot((current) => withoutSlot(current, slotIndex));
    setNatureBySlot((current) => withoutSlot(current, slotIndex));
    setEvsBySlot((current) => withoutSlot(current, slotIndex));
    setMoveIdsBySlot((current) => withoutSlot(current, slotIndex));
    setPreMegaPokemonBySlot((current) => withoutSlot(current, slotIndex));
  }

  function handleClearSlot(slotIndex: number) {
    onClearSlot(slotIndex);
    resetSlotEditorState(slotIndex);
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

  async function handleSelectItem(value: string) {
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

    try {
      const item = await fetchItem(value);

      setItemDetailsByName((current) => ({
        ...current,
        [value]: item,
      }));
      setItemBySlot((current) => ({
        ...current,
        [selectedSlot]: item,
      }));
    } catch {
      // Keep the index-backed item when detailed PokeAPI data is missing.
    }
  }

  async function previewItem(itemId: string, fallbackItem: PokemonItem) {
    const cachedItem = itemDetailsByName[itemId];

    setHoveredItemOption(cachedItem ?? fallbackItem);

    if (cachedItem?.effect) {
      return;
    }

    try {
      const item = await fetchItem(itemId);

      setItemDetailsByName((current) => ({
        ...current,
        [itemId]: item,
      }));
      setHoveredItemOption((current) => (current?.id === itemId ? item : current));
    } catch {
      // Keep the index-backed preview when detailed PokeAPI data is missing.
    }
  }

  async function previewAbility(abilityName: string) {
    const abilityId = getAbilityApiLookup(abilityName);

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
      // Keep the name-only preview when detailed PokeAPI data is missing.
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
    if (normalizedNameQuery || filteredOptions.length >= popularSelectOptions.length) {
      return;
    }

    const target = event.currentTarget;
    const remainingScroll =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    if (remainingScroll > 32) {
      return;
    }

    setPopularPokemonLimit((current) => current + popularPokemonPageSize);
  }

  function previewItemOptionAt(index: number) {
    const option = filteredItemOptions[index];

    if (!option) {
      setHoveredItemOption(null);
      return;
    }

    const previewItemOption = itemDetailsByName[option.name] ?? itemFromIndexEntry(option);
    void previewItem(option.name, previewItemOption);
  }

  function moveItemKeyboardOption(direction: 1 | -1) {
    setActiveItemOptionIndex((current) => {
      const nextIndex = getNextOptionIndex(current, filteredItemOptions.length, direction);
      previewItemOptionAt(nextIndex);
      return nextIndex;
    });
  }

  function selectActiveItemOption() {
    const option = getActiveOption(filteredItemOptions, activeItemOptionIndex);

    if (option) {
      void handleSelectItem(option.name);
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
      const nextIndex = getNextOptionIndex(current, filteredMoveOptions.length, direction);
      moveOptionScrollModeRef.current = "nearest";
      setHoveredMoveOption(filteredMoveOptions[nextIndex] ?? null);
      return nextIndex;
    });
  }

  function selectActiveMoveOption(slotIndex: number) {
    const move = getActiveOption(filteredMoveOptions, activeMoveOptionIndex);

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

  function toggleShowdownPanel() {
    if (isShowdownPanelOpen) {
      setIsShowdownPanelOpen(false);
      setShowdownPanelMessage(null);
      return;
    }

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
        aria-label="Showdown team tools"
        ref={showdownToolbarRef}
      >
        <button className="builder-card-tool-button" type="button" onClick={toggleShowdownPanel}>
          <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
          Showdown Text
        </button>
        {activeMember ? (
          <button
            className="builder-card-tool-button is-danger"
            type="button"
            onClick={() => {
              setIsShowdownPanelOpen(false);
              setPendingClearSlot((currentSlot) =>
                currentSlot === selectedSlot ? null : selectedSlot,
              );
            }}
          >
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
            Clear
          </button>
        ) : null}
      </div>

      {activeMember && pendingClearSlot === selectedSlot ? (
        <div
          className="clear-pokemon-confirm"
          role="dialog"
          aria-label="Confirm Pokemon clear"
          ref={clearConfirmRef}
        >
          <strong>Remove this Pokemon?</strong>
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

      <div className="builder-card-layout">
        <div className="team-tabs" aria-label="Current team" ref={teamTabsRef}>
        {team.map((member, index) => (
          <div
            className={`team-tab-shell ${selectedSlot === index ? "is-active" : ""}`}
            key={`${member?.id ?? "empty"}-${index}`}
          >
            <button
              className={`team-tab ${selectedSlot === index ? "is-active" : ""} ${
                member ? "" : "is-empty"
              }`}
              type="button"
              onClick={() => {
                setSelectedSlot(index);
                setPendingClearSlot(null);
                closeNamePicker();
                closeItemPicker();
                closeTraitPicker();
                closeMovePicker();
                if (!member) {
                  setIsNamePickerOpen(true);
                  setNameQuery("");
                }
              }}
              aria-label={member ? `Show slot ${index + 1}` : `Add Pokemon to slot ${index + 1}`}
            >
              {member ? (
                <PokemonIcon pokemon={member} />
              ) : (
                <span>+</span>
              )}
            </button>
          </div>
        ))}
      </div>

      <article
        className="pokemon-card"
        onClick={(event) => {
          if (activeMember || isNamePickerOpen) {
            return;
          }

          const target = event.target as HTMLElement;

          if (target.closest(".pokemon-name-picker")) {
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
                {isNamePickerOpen ? (
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
                    aria-expanded={isNamePickerOpen}
                    onClick={() => setIsNamePickerOpen(true)}
                  >
                    {activeHeaderName ?? "Pokemon"}
                  </button>
                )}

                {isNamePickerOpen ? (
                  <div
                    className="pokemon-name-menu"
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
                        {option.number ? <small>#{option.number}</small> : null}
                      </button>
                    ))}
                    {!normalizedNameQuery && isUsageOrderLoading ? (
                      <div className="pokemon-name-empty">Loading popular Pokemon</div>
                    ) : null}
                    {!normalizedNameQuery &&
                    !isUsageOrderLoading &&
                    usagePokemonIds !== null &&
                    filteredOptions.length === 0 ? (
                      <div className="pokemon-name-empty">Type to search Pokemon</div>
                    ) : null}
                    {normalizedNameQuery && filteredOptions.length === 0 ? (
                      <div className="pokemon-name-empty">No Pokemon found</div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!isNamePickerOpen && visibleMegaOptions.length > 0 ? (
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

            </div>

            {searchError ? (
              <p className="search-error" role="alert">
                {searchError}
              </p>
            ) : null}

            {activeMember ? (
            <div className="meta-row">
              <div
                className="item-picker"
                ref={itemPickerRef}
                onMouseEnter={() => {
                  if (!isItemPickerOpen && activeItem) {
                    void previewItem(activeItem.id, activeItem);
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
                      void previewItem(activeItem.id, activeItem);
                    }
                  }}
                  onMouseEnter={() => {
                    if (activeItem) {
                      void previewItem(activeItem.id, activeItem);
                    }
                  }}
                  onMouseLeave={() => setHoveredItemOption(null)}
                >
                  {activeItem?.spriteUrl ? (
                    <img src={activeItem.spriteUrl} alt="" />
                  ) : activeItem ? (
                    <span className="item-fallback-label">
                      {activeItem.category === "Mega Stones" ? "M" : activeItem.name.charAt(0)}
                    </span>
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

                        if (event.key === "Enter" && filteredItemOptions.length > 0) {
                          event.preventDefault();
                          selectActiveItemOption();
                        }
                      }}
                    />

                    <div className="item-results" role="listbox">
                      {filteredItemOptions.map((option, optionIndex) => {
                        const previewItemOption =
                          itemDetailsByName[option.name] ?? itemFromIndexEntry(option);

                        return (
                          <button
                            className="item-option"
                            type="button"
                            role="option"
                            aria-selected={activeItemOptionIndex === optionIndex}
                            key={option.name}
                            aria-describedby="item-option-tooltip"
                            onBlur={() => setHoveredItemOption(null)}
                            onFocus={() =>
                              void previewItem(option.name, previewItemOption)
                            }
                            onMouseEnter={() => {
                              setActiveItemOptionIndex(optionIndex);
                              void previewItem(option.name, previewItemOption);
                            }}
                            onMouseLeave={() => setHoveredItemOption(null)}
                            onClick={() => void handleSelectItem(option.name)}
                          >
                            <span className="item-option-icon" aria-hidden="true">
                              {previewItemOption.spriteUrl ? (
                                <img src={previewItemOption.spriteUrl} alt="" />
                              ) : (
                                <span className="item-fallback-label">
                                  {previewItemOption.category === "Mega Stones"
                                    ? "M"
                                    : previewItemOption.name.charAt(0)}
                                </span>
                              )}
                            </span>
                            <span className="item-option-name">{option.displayName}</span>
                          </button>
                        );
                      })}
                      {!normalizedItemQuery ? (
                        <div className="item-empty">Type to search items</div>
                      ) : null}
                      {normalizedItemQuery && filteredItemOptions.length === 0 ? (
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
                      {hoveredItemOption.spriteUrl ? (
                        <img src={hoveredItemOption.spriteUrl} alt="" />
                      ) : (
                        <span className="item-fallback-label">
                          {hoveredItemOption.category === "Mega Stones"
                            ? "M"
                            : hoveredItemOption.name.charAt(0)}
                        </span>
                      )}
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
                    <div className="trait-menu" role="listbox">
                      {displayedAbilityOptions.map((ability, optionIndex) => (
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
                              const nature = natureByAlignment.get(`${upStat}:${downStat}`)!;
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
            ) : null}

            <div className="move-list" aria-label="Selected moves" ref={movePickerRef}>
              {activeMember ? (
                selectedMoves.map((move, index) => (
                  <div className="move-picker" key={`${index}-${move.id}`}>
                    <button
                      className={`move-pill type-${move.type}`}
                      type="button"
                      aria-expanded={openMoveSlot === index}
                      onClick={() => toggleMovePicker(index, move.id)}
                    >
                      <span className="move-type-mark">
                        <TypeBadge type={move.type} />
                      </span>
                      <span className="move-name">{move.name}</span>
                      <span className="move-power-panel">{move.power ?? "-"}</span>
                    </button>

                    {openMoveSlot !== index ? (
                      <aside className={`move-tooltip type-${move.type}`} role="tooltip">
                        <div className="move-tooltip-shell">
                          <div className="move-tooltip-header">
                            <span className="move-tooltip-type">
                              <TypeBadge type={move.type} />
                            </span>
                            <strong>{move.name}</strong>
                            <span
                              className={`move-category-icon is-${getMoveCategoryClass(
                                move.category,
                              )}`}
                              aria-label={move.category ?? "Move category"}
                              title={move.category ?? "Move category"}
                            />
                          </div>

                          <div className="move-tooltip-body">
                            <dl className="move-tooltip-stats">
                              <div>
                                <dt>Power</dt>
                                <dd>{move.power ?? "-"}</dd>
                              </div>
                              <div>
                                <dt>Accuracy</dt>
                                <dd>{move.accuracy ?? "-"}</dd>
                              </div>
                              <div>
                                <dt>PP</dt>
                                <dd>{move.pp}</dd>
                              </div>
                            </dl>

                            <p>{move.description}</p>

                            {move.tags?.length ? (
                              <div className="move-tooltip-tags" aria-label="Move tags">
                                {move.tags.map((tag) => (
                                  <span key={tag}>#{tag}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </aside>
                    ) : null}

                    {openMoveSlot === index ? (
                      <div className="move-menu">
                        <input
                          className="move-search-input"
                          aria-label="Search available moves"
                          autoFocus
                          value={moveQuery}
                          placeholder="Search moves"
                          onChange={(event) => setMoveQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              closeMovePicker();
                            }

                            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                              event.preventDefault();
                              moveMoveKeyboardOption(event.key === "ArrowDown" ? 1 : -1);
                            }

                            if (event.key === "Enter" && filteredMoveOptions.length > 0) {
                              event.preventDefault();
                              selectActiveMoveOption(index);
                            }
                          }}
                        />

                        <div className="move-results" role="listbox" ref={moveResultsRef}>
                          {filteredMoveOptions.length ? (
                            filteredMoveOptions.map((option, optionIndex) => (
                              <button
                                className={`move-option type-${option.type} ${
                                  activeMoveOptionIndex === optionIndex
                                    ? "is-keyboard-active"
                                    : ""
                                }`}
                                type="button"
                                role="option"
                                key={option.id}
                                aria-selected={activeMoveOptionIndex === optionIndex}
                                aria-describedby={`move-option-tooltip-${index}`}
                                onBlur={() => setHoveredMoveOption(null)}
                                onFocus={() => {
                                  setActiveMoveOptionIndex(optionIndex);
                                  setHoveredMoveOption(option);
                                }}
                                onMouseEnter={() => {
                                  setActiveMoveOptionIndex(optionIndex);
                                  setHoveredMoveOption(option);
                                }}
                                onMouseLeave={() => setHoveredMoveOption(null)}
                                onClick={() => selectMove(index, option.id)}
                              >
                                <span className="move-type-mark">
                                  <TypeBadge type={option.type} />
                                </span>
                                <span className="move-name">{option.name}</span>
                                <span className="move-power-panel">{option.power ?? "-"}</span>
                              </button>
                            ))
                          ) : (
                            <div className="move-empty">No moves found.</div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {openMoveSlot === index && hoveredMoveOption ? (
                      <aside
                        className={`move-tooltip move-option-tooltip type-${hoveredMoveOption.type}`}
                        id={`move-option-tooltip-${index}`}
                        role="tooltip"
                      >
                        <div className="move-tooltip-shell">
                          <div className="move-tooltip-header">
                            <span className="move-tooltip-type">
                              <TypeBadge type={hoveredMoveOption.type} />
                            </span>
                            <strong>{hoveredMoveOption.name}</strong>
                            <span
                              className={`move-category-icon is-${getMoveCategoryClass(
                                hoveredMoveOption.category,
                              )}`}
                              aria-label={hoveredMoveOption.category ?? "Move category"}
                              title={hoveredMoveOption.category ?? "Move category"}
                            />
                          </div>

                          <div className="move-tooltip-body">
                            <dl className="move-tooltip-stats">
                              <div>
                                <dt>Power</dt>
                                <dd>{hoveredMoveOption.power ?? "-"}</dd>
                              </div>
                              <div>
                                <dt>Accuracy</dt>
                                <dd>{hoveredMoveOption.accuracy ?? "-"}</dd>
                              </div>
                              <div>
                                <dt>PP</dt>
                                <dd>{hoveredMoveOption.pp}</dd>
                              </div>
                            </dl>

                            <p>{hoveredMoveOption.description}</p>

                            {hoveredMoveOption.tags?.length ? (
                              <div className="move-tooltip-tags" aria-label="Move tags">
                                {hoveredMoveOption.tags.map((tag) => (
                                  <span key={tag}>#{tag}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </aside>
                    ) : null}
                  </div>
                ))
              ) : null}
            </div>

            {activeMember ? (
              <table className="stats-table" aria-label="Pokemon stats">
              <thead>
                <tr>
                  <th />
                  {statKeys.map((stat) => (
                    <th key={stat}>{statLabels[stat]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Base</th>
                  {statKeys.map((stat) => (
                    <td key={stat}>{baseStats[stat]}</td>
                  ))}
                </tr>
                <tr>
                  <th>
                    EVs
                    <span className="ev-total">{evTotal}/{CHAMPIONS_MAX_EV_TOTAL}</span>
                  </th>
                  {statKeys.map((stat) => (
                    <td key={stat}>
                      <input
                        aria-label={`${statLabels[stat]} EV`}
                        inputMode="numeric"
                        min={0}
                        max={Math.min(
                          CHAMPIONS_MAX_EV_PER_STAT,
                          Math.max(0, CHAMPIONS_MAX_EV_TOTAL - (evTotal - evs[stat])),
                        )}
                        value={evs[stat]}
                        onChange={(event) => updateEv(stat, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>Stats</th>
                  {statKeys.map((stat) => {
                    const natureShift =
                      selectedNature.up !== selectedNature.down && stat === selectedNature.up
                        ? "up"
                        : selectedNature.up !== selectedNature.down &&
                            stat === selectedNature.down
                          ? "down"
                          : null;

                    return (
                      <td key={stat}>
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
                      </td>
                    );
                  })}
                </tr>
              </tbody>
              </table>
            ) : null}
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
    </section>
  );
}

