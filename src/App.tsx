import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCopy,
  faFileExport,
  faFileImport,
  faFileLines,
  faFloppyDisk,
  faList,
  faPen,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { fetchPokemon } from "./api/pokeApi";
import { fetchPokemonIndex } from "./api/pokemonIndex";
import { fetchItem, fetchItemIndex } from "./api/showdownCatalog";
import { normalizeShowdownId } from "./api/showdownIds";
import {
  loadPopularSmogonSet,
  resolveSmogonUsageMoveIds,
} from "./api/smogonUsage";
import { isPokemonLegal, loadShowdownLegality } from "./api/showdownLegality";
import { CopilotPanel } from "./components/CopilotPanel";
import { NewTeamControl } from "./components/NewTeamControl";
import { PokemonIcon } from "./components/PokemonIcon";
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
import { useLongPressReorder } from "./hooks/useLongPressReorder";
import {
  getPreferredPokeApiId,
  shouldKeepSelectedPokemonForUsageTarget,
} from "./utils/pokemonAliases";
import { isFullShowdownSpriteUrl } from "./utils/pokemonSprites";
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
  DataLoadStatus,
  ItemIndexEntry,
  PokemonIndexEntry,
  PokemonItem,
  TeamMember,
  TeamSlot,
} from "./types";
import type { TeamBuildState } from "./hooks/useTeamBuildState";
import type { SmogonUsageSet } from "./api/smogonUsage";
import type { ShowdownLegalitySnapshot } from "./api/showdownLegality";

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

function reorderArrayItem<T>(items: T[], sourceIndex: number, targetIndex: number) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);

  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

function App() {
  const [team, setTeam] = useState<TeamSlot[]>(() =>
    Array<TeamSlot>(ACTIVE_TEAM_SIZE).fill(null),
  );
  const [bench, setBench] = useState<BenchPokemon[]>([]);
  const [selectedTeamSlot, setSelectedTeamSlot] = useState(0);
  const teamBuildState = useTeamBuildState();
  const [teamName, setTeamName] = useState("Untitled Team");
  const [teamNameDraft, setTeamNameDraft] = useState("Untitled Team");
  const [savedTeams, setSavedTeams] = useState<SavedTeamSummary[]>([]);
  const [activeSavedTeamId, setActiveSavedTeamId] = useState<string | null>(null);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
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
  const [showdownTeamId, setShowdownTeamId] = useState<string | null>(null);
  const [teamShowdownDraft, setTeamShowdownDraft] = useState("");
  const [isImportingSavedTeam, setIsImportingSavedTeam] = useState(false);
  const [pendingTeamAction, setPendingTeamAction] = useState<PendingTeamAction | null>(
    null,
  );
  const [customPool, setCustomPool] = useState<TeamMember[]>([]);
  const [pokemonIndex, setPokemonIndex] = useState<PokemonIndexEntry[]>([]);
  const [itemIndex, setItemIndex] = useState<ItemIndexEntry[]>([]);
  const [showdownLegality, setShowdownLegality] = useState<ShowdownLegalitySnapshot | null>(
    null,
  );
  const [showdownLegalityError, setShowdownLegalityError] = useState<string | null>(null);
  const [showdownLegalityStatus, setShowdownLegalityStatus] =
    useState<DataLoadStatus>("idle");
  const [indexStatus, setIndexStatus] = useState<DataLoadStatus>("idle");
  const [itemIndexStatus, setItemIndexStatus] = useState<DataLoadStatus>("idle");
  const [showdownLoadAttempt, setShowdownLoadAttempt] = useState(0);
  const [pokemonIndexLoadAttempt, setPokemonIndexLoadAttempt] = useState(0);
  const [itemIndexLoadAttempt, setItemIndexLoadAttempt] = useState(0);
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
  const savedTeamListRef = useRef<HTMLDivElement | null>(null);
  const saveFeedbackTimeoutRef = useRef<number | null>(null);
  const pokemonSelectionRequestRef = useRef(0);
  const committedSnapshotRef = useRef<string | null>(null);
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
      name: name.trim() || "Untitled Team",
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

  useEffect(
    () => () => {
      if (saveFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(saveFeedbackTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !isTeamManagerOpen &&
      !isNewTeamMenuOpen &&
      !isNewTeamImportOpen &&
      !pendingTeamAction
    ) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!teamActionsRef.current?.contains(event.target as Node)) {
        closeTeamManager();
        closeNewTeamTools();
        setPendingTeamAction(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    closeNewTeamTools,
    closeTeamManager,
    isNewTeamImportOpen,
    isNewTeamMenuOpen,
    isTeamManagerOpen,
    pendingTeamAction,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadShowdownData() {
      setShowdownLegalityStatus("loading");
      setShowdownLegalityError(null);

      try {
        const legality = await loadShowdownLegality("gen9-regulation-mb");

        if (isMounted) {
          setShowdownLegality((current) =>
            legality.error && current && !current.error ? current : legality,
          );
          setShowdownLegalityError(legality.error ?? null);
          setShowdownLegalityStatus(legality.error ? "error" : "ready");
        }
      } catch (error) {
        if (isMounted) {
          setShowdownLegalityStatus("error");
          setShowdownLegalityError(
            error instanceof Error ? error.message : "Showdown legality load failed.",
          );
        }
      }
    }

    void loadShowdownData();

    return () => {
      isMounted = false;
    };
  }, [showdownLoadAttempt]);

  useEffect(() => {
    let isMounted = true;

    async function loadPokemonIndex() {
      setIndexStatus("loading");

      try {
        const index = await fetchPokemonIndex();

        if (isMounted) {
          setPokemonIndex(index);
          setIndexStatus("ready");
        }
      } catch {
        if (isMounted) {
          setIndexStatus("error");
        }
      }
    }

    void loadPokemonIndex();

    return () => {
      isMounted = false;
    };
  }, [pokemonIndexLoadAttempt]);

  useEffect(() => {
    let isMounted = true;

    async function loadItemIndex() {
      setItemIndexStatus("loading");

      try {
        const index = await fetchItemIndex();

        if (isMounted) {
          setItemIndex(index);
          setItemIndexStatus("ready");
        }
      } catch {
        if (isMounted) {
          setItemIndexStatus("error");
        }
      }
    }

    void loadItemIndex();

    return () => {
      isMounted = false;
    };
  }, [itemIndexLoadAttempt]);

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
      reorderArrayItem(currentTeam, sourceIndex, targetIndex),
    );
    teamBuildState.reorderSlots(sourceIndex, targetIndex, team.length);
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

    setBench((current) => reorderArrayItem(current, sourceIndex, targetIndex));
  }

  function handleRemoveBenchPokemon(benchId: string) {
    setBench((current) => current.filter((entry) => entry.id !== benchId));
  }

  function commitTeamName() {
    const nextName = teamNameDraft.trim() || "Untitled Team";

    setTeamName(nextName);
    setTeamNameDraft(nextName);

    return nextName;
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
      setNewTeamImportError("Paste at least one Showdown Pokemon set.");
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
      setSearchError(`${lookup} is not legal in Regulation M-B.`);
      setSelectingPokemonSlot(null);
      return;
    }

    try {
      const selectedMember = await resolvePokemonMember(lookup);
      let targetMember = selectedMember;
      let usageSet: SmogonUsageSet | null = null;

      if (options.applyUsageStats) {
        usageSet = await loadPopularSmogonSet(lookup);

        if (usageSet) {
          targetMember = await resolveUsageTargetMember(usageSet, selectedMember);
        } else if (pokemonSelectionRequestRef.current === requestId) {
          setSearchNotice({
            slotIndex,
            message: "No popular set found. Basic defaults were applied.",
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
        setSearchError(error instanceof Error ? error.message : "Pokemon lookup failed.");
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
      throw new Error("Paste at least one Showdown Pokemon set.");
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
      const importedTeamName = "Imported Team";
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
      setTeamStorageMessage("Imported new team. Save when ready.");
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
        slots: emptyTeam.map(createSavedSlot),
        bench: [],
        buildState: createEmptyBuildState(),
      });
    } catch (error) {
      setIsNewTeamImportOpen(true);
      setNewTeamImportError(
        error instanceof Error ? error.message : "Showdown import failed.",
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
    setTeamStorageMessage("Imported Pokemon set.");
  }

  function handleSaveTeam() {
    const nextName = commitTeamName();
    const now = new Date().toISOString();
    const nextSnapshot = getCurrentTeamSnapshot(nextName);
    const nextTeamId = activeSavedTeamId ?? createSavedTeamId();
    const existingTeam = savedTeams.find((savedTeam) => savedTeam.id === nextTeamId);

    if (!existingTeam && !canAddSavedTeam(savedTeams.length)) {
      setTeamStorageMessage("Team limit reached. Delete one first.");
      setIsTeamManagerOpen(true);
      setIsSaveConfirmed(false);
      return;
    }

    const nextSavedTeam: SavedTeamSummary = {
      version: SAVED_TEAM_SCHEMA_VERSION,
      id: nextTeamId,
      name: nextName,
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
    setTeamStorageMessage(`Saved ${nextSavedTeam.name}.`);
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
    teamBuildState.replaceBuildState(savedTeam.buildState);
    setActiveSavedTeamId(savedTeam.id);
    storeLastActiveTeamId(savedTeam.id);
    committedSnapshotRef.current = serializeTeamSnapshot({
      name: savedTeam.name,
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
    setTeamName("Untitled Team");
    setTeamNameDraft("Untitled Team");
    setActiveSavedTeamId(null);
    clearLastActiveTeamId();
    setTeamStorageMessage("New team ready.");
    setPendingTeamAction(null);
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setRenameDraft("");
    setIsTeamManagerOpen(false);
    closeNewTeamTools();
    setNewTeamShowdownDraft("");
    committedSnapshotRef.current = serializeTeamSnapshot({
      name: "Untitled Team",
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
      return "Start a new team without saving this one.";
    }

    if (action.kind === "import") {
      return "Import a new team without saving this one.";
    }

    return `Load ${action.team.name} without saving this one.`;
  }

  function updateSavedTeams(nextTeams: SavedTeamSummary[]) {
    storeTeams(nextTeams);
    setSavedTeams(nextTeams);
  }

  function handleReorderSavedTeams(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) {
      return;
    }

    updateSavedTeams(reorderArrayItem(savedTeams, sourceIndex, targetIndex));
    setTeamStorageMessage("Reordered saved teams.");
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
    setTeamStorageMessage(`Renamed to ${nextName}.`);
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

    setTeamStorageMessage(`Renamed to ${nextName}.`);
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
      setTeamStorageMessage("Team limit reached. Delete one first.");
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
    setTeamStorageMessage(`Duplicated ${savedTeam.name}.`);
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
      setTeamStorageMessage("Copied Showdown text.");
    } catch {
      setTeamStorageMessage("Export text could not be copied.");
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
          slots: nextSavedTeam.slots,
          bench: nextSavedTeam.bench,
          buildState: importedSnapshot.buildState,
        });
      }

      setTeamStorageMessage(`Imported into ${savedTeam.name}.`);
      closeSavedTeamShowdown();
    } catch (error) {
      setTeamStorageMessage(
        error instanceof Error ? error.message : "Showdown import failed.",
      );
      setIsImportingSavedTeam(false);
    }
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
    setTeamStorageMessage(deletedTeam ? `Deleted ${deletedTeam.name}.` : "Deleted team.");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <nav className="team-actions" aria-label="Team actions" ref={teamActionsRef}>
          <button
            className="team-action-button"
            type="button"
            aria-label="Manage teams"
            title="Manage teams"
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
            <span className="sr-only">Team name</span>
            <input
              type="text"
              value={teamNameDraft}
              aria-label="Team name"
              spellCheck="false"
              onBlur={commitTeamName}
              onChange={(event) => setTeamNameDraft(event.target.value)}
              onKeyDown={handleTeamNameKeyDown}
            />
          </label>
          <button
            className={`team-action-button ${isSaveConfirmed ? "is-confirmed" : ""}`}
            type="button"
            aria-label="Save team"
            title="Save team"
            onClick={handleSaveTeam}
          >
            <FontAwesomeIcon
              icon={isSaveConfirmed ? faCheck : faFloppyDisk}
              aria-hidden="true"
            />
          </button>
          {pendingTeamAction ? (
            <div className="team-unsaved-warning" role="dialog" aria-label="Unsaved changes">
              <strong>Discard unsaved changes?</strong>
              <span>{getPendingTeamActionMessage(pendingTeamAction)}</span>
              <div className="team-unsaved-warning-actions">
                <button
                  type="button"
                  onClick={cancelPendingTeamAction}
                >
                  Cancel
                </button>
                <button
                  className="is-danger"
                  type="button"
                  onClick={confirmPendingTeamAction}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : null}
          {isTeamManagerOpen ? (
            <div className="team-manager-panel" role="dialog" aria-label="Saved teams">
              <div className="team-manager-header">
                <strong>
                  Saved Teams <small>{savedTeams.length} / {MAX_SAVED_TEAMS}</small>
                </strong>
                <span
                  className={`${teamStorageMessage ? "has-message" : ""} ${
                    teamStorageMessage?.startsWith("Team limit") ? "is-limit" : ""
                  }`}
                >
                  {teamStorageMessage ?? "Manage teams"}
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
                    <div
                      className={`saved-team-row ${
                        savedTeam.id === activeSavedTeamId ? "is-active" : ""
                      } ${
                        savedTeamReorder.dragState?.sourceIndex === index
                          ? "is-dragging"
                          : ""
                      } ${
                        savedTeamReorder.dragState?.sourceIndex === index &&
                        savedTeamReorder.dragState.isDropping
                          ? "is-dropping"
                          : ""
                      } ${
                        savedTeamReorder.dragState?.targetIndex === index &&
                        savedTeamReorder.dragState.sourceIndex !== index
                          ? "is-drop-target"
                          : ""
                      }`}
                      data-saved-team-index={index}
                      key={savedTeam.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${savedTeam.name}. Drag to reorder or press Alt and an arrow key.`}
                      style={
                        savedTeamReorder.dragState?.sourceIndex === index
                          ? ({
                              "--saved-team-drag-x": `${savedTeamReorder.dragState.offsetX}px`,
                              "--saved-team-drag-y": `${savedTeamReorder.dragState.offsetY}px`,
                            } as CSSProperties)
                          : undefined
                      }
                      onClick={() => handleSavedTeamRowClick(savedTeam)}
                      onKeyDown={(event) =>
                        handleSavedTeamRowKeyDown(event, index, savedTeam)
                      }
                      onPointerDown={(event) => {
                        if (
                          (event.target as Element).closest(
                            "button, input, textarea, [contenteditable='true']",
                          )
                        ) {
                          return;
                        }

                        savedTeamReorder.handlePointerDown(event, index);
                      }}
                      onPointerMove={savedTeamReorder.handlePointerMove}
                      onPointerUp={savedTeamReorder.handlePointerUp}
                      onPointerCancel={savedTeamReorder.handlePointerCancel}
                    >
                      <div className="saved-team-header-row">
                        <div className="saved-team-info">
                          {renamingTeamId === savedTeam.id ? (
                            <input
                              className="saved-team-rename-input"
                              aria-label={`Rename ${savedTeam.name}`}
                              autoFocus
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => handleRenameKeyDown(event, savedTeam.id)}
                            />
                          ) : (
                            <span
                              className="saved-team-name-button"
                            >
                              {savedTeam.name}
                            </span>
                          )}
                        </div>

                        <div
                          className="saved-team-actions"
                          aria-label={`${savedTeam.name} actions`}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {renamingTeamId === savedTeam.id ? (
                            <>
                              <button
                                className="saved-team-action-button"
                                type="button"
                                aria-label="Confirm rename"
                                title="Confirm rename"
                                onClick={() => commitRenameTeam(savedTeam.id)}
                              >
                                <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                              </button>
                              <button
                                className="saved-team-action-button"
                                type="button"
                                aria-label="Cancel rename"
                                title="Cancel rename"
                                onClick={cancelRenameTeam}
                              >
                                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="saved-team-action-button"
                                type="button"
                                aria-label={`Rename ${savedTeam.name}`}
                                title="Rename"
                                onClick={() => startRenameTeam(savedTeam)}
                              >
                                <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                              </button>
                              <button
                                className="saved-team-action-button"
                                type="button"
                                aria-label={`Duplicate ${savedTeam.name}`}
                                title="Duplicate"
                                onClick={() => handleDuplicateTeam(savedTeam)}
                              >
                                <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
                              </button>
                              <button
                                className="saved-team-action-button"
                                type="button"
                                aria-label={`Open Showdown text tools for ${savedTeam.name}`}
                                title="Showdown Text"
                                onClick={() => void toggleSavedTeamShowdown(savedTeam)}
                              >
                                <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
                              </button>
                              <button
                                className="saved-team-action-button is-danger"
                                type="button"
                                aria-label={`Delete ${savedTeam.name}`}
                                title="Delete"
                                onClick={() => {
                                  setRenamingTeamId(null);
                                  setShowdownTeamId(null);
                                  setTeamShowdownDraft("");
                                  setPendingDeleteTeamId((currentId) =>
                                    currentId === savedTeam.id ? null : savedTeam.id,
                                  );
                                  setTeamStorageMessage(null);
                                }}
                              >
                                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        className="saved-team-preview"
                        aria-label={`Load ${savedTeam.name}`}
                      >
                          {savedTeam.slots.map((slot, index) => (
                            <span
                              className="saved-team-preview-slot"
                              key={`${savedTeam.id}-${index}`}
                            >
                              {slot ? <PokemonIcon pokemon={slot} /> : null}
                            </span>
                          ))}
                      </div>

                      {pendingDeleteTeamId === savedTeam.id ? (
                        <div
                          className="saved-team-delete-confirm"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <span>Delete permanently?</span>
                          <button type="button" onClick={() => setPendingDeleteTeamId(null)}>
                            Cancel
                          </button>
                          <button
                            className="is-danger"
                            type="button"
                            onClick={() => handleDeleteTeam(savedTeam.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}

                      {showdownTeamId === savedTeam.id ? (
                        <div
                          className="saved-team-import-panel"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <strong>Team Showdown Text</strong>
                          <textarea
                            value={teamShowdownDraft}
                            placeholder="Paste Showdown team text here..."
                            onChange={(event) => setTeamShowdownDraft(event.target.value)}
                          />
                          <div className="saved-team-import-actions">
                            <button
                              type="button"
                              disabled={isImportingSavedTeam}
                              onClick={() => void commitImportSavedTeam(savedTeam)}
                            >
                              <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
                              {isImportingSavedTeam ? "Importing..." : "Import"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleExportSavedTeam()}
                            >
                              <FontAwesomeIcon icon={faFileExport} aria-hidden="true" />
                              Export
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="team-manager-empty">No saved teams yet.</p>
              )}
            </div>
          ) : null}
        </nav>
      </header>

      <div className="workspace">
        <div className="builder-workspace">
          <TeamBuilder
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
            failedPokemonSelectionSlot={failedPokemonSelection?.slotIndex ?? null}
            buildState={teamBuildState}
            validity={teamValidity}
            onSelectedSlotChange={setSelectedTeamSlot}
            onRetryPokemonIndex={() => setPokemonIndexLoadAttempt((attempt) => attempt + 1)}
            onRetryItemIndex={() => setItemIndexLoadAttempt((attempt) => attempt + 1)}
            onRetryShowdownLegality={() => setShowdownLoadAttempt((attempt) => attempt + 1)}
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
          <TeamDiagnostics
            team={team}
            diagnostics={teamDiagnostics}
          />
        </div>
        <CopilotPanel
          teamName={teamNameDraft}
          team={team}
          pokemonIndex={pokemonIndex}
          selectedSlot={selectedTeamSlot}
          buildState={teamBuildState}
          diagnostics={teamDiagnostics}
          validity={teamValidity}
        />
      </div>

      <footer className="footer">
        <p>
          PokePilot AI is unofficial and not affiliated with Nintendo, Game Freak,
          Creatures, or The Pokemon Company. Data sources: PokeAPI and Pokemon
          Showdown. Icons: Font Awesome and third-party type SVGs.
        </p>
      </footer>
    </main>
  );
}

export default App;
