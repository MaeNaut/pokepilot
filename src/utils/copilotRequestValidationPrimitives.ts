import { pokemonTypes } from "../types.js";
import { isRecord } from "./typeGuards.js";

export const pokemonTypeSet = new Set<string>(pokemonTypes);
export const statIds = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
] as const;
export const statIdSet = new Set<string>(statIds);
export const optimizationCandidateProfiles = new Set([
  "offense-breakpoint",
  "physical-bulk-maximum",
  "special-bulk-maximum",
  "physical-survival-with-reserve",
  "special-survival-with-reserve",
  "speed-adjustment",
]);
export const teamRoleIds = [
  "physical-attacker",
  "special-attacker",
  "physical-wall",
  "special-wall",
  "supporter",
  "setter",
] as const;
export const teamRoleIdSet = new Set<string>(teamRoleIds);
export const teamConceptIds = [
  "trick-room",
  "tailwind",
  "gravity",
  "rain",
  "sun",
  "sand",
  "snow",
] as const;
export const teamConceptIdSet = new Set<string>(teamConceptIds);

export function validateBoundedStructure(
  value: unknown,
  path: string,
  errors: string[],
  depth = 0,
) {
  if (depth > 12) {
    errors.push(`${path} exceeds the maximum nesting depth.`);
    return;
  }

  if (typeof value === "string") {
    if (value.length > 1_000) {
      errors.push(`${path} exceeds the maximum string length.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 100) {
      errors.push(`${path} exceeds the maximum array length.`);
      return;
    }
    value.forEach((entry, index) =>
      validateBoundedStructure(entry, `${path}[${index}]`, errors, depth + 1),
    );
    return;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > 100) {
      errors.push(`${path} exceeds the maximum object size.`);
      return;
    }
    entries.forEach(([key, entry]) =>
      validateBoundedStructure(entry, `${path}.${key}`, errors, depth + 1),
    );
  }
}

export function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

export function isFiniteNumber(
  value: unknown,
  minimum = -10_000,
  maximum = 10_000,
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

export function isBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  return (
    Number.isInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  );
}

export function isSlotIndex(value: unknown) {
  return isBoundedInteger(value, 0, 5);
}

export function isStringArray(
  value: unknown,
  maximum = 100,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((entry) => typeof entry === "string")
  );
}

export function isUniqueEnumArray(
  value: unknown,
  allowed: Set<string>,
  maximum: number,
  minimum = 0,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.every((entry) => typeof entry === "string" && allowed.has(entry)) &&
    new Set(value).size === value.length
  );
}

export function isPokemonTypeArray(
  value: unknown,
  maximum = 18,
  minimum = 0,
): value is string[] {
  return isUniqueEnumArray(value, pokemonTypeSet, maximum, minimum);
}

export function isStatBlock(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, statIds) &&
    statIds.every((stat) => isFiniteNumber(value[stat]))
  );
}

export function hasValidMaxedStats(value: unknown, evs: unknown) {
  return (
    isUniqueEnumArray(value, statIdSet, statIds.length) &&
    isRecord(evs) &&
    statIds.every(
      (stat) => value.includes(stat) === (Number(evs[stat]) === 32),
    )
  );
}

export function isBoundedIntegerStatBlock(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  return (
    isStatBlock(value) &&
    isRecord(value) &&
    Object.values(value).every((entry) =>
      isBoundedInteger(entry, minimum, maximum),
    )
  );
}

export function getStatBlockTotal(value: unknown) {
  return isRecord(value)
    ? Object.values(value).reduce<number>(
        (total, entry) => total + Number(entry),
        0,
      )
    : Number.NaN;
}

export function hasUniqueSlots(entries: unknown[]) {
  const slots = entries.map((entry) =>
    isRecord(entry) ? Number(entry.slotIndex) : Number.NaN,
  );
  return new Set(slots).size === slots.length;
}
