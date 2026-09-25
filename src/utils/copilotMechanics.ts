import { normalizeShowdownId } from "../api/showdownIds";
import type {
  PokemonMoveFieldEffect,
  PokemonMoveStatChange,
  PokemonMoveTarget,
} from "../types";

export type CopilotMechanicEntry = {
  id: string;
  displayName: string;
  effect?: string;
  tags?: string[];
  target?: PokemonMoveTarget;
  priority?: number;
  targetStatChanges?: PokemonMoveStatChange[];
  fieldEffects?: PokemonMoveFieldEffect[];
  statChangeMode?: "reverse" | "double";
};

export type CopilotMechanicsSnapshot = {
  moves: CopilotMechanicEntry[];
  abilities: CopilotMechanicEntry[];
  items: CopilotMechanicEntry[];
};

export type CopilotMechanicsMoveInput = {
  id: string;
  displayName: string;
  description?: string;
  tags?: string[];
  target?: PokemonMoveTarget;
  priority?: number;
  targetStatChanges?: PokemonMoveStatChange[];
  fieldEffects?: PokemonMoveFieldEffect[];
};

export type CopilotMechanicsAbilityInput = {
  id: string;
  displayName: string;
  effect?: string;
};

export type CopilotMechanicsSetInput = {
  abilities: CopilotMechanicsAbilityInput[];
  itemId: string | null;
  itemDisplayName: string | null;
  itemEffect?: string;
  moves: CopilotMechanicsMoveInput[];
};

const maxEffectLength = 500;
const genericDescriptions = new Set([
  "",
  "no additional effect.",
  "no additional effect",
  "move description is not available from showdown.",
]);

function normalizeId(value: string | null | undefined) {
  return normalizeShowdownId(value ?? "");
}

export function compactCopilotMechanicEffect(value: string | undefined) {
  const compact = value?.replace(/\s+/g, " ").trim() ?? "";

  if (!compact || genericDescriptions.has(compact.toLowerCase())) {
    return undefined;
  }

  return compact.length <= maxEffectLength
    ? compact
    : `${compact.slice(0, maxEffectLength - 3).trimEnd()}...`;
}

function compactTags(tags: string[] | undefined) {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
}

function inferStatChangeMode(effect: string | undefined) {
  const normalized = effect?.toLowerCase() ?? "";
  if (
    /revers(?:e|es|ed|ing)[\s\S]{0,80}stat (?:stage )?changes|stat (?:stage )?changes[\s\S]{0,80}revers|stat stage(?:s)?[\s\S]{0,80}raised[\s\S]{0,80}lowered[\s\S]{0,80}vice versa/i.test(
      normalized,
    )
  ) {
    return "reverse" as const;
  }
  if (
    /doubl(?:e|es|ed|ing)[\s\S]{0,80}stat (?:stage )?changes|stat (?:stage )?changes[\s\S]{0,80}doubl|stat stage(?:s)?[\s\S]{0,80}doubl/i.test(
      normalized,
    )
  ) {
    return "double" as const;
  }
  return undefined;
}

function addUniqueMechanic(
  entries: Map<string, CopilotMechanicEntry>,
  entry: CopilotMechanicEntry,
) {
  const id = normalizeId(entry.id);

  if (id && !entries.has(id)) {
    entries.set(id, { ...entry, id });
  }
}

export function createCopilotMechanicsSnapshot(
  sets: CopilotMechanicsSetInput[],
): CopilotMechanicsSnapshot {
  const moves = new Map<string, CopilotMechanicEntry>();
  const abilities = new Map<string, CopilotMechanicEntry>();
  const items = new Map<string, CopilotMechanicEntry>();

  for (const set of sets) {
    for (const move of set.moves) {
      const effect = compactCopilotMechanicEffect(move.description);
      const tags = compactTags(move.tags);
      addUniqueMechanic(moves, {
        id: move.id,
        displayName: move.displayName,
        ...(effect ? { effect } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        ...(move.target ? { target: move.target } : {}),
        ...(move.priority ? { priority: move.priority } : {}),
        ...(move.targetStatChanges?.length
          ? { targetStatChanges: move.targetStatChanges.map((change) => ({ ...change })) }
          : {}),
        ...(move.fieldEffects?.length
          ? { fieldEffects: move.fieldEffects.map((effect) => ({ ...effect })) }
          : {}),
      });
    }

    for (const ability of set.abilities) {
      const effect = compactCopilotMechanicEffect(ability.effect);
      const statChangeMode = inferStatChangeMode(effect);
      addUniqueMechanic(abilities, {
        id: ability.id,
        displayName: ability.displayName,
        ...(effect ? { effect } : {}),
        ...(statChangeMode ? { statChangeMode } : {}),
      });
    }

    if (set.itemId && set.itemDisplayName) {
      const effect = compactCopilotMechanicEffect(set.itemEffect);
      addUniqueMechanic(items, {
        id: set.itemId,
        displayName: set.itemDisplayName,
        ...(effect ? { effect } : {}),
      });
    }
  }

  return {
    moves: [...moves.values()],
    abilities: [...abilities.values()],
    items: [...items.values()],
  };
}
