import type { BattleFormat } from "../battleFormat/battleFormat";
import {
  isHostedAnalysisFailureReason,
  type HostedAnalysisFailureReason,
} from "../api/copilotFailure";
import type { Locale } from "../i18n/gameTranslations";
import type {
  CopilotAnalysisRequest,
  CopilotAnalysisResponse,
  CopilotAnalysisScope,
} from "./copilotAnalysis";
import { isRecord } from "./typeGuards";
import { validateCopilotModelOutput } from "./copilotModelContract";

const COPILOT_HISTORY_STORAGE_KEY = "pokepilot:analysis-history:v1";
const COPILOT_HISTORY_SCHEMA_VERSION = 1;
const MAX_COPILOT_HISTORY_ENTRIES = 60;
const MAX_COPILOT_HISTORY_PER_TEAM = 12;

export type CopilotHistoryEntry = {
  id: string;
  teamKey: string;
  locale: Locale;
  scope: CopilotAnalysisScope;
  battleFormat: BattleFormat;
  requestFingerprint: string;
  createdAt: string;
  response: CopilotAnalysisResponse;
  usedFallback: boolean;
  fallbackReason?: HostedAnalysisFailureReason;
};

type CopilotHistoryPayload = {
  version: typeof COPILOT_HISTORY_SCHEMA_VERSION;
  entries: CopilotHistoryEntry[];
};

type CreateCopilotHistoryEntryInput = Omit<
  CopilotHistoryEntry,
  "id" | "createdAt"
> & {
  id?: string;
  createdAt?: string;
};

function normalizeResponse(value: unknown): CopilotAnalysisResponse | null {
  if (
    !isRecord(value) ||
    (value.source !== "hosted" &&
      value.source !== "local" &&
      value.source !== "device")
  ) {
    return null;
  }

  const { source, ...modelOutput } = value;
  const validation = validateCopilotModelOutput(modelOutput);

  return validation.success ? { ...validation.data, source } : null;
}

function normalizeHistoryEntry(value: unknown): CopilotHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const response = normalizeResponse(value.response);
  const fallbackReason = isHostedAnalysisFailureReason(value.fallbackReason)
    ? value.fallbackReason
    : undefined;
  const hasValidMetadata =
    typeof value.id === "string" &&
    typeof value.teamKey === "string" &&
    value.teamKey.length > 0 &&
    (value.locale === "en" || value.locale === "ko") &&
    (value.scope === "team" ||
      value.scope === "pokemon" ||
      value.scope === "recommendation") &&
    (value.battleFormat === "singles" || value.battleFormat === "doubles") &&
    typeof value.requestFingerprint === "string" &&
    value.requestFingerprint.length > 0 &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.usedFallback === "boolean";

  if (!hasValidMetadata || !response) {
    return null;
  }

  return {
    id: value.id as string,
    teamKey: value.teamKey as string,
    locale: value.locale as Locale,
    scope: value.scope as CopilotAnalysisScope,
    battleFormat: value.battleFormat as BattleFormat,
    requestFingerprint: value.requestFingerprint as string,
    createdAt: value.createdAt as string,
    response,
    usedFallback: value.usedFallback as boolean,
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

function limitHistory(entries: CopilotHistoryEntry[]) {
  const teamCounts = new Map<string, number>();

  return entries
    .filter((entry) => {
      const currentCount = teamCounts.get(entry.teamKey) ?? 0;

      if (currentCount >= MAX_COPILOT_HISTORY_PER_TEAM) {
        return false;
      }

      teamCounts.set(entry.teamKey, currentCount + 1);
      return true;
    })
    .slice(0, MAX_COPILOT_HISTORY_ENTRIES);
}

export function getStoredCopilotHistory(): CopilotHistoryEntry[] {
  try {
    const rawPayload = localStorage.getItem(COPILOT_HISTORY_STORAGE_KEY);

    if (!rawPayload) {
      return [];
    }

    const payload = JSON.parse(rawPayload) as unknown;

    if (
      !isRecord(payload) ||
      payload.version !== COPILOT_HISTORY_SCHEMA_VERSION ||
      !Array.isArray(payload.entries)
    ) {
      return [];
    }

    return limitHistory(
      payload.entries
        .map(normalizeHistoryEntry)
        .filter((entry): entry is CopilotHistoryEntry => Boolean(entry))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  } catch {
    return [];
  }
}

export function storeCopilotHistory(entries: CopilotHistoryEntry[]) {
  try {
    const payload: CopilotHistoryPayload = {
      version: COPILOT_HISTORY_SCHEMA_VERSION,
      entries: limitHistory(entries),
    };

    localStorage.setItem(COPILOT_HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Analysis remains available in memory when storage is unavailable or full.
  }
}

export function createCopilotHistoryEntry({
  id,
  createdAt,
  ...entry
}: CreateCopilotHistoryEntryInput): CopilotHistoryEntry {
  return {
    ...entry,
    id:
      id ??
      globalThis.crypto?.randomUUID?.() ??
      `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

export function addCopilotHistoryEntry(
  entries: CopilotHistoryEntry[],
  entry: CopilotHistoryEntry,
) {
  return limitHistory([entry, ...entries.filter((candidate) => candidate.id !== entry.id)]);
}

export function clearCopilotHistoryForTeam(
  entries: CopilotHistoryEntry[],
  teamKey: string,
) {
  return entries.filter((entry) => entry.teamKey !== teamKey);
}

export function getCopilotHistoryForTeam(
  entries: CopilotHistoryEntry[],
  teamKey: string,
) {
  return entries.filter((entry) => entry.teamKey === teamKey);
}

export function findMatchingCopilotHistoryEntry(
  entries: CopilotHistoryEntry[],
  teamKey: string,
  scope: CopilotAnalysisScope,
  locale: Locale,
  requestFingerprint: string,
) {
  return entries.find(
    (entry) =>
      entry.teamKey === teamKey &&
      entry.scope === scope &&
      entry.locale === locale &&
      entry.requestFingerprint === requestFingerprint,
  );
}

export function createCopilotHistoryTeamKey(
  savedTeamId: string | null,
  request: CopilotAnalysisRequest,
) {
  if (savedTeamId) {
    return `saved:${savedTeamId}`;
  }

  const roster = [...request.sets]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((set) => `${set.slotIndex}:${set.pokemonId}`)
    .join("|");

  return `draft:${request.battleFormat}:${roster || "empty"}`;
}

export const copilotHistoryLimits = {
  total: MAX_COPILOT_HISTORY_ENTRIES,
  perTeam: MAX_COPILOT_HISTORY_PER_TEAM,
} as const;
