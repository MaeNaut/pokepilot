import { useCallback, useEffect, useRef, useState } from "react";
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
  faPlus,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { fetchItem, fetchItemIndex, fetchPokemon, fetchPokemonIndex } from "./api/pokeApi";
import { loadPopularSmogonSet } from "./api/smogonUsage";
import { isPokemonLegal, loadShowdownLegality } from "./api/showdownLegality";
import { CopilotPanel } from "./components/CopilotPanel";
import { PokemonIcon } from "./components/PokemonIcon";
import { TeamBuilder } from "./components/TeamBuilder";
import { TeamDiagnostics } from "./components/TeamDiagnostics";
import { samplePool, startingTeam } from "./data/sampleTeam";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  defaultEvs,
} from "./data/natures";
import { useTeamBuildState } from "./hooks/useTeamBuildState";
import { useLongPressReorder } from "./hooks/useLongPressReorder";
import {
  getPreferredPokeApiId,
  shouldKeepSelectedPokemonForUsageTarget,
} from "./utils/pokemonAliases";
import { isFullShowdownSpriteUrl } from "./utils/pokemonSprites";
import {
  formatShowdownSlot,
  formatShowdownTeam,
  parseShowdownTeam,
  toPokemonId,
} from "./utils/showdownText";
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

const savedTeamsStorageKey = "pokepilot.savedTeams.v1";
const lastActiveTeamStorageKey = "pokepilot.lastActiveTeam.v1";
const savedTeamSchemaVersion = 1;
const blankTeamSize = 6;

type SavedTeamSlot = {
  pokemonId: string;
  name: string;
  spriteUrl?: string;
  iconSpriteUrl?: string;
} | null;

type SavedTeamSummary = {
  version: typeof savedTeamSchemaVersion;
  id: string;
  name: string;
  slots: SavedTeamSlot[];
  buildState?: TeamBuildState;
  createdAt: string;
  updatedAt: string;
};

type TeamSnapshot = {
  name: string;
  slots: SavedTeamSlot[];
  buildState: TeamBuildState;
};

type PendingTeamAction =
  | {
      kind: "load";
      team: SavedTeamSummary;
    }
  | {
      kind: "new";
    };

function mergePool(nextMembers: TeamMember[], currentPool: TeamMember[]) {
  const merged = [...nextMembers, ...currentPool];
  return merged.filter(
    (member, index, list) => list.findIndex((item) => item.id === member.id) === index,
  );
}

function createSavedTeamId() {
  return globalThis.crypto?.randomUUID?.() ?? `team-${Date.now()}`;
}

function normalizeSavedTeam(team: Partial<SavedTeamSummary>): SavedTeamSummary | null {
  if (!team.id || !team.name || !Array.isArray(team.slots)) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    version: savedTeamSchemaVersion,
    id: team.id,
    name: team.name,
    slots: team.slots,
    buildState: team.buildState,
    createdAt: team.createdAt ?? now,
    updatedAt: team.updatedAt ?? team.createdAt ?? now,
  };
}

function getStoredTeams(): SavedTeamSummary[] {
  try {
    const rawTeams = localStorage.getItem(savedTeamsStorageKey);
    const parsedTeams = rawTeams ? JSON.parse(rawTeams) : [];

    if (!Array.isArray(parsedTeams)) {
      return [];
    }

    return parsedTeams
      .map((team) => normalizeSavedTeam(team as Partial<SavedTeamSummary>))
      .filter((team): team is SavedTeamSummary => Boolean(team));
  } catch {
    return [];
  }
}

function storeTeams(teams: SavedTeamSummary[]) {
  localStorage.setItem(savedTeamsStorageKey, JSON.stringify(teams));
}

function getLastActiveTeamId() {
  return localStorage.getItem(lastActiveTeamStorageKey);
}

function storeLastActiveTeamId(teamId: string) {
  localStorage.setItem(lastActiveTeamStorageKey, teamId);
}

function clearLastActiveTeamId() {
  localStorage.removeItem(lastActiveTeamStorageKey);
}

function getCopiedTeamName(name: string, teams: SavedTeamSummary[]) {
  const baseName = `${name} Copy`;
  const usedNames = new Set(teams.map((team) => team.name.toLowerCase()));

  if (!usedNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let copyNumber = 2;

  while (usedNames.has(`${baseName} ${copyNumber}`.toLowerCase())) {
    copyNumber += 1;
  }

  return `${baseName} ${copyNumber}`;
}

function createSavedSlot(member: TeamSlot): SavedTeamSlot {
  if (!member) {
    return null;
  }

  return {
    pokemonId: member.id,
    name: member.name,
    spriteUrl: member.spriteUrl,
    iconSpriteUrl: member.iconSpriteUrl,
  };
}

function serializeTeamSnapshot(snapshot: TeamSnapshot) {
  return JSON.stringify(snapshot);
}

function createEmptyBuildState(): TeamBuildState {
  return {
    itemBySlot: {},
    abilityBySlot: {},
    natureBySlot: {},
    evsBySlot: {},
    moveIdsBySlot: {},
    preMegaPokemonBySlot: {},
  };
}

function createFallbackMember(slot: Exclude<SavedTeamSlot, null>): TeamMember {
  return {
    id: slot.pokemonId,
    name: slot.name,
    types: [],
    roles: [],
    spriteUrl: slot.spriteUrl,
    iconSpriteUrl: slot.iconSpriteUrl,
    source: "local",
  };
}

function hasStaleShowdownIcon(member: TeamMember) {
  return isFullShowdownSpriteUrl(member.iconSpriteUrl);
}

function normalizeShowdownLookup(value: string) {
  return toPokemonId(value);
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
  const [team, setTeam] = useState<TeamSlot[]>(startingTeam);
  const teamBuildState = useTeamBuildState();
  const [teamName, setTeamName] = useState("Untitled Team");
  const [teamNameDraft, setTeamNameDraft] = useState("Untitled Team");
  const [savedTeams, setSavedTeams] = useState<SavedTeamSummary[]>([]);
  const [activeSavedTeamId, setActiveSavedTeamId] = useState<string | null>(null);
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
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
  const [customPool, setCustomPool] = useState(samplePool);
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
  const hasRestoredSavedTeamRef = useRef(false);
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

  function getCurrentTeamSnapshot(name = teamNameDraft): TeamSnapshot {
    return {
      name: name.trim() || "Untitled Team",
      slots: team.map(createSavedSlot),
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
      hasRestoredSavedTeamRef.current = true;
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
    if (!isTeamManagerOpen && !pendingTeamAction) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!teamActionsRef.current?.contains(event.target as Node)) {
        closeTeamManager();
        setPendingTeamAction(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeTeamManager, isTeamManagerOpen, pendingTeamAction]);

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

  useEffect(() => {
    let isMounted = true;

    async function hydrateStartingTeam() {
      if (hasRestoredSavedTeamRef.current) {
        return;
      }

      try {
        const hydratedTeam = await Promise.all(
          startingTeam.map((member) => fetchPokemon(member.id)),
        );

        if (!isMounted || hasRestoredSavedTeamRef.current) {
          return;
        }

        setTeam(hydratedTeam);
        setCustomPool((currentPool) => mergePool(hydratedTeam, currentPool));
      } catch {
        // Keep local sample data if the network is unavailable.
      }
    }

    void hydrateStartingTeam();

    return () => {
      isMounted = false;
    };
  }, []);

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

  function commitTeamName() {
    const nextName = teamNameDraft.trim() || "Untitled Team";

    setTeamName(nextName);
    setTeamNameDraft(nextName);

    return nextName;
  }

  function toggleTeamManager() {
    if (isTeamManagerOpen) {
      closeTeamManager();
    } else {
      setIsTeamManagerOpen(true);
    }
  }

  function openUnsavedWarning(action: PendingTeamAction) {
    setPendingTeamAction(action);
    setPendingDeleteTeamId(null);
    setRenamingTeamId(null);
    setTeamStorageMessage(null);
  }

  function requestNewTeam() {
    if (hasUnsavedTeamChanges()) {
      openUnsavedWarning({ kind: "new" });
      return;
    }

    createNewTeam();
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

  function resolveImportedPokemonId(name: string) {
    const preferredPokeApiId = getPreferredPokeApiId(name);

    if (preferredPokeApiId) {
      return preferredPokeApiId;
    }

    const normalized = normalizeShowdownLookup(name);
    const matchedEntry = pokemonIndex.find((entry) => {
      const entryNames = [
        entry.name,
        entry.displayName,
        entry.displayName.replace(/\s+/g, "-"),
      ].map(normalizeShowdownLookup);

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
        (ability) => normalizeShowdownLookup(ability) === normalizeShowdownLookup(usageSet.ability!),
      ) ??
      usageSet.ability
    );
  }

  function resolveUsageMoveIds(member: TeamMember, usageSet: SmogonUsageSet) {
    const legalMoveIds = new Set((member.moves ?? []).map((move) => move.id));

    return usageSet.moveIds.filter((moveId) => legalMoveIds.has(moveId)).slice(0, 4);
  }

  async function resolveUsageTargetMember(
    usageSet: SmogonUsageSet,
    selectedMember: TeamMember,
  ) {
    const usagePokemonId = resolveImportedPokemonId(usageSet.pokemonName);

    if (
      normalizeShowdownLookup(usagePokemonId) === normalizeShowdownLookup(selectedMember.id) ||
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
    const moveIds = resolveUsageMoveIds(targetMember, usageSet);
    let item: PokemonItem | null = null;

    if (usageSet.itemName) {
      try {
        item = await fetchItem(normalizeShowdownLookup(usageSet.itemName));
      } catch {
        item = null;
      }
    }

    teamBuildState.patchSlot(slotIndex, {
      item,
      ...(ability ? { ability } : {}),
      ...(usageSet.nature ? { nature: usageSet.nature } : {}),
      ...(usageSet.evs ? { evs: normalizeImportedEvs(usageSet.evs) } : {}),
      ...(moveIds.length > 0 ? { moveIds } : {}),
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

      const pokemonId = resolveImportedPokemonId(parsedPokemon.pokemonName);
      const member = await fetchPokemon(pokemonId);

      importedMembers.push(member);

      if (parsedPokemon.itemName) {
        try {
          importedBuildState.itemBySlot[slotIndex] = await fetchItem(
            normalizeShowdownLookup(parsedPokemon.itemName),
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

      const moveIds = parsedPokemon.moves.map(normalizeShowdownLookup);
      importedBuildState.moveIdsBySlot[slotIndex] = [0, 1, 2, 3].map(
        (moveIndex) => moveIds[moveIndex] ?? "",
      );
    }

    while (importedMembers.length < blankTeamSize) {
      importedMembers.push(null);
    }

    return {
      members: importedMembers.slice(0, blankTeamSize),
      buildState: importedBuildState,
    };
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
    const nextSavedTeam: SavedTeamSummary = {
      version: savedTeamSchemaVersion,
      id: nextTeamId,
      name: nextName,
      slots: nextSnapshot.slots,
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

    const hydratedTeam = await hydrateSavedTeamMembers(savedTeam);

    setCustomPool((currentPool) =>
      mergePool(
        hydratedTeam.filter((member): member is TeamMember => Boolean(member)),
        currentPool,
      ),
    );
    setTeam(hydratedTeam);
    setTeamName(savedTeam.name);
    setTeamNameDraft(savedTeam.name);
    teamBuildState.replaceBuildState(savedTeam.buildState);
    setActiveSavedTeamId(savedTeam.id);
    storeLastActiveTeamId(savedTeam.id);
    committedSnapshotRef.current = serializeTeamSnapshot({
      name: savedTeam.name,
      slots: savedTeam.slots,
      buildState: savedTeam.buildState ?? createEmptyBuildState(),
    });
    closeTeamManager();
  }

  async function hydrateSavedTeamMembers(savedTeam: SavedTeamSummary) {
    return Promise.all(
      savedTeam.slots.map(async (slot) => {
        if (!slot) {
          return null;
        }

        const poolMember = customPool.find((member) => member.id === slot.pokemonId);

        if (poolMember && !hasStaleShowdownIcon(poolMember)) {
          return poolMember;
        }

        try {
          return await fetchPokemon(slot.pokemonId);
        } catch {
          return createFallbackMember(slot);
        }
      }),
    );
  }

  function createNewTeam() {
    const emptyTeam = Array<TeamSlot>(blankTeamSize).fill(null);

    setTeam(emptyTeam);
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
    committedSnapshotRef.current = serializeTeamSnapshot({
      name: "Untitled Team",
      slots: emptyTeam.map(createSavedSlot),
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

    void loadSavedTeam(action.team);
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
    const now = new Date().toISOString();
    const copiedTeam: SavedTeamSummary = {
      ...savedTeam,
      version: savedTeamSchemaVersion,
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
          <button
            className="team-action-button"
            type="button"
            aria-label="New team"
            title="New team"
            onClick={requestNewTeam}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          </button>
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
              <span>
                {pendingTeamAction.kind === "new"
                  ? "Start a new team without saving this one."
                  : `Load ${pendingTeamAction.team.name} without saving this one.`}
              </span>
              <div className="team-unsaved-warning-actions">
                <button
                  type="button"
                  onClick={() => setPendingTeamAction(null)}
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
                <strong>Saved Teams</strong>
                <span className={teamStorageMessage ? "has-message" : ""}>
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
                                aria-label={`Open Showdown text tools for ${savedTeam.name}`}
                                title="Showdown Text"
                                onClick={() => void toggleSavedTeamShowdown(savedTeam)}
                              >
                                <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
                              </button>
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
            onExportShowdown={getShowdownExportText}
            onImportShowdown={handleImportShowdownSlot}
          />
          <TeamDiagnostics
            team={team}
            moveSources={customPool}
            buildState={teamBuildState}
          />
        </div>
        <CopilotPanel
          team={team}
          pokemonCount={pokemonIndex.length}
          indexStatus={indexStatus}
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
