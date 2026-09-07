import {
  calculateChampionsStats,
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  getNatureById,
} from "../../data/natures";
import type { StatBlock } from "../../types";
import { rebalanceSpread, totalStatPoints } from "./spreads";
import type { CalculatorAnalysisContext, CandidateSeed } from "./types";

export function getRoleCost(context: CalculatorAnalysisContext, seed: CandidateSeed) {
  const { member, build } = context.player;
  if (!member?.baseStats) return 0;
  const original = calculateChampionsStats(member.baseStats, build.evs, getNatureById(build.natureId));
  const proposed = calculateChampionsStats(member.baseStats, seed.evs, getNatureById(seed.natureId));
  let cost = 0;
  for (const stat of ["attack", "specialAttack", "speed"] as const) {
    if (build.evs[stat] === 0 || proposed[stat] >= original[stat]) continue;
    const lostPerformance = (original[stat] - proposed[stat]) / original[stat];
    const lostInvestment = Math.max(0, build.evs[stat] - seed.evs[stat]) / CHAMPIONS_MAX_EV_PER_STAT;
    // Small adjustments have a small cost; dismantling an invested axis is expensive.
    cost += lostPerformance * (stat === "speed" ? 300 : 200)
      + lostInvestment ** 2 * (stat === "speed" ? 100 : 80);
  }
  const nature = getNatureById(build.natureId);
  if (build.evs.speed === 0 && nature.down === "speed" && nature.up !== "speed") {
    cost += Math.max(0, proposed.speed / original.speed - 1) * 300;
  }
  return cost;
}

export function createRolePreserver(context: CalculatorAnalysisContext) {
  const { build, member } = context.player;
  const baseStats = member?.baseStats;
  const currentNature = getNatureById(build.natureId);
  const currentStats = baseStats
    ? calculateChampionsStats(baseStats, build.evs, currentNature)
    : null;
  const protectedStats = (["attack", "specialAttack", "speed"] as const)
    .filter((stat) => build.evs[stat] > 0);
  const preserveSlowSpeed = build.evs.speed === 0
    && currentNature.down === "speed" && currentNature.up !== "speed";
  const floorsByNature = new Map<string, Partial<StatBlock> | null>();

  function getFloors(natureId: string) {
    if (floorsByNature.has(natureId)) return floorsByNature.get(natureId)!;
    if (!baseStats || !currentStats) return null;
    const nature = getNatureById(natureId);
    const floors: Partial<StatBlock> = {};
    for (const stat of protectedStats) {
      let points = 0;
      while (points <= CHAMPIONS_MAX_EV_PER_STAT
        && calculateChampionsStats(baseStats, { ...build.evs, [stat]: points }, nature)[stat] < currentStats[stat]) {
        points += 1;
      }
      if (points > CHAMPIONS_MAX_EV_PER_STAT) {
        floorsByNature.set(natureId, null);
        return null;
      }
      floors[stat] = points;
    }
    floorsByNature.set(natureId, floors);
    return floors;
  }

  return (seed: CandidateSeed): CandidateSeed | null => {
    const floors = getFloors(seed.natureId);
    if (!floors || !baseStats || !currentStats) return null;
    const targets: Partial<StatBlock> = {};
    for (const stat of protectedStats) {
      targets[stat] = Math.max(seed.evs[stat], floors[stat]!);
    }
    if (preserveSlowSpeed) targets.speed = 0;
    // Rebuild the remaining budget around the existing role, not the one foe's KO tiers.
    const evs = rebalanceSpread(seed.evs, targets);
    if (totalStatPoints(evs) !== CHAMPIONS_MAX_EV_TOTAL) return null;
    if (preserveSlowSpeed
      && calculateChampionsStats(baseStats, evs, getNatureById(seed.natureId)).speed > currentStats.speed) {
      return null;
    }
    const adjustedTargets = { ...seed.targets, ...targets };
    for (const stat of Object.keys(adjustedTargets) as Array<keyof StatBlock>) {
      adjustedTargets[stat] = evs[stat];
    }
    return { ...seed, evs, targets: adjustedTargets };
  };
}
