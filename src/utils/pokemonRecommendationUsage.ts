import { loadPopularUsageSet, type BattleUsageSet } from "../api/battleUsage";
import { BATTLE_USAGE_OPTION_LIMITS } from "../api/battleUsageData";
import type { ShowdownDataSnapshot } from "../api/showdownData";
import { normalizeShowdownId } from "../api/showdownIds";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { getNatureById, normalizeStatPointSpread } from "../data/natures";
import type { ItemIndexEntry, StatBlock } from "../types";
import { compactCopilotMechanicEffect } from "./copilotMechanics";
import type { CopilotRecommendationCandidateSnapshot, PokemonRecommendationCommonSet, PokemonRecommendationOption } from "./pokemonRecommendations";
import { waitForTask } from "./workerTask";

type NamedUsageOption = { id: string; displayName: string; usagePercent: number | null };

export type PokemonRecommendationUsageOptions = {
  sourcePokemonId: string;
  sourceMonth: string;
  sourceDate: string | null;
  season: string | null;
  alternativeMoves: Array<PokemonRecommendationCommonSet["moves"][number] & { usagePercent: number | null }>;
  items: Array<NamedUsageOption & { effect?: string }>;
  natures: NamedUsageOption[];
  statPointSpreads: Array<{ evs: StatBlock; usagePercent: number | null }>;
};

export function createRecommendationUsageOptions(
  candidate: CopilotRecommendationCandidateSnapshot,
  option: PokemonRecommendationOption,
  usage: BattleUsageSet,
  showdown: ShowdownDataSnapshot | null,
  itemIndex: ItemIndexEntry[],
): PokemonRecommendationUsageOptions {
  const commonMoves = new Set(candidate.commonSet?.moves.map((move) => normalizeShowdownId(move.id)));
  const legalMoves = new Set(option.legalMoveIds.map(normalizeShowdownId));
  const percentages = new Map(usage.moveOptions?.map((move) => [normalizeShowdownId(move.id), move.usagePercent]));
  const alternativeMoves = [...new Set(usage.moveIds.map(normalizeShowdownId))]
    .slice(0, BATTLE_USAGE_OPTION_LIMITS.moves)
    .flatMap((id) => {
      const move = showdown?.movesById[id];
      if (!move || commonMoves.has(id) || !legalMoves.has(id)) return [];
      const effect = compactCopilotMechanicEffect(move.detailedDescription ?? move.description);
      return [{
        id: move.id, displayName: move.name, type: move.type,
        category: move.category ?? "Status", power: move.power,
        usagePercent: percentages.get(id) ?? null,
        ...(effect ? { effect } : {}),
      }];
    }).slice(0, 8);
  const itemOptions = usage.itemOptions?.length ? usage.itemOptions :
    (usage.itemNames ?? (usage.itemName ? [usage.itemName] : [])).map((id) => ({ id, usagePercent: null }));
  const items = candidate.requiresMegaStone ? [] : itemOptions.flatMap((entry) => {
    const item = itemIndex.find((item) => normalizeShowdownId(item.showdownId) === normalizeShowdownId(entry.id) ||
      normalizeShowdownId(item.name) === normalizeShowdownId(entry.id));
    if (!item || item.isMegaStone) return [];
    const effect = compactCopilotMechanicEffect(item.effect);
    return [{ id: item.showdownId, displayName: item.name, usagePercent: entry.usagePercent,
      ...(effect ? { effect } : {}) }];
  }).slice(0, BATTLE_USAGE_OPTION_LIMITS.items);
  const natures = (usage.natureOptions?.length ? usage.natureOptions :
    usage.nature ? [{ id: normalizeShowdownId(usage.nature), usagePercent: null }] : [])
    .slice(0, BATTLE_USAGE_OPTION_LIMITS.natures)
    .map((entry) => ({ ...entry, displayName: getNatureById(entry.id).label }));
  const statPointSpreads = (usage.statPointSpreads?.length ? usage.statPointSpreads :
    usage.evs ? [{ evs: normalizeStatPointSpread(usage.evs), usagePercent: null }] : [])
    .slice(0, BATTLE_USAGE_OPTION_LIMITS.spreads)
    .map((entry) => ({ ...entry, evs: { ...entry.evs } }));
  return {
    sourcePokemonId: usage.pokemonId, sourceMonth: usage.sourceMonth,
    sourceDate: usage.sourceDate ?? null, season: usage.season ?? null,
    alternativeMoves, items, natures, statPointSpreads,
  };
}

export async function enrichRecommendationUsage(
  candidates: CopilotRecommendationCandidateSnapshot[],
  sources: Array<{ option: PokemonRecommendationOption; usage: BattleUsageSet | null }>,
  battleFormat: BattleFormat,
  showdown: ShowdownDataSnapshot | null,
  itemIndex: ItemIndexEntry[],
  signal?: AbortSignal,
) {
  if (signal?.aborted) return [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 8_000);
  const uniqueSources = [...new Map(sources.flatMap(({ usage }) => usage ? [[usage.pokemonId, usage] as const] : [])).values()];
  const details = new Map<string, BattleUsageSet>();
  let next = 0;
  try {
    // Bound fan-out and share the existing detail cache across Mega/base candidates.
    await Promise.all(Array.from({ length: Math.min(4, uniqueSources.length) }, async () => {
      while (next < uniqueSources.length && !controller.signal.aborted) {
        const base = uniqueSources[next++];
        const detail = await waitForTask(loadPopularUsageSet(base.pokemonId, battleFormat).catch(() => null), controller.signal);
        if (detail && !controller.signal.aborted && detail.pokemonId === base.pokemonId &&
          detail.sourceMonth === base.sourceMonth && detail.sourceDate === base.sourceDate && detail.season === base.season) {
          details.set(base.pokemonId, detail);
        }
      }
    }));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
  if (signal?.aborted) return [];
  return candidates.map((candidate, index) => {
    const { option, usage } = sources[index];
    if (!usage) return candidate;
    return { ...candidate, usageOptions: createRecommendationUsageOptions(
      candidate, option, details.get(usage.pokemonId) ?? usage, showdown, itemIndex,
    ) };
  });
}
