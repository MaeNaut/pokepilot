export const battleFormats = ["singles", "doubles"] as const;

export type BattleFormat = (typeof battleFormats)[number];

export const DEFAULT_BATTLE_FORMAT: BattleFormat = "doubles";
export const BATTLE_FORMAT_STORAGE_KEY = "pokepilot:battle-format";

export function isBattleFormat(value: string | null): value is BattleFormat {
  return value === "singles" || value === "doubles";
}

export function resolveBattleFormat(
  value: string | null | undefined,
): BattleFormat {
  const normalizedValue = value ?? null;

  return isBattleFormat(normalizedValue)
    ? normalizedValue
    : DEFAULT_BATTLE_FORMAT;
}
