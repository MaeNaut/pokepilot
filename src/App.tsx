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
  faDesktop,
  faFloppyDisk,
  faLanguage,
  faList,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import { useSavedTeams } from "./hooks/useSavedTeams";
import { hydrateSavedTeamMembers, hydrateSavedBench } from "./utils/savedTeamLibrary";
import { isPokemonLegal } from "./api/showdownLegality";
import { NewTeamControl } from "./components/NewTeamControl";
import { PrivacyControl } from "./components/PrivacyControl";
import { SavedTeamRow } from "./components/SavedTeamRow";
import { TeamBuilder } from "./components/TeamBuilder";
import { TeamDiagnostics } from "./components/TeamDiagnostics";
import { CopilotDrawer } from "./components/CopilotDrawer";
import {
  AppModeControl,
  BattleFormatControl,
} from "./components/HeaderModeControls";
import {
  ACTIVE_TEAM_SIZE,
  MAX_SAVED_TEAMS,
  canAddBenchPokemon,
} from "./data/teamLimits";
import { useTeamBuildState } from "./hooks/useTeamBuildState";
import { useBuilderData } from "./hooks/useBuilderData";
import { useDismissOnOutsidePointer } from "./hooks/useDismissOnOutsidePointer";
import { useLongPressReorder } from "./hooks/useLongPressReorder";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { resolvePokemonChoice as resolveTeamPokemonChoice } from "./utils/pokemonSelection";
import type { TeamBuildState } from "./utils/teamBuildState";
import { swapArrayItems } from "./utils/reorder";
import {
  validateRecommendedPokemonApplication,
  type RecommendedPokemonApplyResult,
  type RecommendedPokemonSaveResult,
} from "./utils/recommendedPokemonApplication";
import {
  moveBenchPokemonToTeam,
  moveTeamPokemonToBench,
  getPokemonBuildSnapshot,
  type BenchPokemon,
} from "./utils/benchPokemon";
import type { CalculatorAnalysisContext } from "./calculator/setOptimizer";
import type { CopilotSetOptimizationCandidateSnapshot } from "./utils/copilotContracts";
import { resolveOptimizationCandidatePatch } from "./utils/optimizationCandidateApplication";
import { createTeamAnalysisContext } from "./utils/teamAnalysisContext";
import {
  formatShowdownSlot,
  formatShowdownTeam,
} from "./utils/showdownText";
import {
  buildImportedShowdownSnapshot,
  normalizeImportedEvs,
} from "./utils/showdownImport";
import {
  clearLastActiveTeamId,
  createEmptyBuildState,
  createSavedBenchPokemon,
  createSavedSlot,
  createSavedTeamId,
  getLastActiveTeamId,
  serializeTeamSnapshot,
  storeLastActiveTeamId,
  type SavedTeamSummary,
  type TeamSnapshot,
} from "./utils/teamStorage";
import type { TeamMember, TeamSlot } from "./types";
import { useLocalization } from "./i18n/useLocalization";
import type { Locale } from "./i18n/gameTranslations";
import { useTheme } from "./theme/useTheme";
import type { ThemePreference } from "./theme/theme";
import { useBattleFormat } from "./battleFormat/useBattleFormat";
import { useAppMode } from "./appMode/useAppMode";

const Calculator = lazy(() =>
  import("./components/Calculator").then((module) => ({
    default: module.Calculator,
  })),
);

const CopilotPanel = lazy(() =>
  import("./components/CopilotPanel").then((module) => ({
    default: module.CopilotPanel,
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

type PokemonSelectionOptions = {
  applyUsageStats?: boolean;
  allowBattleForm?: boolean;
  validateRecommendation?: boolean;
  expectedRecommendationTarget?: string | null;
};

type EditorPokemonSelectionOptions = Omit<
  PokemonSelectionOptions,
  "validateRecommendation"
>;

const localizedUntitledTeamNames = new Set(["Untitled Team", "이름 없는 팀"]);

function mergePool(nextMembers: TeamMember[], currentPool: TeamMember[]) {
  const merged = [...nextMembers, ...currentPool];
  return merged.filter(
    (member, index, list) => list.findIndex((item) => item.id === member.id) === index,
  );
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
  const [calculatorAnalysisContext, setCalculatorAnalysisContext] =
    useState<CalculatorAnalysisContext | null>(null);
  const [bench, setBench] = useState<BenchPokemon[]>([]);
  const [selectedTeamSlot, setSelectedTeamSlot] = useState(0);
  const teamBuildState = useTeamBuildState();
  const {
    pokemonIndex,
    itemIndex,
    abilityIndex,
    showdownLegality,
    pokemonIndexStatus: indexStatus,
    itemIndexStatus,
    abilityIndexStatus,
    showdownLegalityStatus,
    showdownLegalityError,
    retryPokemonIndex,
    retryItemIndex,
    retryShowdownLegality,
  } = useBuilderData();
  const [teamName, setTeamName] = useState(() => t("team.untitled"));
  const [teamNameDraft, setTeamNameDraft] = useState(() => t("team.untitled"));
  const savedTeamLibrary = useSavedTeams();
  const savedTeams = savedTeamLibrary.teams;
  const [activeSavedTeamId, setActiveSavedTeamId] = useState<string | null>(null);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [isNewTeamMenuOpen, setIsNewTeamMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
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
    options: PokemonSelectionOptions;
  } | null>(null);
  const teamActionsRef = useRef<HTMLElement | null>(null);
  const themeControlRef = useRef<HTMLDivElement | null>(null);
  const themeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const languageControlRef = useRef<HTMLDivElement | null>(null);
  const languageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savedTeamListRef = useRef<HTMLDivElement | null>(null);
  const saveFeedbackTimeoutRef = useRef<number | null>(null);
  const pokemonSelectionRequestRef = useRef(0);
  const teamLoadRequestRef = useRef(0);
  const committedSnapshotRef = useRef<string | null>(null);
  const analysisBuildState = teamBuildState.getBuildStateSnapshot();
  const pokemonSelectionContextFingerprint = JSON.stringify({
    activeSavedTeamId,
    battleFormat,
    selectedTeamSlot,
    team: team.map((member) => member?.id ?? null),
    buildState: analysisBuildState,
    pokemonIndexVersion: `${indexStatus}:${pokemonIndex.length}`,
    itemIndexVersion: `${itemIndexStatus}:${itemIndex.length}`,
    legalityVersion: `${showdownLegalityStatus}:${showdownLegality?.generatedAt ?? "none"}`,
  });
  const pokemonSelectionContextFingerprintRef = useRef(
    pokemonSelectionContextFingerprint,
  );
  pokemonSelectionContextFingerprintRef.current =
    pokemonSelectionContextFingerprint;
  const {
    diagnostics: teamDiagnostics,
    validity: teamValidity,
  } = useMemo(
    () =>
      createTeamAnalysisContext({
        team,
        buildState: analysisBuildState,
        moveSources: customPool,
        legality: showdownLegality,
        pokemonIndex,
        itemIndex,
      }),
    [
      analysisBuildState,
      customPool,
      itemIndex,
      pokemonIndex,
      showdownLegality,
      team,
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
    const storedTeams = savedTeams;
    const lastActiveTeamId = getLastActiveTeamId();
    const lastActiveTeam = storedTeams.find(
      (savedTeam) => savedTeam.id === lastActiveTeamId,
    );

    if (lastActiveTeam) {
      void loadSavedTeam(lastActiveTeam);
    }
    return () => {
      teamLoadRequestRef.current += 1;
    };
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
      themeTriggerRef.current?.focus({ preventScroll: true });
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
      languageTriggerRef.current?.focus({ preventScroll: true });
    }

    document.addEventListener("pointerdown", closeLanguageMenu);
    document.addEventListener("keydown", handleLanguageMenuKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeLanguageMenu);
      document.removeEventListener("keydown", handleLanguageMenuKeyDown);
    };
  }, [isLanguageMenuOpen]);


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

  function handleApplyOptimizationCandidate(
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) {
    if (!team[candidate.slotIndex]) {
      return;
    }

    const patch = resolveOptimizationCandidatePatch(candidate, itemIndex);
    if (!patch) return;

    teamBuildState.patchSlot(candidate.slotIndex, patch);
    setSelectedTeamSlot(candidate.slotIndex);
  }

  function handleSaveOptimizationCandidate(
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) {
    const member = team[candidate.slotIndex];

    if (!member || !canAddBenchPokemon(bench.length)) {
      return false;
    }

    const currentBuild = getPokemonBuildSnapshot(
      member,
      teamBuildState.getBuildStateSnapshot(),
      candidate.slotIndex,
    );
    const patch = resolveOptimizationCandidatePatch(candidate, itemIndex);
    if (!patch) return false;
    setBench((current) => [
      ...current,
      {
        id: createSavedTeamId(),
        member,
        build: {
          ...currentBuild,
          nature: patch.nature ?? currentBuild.nature,
          evs: patch.evs ?? currentBuild.evs,
          moveIds: patch.moveIds ?? currentBuild.moveIds,
          ...(Object.prototype.hasOwnProperty.call(patch, "item")
            ? { item: patch.item ?? null }
            : {}),
        },
      },
    ]);

    return true;
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
    themeTriggerRef.current?.focus({ preventScroll: true });
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
    languageTriggerRef.current?.focus({ preventScroll: true });
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
    options: PokemonSelectionOptions = {},
  ): Promise<RecommendedPokemonApplyResult | void> {
    const requestId = pokemonSelectionRequestRef.current + 1;
    const initialContextFingerprint =
      pokemonSelectionContextFingerprintRef.current;
    pokemonSelectionRequestRef.current = requestId;
    setSelectingPokemonSlot(slotIndex);
    setSearchError(null);
    setSearchNotice(null);
    setFailedPokemonSelection(null);

    if (!lookup) {
      handleClearSlot(slotIndex);
      setSelectingPokemonSlot(null);
      return options.validateRecommendation
        ? { status: "blocked", reason: "stale", issueCodes: [] }
        : undefined;
    }

    const speciesKey = resolveSpeciesKeyForLegality(lookup);

    if (
      !options.allowBattleForm &&
      hasLegalityFilter() &&
      !isPokemonLegal(showdownLegality, lookup, speciesKey)
    ) {
      if (!options.validateRecommendation) {
        setSearchError(t("builder.illegalPokemon", { name: lookup }));
      }
      setSelectingPokemonSlot(null);
      return options.validateRecommendation
        ? {
            status: "blocked",
            reason: "invalid",
            issueCodes: ["illegal-pokemon"],
          }
        : undefined;
    }

    try {
      const {
        selectedMember,
        targetMember,
        usageSetPatch,
        proposedBuildState,
        usageSetFound,
      } = await resolvePokemonChoice(slotIndex, lookup, Boolean(options.applyUsageStats));

      if (
        options.applyUsageStats &&
        !usageSetFound &&
        pokemonSelectionRequestRef.current === requestId
      ) {
        setSearchNotice({
          slotIndex,
          message: t("builder.noPopularSet"),
        });
      }

      if (pokemonSelectionRequestRef.current !== requestId) {
        return options.validateRecommendation
          ? { status: "blocked", reason: "stale", issueCodes: [] }
          : undefined;
      }

      if (
        options.validateRecommendation &&
        pokemonSelectionContextFingerprintRef.current !==
          initialContextFingerprint
      ) {
        return { status: "blocked", reason: "stale", issueCodes: [] };
      }

      if (options.validateRecommendation) {
        const blocked = checkRecommendationApplication(
          team,
          slotIndex,
          targetMember,
          proposedBuildState,
          Boolean(usageSetPatch?.itemLoadFailed),
          options.expectedRecommendationTarget ?? null,
        );
        if (blocked) {
          return blocked;
        }
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

      if (usageSetPatch) {
        teamBuildState.patchSlot(slotIndex, usageSetPatch.patch);
      }

      return options.validateRecommendation ? { status: "applied" } : undefined;
    } catch (error) {
      if (pokemonSelectionRequestRef.current === requestId) {
        if (!options.validateRecommendation) {
          setSearchError(
            error instanceof Error ? error.message : t("builder.lookupFailed"),
          );
          setFailedPokemonSelection({ slotIndex, lookup, options });
        }
      }
      return options.validateRecommendation
        ? { status: "blocked", reason: "load-failed", issueCodes: [] }
        : undefined;
    } finally {
      if (pokemonSelectionRequestRef.current === requestId) {
        setSelectingPokemonSlot(null);
      }
    }
  }

  async function handleEditorSelectPokemon(
    slotIndex: number,
    lookup: string,
    options: EditorPokemonSelectionOptions = {},
  ) {
    await handleSelectPokemon(slotIndex, lookup, options);
  }

  async function handleSaveRecommendedPokemon(
    slotIndex: number,
    lookup: string,
  ): Promise<RecommendedPokemonSaveResult> {
    const initialContextFingerprint =
      pokemonSelectionContextFingerprintRef.current;

    if (!canAddBenchPokemon(bench.length)) {
      return { status: "blocked", reason: "bench-full", issueCodes: [] };
    }

    try {
      const {
        selectedMember,
        targetMember,
        usageSetPatch,
        proposedBuildState,
      } = await resolvePokemonChoice(slotIndex, lookup, true);

      if (
        pokemonSelectionContextFingerprintRef.current !==
        initialContextFingerprint
      ) {
        return { status: "blocked", reason: "stale", issueCodes: [] };
      }

      const blocked = checkRecommendationApplication(
        team.map(() => null),
        slotIndex,
        targetMember,
        proposedBuildState,
        Boolean(usageSetPatch?.itemLoadFailed),
        null,
      );
      if (blocked) {
        return blocked;
      }

      setCustomPool((currentPool) =>
        mergePool([selectedMember, targetMember], currentPool),
      );
      setBench((current) => [
        ...current,
        {
          id: createSavedTeamId(),
          member: targetMember,
          build: getPokemonBuildSnapshot(
            targetMember,
            proposedBuildState,
            slotIndex,
          ),
        },
      ]);

      return { status: "saved" };
    } catch {
      return { status: "blocked", reason: "load-failed", issueCodes: [] };
    }
  }

  function checkRecommendationApplication(
    currentTeam: TeamSlot[],
    slotIndex: number,
    candidate: TeamMember,
    proposedBuildState: TeamBuildState,
    itemLoadFailed: boolean,
    expectedCurrentPokemonId: string | null,
  ): Extract<RecommendedPokemonApplyResult, { status: "blocked" }> | null {
    if (
      indexStatus !== "ready" ||
      itemIndexStatus !== "ready" ||
      showdownLegalityStatus !== "ready" ||
      itemLoadFailed
    ) {
      return {
        status: "blocked",
        reason: itemLoadFailed ? "load-failed" : "legality-unavailable",
        issueCodes: [],
      };
    }

    const validation = validateRecommendedPokemonApplication({
      currentTeam,
      slotIndex,
      candidate,
      proposedBuildState,
      legality: showdownLegality,
      pokemonIndex,
      itemIndex,
      expectedCurrentPokemonId,
    });
    return validation.status === "blocked"
      ? {
          status: "blocked",
          reason:
            validation.reason === "stale-target" ? "stale" : validation.reason,
          issueCodes: validation.issues.map((issue) => issue.code),
        }
      : null;
  }

  function resolvePokemonChoice(
    slotIndex: number,
    lookup: string,
    applyUsageStats: boolean,
  ) {
    return resolveTeamPokemonChoice({
      slotIndex,
      lookup,
      applyUsageStats,
      battleFormat,
      customPool,
      pokemonIndex,
      getBuildStateSnapshot: teamBuildState.getBuildStateSnapshot,
    });
  }

  function getShowdownExportText(slotIndex: number) {
    return formatShowdownSlot(team, teamBuildState.getBuildStateSnapshot(), slotIndex);
  }

  async function importShowdownAsNewTeam(text: string) {
    const requestId = ++teamLoadRequestRef.current;
    setIsImportingNewTeam(true);
    setNewTeamImportError(null);

    try {
      const importedSnapshot = await buildImportedShowdownSnapshot(text, {
        pokemonIndex,
        emptyTeamMessage: t("team.pasteAtLeastOne"),
      });
      if (requestId !== teamLoadRequestRef.current) return;
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
      if (requestId !== teamLoadRequestRef.current) return;
      setIsNewTeamImportOpen(true);
      setNewTeamImportError(
        error instanceof Error ? error.message : t("toolbar.importFailed"),
      );
    } finally {
      if (requestId === teamLoadRequestRef.current) setIsImportingNewTeam(false);
    }
  }

  async function handleImportShowdownSlot(slotIndex: number, text: string) {
    const importedSnapshot = await buildImportedShowdownSnapshot(text, {
      pokemonIndex,
      emptyTeamMessage: t("team.pasteAtLeastOne"),
    });
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
    const nextSavedTeam = savedTeamLibrary.save(
      getCurrentTeamSnapshot(nextName),
      activeSavedTeamId,
    );

    if (!nextSavedTeam) {
      setTeamStorageMessage(t("team.limitReached"));
      setIsTeamManagerOpen(true);
      setIsSaveConfirmed(false);
      return;
    }

    setActiveSavedTeamId(nextSavedTeam.id);
    storeLastActiveTeamId(nextSavedTeam.id);

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
    const requestId = ++teamLoadRequestRef.current;
    setIsImportingNewTeam(false);
    setTeamStorageMessage(null);

    const [hydratedTeam, hydratedBench] = await Promise.all([
      hydrateSavedTeamMembers(savedTeam, customPool),
      hydrateSavedBench(savedTeam, customPool),
    ]);
    if (requestId !== teamLoadRequestRef.current) return;

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



  function createNewTeam() {
    teamLoadRequestRef.current += 1;
    setIsImportingNewTeam(false);
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



  function handleReorderSavedTeams(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    savedTeamLibrary.reorder(sourceIndex, targetIndex);
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

    savedTeamLibrary.rename(activeSavedTeamId, nextName);

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

    savedTeamLibrary.rename(teamId, nextName);

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
    if (!savedTeamLibrary.duplicate(savedTeam)) {
      setTeamStorageMessage(t("team.limitReached"));
      return;
    }

    setTeamStorageMessage(t("team.duplicatedNamed", { name: savedTeam.name }));
    setPendingDeleteTeamId(null);
    setShowdownTeamId(null);
    setTeamShowdownDraft("");
    setRenamingTeamId(null);
  }

  async function getSavedTeamShowdownText(savedTeam: SavedTeamSummary) {
    const hydratedTeam = await hydrateSavedTeamMembers(savedTeam, customPool);

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

    const showdownText = await getSavedTeamShowdownText(savedTeam);
    setTeamShowdownDraft(showdownText);
    setShowdownTeamId(savedTeam.id);
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
    const editorRequestId = teamLoadRequestRef.current;
    setIsImportingSavedTeam(true);

    try {
      const importedSnapshot = await buildImportedShowdownSnapshot(
        teamShowdownDraft,
        {
          pokemonIndex,
          emptyTeamMessage: t("team.pasteAtLeastOne"),
        },
      );
      const now = new Date().toISOString();
      const nextSavedTeam: SavedTeamSummary = {
        ...savedTeam,
        slots: importedSnapshot.members.map(createSavedSlot),
        buildState: importedSnapshot.buildState,
        updatedAt: now,
      };
      savedTeamLibrary.update(savedTeam.id, (current) => ({
        ...current,
        slots: nextSavedTeam.slots,
        buildState: nextSavedTeam.buildState,
        updatedAt: now,
      }));

      setCustomPool((currentPool) =>
        mergePool(
          importedSnapshot.members.filter(
            (member): member is TeamMember => Boolean(member),
          ),
          currentPool,
        ),
      );

      if (savedTeam.id === activeSavedTeamId && editorRequestId === teamLoadRequestRef.current) {
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
    savedTeamLibrary.remove(teamId);

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
            <BattleFormatControl
              battleFormat={battleFormat}
              onChange={setBattleFormat}
            />
          </div>
          <AppModeControl
            appMode={appMode}
            onChange={(nextMode) => {
              if (nextMode === "calculator") {
                setHasOpenedCalculator(true);
              }

              setAppMode(nextMode);
            }}
          />
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
              onSelectPokemon={handleEditorSelectPokemon}
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
              onReorderSlots={handleReorderSlots}
              onSelectPokemon={handleEditorSelectPokemon}
              onAnalysisContextChange={setCalculatorAnalysisContext}
              isVisible={appMode === "calculator"}
            />
          </Suspense>
        ) : null}

        <CopilotDrawer isCompactLayout={isCompactDrawerLayout}>
          <Suspense
            fallback={
              <div className="copilot-panel">
                <div className="copilot-empty-state">
                  <span>{t("common.loading")}</span>
                </div>
              </div>
            }
          >
            <CopilotPanel
              savedTeamId={activeSavedTeamId}
              teamName={teamNameDraft}
              battleFormat={battleFormat}
              team={team}
              pokemonIndex={pokemonIndex}
              abilityIndex={abilityIndex}
              abilityIndexStatus={abilityIndexStatus}
              showdownLegality={showdownLegality}
              showdownLegalityStatus={showdownLegalityStatus}
              selectedSlot={selectedTeamSlot}
              buildState={teamBuildState}
              diagnostics={teamDiagnostics}
              validity={teamValidity}
              isCalculatorActive={appMode === "calculator"}
              calculatorContext={calculatorAnalysisContext}
              onSelectRecommendedPokemon={async (
                slotIndex,
                pokemonId,
                expectedCurrentPokemonId,
              ) => {
                const result = await handleSelectPokemon(slotIndex, pokemonId, {
                  applyUsageStats: true,
                  validateRecommendation: true,
                  expectedRecommendationTarget: expectedCurrentPokemonId,
                });
                if (result?.status === "applied") {
                  setSelectedTeamSlot(slotIndex);
                }
                return result ?? {
                  status: "blocked",
                  reason: "load-failed",
                  issueCodes: [],
                };
              }}
              onSaveRecommendedPokemon={handleSaveRecommendedPokemon}
              onApplyOptimizationCandidate={handleApplyOptimizationCandidate}
              onSaveOptimizationCandidate={handleSaveOptimizationCandidate}
            />
          </Suspense>
        </CopilotDrawer>
      </div>

      <footer className="footer">
        <p>
          {t("footer.disclaimer")}
          <span className="footer-links">
            <PrivacyControl />
            <a
              href="https://github.com/MaeNaut/pokepilot/issues"
              target="_blank"
              rel="noreferrer"
            >
              {t("footer.feedback")}
            </a>
            <a
              href="https://github.com/MaeNaut/pokepilot/security/policy"
              target="_blank"
              rel="noreferrer"
            >
              {t("footer.security")}
            </a>
          </span>
        </p>
      </footer>
    </main>
  );
}

export default App;
