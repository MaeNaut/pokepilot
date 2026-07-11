import type { PokemonType } from "../types";

export type TeamConceptId =
  | "trick-room"
  | "tailwind"
  | "gravity"
  | "rain"
  | "sun"
  | "sand"
  | "snow";

export type TeamConceptDefinition = {
  id: TeamConceptId;
  label: string;
  setterMoveIds: Set<string>;
  setterAbilityIds: Set<string>;
  aceAbilityIds: Set<string>;
  aceMoveIds: Set<string>;
  boostedMoveType?: PokemonType;
};

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizedSet(values: string[]) {
  return new Set(values.map(normalizeLookup));
}

export const teamConceptDefinitions: TeamConceptDefinition[] = [
  {
    id: "trick-room",
    label: "Trick Room",
    setterMoveIds: normalizedSet(["trick-room"]),
    setterAbilityIds: normalizedSet([]),
    aceAbilityIds: normalizedSet([]),
    aceMoveIds: normalizedSet([]),
  },
  {
    id: "tailwind",
    label: "Tailwind",
    setterMoveIds: normalizedSet(["tailwind"]),
    setterAbilityIds: normalizedSet([]),
    aceAbilityIds: normalizedSet([]),
    aceMoveIds: normalizedSet([]),
  },
  {
    id: "gravity",
    label: "Gravity",
    setterMoveIds: normalizedSet(["gravity"]),
    setterAbilityIds: normalizedSet([]),
    aceAbilityIds: normalizedSet([]),
    aceMoveIds: normalizedSet([]),
  },
  {
    id: "rain",
    label: "Rain",
    setterMoveIds: normalizedSet(["rain-dance"]),
    setterAbilityIds: normalizedSet(["drizzle"]),
    aceAbilityIds: normalizedSet(["swift-swim"]),
    aceMoveIds: normalizedSet(["thunder", "hurricane", "weather-ball"]),
    boostedMoveType: "water",
  },
  {
    id: "sun",
    label: "Sun",
    setterMoveIds: normalizedSet(["sunny-day"]),
    setterAbilityIds: normalizedSet(["drought"]),
    aceAbilityIds: normalizedSet(["chlorophyll", "solar-power"]),
    aceMoveIds: normalizedSet([
      "growth",
      "solar-beam",
      "solar-blade",
      "weather-ball",
    ]),
    boostedMoveType: "fire",
  },
  {
    id: "sand",
    label: "Sand",
    setterMoveIds: normalizedSet(["sandstorm"]),
    setterAbilityIds: normalizedSet(["sand-stream"]),
    aceAbilityIds: normalizedSet(["sand-force", "sand-rush"]),
    aceMoveIds: normalizedSet(["weather-ball"]),
  },
  {
    id: "snow",
    label: "Snow",
    setterMoveIds: normalizedSet(["chilly-reception", "snowscape"]),
    setterAbilityIds: normalizedSet(["snow-warning"]),
    aceAbilityIds: normalizedSet(["slush-rush"]),
    aceMoveIds: normalizedSet(["aurora-veil", "blizzard", "weather-ball"]),
  },
];

export const setterMoveIds = normalizedSet([
  "aurora-veil",
  "electric-terrain",
  "gravity",
  "grassy-terrain",
  "light-screen",
  "magic-room",
  "misty-terrain",
  "psychic-terrain",
  "rain-dance",
  "reflect",
  "sandstorm",
  "snowscape",
  "spikes",
  "stealth-rock",
  "sticky-web",
  "sunny-day",
  "tailwind",
  "toxic-spikes",
  "trick-room",
  "wonder-room",
  "chilly-reception",
]);

export const setterAbilityIds = normalizedSet([
  "drizzle",
  "drought",
  "electric-surge",
  "grassy-surge",
  "misty-surge",
  "psychic-surge",
  "sand-stream",
  "snow-warning",
]);

export { normalizeLookup as normalizeConceptLookup };
