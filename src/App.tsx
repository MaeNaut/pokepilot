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
  faChevronDown,
  faPlus,
  faFileImport,
  faFloppyDisk,
  faList,
} from "@fortawesome/free-solid-svg-icons";
import { useSavedTeams } from "./hooks/useSavedTeams";
import { hydrateSavedTeamMembers, hydrateSavedBench } from "./utils/savedTeamLibrary";
import { isPokemonLegal } from "./api/showdownLegality";
import { NewTeamControl } from "./components/NewTeamControl";
import { PrivacyControl } from "./components/PrivacyControl";
import { SavedTeamRow } from "./components/SavedTeamRow";
import { TeamSyncConflictDialog } from "./components/TeamSyncConflictDialog";
import { TeamBuilder } from "./components/TeamBuilder";
import { TeamDiagnostics } from "./components/TeamDiagnostics";
import { CopilotDrawer } from "./components/CopilotDrawer";
import { WorkspaceTutorial } from "./components/WorkspaceTutorial";
import { HeaderAccountMenu } from "./components/HeaderAccountMenu";
import {
  AppModeControl,
  BattleFormatControl,
} from "./components/HeaderModeControls";
import {
  MAX_SAVED_TEAMS,
  canAddBenchPokemon,
} from "./data/teamLimits";
import { useTeamWorkspace } from "./hooks/useTeamWorkspace";
import { useSavedTeamShowdown } from "./hooks/useSavedTeamShowdown";
import { useTeamWorkspaceRestore } from "./hooks/useTeamWorkspaceRestore";
import { useBuilderData } from "./hooks/useBuilderData";
import { useDismissOnOutsidePointer } from "./hooks/useDismissOnOutsidePointer";
import { useLongPressReorder } from "./hooks/useLongPressReorder";
import { useMediaQuery } from "./hooks/useMediaQuery";
import {
  resolveMegaAbilityTransition,
  resolvePokemonChoice as resolveTeamPokemonChoice,
} from "./utils/pokemonSelection";
import type { TeamBuildState } from "./utils/teamBuildState";
import {
  validateRecommendedPokemonApplication,
  type RecommendedPokemonApplyResult,
  type RecommendedPokemonSaveResult,
} from "./utils/recommendedPokemonApplication";
import {
  getPokemonBuildSnapshot,
  type BenchPokemon,
} from "./utils/benchPokemon";
import type { CopilotSetOptimizationCandidateSnapshot } from "./utils/copilotContracts";
import { resolveOptimizationCandidatePatch } from "./utils/optimizationCandidateApplication";
import { createTeamAnalysisContext } from "./utils/teamAnalysisContext";
import { formatShowdownSlot } from "./utils/showdownText";
import {
  buildImportedShowdownSnapshot,
  normalizeImportedEvs,
  type ImportedShowdownSnapshot,
} from "./utils/showdownImport";
import {
  createSavedTeamId,
  type SavedTeamSummary,
} from "./utils/teamStorage";
import type { TeamMember, TeamSlot } from "./types";
import { useLocalization } from "./i18n/useLocalization";
import { useTheme } from "./theme/useTheme";
import { useBattleFormat } from "./battleFormat/useBattleFormat";
import { useAppMode } from "./appMode/useAppMode";
import { useAccount } from "./hooks/useAccount";
import { useAccountPreferencesSync } from "./hooks/useAccountPreferencesSync";
import { DEFAULT_ANALYSIS_PREFERENCE } from "./utils/accountPreferences";
import type { TeamConflictChoice } from "./utils/accountStorageSync";
import {
  getWorkspaceTutorialCompleted,
  storeWorkspaceTutorialCompleted,
} from "./utils/tutorialStorage";

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

function mergePool(nextMembers: TeamMember[], currentPool: TeamMember[]) {
  const merged = [...nextMembers, ...currentPool];
  return merged.filter(
    (member, index, list) => list.findIndex((item) => item.id === member.id) === index,
  );
}

function App() {
  const { locale, setLocale, t } = useLocalization();
  const { themePreference, setThemePreference } = useTheme();
  const account = useAccount();
  const isTeamSaveUnavailable = account.status === "loading" || account.status === "error";
  const accountStorageId = account.status === "ready" ? account.user?.id ?? null : null;
  const { battleFormat, setBattleFormat } = useBattleFormat();
  const { appMode, setAppMode } = useAppMode();
  const [analysisPreference, setAnalysisPreference] = useState(DEFAULT_ANALYSIS_PREFERENCE);
  const [tutorialCompleted, setTutorialCompleted] = useState(
    getWorkspaceTutorialCompleted,
  );
  useAccountPreferencesSync({
    analysis: analysisPreference,
    setAnalysis: setAnalysisPreference,
    accountId: accountStorageId,
    authResolved: account.status !== "loading" && account.status !== "error",
    locale,
    setLocale,
    themePreference,
    setThemePreference,
    battleFormat,
    setBattleFormat,
    tutorialCompleted,
    setTutorialCompleted,
  });
  const isCompactDrawerLayout = useMediaQuery("(max-width: 1420px)");
  const [hasOpenedCalculator, setHasOpenedCalculator] = useState(
    appMode === "calculator",
  );
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
  const savedTeamLibrary = useSavedTeams(
    accountStorageId, account.status !== "loading" && account.status !== "error",
  );
  const savedTeams = savedTeamLibrary.teams;
  const {
    team, setTeam, bench, setBench, selectedTeamSlot, setSelectedTeamSlot,
    teamBuildState, activeSavedTeamId, resetWorkspace, importWorkspace,
    handleReorderSlots, handleMoveTeamPokemonToBench, handleMoveBenchPokemonToTeam,
    handleReorderBenchPokemon, handleRemoveBenchPokemon,
    loadWorkspace, markWorkspaceSaved, detachSavedTeam,
    teamName, setTeamName, teamNameDraft, setTeamNameDraft, commitTeamName,
    getCurrentTeamSnapshot, setCommittedSnapshot, renameCommittedSnapshot,
    hasUnsavedTeamChanges,
  } = useTeamWorkspace({
    battleFormat, setBattleFormat, untitledName: t("team.untitled"),
  });
  const benchRef = useRef(bench);
  benchRef.current = bench;
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
  const [isMobileTeamMenuOpen, setIsMobileTeamMenuOpen] = useState(false);
  const mobileTeamMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [isNewTeamMenuOpen, setIsNewTeamMenuOpen] = useState(false);
  const [isNewTeamImportOpen, setIsNewTeamImportOpen] = useState(false);
  const [newTeamShowdownDraft, setNewTeamShowdownDraft] = useState("");
  const [newTeamImportError, setNewTeamImportError] = useState<string | null>(null);
  const [isImportingNewTeam, setIsImportingNewTeam] = useState(false);
  const [teamStorageMessage, setTeamStorageMessage] = useState<string | null>(null);
  const [isSaveConfirmed, setIsSaveConfirmed] = useState(false);
  const [renamingTeamId, setRenamingTeamId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteTeamId, setPendingDeleteTeamId] = useState<string | null>(null);
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
  const savedTeamListRef = useRef<HTMLDivElement | null>(null);
  const savedTeamDragOrderRef = useRef<string[] | null>(null);
  const saveFeedbackTimeoutRef = useRef<number | null>(null);
  const pokemonSelectionRequestRef = useRef(0);
  const teamLoadRequestRef = useRef(0);
  const previousAccountStorageIdRef = useRef(accountStorageId);
  const beginWorkspaceTransition = useCallback(() => {
    pokemonSelectionRequestRef.current += 1;
    setSelectingPokemonSlot(null);
    setSearchError(null);
    setSearchNotice(null);
    setFailedPokemonSelection(null);
    return ++teamLoadRequestRef.current;
  }, []);
  const {
    showdownTeamId, teamShowdownDraft, setTeamShowdownDraft, isImportingSavedTeam,
    closeSavedTeamShowdown, toggleSavedTeamShowdown, handleExportSavedTeam, commitImportSavedTeam,
  } = useSavedTeamShowdown({
    accountId: accountStorageId, pool: customPool, pokemonIndex,
    library: savedTeamLibrary, t, onMessage: setTeamStorageMessage,
    getWorkspaceRevision: () => teamLoadRequestRef.current,
    onImported: applySavedTeamImport,
  });
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
    onDragStart: () => {
      savedTeamDragOrderRef.current = savedTeams.map((team) => team.id);
      setTeamStorageMessage(null);
    },
    onReorder: handleReorderSavedTeams,
  });

  const closeTeamManager = useCallback(() => {
    setIsTeamManagerOpen(false);
    setPendingDeleteTeamId(null);
    closeSavedTeamShowdown();
    setRenamingTeamId(null);
    setRenameDraft("");
  }, [closeSavedTeamShowdown]);

  const closeNewTeamTools = useCallback(() => {
    setIsNewTeamMenuOpen(false);
    setIsNewTeamImportOpen(false);
    setNewTeamImportError(null);
  }, []);

  useEffect(() => {
    const previousAccountId = previousAccountStorageIdRef.current;
    previousAccountStorageIdRef.current = accountStorageId;
    if (!previousAccountId || previousAccountId === accountStorageId) return;

    beginWorkspaceTransition();
    resetWorkspace("account-change");
    setCustomPool([]);
    setTeamStorageMessage(null);
    setPendingTeamAction(null);
  }, [accountStorageId, resetWorkspace, beginWorkspaceTransition]);

  useTeamWorkspaceRestore({
    scope: accountStorageId ?? "local",
    ready: !(account.enabled && account.status === "loading") && savedTeamLibrary.isHydrated,
    teams: savedTeams,
    restore: loadSavedTeam,
  });

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
      isMobileTeamMenuOpen ||
      isNewTeamMenuOpen ||
      isNewTeamImportOpen ||
      Boolean(pendingTeamAction),
    () => {
      closeTeamManager();
      setIsMobileTeamMenuOpen(false);
      closeNewTeamTools();
      setPendingTeamAction(null);
    },
  );

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

    if (!member) {
      return false;
    }

    const currentBuild = getPokemonBuildSnapshot(
      member,
      teamBuildState.getBuildStateSnapshot(),
      candidate.slotIndex,
    );
    const patch = resolveOptimizationCandidatePatch(candidate, itemIndex);
    if (!patch) return false;
    return appendBenchPokemon({
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
    });
  }

  function appendBenchPokemon(entry: BenchPokemon) {
    if (!canAddBenchPokemon(benchRef.current.length)) return false;
    const next = [...benchRef.current, entry];
    benchRef.current = next;
    setBench(next);
    return true;
  }

  function toggleTeamManager() {
    closeNewTeamTools();
    setPendingTeamAction(null);

    if (isTeamManagerOpen) {
      closeTeamManager();
    } else {
      setIsTeamManagerOpen(true);
    }
  }

  function toggleNewTeamMenu() {
    closeTeamManager();
    setPendingTeamAction(null);
    setNewTeamImportError(null);

    if (isNewTeamMenuOpen || isNewTeamImportOpen) {
      closeNewTeamTools();
      return;
    }

    setIsNewTeamMenuOpen(true);
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

    const previousMember = team[slotIndex];
    const previousBuildState = teamBuildState.getBuildStateSnapshot();

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

      const previousAbility = previousBuildState.abilityBySlot[slotIndex] ??
        previousMember?.abilities?.[0] ?? "";
      const transition = resolveMegaAbilityTransition({
        previousMember,
        targetMember,
        nextAbility: proposedBuildState.abilityBySlot[slotIndex] ??
          (options.applyUsageStats ? "" : previousAbility),
        previousAbility,
        rememberedAbility: previousBuildState.preMegaAbilityBySlot[slotIndex],
        rememberedPokemonId: previousBuildState.preMegaPokemonBySlot[slotIndex],
        pokemonIndex,
      });
      const abilityChanged = transition.ability !== proposedBuildState.abilityBySlot[slotIndex];
      const memoryChanged = transition.preMegaAbility !==
        (proposedBuildState.preMegaAbilityBySlot[slotIndex] ?? null);

      if (abilityChanged || memoryChanged) {
        teamBuildState.patchSlot(slotIndex, {
          ...(abilityChanged ? { ability: transition.ability } : {}),
          ...(memoryChanged ? { preMegaAbility: transition.preMegaAbility } : {}),
        });
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
    const workspaceRevision = teamLoadRequestRef.current;

    if (!canAddBenchPokemon(benchRef.current.length)) {
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
        teamLoadRequestRef.current !== workspaceRevision ||
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

      if (!appendBenchPokemon({
        id: createSavedTeamId(),
        member: targetMember,
        build: getPokemonBuildSnapshot(targetMember, proposedBuildState, slotIndex),
      })) {
        return { status: "blocked", reason: "bench-full", issueCodes: [] };
      }
      setCustomPool((currentPool) =>
        mergePool([selectedMember, targetMember], currentPool),
      );

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
    const requestId = beginWorkspaceTransition();
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

      setCustomPool((currentPool) => mergePool(importedMembers, currentPool));
      importWorkspace(importedSnapshot, importedTeamName);
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
    const workspaceRevision = teamLoadRequestRef.current;
    const importedSnapshot = await buildImportedShowdownSnapshot(text, {
      pokemonIndex,
      emptyTeamMessage: t("team.pasteAtLeastOne"),
    });
    if (workspaceRevision !== teamLoadRequestRef.current) return;
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
      preMegaAbility:
        importedSnapshot.buildState.preMegaAbilityBySlot[0] ?? null,
    });
    setTeamStorageMessage(t("team.importedPokemon"));
  }

  function handleSaveTeam() {
    if (isTeamSaveUnavailable) {
      setTeamStorageMessage(t(account.status === "loading" ? "account.checking" : "account.unavailable"));
      setIsTeamManagerOpen(true);
      setIsSaveConfirmed(false);
      return;
    }
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

    markWorkspaceSaved(nextSavedTeam.id, nextName);

    setTeamStorageMessage(t("team.savedNamed", { name: nextSavedTeam.name }));
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setPendingTeamAction(null);
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

  async function loadSavedTeam(savedTeam: SavedTeamSummary, signal?: AbortSignal) {
    const requestId = beginWorkspaceTransition();
    setIsImportingNewTeam(false);
    setTeamStorageMessage(null);

    const [hydratedTeam, hydratedBench] = await Promise.all([
      hydrateSavedTeamMembers(savedTeam, customPool),
      hydrateSavedBench(savedTeam, customPool),
    ]);
    if (requestId !== teamLoadRequestRef.current || signal?.aborted) return false;

    setCustomPool((currentPool) =>
      mergePool(
        [
          ...hydratedTeam.filter((member): member is TeamMember => Boolean(member)),
          ...hydratedBench.map((entry) => entry.member),
        ],
        currentPool,
      ),
    );
    loadWorkspace(savedTeam, hydratedTeam, hydratedBench);
    closeTeamManager();
    return true;
  }



  function createNewTeam() {
    beginWorkspaceTransition();
    setIsImportingNewTeam(false);
    resetWorkspace("new-team");
    setTeamStorageMessage(t("team.newReady"));
    setPendingTeamAction(null);
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setRenameDraft("");
    setIsTeamManagerOpen(false);
    closeNewTeamTools();
    setNewTeamShowdownDraft("");
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
    const order = savedTeamDragOrderRef.current ?? savedTeams.map((team) => team.id);
    savedTeamDragOrderRef.current = null;
    const sourceId = order[sourceIndex];
    const targetId = order[targetIndex];
    if (sourceId && targetId && savedTeamLibrary.reorderByIds(sourceId, targetId)) {
      setTeamStorageMessage(t("team.reorderedSaved"));
    }
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

      savedTeamDragOrderRef.current = null;
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
    closeSavedTeamShowdown();
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
    closeSavedTeamShowdown();
    setRenamingTeamId(null);
  }

  function handleToggleSavedTeamShowdown(savedTeam: SavedTeamSummary) {
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setTeamStorageMessage(null);
    return toggleSavedTeamShowdown(savedTeam);
  }

  function applySavedTeamImport(
    savedTeam: SavedTeamSummary,
    snapshot: ImportedShowdownSnapshot,
    editorRequestId: number,
  ) {
    setCustomPool((currentPool) => mergePool(
      snapshot.members.filter((member): member is TeamMember => Boolean(member)), currentPool,
    ));
    if (savedTeam.id !== activeSavedTeamId || editorRequestId !== teamLoadRequestRef.current) return;
    setTeam(snapshot.members);
    teamBuildState.replaceBuildState(snapshot.buildState);
    setCommittedSnapshot({
      name: savedTeam.name,
      battleFormat: savedTeam.battleFormat,
      slots: savedTeam.slots,
      bench: savedTeam.bench,
      buildState: snapshot.buildState,
    });
  }

  function toggleDeleteTeam(teamId: string) {
    setRenamingTeamId(null);
    closeSavedTeamShowdown();
    setPendingDeleteTeamId((currentId) =>
      currentId === teamId ? null : teamId,
    );
    setTeamStorageMessage(null);
  }

  function handleDeleteTeam(teamId: string) {
    const deletedTeam = savedTeams.find((savedTeam) => savedTeam.id === teamId);
    savedTeamLibrary.remove(teamId);

    if (teamId === activeSavedTeamId) {
      detachSavedTeam();
    }

    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setTeamStorageMessage(
      deletedTeam
        ? t("team.deletedNamed", { name: deletedTeam.name })
        : t("team.deleted"),
    );
  }

  function handleResolveTeamConflicts(choices: Record<string, TeamConflictChoice>) {
    const conflicts = savedTeamLibrary.conflict?.conflicts ?? [];
    const copies = savedTeamLibrary.resolveTeamConflicts(choices, t("team.syncCopySuffix"));
    if (!copies) return false;
    const activeCopy = copies.find((entry) => entry.originalId === activeSavedTeamId);
    if (activeCopy) markWorkspaceSaved(activeCopy.copy.id, activeCopy.copy.name);
    else if (conflicts.some((entry) => entry.id === activeSavedTeamId &&
      (choices[entry.id] === "remote" || !entry.local))) detachSavedTeam();
    return true;
  }

  return (
    <main
      className={`app-shell${
        isCompactDrawerLayout ? " is-compact-drawer-layout" : ""
      }`}
    >
      <header className="app-header">
        <span className="app-wordmark"><img src="/favicon.svg" width="22" height="22" alt="" />PokePilot</span>
        <div className="app-header-layout">
          <div className="header-builder-workspace">
            <nav className="team-actions" aria-label={t("team.actions")} ref={teamActionsRef}>
          <button
            className="team-action-button"
            type="button"
            aria-label={t("team.manage")}
            title={t("team.manage")}
            aria-expanded={isTeamManagerOpen}
            onClick={() => {
              setIsMobileTeamMenuOpen(false);
              toggleTeamManager();
            }}
          >
            <FontAwesomeIcon icon={faList} aria-hidden="true" />
          </button>
          <button
            className="mobile-team-menu-trigger"
            ref={mobileTeamMenuTriggerRef}
            type="button"
            aria-label={`${t("team.actions")}: ${teamNameDraft}`}
            aria-expanded={isMobileTeamMenuOpen}
            aria-controls="mobile-team-menu"
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsMobileTeamMenuOpen(false);
            }}
            onClick={() => {
              closeTeamManager();
              closeNewTeamTools();
              setIsMobileTeamMenuOpen((open) => !open);
            }}
          >
            <span>{teamNameDraft}</span>
            <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
          </button>
          {isMobileTeamMenuOpen && (
            <div
              id="mobile-team-menu"
              className="mobile-team-menu"
              role="region"
              aria-label={t("team.actions")}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsMobileTeamMenuOpen(false);
                  mobileTeamMenuTriggerRef.current?.focus();
                }
              }}
            >
              <label>
                <span>{t("team.name")}</span>
                <input
                  value={teamNameDraft}
                  spellCheck={false}
                  onChange={(event) => setTeamNameDraft(event.target.value)}
                  onBlur={commitTeamName}
                  onKeyDown={handleTeamNameKeyDown}
                />
              </label>
              <button type="button"
                title={isTeamSaveUnavailable ? t(account.status === "loading" ? "account.checking" : "account.unavailable") : undefined}
                onClick={() => {
                handleSaveTeam();
                setIsMobileTeamMenuOpen(false);
                mobileTeamMenuTriggerRef.current?.focus();
              }}>
                <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />{t("team.save")}
              </button>
              <button type="button" onClick={() => {
                setIsMobileTeamMenuOpen(false);
                requestNewTeam();
              }}>
                <FontAwesomeIcon icon={faPlus} aria-hidden="true" />{t("team.new")}
              </button>
              <button type="button" onClick={() => {
                setIsMobileTeamMenuOpen(false);
                openNewTeamImport();
              }}>
                <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />{t("team.importShowdown")}
              </button>
            </div>
          )}
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
            className={`team-action-button desktop-team-save ${isSaveConfirmed ? "is-confirmed" : ""}`}
            type="button"
            aria-label={t("team.save")}
            title={isTeamSaveUnavailable ? t(account.status === "loading" ? "account.checking" : "account.unavailable") : t("team.save")}
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
                        void handleToggleSavedTeamShowdown(teamSummary)
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
          <HeaderAccountMenu
            account={account}
            locale={locale}
            onLocaleChange={setLocale}
            themePreference={themePreference}
            onThemePreferenceChange={setThemePreference}
          />
        </div>
      </header>

      {savedTeamLibrary.hasLocalStorageError ? (
        <div className="team-storage-alert" role="alert">{t("team.localStorageUnavailable")}</div>
      ) : null}

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
              analysisPreference={analysisPreference}
              setAnalysisPreference={setAnalysisPreference}
              account={account}
              savedTeamId={activeSavedTeamId}
              teamName={teamNameDraft}
              battleFormat={battleFormat}
              team={team}
              pokemonIndex={pokemonIndex}
              itemIndex={itemIndex}
              abilityIndex={abilityIndex}
              abilityIndexStatus={abilityIndexStatus}
              showdownLegality={showdownLegality}
              showdownLegalityStatus={showdownLegalityStatus}
              selectedSlot={selectedTeamSlot}
              buildState={teamBuildState}
              diagnostics={teamDiagnostics}
              validity={teamValidity}
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
        </p>
          <span className="footer-links">
            <button className="tutorial-restart" type="button" onClick={() => window.dispatchEvent(new Event("pokepilot:tutorial"))}>{locale === "ko" ? "튜토리얼" : "Tutorial"}</button>
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
      </footer>
      <WorkspaceTutorial
        completed={tutorialCompleted}
        onComplete={() => {
          storeWorkspaceTutorialCompleted();
          setTutorialCompleted(true);
        }}
      />
      {savedTeamLibrary.conflict ? (
        <TeamSyncConflictDialog
          conflicts={savedTeamLibrary.conflict.conflicts}
          onResolve={handleResolveTeamConflicts}
        />
      ) : null}
    </main>
  );
}

export default App;
