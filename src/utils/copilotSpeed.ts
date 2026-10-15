import { pokeRound } from "@smogon/calc/dist/mechanics/util";
import { normalizeShowdownId } from "../api/showdownIds";
import type { CopilotMechanicsSnapshot } from "./copilotMechanics";

type SpeedSet = { stats: { speed: number } | null; item: string | null };

export function getCopilotItemSpeedMultiplier(set: SpeedSet, mechanics: CopilotMechanicsSnapshot) {
  const itemId = normalizeShowdownId(set.item ?? "");
  const effect = mechanics.items.find(item => normalizeShowdownId(item.id) === itemId)
    ?.effect?.normalize("NFKC").replace(/\u00d7/g, "x").toLowerCase();
  const match = effect?.match(/^holder(?:'s|\u2019s) speed is (\d+(?:\.\d+)?)x\b/);
  if (match) {
    const multiplier = Number(match[1]);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }
  return /^holder(?:'s|\u2019s) speed is halved\b/.test(effect ?? "") ? 0.5 : 1;
}

/** Stat-stage-neutral, active-item-only comparison, not actual move order. */
export function getCopilotComparableSpeed(set: SpeedSet, mechanics: CopilotMechanicsSnapshot) {
  const stat = set.stats?.speed;
  if (stat === undefined || !Number.isFinite(stat) || stat < 0) return null;
  return Math.min(10000, Math.max(0, pokeRound(stat * getCopilotItemSpeedMultiplier(set, mechanics))));
}
