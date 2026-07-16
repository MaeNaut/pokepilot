import {
  getLegalAbilities,
  getLegalMoves,
  isItemLegal,
  isPokemonLegal,
  type ShowdownLegalitySnapshot,
} from "../api/showdownLegality";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  natures,
  statKeys,
} from "../data/natures";
import type { TeamBuildState } from "./teamBuildState";
import type {
  ItemIndexEntry,
  PokemonIndexEntry,
  TeamMember,
  TeamSlot,
} from "../types";
import { getMegaStoneItemName, isMegaPokemonName } from "./megaEvolution";

export type ValidityStatus = "empty" | "valid" | "invalid" | "unavailable";

export type ValidityIssue = {
  id: string;
  severity: "error" | "unavailable";
  scope: "pokemon" | "item" | "ability" | "nature" | "ev" | "move" | "team";
  message: string;
  slotIndex?: number;
};

export type SlotValidity = {
  slotIndex: number;
  status: ValidityStatus;
  issues: ValidityIssue[];
};

export type TeamValidityResult = {
  status: Exclude<ValidityStatus, "empty">;
  slotResults: SlotValidity[];
  teamIssues: ValidityIssue[];
  errorCount: number;
  unavailableCount: number;
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatLookupLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isLegalityDataAvailable(snapshot: ShowdownLegalitySnapshot | null) {
  return Boolean(
    snapshot &&
      !snapshot.error &&
      snapshot.pokemonIds.size > 0 &&
      snapshot.itemIds.size > 0,
  );
}

function getIndexEntry(member: TeamMember, pokemonIndex: PokemonIndexEntry[]) {
  return pokemonIndex.find((entry) => entry.name === member.id);
}

function createIssue(
  slotIndex: number,
  id: string,
  scope: ValidityIssue["scope"],
  message: string,
  severity: ValidityIssue["severity"] = "error",
): ValidityIssue {
  return { id: `${id}-${slotIndex}`, severity, scope, message, slotIndex };
}

function validateEvs(slotIndex: number, buildState: TeamBuildState) {
  const evs = buildState.evsBySlot[slotIndex];

  if (!evs) {
    return [];
  }

  const issues: ValidityIssue[] = [];

  for (const stat of statKeys) {
    const value = evs[stat];

    if (!Number.isInteger(value) || value < 0 || value > CHAMPIONS_MAX_EV_PER_STAT) {
      issues.push(
        createIssue(
          slotIndex,
          `ev-${stat}`,
          "ev",
          `${stat} EV must be a whole number from 0 to ${CHAMPIONS_MAX_EV_PER_STAT}.`,
        ),
      );
    }
  }

  const total = statKeys.reduce((sum, stat) => sum + evs[stat], 0);

  if (Number.isFinite(total) && total > CHAMPIONS_MAX_EV_TOTAL) {
    issues.push(
      createIssue(
        slotIndex,
        "ev-total",
        "ev",
        `EV total is ${total}; Regulation M-B allows ${CHAMPIONS_MAX_EV_TOTAL}.`,
      ),
    );
  }

  return issues;
}

function validateMoves(
  slotIndex: number,
  member: TeamMember,
  speciesKey: string | undefined,
  buildState: TeamBuildState,
  snapshot: ShowdownLegalitySnapshot,
) {
  const selectedMoveIds = buildState.moveIdsBySlot[slotIndex] ?? [];
  const issues: ValidityIssue[] = [];
  const normalizedMoveIds = selectedMoveIds.map(normalizeLookup).filter(Boolean);
  const duplicateMoveIds = normalizedMoveIds.filter(
    (moveId, index) => normalizedMoveIds.indexOf(moveId) !== index,
  );

  if (duplicateMoveIds.length > 0) {
    issues.push(
      createIssue(slotIndex, "duplicate-moves", "move", "A Pokemon cannot use the same move twice."),
    );
  }

  if (normalizedMoveIds.length === 0) {
    return issues;
  }

  const activeMoves = getLegalMoves(snapshot, member.id, speciesKey);
  const preMegaId = buildState.preMegaPokemonBySlot[slotIndex];
  const preMegaMoves = preMegaId ? getLegalMoves(snapshot, preMegaId, speciesKey) : null;
  const legalMoves = new Set([...(activeMoves ?? []), ...(preMegaMoves ?? [])]);

  if (legalMoves.size === 0) {
    issues.push(
      createIssue(
        slotIndex,
        "move-data-unavailable",
        "move",
        "Move legality data is unavailable for this form.",
        "unavailable",
      ),
    );
    return issues;
  }

  for (const moveId of new Set(normalizedMoveIds)) {
    if (!legalMoves.has(moveId)) {
      const moveName =
        member.moves?.find((move) => normalizeLookup(move.id) === moveId)?.name ?? moveId;
      issues.push(
        createIssue(slotIndex, `illegal-move-${moveId}`, "move", `${moveName} is not legal for this Pokemon.`),
      );
    }
  }

  return issues;
}

function validateSlot(
  member: TeamMember | null,
  slotIndex: number,
  buildState: TeamBuildState,
  snapshot: ShowdownLegalitySnapshot | null,
  pokemonIndex: PokemonIndexEntry[],
  knownMegaStoneNames: Set<string>,
): SlotValidity {
  if (!member) {
    return { slotIndex, status: "empty", issues: [] };
  }

  const issues = validateEvs(slotIndex, buildState);
  const natureId = buildState.natureBySlot[slotIndex];

  if (natureId && !natures.some((nature) => nature.id === natureId)) {
    issues.push(createIssue(slotIndex, "unknown-nature", "nature", `${natureId} is not a recognized nature.`));
  }

  const indexEntry = getIndexEntry(member, pokemonIndex);
  const speciesKey = indexEntry?.speciesKey;
  const activeItem = buildState.itemBySlot[slotIndex];

  if (isMegaPokemonName(member.id)) {
    const expectedStone = getMegaStoneItemName(member.id, knownMegaStoneNames);
    const activeItemId = normalizeLookup(activeItem?.id || activeItem?.name || "");

    if (expectedStone && activeItemId !== normalizeLookup(expectedStone)) {
      issues.push(
        createIssue(
          slotIndex,
          "mega-stone",
          "item",
          `This Mega form requires ${formatLookupLabel(expectedStone)}.`,
        ),
      );
    }
  }

  if (!isLegalityDataAvailable(snapshot)) {
    issues.push(
      createIssue(
        slotIndex,
        "legality-unavailable",
        "pokemon",
        "Regulation M-B legality data is not available yet.",
        "unavailable",
      ),
    );
  } else if (snapshot) {
    if (!isPokemonLegal(snapshot, member.id, speciesKey)) {
      issues.push(createIssue(slotIndex, "illegal-pokemon", "pokemon", `${member.name} is not legal in Regulation M-B.`));
    }

    if (activeItem && !isItemLegal(snapshot, activeItem.id || activeItem.name)) {
      issues.push(createIssue(slotIndex, "illegal-item", "item", `${activeItem.name} is not legal in Regulation M-B.`));
    }

    const selectedAbility = buildState.abilityBySlot[slotIndex] ?? member.abilities?.[0];

    if (selectedAbility) {
      const legalAbilities = getLegalAbilities(snapshot, member.id, speciesKey);

      if (!legalAbilities || legalAbilities.size === 0) {
        issues.push(
          createIssue(
            slotIndex,
            "ability-data-unavailable",
            "ability",
            "Ability legality data is unavailable for this form.",
            "unavailable",
          ),
        );
      } else if (!legalAbilities.has(normalizeLookup(selectedAbility))) {
        issues.push(createIssue(slotIndex, "illegal-ability", "ability", `${selectedAbility} is not legal for this Pokemon.`));
      }
    }

    issues.push(...validateMoves(slotIndex, member, speciesKey, buildState, snapshot));
  }

  const hasError = issues.some((issue) => issue.severity === "error");
  const hasUnavailable = issues.some((issue) => issue.severity === "unavailable");

  return {
    slotIndex,
    status: hasError ? "invalid" : hasUnavailable ? "unavailable" : "valid",
    issues,
  };
}

function createDuplicateIssues(
  team: TeamSlot[],
  buildState: TeamBuildState,
  pokemonIndex: PokemonIndexEntry[],
) {
  const issues: ValidityIssue[] = [];
  const speciesSlots = new Map<string, number[]>();
  const itemSlots = new Map<string, { name: string; slots: number[] }>();

  team.forEach((member, slotIndex) => {
    if (!member) {
      return;
    }

    const speciesKey = getIndexEntry(member, pokemonIndex)?.speciesKey ?? member.id;
    const speciesId = normalizeLookup(speciesKey);
    speciesSlots.set(speciesId, [...(speciesSlots.get(speciesId) ?? []), slotIndex]);

    const item = buildState.itemBySlot[slotIndex];
    if (item) {
      const itemId = normalizeLookup(item.id || item.name);
      const entry = itemSlots.get(itemId) ?? { name: item.name, slots: [] };
      entry.slots.push(slotIndex);
      itemSlots.set(itemId, entry);
    }
  });

  for (const [speciesId, slots] of speciesSlots) {
    if (speciesId && slots.length > 1) {
      issues.push({
        id: `duplicate-species-${speciesId}`,
        severity: "error",
        scope: "team",
        message: `Species Clause: slots ${slots.map((slot) => slot + 1).join(", ")} use the same Pokemon species.`,
      });
    }
  }

  for (const [itemId, entry] of itemSlots) {
    if (itemId && entry.slots.length > 1) {
      issues.push({
        id: `duplicate-item-${itemId}`,
        severity: "error",
        scope: "team",
        message: `Item Clause: ${entry.name} is used in slots ${entry.slots.map((slot) => slot + 1).join(", ")}.`,
      });
    }
  }

  return issues;
}

export function validateTeam(
  team: TeamSlot[],
  buildState: TeamBuildState,
  snapshot: ShowdownLegalitySnapshot | null,
  pokemonIndex: PokemonIndexEntry[],
  itemIndex: ItemIndexEntry[],
): TeamValidityResult {
  const knownMegaStoneNames = new Set(
    itemIndex.filter((item) => item.isMegaStone).map((item) => item.name),
  );
  const slotResults = team.map((member, slotIndex) =>
    validateSlot(
      member,
      slotIndex,
      buildState,
      snapshot,
      pokemonIndex,
      knownMegaStoneNames,
    ),
  );
  const teamIssues = createDuplicateIssues(team, buildState, pokemonIndex);
  const issues = [...slotResults.flatMap((result) => result.issues), ...teamIssues];
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const unavailableCount = issues.filter((issue) => issue.severity === "unavailable").length;

  return {
    status: errorCount > 0 ? "invalid" : unavailableCount > 0 ? "unavailable" : "valid",
    slotResults,
    teamIssues,
    errorCount,
    unavailableCount,
  };
}
