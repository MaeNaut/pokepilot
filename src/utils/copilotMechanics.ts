export type CopilotMechanicEntry = {
  id: string;
  displayName: string;
  effect?: string;
  tags?: string[];
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
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function compactEffect(value: string | undefined) {
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
      const effect = compactEffect(move.description);
      const tags = compactTags(move.tags);
      addUniqueMechanic(moves, {
        id: move.id,
        displayName: move.displayName,
        ...(effect ? { effect } : {}),
        ...(tags.length > 0 ? { tags } : {}),
      });
    }

    for (const ability of set.abilities) {
      const effect = compactEffect(ability.effect);
      addUniqueMechanic(abilities, {
        id: ability.id,
        displayName: ability.displayName,
        ...(effect ? { effect } : {}),
      });
    }

    if (set.itemId && set.itemDisplayName) {
      const effect = compactEffect(set.itemEffect);
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
