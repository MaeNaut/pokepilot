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
  CopilotExecutionInfo,
  CopilotQualityWarningCode,
  CopilotSetOptimizationCandidateSnapshot,
} from "./copilotContracts";
import type { CopilotRecommendationCandidateSnapshot } from "./pokemonRecommendations";
import { isCopilotQualityWarningCode, normalizeCopilotExecutionInfo } from "./copilotContracts";
import { isRecord } from "./typeGuards";
import { BATTLE_USAGE_PROVIDER, type BattleUsageSource } from "../api/battleUsageData";
import { normalizeCopilotRequestFingerprint } from "./copilotRequestFingerprint";
import { hasValidRecommendationCandidateShape } from "./copilotRequestCandidateValidation";
import { validateCopilotModelOutput } from "./copilotModelValidation";
import { isValidCopilotOptimizationCandidateSnapshot } from "./copilotRequestContract";
import {
  clearConsumedPendingCollections, clearPendingCollection, readPendingCollection,
  readPendingCollections, writePendingCollection, pendingCopilotHistoryStorageKey, type PendingAccountCollection,
  type StoredPendingAccountCollection,
} from "./accountPendingStorage";

const COPILOT_HISTORY_STORAGE_KEY = "pokepilot:analysis-history:v1";
const COPILOT_HISTORY_ACCOUNT_STORAGE_KEY = "pokepilot:analysis-history.account.v1";
const COPILOT_HISTORY_SCHEMA_VERSION = 1;
const MAX_COPILOT_HISTORY_ENTRIES = 60;
const MAX_COPILOT_HISTORY_PER_TEAM = 12;

export type CopilotHistoryEntry = {
  id: string;
  teamKey: string;
  locale: Locale;
  scope: CopilotAnalysisScope;
  battleFormat: BattleFormat;
  reasoningEffort?: "low" | "medium";
  modelId?: "gpt-6-luna" | "gpt-6-sol";
  requestFingerprint: string;
  createdAt: string;
  response: CopilotAnalysisResponse;
  execution?: CopilotExecutionInfo;
  usageSource?: BattleUsageSource;
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

function joinLegacyParagraph(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join(" ")
    : "";
}

function migrateLegacyModelOutput(value: unknown): unknown {
  if (!isRecord(value) || value.version !== 1) {
    return value;
  }

  const paragraphs = [
    typeof value.summary === "string" ? value.summary.trim() : "",
    joinLegacyParagraph(value.strengths),
    joinLegacyParagraph(value.weaknesses),
  ].filter(Boolean);

  return {
    version: 2,
    scope: value.scope,
    title: value.title,
    paragraphs,
    recommendations: value.recommendations,
  };
}

function normalizeResponse(value: unknown, legacyCandidates?: unknown): CopilotAnalysisResponse | null {
  if (!isRecord(value) || (value.source !== "hosted" && value.source !== "local")) {
    return null;
  }

  const {
    source,
    optimizationCandidates,
    recommendationCandidates,
    qualityWarnings,
    ...modelOutput
  } = value;
  const validation = validateCopilotModelOutput(
    migrateLegacyModelOutput(modelOutput),
  );

  const normalizedOptimizationCandidates = Array.isArray(optimizationCandidates)
    ? optimizationCandidates.filter(
        (candidate): candidate is CopilotSetOptimizationCandidateSnapshot =>
          isValidCopilotOptimizationCandidateSnapshot(candidate),
      )
    : undefined;
  const normalizedQualityWarnings: CopilotQualityWarningCode[] =
    Array.isArray(qualityWarnings)
      ? [...new Set(qualityWarnings.filter(isCopilotQualityWarningCode))]
      : [];
  const candidates = recommendationCandidates ?? legacyCandidates;
  const normalizedRecommendationCandidates = Array.isArray(candidates) && validation.success
    ? candidates.slice(0, 30).filter(
        (candidate): candidate is CopilotRecommendationCandidateSnapshot =>
          hasValidRecommendationCandidateShape(candidate) &&
          validation.data.recommendations.some((entry) => entry.id === candidate.pokemonId),
      )
    : [];

  if (
    validation.success &&
    validation.data.scope === "optimization" &&
    (!normalizedOptimizationCandidates ||
      normalizedOptimizationCandidates.length === 0)
  ) {
    return null;
  }

  return validation.success
    ? {
        ...validation.data,
        source,
        ...(normalizedOptimizationCandidates
          ? { optimizationCandidates: normalizedOptimizationCandidates }
          : {}),
        ...(normalizedRecommendationCandidates.length > 0
          ? { recommendationCandidates: normalizedRecommendationCandidates }
          : {}),
        ...(normalizedQualityWarnings.length > 0
          ? { qualityWarnings: normalizedQualityWarnings }
          : {}),
      }
    : null;
}

export function normalizeCopilotHistoryEntry(value: unknown): CopilotHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  let legacyCandidates: unknown;
  if (typeof value.requestFingerprint === "string") {
    try {
      const legacyRequest: unknown = JSON.parse(value.requestFingerprint);
      if (isRecord(legacyRequest)) legacyCandidates = legacyRequest.recommendationCandidates;
    } catch {
      // Older opaque fingerprints do not contain candidate snapshots.
    }
  }
  const response = normalizeResponse(value.response, legacyCandidates);
  const fallbackReason = isHostedAnalysisFailureReason(value.fallbackReason)
    ? value.fallbackReason
    : undefined;
  const execution = normalizeCopilotExecutionInfo(value.execution);
  const source = value.usageSource;
  const usageSource: BattleUsageSource | undefined = isRecord(source) &&
    source.provider === BATTLE_USAGE_PROVIDER && typeof source.season === "string" && /^M\d+$/.test(source.season) &&
    typeof source.sourceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.sourceDate) && Number.isFinite(Date.parse(source.sourceDate)) &&
    typeof source.generatedAt === "string" && Number.isFinite(Date.parse(source.generatedAt))
    ? { provider: BATTLE_USAGE_PROVIDER, season: source.season, sourceDate: source.sourceDate,
        generatedAt: source.generatedAt, ...(source.stale === true ? { stale: true } : {}) } : undefined;
  const hasValidMetadata =
    typeof value.id === "string" &&
    typeof value.teamKey === "string" &&
    value.teamKey.length > 0 &&
    (value.locale === "en" || value.locale === "ko") &&
    (value.scope === "team" ||
      value.scope === "pokemon" ||
      value.scope === "recommendation" ||
      value.scope === "optimization" ||
      value.scope === "matchup") &&
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
    ...(value.reasoningEffort === "low" || value.reasoningEffort === "medium"
      ? { reasoningEffort: value.reasoningEffort }
      : {}),
    ...(value.modelId === "gpt-6-sol" ? { modelId: value.modelId } : {}),
    requestFingerprint: normalizeCopilotRequestFingerprint(value.requestFingerprint as string),
    createdAt: value.createdAt as string,
    response,
    ...(execution ? { execution } : {}),
    ...(usageSource ? { usageSource } : {}),
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

export function normalizeCopilotHistoryEntries(value: unknown) {
  if (!Array.isArray(value)) return [];

  return limitHistory(
    value
      .map(normalizeCopilotHistoryEntry)
      .filter((entry): entry is CopilotHistoryEntry => Boolean(entry))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  );
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

    return normalizeCopilotHistoryEntries(payload.entries);
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

export function getPendingCopilotHistory() {
  return readPendingCollection(pendingCopilotHistoryStorageKey, normalizeCopilotHistoryEntries);
}

export function getAllPendingCopilotHistory() {
  return readPendingCollections(pendingCopilotHistoryStorageKey, normalizeCopilotHistoryEntries);
}

export function storePendingCopilotHistory(pending: PendingAccountCollection<CopilotHistoryEntry>) {
  writePendingCollection(pendingCopilotHistoryStorageKey, pending);
}

export function clearPendingCopilotHistory(accountId?: string) {
  clearPendingCollection(pendingCopilotHistoryStorageKey, accountId);
}

export function clearConsumedPendingCopilotHistory(records: StoredPendingAccountCollection<CopilotHistoryEntry>[]) {
  clearConsumedPendingCollections(records);
}

export function clearStoredCopilotHistory() {
  const ownerId = getStoredCopilotHistoryAccountId();
  if (ownerId) clearPendingCopilotHistory(ownerId);
  localStorage.removeItem(COPILOT_HISTORY_STORAGE_KEY);
  localStorage.removeItem(COPILOT_HISTORY_ACCOUNT_STORAGE_KEY);
}

export function getStoredCopilotHistoryAccountId() {
  return localStorage.getItem(COPILOT_HISTORY_ACCOUNT_STORAGE_KEY);
}

export function storeCopilotHistoryAccountId(accountId: string) {
  localStorage.setItem(COPILOT_HISTORY_ACCOUNT_STORAGE_KEY, accountId);
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
  reasoningEffort: "low" | "medium" = "low",
  modelId: "gpt-6-luna" | "gpt-6-sol" = "gpt-6-luna",
) {
  return entries.find(
    (entry) =>
      entry.teamKey === teamKey &&
      entry.scope === scope &&
      entry.locale === locale &&
      entry.requestFingerprint === requestFingerprint &&
      (entry.reasoningEffort ?? "low") === reasoningEffort &&
      (entry.modelId ?? "gpt-6-luna") === modelId,
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
