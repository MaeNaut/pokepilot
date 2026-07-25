import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCalculator,
  faDesktop,
  faFloppyDisk,
  faLanguage,
  faList,
  faMoon,
  faSun,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPokemon } from "./api/pokeApi";
import { fetchItem } from "./api/showdownCatalog";
import { normalizeShowdownId } from "./api/showdownIds";
import {
  loadPopularSmogonSet,
  resolveSmogonUsageMoveIds,
} from "./api/smogonUsage";
import { isPokemonLegal } from "./api/showdownLegality";
import { CopilotPanel } from "./components/CopilotPanel";
import { NewTeamControl } from "./components/NewTeamControl";
import { SavedTeamRow } from "./components/SavedTeamRow";
import { TeamBuilder } from "./components/TeamBuilder";
import { TeamDiagnostics } from "./components/TeamDiagnostics";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  defaultEvs,
} from "./data/natures";
import {
  ACTIVE_TEAM_SIZE,
  MAX_SAVED_TEAMS,
  canAddSavedTeam,
} from "./data/teamLimits";
import { useTeamBuildState } from "./hooks/useTeamBuildState";
import { useBuilderData } from "./hooks/useBuilderData";
import { useDismissOnOutsidePointer } from "./hooks/useDismissOnOutsidePointer";
import { useLongPressReorder } from "./hooks/useLongPressReorder";
import { useMediaQuery } from "./hooks/useMediaQuery";
import {
  getPreferredPokeApiId,
  shouldKeepSelectedPokemonForUsageTarget,
} from "./utils/pokemonAliases";
import { isFullShowdownSpriteUrl } from "./utils/pokemonSprites";
import { swapArrayItems } from "./utils/reorder";
import {
  moveBenchPokemonToTeam,
  moveTeamPokemonToBench,
  type BenchPokemon,
} from "./utils/benchPokemon";
import { analyzeTeam } from "./utils/teamDiagnostics";
import { validateTeam } from "./utils/teamValidity";
import {
  formatShowdownSlot,
  formatShowdownTeam,
  parseShowdownTeam,
  toPokemonId,
} from "./utils/showdownText";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  clearLastActiveTeamId,
  createEmptyBuildState,
  createFallbackMember,
  createSavedBenchPokemon,
  createSavedSlot,
  createSavedTeamId,
  getCopiedTeamName,
  getLastActiveTeamId,
  getStoredTeams,
  serializeTeamSnapshot,
  storeLastActiveTeamId,
  storeTeams,
  type SavedTeamSlot,
  type SavedTeamSummary,
  type TeamSnapshot,
} from "./utils/teamStorage";
import type {
  PokemonItem,
  TeamMember,
  TeamSlot,
} from "./types";
import type { TeamBuildState } from "./utils/teamBuildState";
import type { SmogonUsageSet } from "./api/smogonUsage";
import { useLocalization } from "./i18n/useLocalization";
import type { Locale } from "./i18n/gameTranslations";
import { useTheme } from "./theme/useTheme";
import type { ThemePreference } from "./theme/theme";
import {
  battleFormats,
  type BattleFormat,
} from "./battleFormat/battleFormat";
import { useBattleFormat } from "./battleFormat/useBattleFormat";
import { useAppMode } from "./appMode/useAppMode";

const Calculator = lazy(() =>
  import("./components/Calculator").then((module) => ({
    default: module.Calculator,
  })),
);

type PendingTeamAction =
  | {
      kind: "load";
      team: SavedTeamSummary;
    }
  | {
      kind: "new";
    }
  | {
      kind: "import";
      showdownText: string;
    };

const localizedUntitledTeamNames = new Set(["Untitled Team", "이름 없는 팀"]);

function mergePool(nextMembers: TeamMember[], currentPool: TeamMember[]) {
  const merged = [...nextMembers, ...currentPool];
  return merged.filter(
    (member, index, list) => list.findIndex((item) => item.id === member.id) === index,
  );
}

function hasStaleShowdownIcon(member: TeamMember) {
  return isFullShowdownSpriteUrl(member.iconSpriteUrl);
}

function normalizeImportedEvs(evs: Partial<TeamBuildState["evsBySlot"][number]>) {
  const stats = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
  let remaining = CHAMPIONS_MAX_EV_TOTAL;

  return stats.reduce(
    (normalized, stat) => {
      const value = Math.max(
        0,
        Math.min(CHAMPIONS_MAX_EV_PER_STAT, evs[stat] ?? 0, remaining),
      );

      remaining -= value;

      return {
        ...normalized,
        [stat]: value,
      };
    },
    defaultEvs,
  );
}

function isMegaPokemonId(value: string) {
  return toPokemonId(value).includes("-mega");
}

function App() {
  const { locale, setLocale, t } = useLocalization();
  const { themePreference, setThemePreference } = useTheme();
  const { battleFormat, setBattleFormat } = useBattleFormat();
  const { appMode, setAppMode } = useAppMode();
  const isCompactDrawerLayout = useMediaQuery("(max-width: 1420px)");
  const [team, setTeam] = useState<TeamSlot[]>(() =>
    Array<TeamSlot>(ACTIVE_TEAM_SIZE).fill(null),
  );
  const [hasOpenedCalculator, setHasOpenedCalculator] = useState(
    appMode === "calculator",
  );
  const [bench, setBench] = useState<BenchPokemon[]>([]);
  const [selectedTeamSlot, setSelectedTeamSlot] = useState(0);
  const teamBuildState = useTeamBuildState();
  const {
    pokemonIndex,
    itemIndex,
    showdownLegality,
    pokemonIndexStatus: indexStatus,
    itemIndexStatus,
    showdownLegalityStatus,
    showdownLegalityError,
    retryPokemonIndex,
    retryItemIndex,
    retryShowdownLegality,
  } = useBuilderData();
  const [teamName, setTeamName] = useState(() => t("team.untitled"));
  const [teamNameDraft, setTeamNameDraft] = useState(() => t("team.untitled"));
  const [savedTeams, setSavedTeams] = useState<SavedTeamSummary[]>([]);
  const [activeSavedTeamId, setActiveSavedTeamId] = useState<string | null>(null);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [isNewTeamMenuOpen, setIsNewTeamMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState(false);
  const [isCopilotDrawerTransitioning, setIsCopilotDrawerTransitioning] =
    useState(false);
  const [isNewTeamImportOpen, setIsNewTeamImportOpen] = useState(false);
  const [newTeamShowdownDraft, setNewTeamShowdownDraft] = useState("");
  const [newTeamImportError, setNewTeamImportError] = useState<string | null>(null);
  const [isImportingNewTeam, setIsImportingNewTeam] = useState(false);
  const [teamStorageMessage, setTeamStorageMessage] = useState<string | null>(null);
  const [isSaveConfirmed, setIsSaveConfirmed] = useState(false);
  const [renamingTeamId, setRenamingTeamId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteTeamId, setPendingDeleteTeamId] = useState<string | null>(null);
  const [showdownTeamId, setShowdownTeamId] = useState<string | null>(null);
  const [teamShowdownDraft, setTeamShowdownDraft] = useState("");
  const [isImportingSavedTeam, setIsImportingSavedTeam] = useState(false);
  const [pendingTeamAction, setPendingTeamAction] = useState<PendingTeamAction | null>(
    null,
  );
  const [customPool, setCustomPool] = useState<TeamMember[]>([]);
  const [selectingPokemonSlot, setSelectingPokemonSlot] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<{
    slotIndex: number;
    message: string;
  } | null>(null);
  const [failedPokemonSelection, setFailedPokemonSelection] = useState<{
    slotIndex: number;
    lookup: string;
    options: { applyUsageStats?: boolean; allowBattleForm?: boolean };
  } | null>(null);
  const teamActionsRef = useRef<HTMLElement | null>(null);
  const themeControlRef = useRef<HTMLDivElement | null>(null);
  const themeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const languageControlRef = useRef<HTMLDivElement | null>(null);
  const languageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const copilotDrawerRef = useRef<HTMLDivElement | null>(null);
  const copilotDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savedTeamListRef = useRef<HTMLDivElement | null>(null);
  const saveFeedbackTimeoutRef = useRef<number | null>(null);
  const copilotDrawerTransitionTimeoutRef = useRef<number | null>(null);
  const pokemonSelectionRequestRef = useRef(0);
  const committedSnapshotRef = useRef<string | null>(null);
  const transitionCopilotDrawer = useCallback((nextOpen: boolean) => {
    if (copilotDrawerTransitionTimeoutRef.current !== null) {
      window.clearTimeout(copilotDrawerTransitionTimeoutRef.current);
    }

    setIsCopilotDrawerTransitioning(true);
    setIsCopilotDrawerOpen(nextOpen);
    copilotDrawerTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsCopilotDrawerTransitioning(false);
      copilotDrawerTransitionTimeoutRef.current = null;
    }, 240);
  }, []);
  const teamDiagnostics = useMemo(
    () =>
      analyzeTeam(
        team,
        {
          abilityBySlot: teamBuildState.abilityBySlot,
          evsBySlot: teamBuildState.evsBySlot,
          moveIdsBySlot: teamBuildState.moveIdsBySlot,
          natureBySlot: teamBuildState.natureBySlot,
        },
        customPool,
      ),
    [
      customPool,
      team,
      teamBuildState.abilityBySlot,
      teamBuildState.evsBySlot,
      teamBuildState.moveIdsBySlot,
      teamBuildState.natureBySlot,
    ],
  );
  const teamValidity = useMemo(
    () =>
      validateTeam(
        team,
        {
          abilityBySlot: teamBuildState.abilityBySlot,
          evsBySlot: teamBuildState.evsBySlot,
          itemBySlot: teamBuildState.itemBySlot,
          moveIdsBySlot: teamBuildState.moveIdsBySlot,
          natureBySlot: teamBuildState.natureBySlot,
          preMegaPokemonBySlot: teamBuildState.preMegaPokemonBySlot,
          candidateFiltersBySlot: teamBuildState.candidateFiltersBySlot,
        },
        showdownLegality,
        pokemonIndex,
        itemIndex,
      ),
    [
      itemIndex,
      pokemonIndex,
      showdownLegality,
      team,
      teamBuildState.abilityBySlot,
      teamBuildState.evsBySlot,
      teamBuildState.itemBySlot,
      teamBuildState.moveIdsBySlot,
      teamBuildState.natureBySlot,
      teamBuildState.preMegaPokemonBySlot,
      teamBuildState.candidateFiltersBySlot,
    ],
  );
  const savedTeamReorder = useLongPressReorder({
    containerRef: savedTeamListRef,
    disabled: Boolean(renamingTeamId || pendingDeleteTeamId || showdownTeamId),
    itemSelector: "[data-saved-team-index]",
    onDragStart: () => setTeamStorageMessage(null),
    onReorder: handleReorderSavedTeams,
  });

  const closeTeamManager = useCallback(() => {
    setIsTeamManagerOpen(false);
    setPendingDeleteTeamId(null);
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setRenamingTeamId(null);
    setRenameDraft("");
  }, []);

  const closeNewTeamTools = useCallback(() => {
    setIsNewTeamMenuOpen(false);
    setIsNewTeamImportOpen(false);
    setNewTeamImportError(null);
  }, []);

  function getCurrentTeamSnapshot(name = teamNameDraft): TeamSnapshot {
    return {
      name: name.trim() || t("team.untitled"),
      battleFormat,
      slots: team.map(createSavedSlot),
      bench: bench.map(createSavedBenchPokemon),
      buildState: teamBuildState.getBuildStateSnapshot(),
    };
  }

  function markCurrentTeamCommitted(name = teamNameDraft) {
    committedSnapshotRef.current = serializeTeamSnapshot(getCurrentTeamSnapshot(name));
  }

  function hasUnsavedTeamChanges() {
    if (!committedSnapshotRef.current) {
      return false;
    }

    return (
      serializeTeamSnapshot(getCurrentTeamSnapshot()) !== committedSnapshotRef.current
    );
  }

  function renameCommittedSnapshot(nextName: string) {
    if (!committedSnapshotRef.current) {
      return;
    }

    const committedSnapshot = JSON.parse(committedSnapshotRef.current) as TeamSnapshot;

    committedSnapshotRef.current = serializeTeamSnapshot({
      ...committedSnapshot,
      name: nextName,
    });
  }

  useEffect(() => {
    const storedTeams = getStoredTeams();
    const lastActiveTeamId = getLastActiveTeamId();
    const lastActiveTeam = storedTeams.find(
      (savedTeam) => savedTeam.id === lastActiveTeamId,
    );

    setSavedTeams(storedTeams);

    if (lastActiveTeam) {
      void loadSavedTeam(lastActiveTeam);
    }
    // Startup restore must run once from localStorage instead of following team edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      activeSavedTeamId ||
      !localizedUntitledTeamNames.has(teamName) ||
      !localizedUntitledTeamNames.has(teamNameDraft)
    ) {
      return;
    }

    const localizedName = t("team.untitled");

    if (localizedName !== teamName) {
      setTeamName(localizedName);
      setTeamNameDraft(localizedName);
      renameCommittedSnapshot(localizedName);
    }
  }, [activeSavedTeamId, locale, t, teamName, teamNameDraft]);

  useEffect(
    () => () => {
      if (saveFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(saveFeedbackTimeoutRef.current);
      }

      if (copilotDrawerTransitionTimeoutRef.current !== null) {
        window.clearTimeout(copilotDrawerTransitionTimeoutRef.current);
      }
    },
    [],
  );

  useDismissOnOutsidePointer(
    teamActionsRef,
    isTeamManagerOpen ||
      isNewTeamMenuOpen ||
      isNewTeamImportOpen ||
      Boolean(pendingTeamAction),
    () => {
      closeTeamManager();
      closeNewTeamTools();
      setPendingTeamAction(null);
    },
  );

  useEffect(() => {
    if (!isThemeMenuOpen) {
      return undefined;
    }

    function closeThemeMenu(event: PointerEvent) {
      if (!themeControlRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }

    function handleThemeMenuKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setIsThemeMenuOpen(false);
      themeTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeThemeMenu);
    document.addEventListener("keydown", handleThemeMenuKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeThemeMenu);
      document.removeEventListener("keydown", handleThemeMenuKeyDown);
    };
  }, [isThemeMenuOpen]);

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined;
    }

    function closeLanguageMenu(event: PointerEvent) {
      if (!languageControlRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    }

    function handleLanguageMenuKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setIsLanguageMenuOpen(false);
      languageTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeLanguageMenu);
    document.addEventListener("keydown", handleLanguageMenuKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeLanguageMenu);
      document.removeEventListener("keydown", handleLanguageMenuKeyDown);
    };
  }, [isLanguageMenuOpen]);

  useEffect(() => {
    if (!isCompactDrawerLayout || !isCopilotDrawerOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousScrollPosition = {
      x: window.scrollX,
      y: window.scrollY,
    };
    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    function getFocusableDrawerElements() {
      return Array.from(
        copilotDrawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    }

    function handleCopilotDrawerKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        transitionCopilotDrawer(false);
        copilotDrawerTriggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableDrawerElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        copilotDrawerRef.current?.focus();
        return;
      }

      const activeElement = document.activeElement;
      if (!copilotDrawerRef.current?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleCopilotDrawerKeyDown);
    window.requestAnimationFrame(() => {
      getFocusableDrawerElements()[0]?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleCopilotDrawerKeyDown);
      window.scrollTo(previousScrollPosition.x, previousScrollPosition.y);
    };
  }, [isCompactDrawerLayout, isCopilotDrawerOpen, transitionCopilotDrawer]);

  function hasLegalityFilter() {
    return (
      Boolean(showdownLegality) &&
      !showdownLegality?.error &&
      (showdownLegality?.pokemonIds.size ?? 0) > 0
    );
  }

  function resolveLookupForLegality(query: string) {
    const normalized = query.trim().toLowerCase();
    const numeric = Number.parseInt(normalized, 10);

    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      const matched = pokemonIndex.find((entry) => entry.sortNumber === numeric);

      if (matched) {
        return matched.name;
      }
    }

    return normalized.replace(/\s+/g, "-");
  }

  function resolveSpeciesKeyForLegality(query: string) {
    const lookup = resolveLookupForLegality(query);
    const pokemonByName = pokemonIndex.find((entry) => entry.name === lookup);

    if (pokemonByName) {
      return pokemonByName.speciesKey;
    }

    const numeric = Number.parseInt(lookup, 10);

    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return pokemonIndex.find((entry) => entry.sortNumber === numeric)?.speciesKey;
    }

    return undefined;
  }

  function handleChangeSlot(slotIndex: number, memberId: string) {
    setSearchError(null);
    const nextMember = customPool.find((member) => member.id === memberId) ?? null;

    setTeam((currentTeam) =>
      currentTeam.map((member, index) => (index === slotIndex ? nextMember : member)),
    );
  }

  function handleClearSlot(slotIndex: number) {
    setTeam((currentTeam) =>
      currentTeam.map((member, index) => (index === slotIndex ? null : member)),
    );
  }

  function handleReorderSlots(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    setTeam((currentTeam) =>
      swapArrayItems(currentTeam, sourceIndex, targetIndex),
    );
    teamBuildState.reorderSlots(sourceIndex, targetIndex);
  }

  function handleMoveTeamPokemonToBench(slotIndex: number) {
    const nextState = moveTeamPokemonToBench(
      {
        team,
        bench,
        buildState: teamBuildState.getBuildStateSnapshot(),
      },
      slotIndex,
      createSavedTeamId(),
    );

    setTeam(nextState.team);
    setBench(nextState.bench);
    teamBuildState.replaceBuildState(nextState.buildState);
  }

  function handleMoveBenchPokemonToTeam(benchIndex: number, slotIndex: number) {
    const nextState = moveBenchPokemonToTeam(
      {
        team,
        bench,
        buildState: teamBuildState.getBuildStateSnapshot(),
      },
      benchIndex,
      slotIndex,
      createSavedTeamId(),
    );

    setTeam(nextState.team);
    setBench(nextState.bench);
    setSelectedTeamSlot(slotIndex);
    teamBuildState.replaceBuildState(nextState.buildState);
  }

  function handleReorderBenchPokemon(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    setBench((current) => swapArrayItems(current, sourceIndex, targetIndex));
  }

  function handleRemoveBenchPokemon(benchId: string) {
    setBench((current) => current.filter((entry) => entry.id !== benchId));
  }

  function commitTeamName() {
    const nextName = teamNameDraft.trim() || t("team.untitled");

    setTeamName(nextName);
    setTeamNameDraft(nextName);

    return nextName;
  }

  function toggleTeamManager() {
    closeNewTeamTools();
    setIsThemeMenuOpen(false);
    setIsLanguageMenuOpen(false);
    setPendingTeamAction(null);

    if (isTeamManagerOpen) {
      closeTeamManager();
    } else {
      setIsTeamManagerOpen(true);
    }
  }

  function toggleNewTeamMenu() {
    closeTeamManager();
    setIsThemeMenuOpen(false);
    setIsLanguageMenuOpen(false);
    setPendingTeamAction(null);
    setNewTeamImportError(null);

    if (isNewTeamMenuOpen || isNewTeamImportOpen) {
      closeNewTeamTools();
      return;
    }

    setIsNewTeamMenuOpen(true);
  }

  function toggleThemeMenu() {
    closeTeamManager();
    closeNewTeamTools();
    setIsLanguageMenuOpen(false);
    setPendingTeamAction(null);
    setIsThemeMenuOpen((isOpen) => !isOpen);
  }

  function selectThemePreference(preference: ThemePreference) {
    setThemePreference(preference);
    setIsThemeMenuOpen(false);
    themeTriggerRef.current?.focus();
  }

  function toggleLanguageMenu() {
    closeTeamManager();
    closeNewTeamTools();
    setIsThemeMenuOpen(false);
    setPendingTeamAction(null);
    setIsLanguageMenuOpen((isOpen) => !isOpen);
  }

  function selectLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setIsLanguageMenuOpen(false);
    languageTriggerRef.current?.focus();
  }

  function openNewTeamImport() {
    setIsNewTeamMenuOpen(false);
    setIsNewTeamImportOpen(true);
    setNewTeamImportError(null);
  }

  function openUnsavedWarning(action: PendingTeamAction) {
    closeNewTeamTools();
    setPendingTeamAction(action);
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setTeamStorageMessage(null);
  }

  function requestNewTeam() {
    closeNewTeamTools();

    if (hasUnsavedTeamChanges()) {
      openUnsavedWarning({ kind: "new" });
      return;
    }

    createNewTeam();
  }

  function requestImportNewTeam() {
    const showdownText = newTeamShowdownDraft.trim();

    if (!showdownText) {
      setNewTeamImportError(t("team.pasteAtLeastOne"));
      return;
    }

    if (hasUnsavedTeamChanges()) {
      openUnsavedWarning({ kind: "import", showdownText });
      return;
    }

    void importShowdownAsNewTeam(showdownText);
  }

  function cancelPendingTeamAction() {
    const action = pendingTeamAction;

    setPendingTeamAction(null);

    if (action?.kind === "import") {
      setNewTeamShowdownDraft(action.showdownText);
      setIsNewTeamImportOpen(true);
    }
  }

  function handleTeamNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      const nextName = commitTeamName();
      renameActiveSavedTeam(nextName);
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      setTeamNameDraft(teamName);
      event.currentTarget.blur();
    }
  }

  async function handleSelectPokemon(
    slotIndex: number,
    lookup: string,
    options: { applyUsageStats?: boolean; allowBattleForm?: boolean } = {},
  ) {
    const requestId = pokemonSelectionRequestRef.current + 1;
    pokemonSelectionRequestRef.current = requestId;
    setSelectingPokemonSlot(slotIndex);
    setSearchError(null);
    setSearchNotice(null);
    setFailedPokemonSelection(null);

    if (!lookup) {
      handleClearSlot(slotIndex);
      setSelectingPokemonSlot(null);
      return;
    }

    const speciesKey = resolveSpeciesKeyForLegality(lookup);

    if (
      !options.allowBattleForm &&
      hasLegalityFilter() &&
      !isPokemonLegal(showdownLegality, lookup, speciesKey)
    ) {
      setSearchError(t("builder.illegalPokemon", { name: lookup }));
      setSelectingPokemonSlot(null);
      return;
    }

    try {
      const selectedMember = await resolvePokemonMember(lookup);
      let targetMember = selectedMember;
      let usageSet: SmogonUsageSet | null = null;

      if (options.applyUsageStats) {
        usageSet = await loadPopularSmogonSet(lookup, battleFormat);

        if (usageSet) {
          targetMember = await resolveUsageTargetMember(usageSet, selectedMember);
        } else if (pokemonSelectionRequestRef.current === requestId) {
          setSearchNotice({
            slotIndex,
            message: t("builder.noPopularSet"),
          });
        }
      }

      if (pokemonSelectionRequestRef.current !== requestId) {
        return;
      }

      if (options.applyUsageStats) {
        teamBuildState.clearSlot(slotIndex);
      }

      setCustomPool((currentPool) =>
        mergePool([selectedMember, targetMember], currentPool),
      );
      setTeam((currentTeam) =>
        currentTeam.map((member, index) => (index === slotIndex ? targetMember : member)),
      );

      if (usageSet) {
        await applyUsageSetToSlot(slotIndex, usageSet, selectedMember, targetMember);
      }
    } catch (error) {
      if (pokemonSelectionRequestRef.current === requestId) {
        setSearchError(error instanceof Error ? error.message : t("builder.lookupFailed"));
        setFailedPokemonSelection({ slotIndex, lookup, options });
      }
    } finally {
      if (pokemonSelectionRequestRef.current === requestId) {
        setSelectingPokemonSlot(null);
      }
    }
  }

  function resolveImportedPokemonId(name: string, gender?: "M" | "F") {
    const preferredPokeApiId = getPreferredPokeApiId(name);

    if (preferredPokeApiId) {
      return preferredPokeApiId;
    }

    const normalized = normalizeShowdownId(name);
    const genderLabel = gender === "F" ? "female" : gender === "M" ? "male" : null;
    const genderMatchedEntry = genderLabel
      ? pokemonIndex.find(
          (entry) =>
            normalizeShowdownId(entry.speciesKey) === normalized &&
            entry.formKind === "gender" &&
            entry.formLabel?.toLowerCase() === genderLabel,
        )
      : undefined;

    if (genderMatchedEntry) {
      return genderMatchedEntry.name;
    }

    const matchedEntry = pokemonIndex.find((entry) => {
      const entryNames = [
        entry.name,
        entry.displayName,
        entry.displayName.replace(/\s+/g, "-"),
      ].map(normalizeShowdownId);

      return entryNames.includes(normalized);
    });

    return matchedEntry?.name ?? normalized;
  }

  async function resolvePokemonMember(lookup: string) {
    const localMember = customPool.find((member) => member.id === lookup);

    if (localMember?.baseStats && localMember.abilities && !hasStaleShowdownIcon(localMember)) {
      return localMember;
    }

    return fetchPokemon(lookup);
  }

  function resolveUsageAbility(member: TeamMember, usageSet: SmogonUsageSet) {
    if (!usageSet.ability) {
      return "";
    }

    return (
      member.abilities?.find(
        (ability) =>
          normalizeShowdownId(ability) === normalizeShowdownId(usageSet.ability!),
      ) ??
      usageSet.ability
    );
  }

  async function resolveUsageTargetMember(
    usageSet: SmogonUsageSet,
    selectedMember: TeamMember,
  ) {
    const usagePokemonId = resolveImportedPokemonId(usageSet.pokemonName);

    if (
      normalizeShowdownId(usagePokemonId) === normalizeShowdownId(selectedMember.id) ||
      shouldKeepSelectedPokemonForUsageTarget(selectedMember.id, usagePokemonId)
    ) {
      return selectedMember;
    }

    try {
      return await fetchPokemon(usagePokemonId);
    } catch {
      return selectedMember;
    }
  }

  async function applyUsageSetToSlot(
    slotIndex: number,
    usageSet: SmogonUsageSet,
    selectedMember: TeamMember,
    targetMember: TeamMember,
  ) {
    const ability = resolveUsageAbility(targetMember, usageSet);
    const resolvedMoveIds = resolveSmogonUsageMoveIds(
      targetMember.moves,
      usageSet.moveIds,
    );
    const moveIds = usageSet.moveIds.length
      ? [...resolvedMoveIds, "", "", "", ""].slice(0, 4)
      : undefined;
    let item: PokemonItem | null = null;

    if (usageSet.itemName) {
      try {
        item = await fetchItem(normalizeShowdownId(usageSet.itemName));
      } catch {
        item = null;
      }
    }

    teamBuildState.patchSlot(slotIndex, {
      item,
      ...(ability ? { ability } : {}),
      ...(usageSet.nature ? { nature: usageSet.nature } : {}),
      ...(usageSet.evs ? { evs: normalizeImportedEvs(usageSet.evs) } : {}),
      ...(moveIds ? { moveIds } : {}),
      preMegaPokemon:
        isMegaPokemonId(targetMember.id) && !isMegaPokemonId(selectedMember.id)
          ? selectedMember.id
          : null,
    });
  }

  function getShowdownExportText(slotIndex: number) {
    return formatShowdownSlot(team, teamBuildState.getBuildStateSnapshot(), slotIndex);
  }

  async function buildImportedShowdownSnapshot(text: string) {
    const parsedTeam = parseShowdownTeam(text);

    if (parsedTeam.length === 0) {
      throw new Error(t("team.pasteAtLeastOne"));
    }

    const importedMembers: TeamSlot[] = [];
    const importedBuildState = createEmptyBuildState();

    for (const [slotIndex, parsedPokemon] of parsedTeam.entries()) {
      if (!parsedPokemon.pokemonName) {
        importedMembers.push(null);
        continue;
      }

      const pokemonId = resolveImportedPokemonId(
        parsedPokemon.pokemonName,
        parsedPokemon.gender,
      );
      const member = await fetchPokemon(pokemonId);

      importedMembers.push(member);

      if (parsedPokemon.itemName) {
        try {
          importedBuildState.itemBySlot[slotIndex] = await fetchItem(
            normalizeShowdownId(parsedPokemon.itemName),
          );
        } catch {
          importedBuildState.itemBySlot[slotIndex] = null;
        }
      }

      if (parsedPokemon.ability) {
        importedBuildState.abilityBySlot[slotIndex] = parsedPokemon.ability;
      }

      if (parsedPokemon.nature) {
        importedBuildState.natureBySlot[slotIndex] = parsedPokemon.nature;
      }

      if (parsedPokemon.evs) {
        importedBuildState.evsBySlot[slotIndex] = normalizeImportedEvs(
          parsedPokemon.evs,
        );
      }

      const moveIds = parsedPokemon.moves.map(normalizeShowdownId);
      importedBuildState.moveIdsBySlot[slotIndex] = [0, 1, 2, 3].map(
        (moveIndex) => moveIds[moveIndex] ?? "",
      );
    }

    while (importedMembers.length < ACTIVE_TEAM_SIZE) {
      importedMembers.push(null);
    }

    return {
      members: importedMembers.slice(0, ACTIVE_TEAM_SIZE),
      buildState: importedBuildState,
    };
  }

  async function importShowdownAsNewTeam(text: string) {
    setIsImportingNewTeam(true);
    setNewTeamImportError(null);

    try {
      const importedSnapshot = await buildImportedShowdownSnapshot(text);
      const importedMembers = importedSnapshot.members.filter(
        (member): member is TeamMember => Boolean(member),
      );
      const importedTeamName = t("team.importedName");
      const emptyTeam = Array<TeamSlot>(ACTIVE_TEAM_SIZE).fill(null);

      setCustomPool((currentPool) => mergePool(importedMembers, currentPool));
      setTeam(importedSnapshot.members);
      setBench([]);
      setSelectedTeamSlot(
        Math.max(0, importedSnapshot.members.findIndex((member) => Boolean(member))),
      );
      teamBuildState.replaceBuildState(importedSnapshot.buildState);
      setTeamName(importedTeamName);
      setTeamNameDraft(importedTeamName);
      setActiveSavedTeamId(null);
      clearLastActiveTeamId();
      setTeamStorageMessage(t("team.importedNew"));
      setPendingTeamAction(null);
      setPendingDeleteTeamId(null);
      setRenamingTeamId(null);
      setRenameDraft("");
      setSearchError(null);
      setSearchNotice(null);
      setFailedPokemonSelection(null);
      closeTeamManager();
      closeNewTeamTools();
      setNewTeamShowdownDraft("");
      committedSnapshotRef.current = serializeTeamSnapshot({
        name: importedTeamName,
        battleFormat,
        slots: emptyTeam.map(createSavedSlot),
        bench: [],
        buildState: createEmptyBuildState(),
      });
    } catch (error) {
      setIsNewTeamImportOpen(true);
      setNewTeamImportError(
        error instanceof Error ? error.message : t("toolbar.importFailed"),
      );
    } finally {
      setIsImportingNewTeam(false);
    }
  }

  async function handleImportShowdownSlot(slotIndex: number, text: string) {
    const importedSnapshot = await buildImportedShowdownSnapshot(text);
    const importedMember = importedSnapshot.members[0] ?? null;

    setCustomPool((currentPool) =>
      importedMember ? mergePool([importedMember], currentPool) : currentPool,
    );
    setTeam((currentTeam) =>
      currentTeam.map((member, index) =>
        index === slotIndex ? importedMember : member,
      ),
    );
    teamBuildState.patchSlot(slotIndex, {
      item: importedSnapshot.buildState.itemBySlot[0] ?? null,
      ability: importedSnapshot.buildState.abilityBySlot[0] ?? null,
      nature: importedSnapshot.buildState.natureBySlot[0] ?? "hardy",
      evs: importedSnapshot.buildState.evsBySlot[0] ?? normalizeImportedEvs({}),
      moveIds: importedSnapshot.buildState.moveIdsBySlot[0] ?? [],
      preMegaPokemon:
        importedSnapshot.buildState.preMegaPokemonBySlot[0] ?? null,
    });
    setTeamStorageMessage(t("team.importedPokemon"));
  }

  function handleSaveTeam() {
    const nextName = commitTeamName();
    const now = new Date().toISOString();
    const nextSnapshot = getCurrentTeamSnapshot(nextName);
    const nextTeamId = activeSavedTeamId ?? createSavedTeamId();
    const existingTeam = savedTeams.find((savedTeam) => savedTeam.id === nextTeamId);

    if (!existingTeam && !canAddSavedTeam(savedTeams.length)) {
      setTeamStorageMessage(t("team.limitReached"));
      setIsTeamManagerOpen(true);
      setIsSaveConfirmed(false);
      return;
    }

    const nextSavedTeam: SavedTeamSummary = {
      version: SAVED_TEAM_SCHEMA_VERSION,
      id: nextTeamId,
      name: nextName,
      battleFormat: nextSnapshot.battleFormat,
      slots: nextSnapshot.slots,
      bench: nextSnapshot.bench,
      buildState: nextSnapshot.buildState,
      createdAt: existingTeam?.createdAt ?? now,
      updatedAt: now,
    };
    const nextTeams = existingTeam
      ? savedTeams.map((savedTeam) =>
          savedTeam.id === nextTeamId ? nextSavedTeam : savedTeam,
        )
      : [nextSavedTeam, ...savedTeams];

    storeTeams(nextTeams);
    setSavedTeams(nextTeams);
    setActiveSavedTeamId(nextTeamId);
    storeLastActiveTeamId(nextTeamId);
    setTeamStorageMessage(t("team.savedNamed", { name: nextSavedTeam.name }));
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setPendingTeamAction(null);
    markCurrentTeamCommitted(nextName);
    setIsSaveConfirmed(true);

    if (saveFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(saveFeedbackTimeoutRef.current);
    }

    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setIsSaveConfirmed(false);
      saveFeedbackTimeoutRef.current = null;
    }, 1800);
  }

  function requestLoadSavedTeam(savedTeam: SavedTeamSummary) {
    if (hasUnsavedTeamChanges()) {
      openUnsavedWarning({ kind: "load", team: savedTeam });
      return;
    }

    void loadSavedTeam(savedTeam);
  }

  async function loadSavedTeam(savedTeam: SavedTeamSummary) {
    setTeamStorageMessage(null);

    const [hydratedTeam, hydratedBench] = await Promise.all([
      hydrateSavedTeamMembers(savedTeam),
      hydrateSavedBenchPokemon(savedTeam),
    ]);

    setCustomPool((currentPool) =>
      mergePool(
        [
          ...hydratedTeam.filter((member): member is TeamMember => Boolean(member)),
          ...hydratedBench.map((entry) => entry.member),
        ],
        currentPool,
      ),
    );
    setTeam(hydratedTeam);
    setBench(hydratedBench);
    setTeamName(savedTeam.name);
    setTeamNameDraft(savedTeam.name);
    setBattleFormat(savedTeam.battleFormat);
    teamBuildState.replaceBuildState(savedTeam.buildState);
    setActiveSavedTeamId(savedTeam.id);
    storeLastActiveTeamId(savedTeam.id);
    committedSnapshotRef.current = serializeTeamSnapshot({
      name: savedTeam.name,
      battleFormat: savedTeam.battleFormat,
      slots: savedTeam.slots,
      bench: savedTeam.bench,
      buildState: savedTeam.buildState ?? createEmptyBuildState(),
    });
    closeTeamManager();
  }

  async function hydrateSavedTeamMembers(savedTeam: SavedTeamSummary) {
    return Promise.all(
      savedTeam.slots.map((slot) => (slot ? hydrateSavedPokemon(slot) : null)),
    );
  }

  async function hydrateSavedBenchPokemon(savedTeam: SavedTeamSummary) {
    return Promise.all(
      savedTeam.bench.map(async (entry) => ({
        id: entry.id,
        member: await hydrateSavedPokemon(entry.pokemon),
        build: entry.build,
      })),
    );
  }

  async function hydrateSavedPokemon(slot: Exclude<SavedTeamSlot, null>) {
    const poolMember = customPool.find((member) => member.id === slot.pokemonId);

    if (poolMember && !hasStaleShowdownIcon(poolMember)) {
      return poolMember;
    }

    try {
      return await fetchPokemon(slot.pokemonId);
    } catch {
      return createFallbackMember(slot);
    }
  }

  function createNewTeam() {
    const emptyTeam = Array<TeamSlot>(ACTIVE_TEAM_SIZE).fill(null);

    setTeam(emptyTeam);
    setBench([]);
    teamBuildState.replaceBuildState();
    const untitledTeamName = t("team.untitled");

    setTeamName(untitledTeamName);
    setTeamNameDraft(untitledTeamName);
    setActiveSavedTeamId(null);
    clearLastActiveTeamId();
    setTeamStorageMessage(t("team.newReady"));
    setPendingTeamAction(null);
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setRenameDraft("");
    setIsTeamManagerOpen(false);
    closeNewTeamTools();
    setNewTeamShowdownDraft("");
    committedSnapshotRef.current = serializeTeamSnapshot({
      name: untitledTeamName,
      battleFormat,
      slots: emptyTeam.map(createSavedSlot),
      bench: [],
      buildState: createEmptyBuildState(),
    });
  }

  function confirmPendingTeamAction() {
    const action = pendingTeamAction;

    if (!action) {
      return;
    }

    setPendingTeamAction(null);

    if (action.kind === "new") {
      createNewTeam();
      return;
    }

    if (action.kind === "import") {
      void importShowdownAsNewTeam(action.showdownText);
      return;
    }

    void loadSavedTeam(action.team);
  }

  function getPendingTeamActionMessage(action: PendingTeamAction) {
    if (action.kind === "new") {
      return t("team.discardNew");
    }

    if (action.kind === "import") {
      return t("team.discardImport");
    }

    return t("team.discardLoad", { name: action.team.name });
  }

  function updateSavedTeams(nextTeams: SavedTeamSummary[]) {
    storeTeams(nextTeams);
    setSavedTeams(nextTeams);
  }

  function handleReorderSavedTeams(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    updateSavedTeams(swapArrayItems(savedTeams, sourceIndex, targetIndex));
    setTeamStorageMessage(t("team.reorderedSaved"));
  }

  function handleSavedTeamRowClick(savedTeam: SavedTeamSummary) {
    if (savedTeamReorder.shouldSuppressClick()) {
      return;
    }

    requestLoadSavedTeam(savedTeam);
  }

  function handleSavedTeamRowKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
    savedTeam: SavedTeamSummary,
  ) {
    const isPrevious = event.key === "ArrowUp" || event.key === "ArrowLeft";
    const isNext = event.key === "ArrowDown" || event.key === "ArrowRight";

    if (event.altKey && (isPrevious || isNext)) {
      event.preventDefault();

      const targetIndex = Math.max(
        0,
        Math.min(savedTeams.length - 1, index + (isPrevious ? -1 : 1)),
      );

      if (targetIndex === index) {
        return;
      }

      handleReorderSavedTeams(index, targetIndex);
      window.requestAnimationFrame(() => {
        savedTeamListRef.current
          ?.querySelector<HTMLElement>(
            `[data-saved-team-index="${targetIndex}"]`,
          )
          ?.focus();
      });
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      requestLoadSavedTeam(savedTeam);
    }
  }

  function renameActiveSavedTeam(nextName: string) {
    if (!activeSavedTeamId) {
      return;
    }

    const now = new Date().toISOString();
    const nextTeams = savedTeams.map((savedTeam) =>
      savedTeam.id === activeSavedTeamId
        ? {
            ...savedTeam,
            name: nextName,
            updatedAt: now,
          }
        : savedTeam,
    );

    updateSavedTeams(nextTeams);
    renameCommittedSnapshot(nextName);
    setTeamStorageMessage(t("team.renamedTo", { name: nextName }));
  }

  function startRenameTeam(savedTeam: SavedTeamSummary) {
    setPendingDeleteTeamId(null);
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setRenamingTeamId(savedTeam.id);
    setRenameDraft(savedTeam.name);
    setTeamStorageMessage(null);
  }

  function cancelRenameTeam() {
    setRenamingTeamId(null);
    setRenameDraft("");
  }

  function commitRenameTeam(teamId: string) {
    const nextName = renameDraft.trim();

    if (!nextName) {
      cancelRenameTeam();
      return;
    }

    const now = new Date().toISOString();
    const nextTeams = savedTeams.map((savedTeam) =>
      savedTeam.id === teamId
        ? {
            ...savedTeam,
            name: nextName,
            updatedAt: now,
          }
        : savedTeam,
    );

    updateSavedTeams(nextTeams);

    if (teamId === activeSavedTeamId) {
      setTeamName(nextName);
      setTeamNameDraft(nextName);
      renameCommittedSnapshot(nextName);
    }

    setTeamStorageMessage(t("team.renamedTo", { name: nextName }));
    cancelRenameTeam();
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>, teamId: string) {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      commitRenameTeam(teamId);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRenameTeam();
    }
  }

  function handleDuplicateTeam(savedTeam: SavedTeamSummary) {
    if (!canAddSavedTeam(savedTeams.length)) {
      setTeamStorageMessage(t("team.limitReached"));
      return;
    }

    const now = new Date().toISOString();
    const copiedTeam: SavedTeamSummary = {
      ...savedTeam,
      version: SAVED_TEAM_SCHEMA_VERSION,
      id: createSavedTeamId(),
      name: getCopiedTeamName(savedTeam.name, savedTeams),
      createdAt: now,
      updatedAt: now,
    };
    const nextTeams = [copiedTeam, ...savedTeams];

    updateSavedTeams(nextTeams);
    setTeamStorageMessage(t("team.duplicatedNamed", { name: savedTeam.name }));
    setPendingDeleteTeamId(null);
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setRenamingTeamId(null);
  }

  async function getSavedTeamShowdownText(savedTeam: SavedTeamSummary) {
    const hydratedTeam = await hydrateSavedTeamMembers(savedTeam);

    return formatShowdownTeam(
      hydratedTeam,
      savedTeam.buildState ?? createEmptyBuildState(),
    );
  }

  async function toggleSavedTeamShowdown(savedTeam: SavedTeamSummary) {
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setTeamStorageMessage(null);

    if (showdownTeamId === savedTeam.id) {
      setShowdownTeamId(null);
      setTeamShowdownDraft("");
      return;
    }

    setShowdownTeamId(savedTeam.id);
    setTeamShowdownDraft(await getSavedTeamShowdownText(savedTeam));
  }

  async function handleExportSavedTeam() {
    try {
      await navigator.clipboard.writeText(teamShowdownDraft);
      setTeamStorageMessage(t("team.copiedShowdown"));
    } catch {
      setTeamStorageMessage(t("team.exportCopyFailed"));
    }
  }

  function closeSavedTeamShowdown() {
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setIsImportingSavedTeam(false);
  }

  async function commitImportSavedTeam(savedTeam: SavedTeamSummary) {
    setIsImportingSavedTeam(true);

    try {
      const importedSnapshot = await buildImportedShowdownSnapshot(teamShowdownDraft);
      const now = new Date().toISOString();
      const nextSavedTeam: SavedTeamSummary = {
        ...savedTeam,
        slots: importedSnapshot.members.map(createSavedSlot),
        buildState: importedSnapshot.buildState,
        updatedAt: now,
      };
      const nextTeams = savedTeams.map((teamSummary) =>
        teamSummary.id === savedTeam.id ? nextSavedTeam : teamSummary,
      );

      updateSavedTeams(nextTeams);
      setCustomPool((currentPool) =>
        mergePool(
          importedSnapshot.members.filter(
            (member): member is TeamMember => Boolean(member),
          ),
          currentPool,
        ),
      );

      if (savedTeam.id === activeSavedTeamId) {
        setTeam(importedSnapshot.members);
        teamBuildState.replaceBuildState(importedSnapshot.buildState);
        committedSnapshotRef.current = serializeTeamSnapshot({
          name: savedTeam.name,
          battleFormat: savedTeam.battleFormat,
          slots: nextSavedTeam.slots,
          bench: nextSavedTeam.bench,
          buildState: importedSnapshot.buildState,
        });
      }

      setTeamStorageMessage(t("team.importedInto", { name: savedTeam.name }));
      closeSavedTeamShowdown();
    } catch (error) {
      setTeamStorageMessage(
        error instanceof Error ? error.message : t("toolbar.importFailed"),
      );
      setIsImportingSavedTeam(false);
    }
  }

  function toggleDeleteTeam(teamId: string) {
    setRenamingTeamId(null);
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setPendingDeleteTeamId((currentId) =>
      currentId === teamId ? null : teamId,
    );
    setTeamStorageMessage(null);
  }

  function handleDeleteTeam(teamId: string) {
    const deletedTeam = savedTeams.find((savedTeam) => savedTeam.id === teamId);
    const nextTeams = savedTeams.filter((savedTeam) => savedTeam.id !== teamId);

    updateSavedTeams(nextTeams);

    if (teamId === activeSavedTeamId) {
      setActiveSavedTeamId(null);
      clearLastActiveTeamId();
      committedSnapshotRef.current = null;
    }

    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setTeamStorageMessage(
      deletedTeam
        ? t("team.deletedNamed", { name: deletedTeam.name })
        : t("team.deleted"),
    );
  }

  return (
    <main
      className={`app-shell${
        isCompactDrawerLayout ? " is-compact-drawer-layout" : ""
      }`}
    >
      <header className="app-header">
        <span className="app-wordmark">PokePilot</span>
        <div className="app-header-layout">
          <div className="header-builder-workspace">
            <nav className="team-actions" aria-label={t("team.actions")} ref={teamActionsRef}>
          <button
            className="team-action-button"
            type="button"
            aria-label={t("team.manage")}
            title={t("team.manage")}
            aria-expanded={isTeamManagerOpen}
            onClick={toggleTeamManager}
          >
            <FontAwesomeIcon icon={faList} aria-hidden="true" />
          </button>
          <NewTeamControl
            isMenuOpen={isNewTeamMenuOpen}
            isImportOpen={isNewTeamImportOpen}
            showdownDraft={newTeamShowdownDraft}
            importError={newTeamImportError}
            isImporting={isImportingNewTeam}
            onToggle={toggleNewTeamMenu}
            onCreateTeam={requestNewTeam}
            onOpenImport={openNewTeamImport}
            onShowdownDraftChange={(value) => {
              setNewTeamShowdownDraft(value);
              setNewTeamImportError(null);
            }}
            onImport={requestImportNewTeam}
            onClose={closeNewTeamTools}
          />
          <label className="team-name-field">
            <span className="sr-only">{t("team.name")}</span>
            <input
              type="text"
              value={teamNameDraft}
              aria-label={t("team.name")}
              spellCheck="false"
              onBlur={commitTeamName}
              onChange={(event) => setTeamNameDraft(event.target.value)}
              onKeyDown={handleTeamNameKeyDown}
            />
          </label>
          <button
            className={`team-action-button ${isSaveConfirmed ? "is-confirmed" : ""}`}
            type="button"
            aria-label={t("team.save")}
            title={t("team.save")}
            onClick={handleSaveTeam}
          >
            <FontAwesomeIcon
              icon={isSaveConfirmed ? faCheck : faFloppyDisk}
              aria-hidden="true"
            />
          </button>
          {pendingTeamAction ? (
            <div className="team-unsaved-warning" role="dialog" aria-label={t("team.unsavedDialog")}>
              <strong>{t("team.discardChanges")}</strong>
              <span>{getPendingTeamActionMessage(pendingTeamAction)}</span>
              <div className="team-unsaved-warning-actions">
                <button
                  type="button"
                  onClick={cancelPendingTeamAction}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="is-danger"
                  type="button"
                  onClick={confirmPendingTeamAction}
                >
                  {t("common.continue")}
                </button>
              </div>
            </div>
          ) : null}
          {isTeamManagerOpen ? (
            <div className="team-manager-panel" role="dialog" aria-label={t("team.saved")}>
              <div className="team-manager-header">
                <strong>
                  {t("team.saved")} <small>{savedTeams.length} / {MAX_SAVED_TEAMS}</small>
                </strong>
                <span
                  className={`${teamStorageMessage ? "has-message" : ""} ${
                    teamStorageMessage === t("team.limitReached") ? "is-limit" : ""
                  }`}
                >
                  {teamStorageMessage ?? t("team.manageHint")}
                </span>
              </div>
              {savedTeams.length > 0 ? (
                <div
                  className={`team-manager-list ${
                    savedTeamReorder.isDragging ? "is-reordering" : ""
                  }`}
                  ref={savedTeamListRef}
                >
                  {savedTeams.map((savedTeam, index) => (
                    <SavedTeamRow
                      key={savedTeam.id}
                      team={savedTeam}
                      index={index}
                      isActive={savedTeam.id === activeSavedTeamId}
                      isRenaming={renamingTeamId === savedTeam.id}
                      renameDraft={renameDraft}
                      isDeletePending={pendingDeleteTeamId === savedTeam.id}
                      isShowdownOpen={showdownTeamId === savedTeam.id}
                      showdownDraft={teamShowdownDraft}
                      isImportingShowdown={isImportingSavedTeam}
                      reorder={savedTeamReorder}
                      onSelect={handleSavedTeamRowClick}
                      onKeyDown={handleSavedTeamRowKeyDown}
                      onRenameDraftChange={setRenameDraft}
                      onRenameKeyDown={handleRenameKeyDown}
                      onConfirmRename={commitRenameTeam}
                      onCancelRename={cancelRenameTeam}
                      onStartRename={startRenameTeam}
                      onDuplicate={handleDuplicateTeam}
                      onToggleShowdown={(teamSummary) =>
                        void toggleSavedTeamShowdown(teamSummary)
                      }
                      onToggleDelete={toggleDeleteTeam}
                      onCancelDelete={() => setPendingDeleteTeamId(null)}
                      onDelete={handleDeleteTeam}
                      onShowdownDraftChange={setTeamShowdownDraft}
                      onImportShowdown={(teamSummary) =>
                        void commitImportSavedTeam(teamSummary)
                      }
                      onExportShowdown={() => void handleExportSavedTeam()}
                    />
                  ))}
                </div>
              ) : (
                <p className="team-manager-empty">{t("team.noneSaved")}</p>
              )}
            </div>
          ) : null}
            </nav>
            <div className="header-format-controls">
              <button
                className={`battle-format-switch is-${battleFormat}`}
                type="button"
                aria-label={t(
                  battleFormat === "singles"
                    ? "battleFormat.switchToDoubles"
                    : "battleFormat.switchToSingles",
                )}
                title={t(
                  battleFormat === "singles"
                    ? "battleFormat.switchToDoubles"
                    : "battleFormat.switchToSingles",
                )}
                onClick={() =>
                  setBattleFormat(
                    (battleFormat === "singles"
                      ? "doubles"
                      : "singles") satisfies BattleFormat,
                  )
                }
              >
                {battleFormats.map((format) => (
                  <span
                    className={`battle-format-option${
                      battleFormat === format ? " is-active" : ""
                    }`}
                    aria-hidden="true"
                    key={format}
                  >
                    {t(
                      format === "singles"
                        ? "battleFormat.singles"
                        : "battleFormat.doubles",
                    )}
                  </span>
                ))}
              </button>
              <button
                className="battle-format-compact-toggle"
                type="button"
                aria-label={t(
                  battleFormat === "singles"
                    ? "battleFormat.switchToDoubles"
                    : "battleFormat.switchToSingles",
                )}
                title={t(
                  battleFormat === "singles"
                    ? "battleFormat.switchToDoubles"
                    : "battleFormat.switchToSingles",
                )}
                onClick={() =>
                  setBattleFormat(
                    (battleFormat === "singles"
                      ? "doubles"
                      : "singles") satisfies BattleFormat,
                  )
                }
              >
                {battleFormat === "singles" ? "1v1" : "2v2"}
              </button>
            </div>
          </div>
          <div className="header-mode-controls">
            <button
              className={`app-mode-toggle is-${appMode}`}
              type="button"
              aria-label={t(
                appMode === "builder"
                  ? "nav.switchToCalculator"
                  : "nav.switchToBuilder",
              )}
              title={t(
                appMode === "builder"
                  ? "nav.switchToCalculator"
                  : "nav.switchToBuilder",
              )}
              onClick={() => {
                const nextMode =
                  appMode === "builder" ? "calculator" : "builder";

                if (nextMode === "calculator") {
                  setHasOpenedCalculator(true);
                }

                setAppMode(nextMode);
              }}
            >
              <span
                className={`app-mode-icon${
                  appMode === "builder" ? " is-active" : ""
                }`}
                aria-hidden="true"
              >
                <FontAwesomeIcon icon={faUsers} />
              </span>
              <span
                className={`app-mode-icon${
                  appMode === "calculator" ? " is-active" : ""
                }`}
                aria-hidden="true"
              >
                <FontAwesomeIcon icon={faCalculator} />
              </span>
            </button>
          </div>
          <div className="header-preferences">
            <div className="preference-control theme-control" ref={themeControlRef}>
              <button
                className={`team-action-button preference-trigger theme-trigger ${
                  isThemeMenuOpen ? "is-open" : ""
                }`}
                type="button"
                aria-label={t("theme.label")}
                title={t("theme.label")}
                aria-haspopup="menu"
                aria-expanded={isThemeMenuOpen}
                ref={themeTriggerRef}
                onClick={toggleThemeMenu}
              >
                <FontAwesomeIcon
                  icon={
                    themePreference === "system"
                      ? faDesktop
                      : themePreference === "dark"
                        ? faMoon
                        : faSun
                  }
                  aria-hidden="true"
                />
              </button>
              {isThemeMenuOpen ? (
                <div
                  className="preference-menu theme-menu"
                  role="menu"
                  aria-label={t("theme.label")}
                >
                  {([
                    ["system", "theme.system"],
                    ["light", "theme.light"],
                    ["dark", "theme.dark"],
                  ] as const).map(([value, labelKey]) => (
                    <button
                      className={`preference-option theme-option ${
                        themePreference === value ? "is-active" : ""
                      }`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={themePreference === value}
                      key={value}
                      onClick={() => selectThemePreference(value)}
                    >
                      <span>{t(labelKey)}</span>
                      {themePreference === value ? (
                        <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div
              className="preference-control language-control"
              ref={languageControlRef}
            >
              <button
                className={`team-action-button preference-trigger language-trigger ${
                  isLanguageMenuOpen ? "is-open" : ""
                }`}
                type="button"
                aria-label={t("language.label")}
                title={t("language.label")}
                aria-haspopup="menu"
                aria-expanded={isLanguageMenuOpen}
                ref={languageTriggerRef}
                onClick={toggleLanguageMenu}
              >
                <FontAwesomeIcon icon={faLanguage} aria-hidden="true" />
              </button>
              {isLanguageMenuOpen ? (
                <div
                  className="preference-menu language-menu"
                  role="menu"
                  aria-label={t("language.label")}
                >
                  {([
                    ["en", "language.english"],
                    ["ko", "language.korean"],
                  ] as const).map(([value, labelKey]) => (
                    <button
                      className={`preference-option language-option ${
                        locale === value ? "is-active" : ""
                      }`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={locale === value}
                      key={value}
                      lang={value}
                      onClick={() => selectLocale(value)}
                    >
                      <span>{t(labelKey)}</span>
                      {locale === value ? (
                        <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div
        className={`workspace${
          appMode === "calculator" ? " is-calculator-workspace" : ""
        }`}
      >
        {appMode === "builder" ? (
          <div className="builder-workspace">
            <TeamBuilder
              teamName={teamNameDraft}
              battleFormat={battleFormat}
              team={team}
              bench={bench}
              selectedSlot={selectedTeamSlot}
              pool={customPool}
              pokemonIndex={pokemonIndex}
              itemIndex={itemIndex}
              showdownLegality={showdownLegality}
              pokemonIndexStatus={indexStatus}
              itemIndexStatus={itemIndexStatus}
              showdownLegalityStatus={showdownLegalityStatus}
              showdownLegalityError={showdownLegalityError}
              selectingPokemonSlot={selectingPokemonSlot}
              searchError={searchError}
              searchNotice={searchNotice}
              failedPokemonSelectionSlot={
                failedPokemonSelection?.slotIndex ?? null
              }
              buildState={teamBuildState}
              validity={teamValidity}
              onSelectedSlotChange={setSelectedTeamSlot}
              onRetryPokemonIndex={retryPokemonIndex}
              onRetryItemIndex={retryItemIndex}
              onRetryShowdownLegality={retryShowdownLegality}
              onRetryPokemonSelection={() => {
                if (failedPokemonSelection) {
                  void handleSelectPokemon(
                    failedPokemonSelection.slotIndex,
                    failedPokemonSelection.lookup,
                    failedPokemonSelection.options,
                  );
                }
              }}
              onChangeSlot={handleChangeSlot}
              onSelectPokemon={handleSelectPokemon}
              onClearSlot={handleClearSlot}
              onReorderSlots={handleReorderSlots}
              onMoveTeamPokemonToBench={handleMoveTeamPokemonToBench}
              onMoveBenchPokemonToTeam={handleMoveBenchPokemonToTeam}
              onReorderBenchPokemon={handleReorderBenchPokemon}
              onRemoveBenchPokemon={handleRemoveBenchPokemon}
              onExportShowdown={getShowdownExportText}
              onImportShowdown={handleImportShowdownSlot}
            />
            <TeamDiagnostics diagnostics={teamDiagnostics} />
          </div>
        ) : null}

        {hasOpenedCalculator ? (
          <Suspense
            fallback={
              appMode === "calculator" ? (
                <div className="calculator-loading">{t("common.loading")}</div>
              ) : null
            }
          >
            <Calculator
              battleFormat={battleFormat}
              team={team}
              selectedSlot={selectedTeamSlot}
              pokemonIndex={pokemonIndex}
              itemIndex={itemIndex}
              showdownLegality={showdownLegality}
              buildState={teamBuildState}
              onSelectedSlotChange={setSelectedTeamSlot}
              onSelectPokemon={handleSelectPokemon}
              isVisible={appMode === "calculator"}
            />
          </Suspense>
        ) : null}

        <button
          className={`copilot-drawer-scrim${
            isCopilotDrawerOpen ? " is-open" : ""
          }${isCopilotDrawerTransitioning ? " is-transitioning" : ""}`}
          type="button"
          tabIndex={-1}
          aria-label={t("copilot.closePanel")}
          onClick={() => {
            transitionCopilotDrawer(false);
            copilotDrawerTriggerRef.current?.focus();
          }}
        />
        <div
          ref={copilotDrawerRef}
          className={`copilot-drawer${
            isCopilotDrawerOpen ? " is-open" : ""
          }${isCopilotDrawerTransitioning ? " is-transitioning" : ""}`}
          id="copilot-drawer"
          role={isCompactDrawerLayout ? "dialog" : undefined}
          aria-label={isCompactDrawerLayout ? "PokePilot" : undefined}
          aria-modal={
            isCompactDrawerLayout && isCopilotDrawerOpen ? true : undefined
          }
          aria-hidden={
            isCompactDrawerLayout && !isCopilotDrawerOpen ? true : undefined
          }
          tabIndex={isCompactDrawerLayout ? -1 : undefined}
        >
          <CopilotPanel
            teamName={teamNameDraft}
            battleFormat={battleFormat}
            team={team}
            pokemonIndex={pokemonIndex}
            selectedSlot={selectedTeamSlot}
            buildState={teamBuildState}
            diagnostics={teamDiagnostics}
            validity={teamValidity}
          />
        </div>
        <button
          ref={copilotDrawerTriggerRef}
          className={`copilot-drawer-handle${
            isCopilotDrawerOpen ? " is-open" : ""
          }${isCopilotDrawerTransitioning ? " is-transitioning" : ""}`}
          type="button"
          aria-controls="copilot-drawer"
          aria-expanded={isCopilotDrawerOpen}
          aria-label={
            isCopilotDrawerOpen
              ? t("copilot.closePanel")
              : t("copilot.openPanel")
          }
          title={
            isCopilotDrawerOpen
              ? t("copilot.closePanel")
              : t("copilot.openPanel")
          }
          onClick={() => transitionCopilotDrawer(!isCopilotDrawerOpen)}
        >
          <FontAwesomeIcon
            icon={isCopilotDrawerOpen ? faChevronRight : faChevronLeft}
            aria-hidden="true"
          />
          <span>PokePilot</span>
        </button>
      </div>

      <footer className="footer">
        <p>{t("footer.disclaimer")}</p>
      </footer>
    </main>
  );
}

export default App;
