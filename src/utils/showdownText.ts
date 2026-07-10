import type { StatBlock, TeamSlot } from "../types";
import type { TeamBuildState } from "../hooks/useTeamBuildState";

export type ParsedShowdownPokemon = {
  pokemonName: string;
  itemName?: string;
  ability?: string;
  nature?: string;
  evs?: Partial<StatBlock>;
  moves: string[];
};

const statLabels: Record<keyof StatBlock, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  specialAttack: "SpA",
  specialDefense: "SpD",
  speed: "Spe",
};

const statAliases: Record<string, keyof StatBlock> = {
  hp: "hp",
  atk: "attack",
  attack: "attack",
  def: "defense",
  defense: "defense",
  spa: "specialAttack",
  "sp.atk": "specialAttack",
  "sp. atk": "specialAttack",
  "special attack": "specialAttack",
  spd: "specialDefense",
  "sp.def": "specialDefense",
  "sp. def": "specialDefense",
  "special defense": "specialDefense",
  spe: "speed",
  speed: "speed",
};

export function toPokemonId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[♀]/g, "-f")
    .replace(/[♂]/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatShowdownName(name: string) {
  return name.trim() || "Pokemon";
}

function formatEvs(evs?: StatBlock) {
  if (!evs) {
    return "";
  }

  const parts = Object.entries(statLabels)
    .map(([stat, label]) => {
      const value = evs[stat as keyof StatBlock];

      return value > 0 ? `${value} ${label}` : null;
    })
    .filter(Boolean);

  return parts.length ? `EVs: ${parts.join(" / ")}` : "";
}

export function formatShowdownTeam(team: TeamSlot[], buildState: TeamBuildState) {
  return team
    .map((member, slotIndex) => {
      if (!member) {
        return "";
      }

      const item = buildState.itemBySlot[slotIndex];
      const ability = buildState.abilityBySlot[slotIndex];
      const nature = buildState.natureBySlot[slotIndex];
      const evs = buildState.evsBySlot[slotIndex];
      const moveIds = buildState.moveIdsBySlot[slotIndex] ?? [];
      const moveNames = moveIds
        .map((moveId) => member.moves?.find((move) => move.id === moveId)?.name ?? moveId)
        .filter(Boolean);
      const lines = [
        `${formatShowdownName(member.name)}${item ? ` @ ${item.name}` : ""}`,
        ability ? `Ability: ${ability}` : "",
        formatEvs(evs),
        nature ? `${nature[0].toUpperCase()}${nature.slice(1)} Nature` : "",
        ...moveNames.map((moveName) => `- ${moveName}`),
      ].filter(Boolean);

      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function formatShowdownSlot(
  team: TeamSlot[],
  buildState: TeamBuildState,
  slotIndex: number,
) {
  return formatShowdownTeam([team[slotIndex] ?? null], {
    itemBySlot: { 0: buildState.itemBySlot[slotIndex] },
    abilityBySlot: { 0: buildState.abilityBySlot[slotIndex] },
    natureBySlot: { 0: buildState.natureBySlot[slotIndex] },
    evsBySlot: { 0: buildState.evsBySlot[slotIndex] },
    moveIdsBySlot: { 0: buildState.moveIdsBySlot[slotIndex] ?? [] },
    preMegaPokemonBySlot: {},
  });
}

function parsePokemonHeader(line: string) {
  const withoutGender = line.replace(/\s+\((M|F)\)\s*/i, " ");
  const [namePart, itemPart] = withoutGender.split(/\s+@\s+/, 2);
  const pokemonName = namePart.replace(/\s*\([^)]*\)\s*$/, "").trim();

  return {
    pokemonName,
    itemName: itemPart?.trim(),
  };
}

function parseEvs(line: string): Partial<StatBlock> {
  const evs: Partial<StatBlock> = {};
  const body = line.replace(/^EVs:\s*/i, "");

  for (const part of body.split("/")) {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);

    if (!match) {
      continue;
    }

    const value = Number.parseInt(match[1], 10);
    const stat = statAliases[match[2].trim().toLowerCase()];

    if (stat && Number.isFinite(value)) {
      evs[stat] = value;
    }
  }

  return evs;
}

export function parseShowdownTeam(text: string): ParsedShowdownPokemon[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.slice(0, 6).map((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const header = parsePokemonHeader(lines[0] ?? "");
    const parsed: ParsedShowdownPokemon = {
      ...header,
      moves: [],
    };

    for (const line of lines.slice(1)) {
      if (line.toLowerCase().startsWith("ability:")) {
        parsed.ability = line.replace(/^Ability:\s*/i, "").trim();
        continue;
      }

      if (line.toLowerCase().startsWith("evs:")) {
        parsed.evs = parseEvs(line);
        continue;
      }

      if (/^[A-Za-z]+ Nature$/i.test(line)) {
        parsed.nature = line.replace(/\s+Nature$/i, "").trim().toLowerCase();
        continue;
      }

      if (line.startsWith("-")) {
        parsed.moves.push(line.replace(/^-\s*/, "").trim());
      }
    }

    return parsed;
  });
}
