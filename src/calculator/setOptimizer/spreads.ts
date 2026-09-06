import type { CalculatorBuildValues } from "../calculatorEditorTypes";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  natures,
  statKeys,
} from "../../data/natures";
import type { StatBlock, StatKey } from "../../types";
import { MAX_BREAKPOINTS_PER_MOVE_NATURE } from "./constants";
import type {
  CalculatorAnalysisContext,
  CandidateSeed,
  SetOptimizationFocus,
} from "./types";

export function totalStatPoints(evs: StatBlock) {
  return statKeys.reduce((total, stat) => total + evs[stat], 0);
}

function clampStatPoints(value: number) {
  return Math.max(
    0,
    Math.min(CHAMPIONS_MAX_EV_PER_STAT, Math.round(value)),
  );
}

export function getChangedStatPoints(
  current: StatBlock,
  candidate: StatBlock,
) {
  return statKeys.reduce(
    (total, stat) => total + Math.abs(candidate[stat] - current[stat]),
    0,
  );
}

export function getStatPointChanges(
  current: StatBlock,
  candidate: StatBlock,
) {
  return statKeys.reduce<StatBlock>((changes, stat) => {
    changes[stat] = candidate[stat] - current[stat];
    return changes;
  }, {} as StatBlock);
}

export function getOppositeOffenseStat(stat: StatKey): StatKey | null {
  if (stat === "attack") return "specialAttack";
  if (stat === "specialAttack") return "attack";
  return null;
}

export function rebalanceSpread(
  current: StatBlock,
  targets: Partial<StatBlock>,
): StatBlock {
  const targetStats = new Set(Object.keys(targets) as StatKey[]);
  const next = statKeys.reduce<StatBlock>((spread, stat) => {
    spread[stat] = clampStatPoints(targets[stat] ?? current[stat]);
    return spread;
  }, {} as StatBlock);
  const targetedOffense = [...targetStats].find(
    (stat) => stat === "attack" || stat === "specialAttack",
  );
  const oppositeOffense = targetedOffense
    ? getOppositeOffenseStat(targetedOffense)
    : null;
  const adjustableStats = statKeys.filter((stat) => !targetStats.has(stat));
  const trimOrder = [...adjustableStats].sort((left, right) => {
    if (left === oppositeOffense) return -1;
    if (right === oppositeOffense) return 1;
    if (left === "hp") return 1;
    if (right === "hp") return -1;
    return current[left] - current[right];
  });

  let overflow = Math.max(0, totalStatPoints(next) - CHAMPIONS_MAX_EV_TOTAL);
  for (const stat of trimOrder) {
    if (overflow === 0) break;
    const removed = Math.min(next[stat], overflow);
    next[stat] -= removed;
    overflow -= removed;
  }

  let remaining = CHAMPIONS_MAX_EV_TOTAL - totalStatPoints(next);
  const fillOrder = [...adjustableStats].sort((left, right) => {
    if (left === "hp") return -1;
    if (right === "hp") return 1;
    if (left === oppositeOffense) return 1;
    if (right === oppositeOffense) return -1;
    return current[right] - current[left];
  });
  for (const stat of fillOrder) {
    if (remaining === 0) break;
    const added = Math.min(
      CHAMPIONS_MAX_EV_PER_STAT - next[stat],
      remaining,
    );
    next[stat] += added;
    remaining -= added;
  }

  return next;
}

export function getNatureCandidates(natureId: string, targetStat: StatKey) {
  const ids = new Set([natureId]);

  if (targetStat !== "hp") {
    natures
      .filter(
        (nature) =>
          nature.up === targetStat &&
          nature.down !== targetStat &&
          !(
            (targetStat === "defense" ||
              targetStat === "specialDefense") &&
            (nature.down === "defense" ||
              nature.down === "specialDefense")
          ),
      )
      .forEach((nature) => ids.add(nature.id));
  }

  return [...ids];
}

export function getOffenseNatureCandidates(
  context: CalculatorAnalysisContext,
  targetStat: Exclude<StatKey, "hp">,
) {
  const ids = new Set([context.player.build.natureId]);
  const oppositeOffense = getOppositeOffenseStat(targetStat);
  const canLowerSpeed = context.player.build.evs.speed === 0;

  natures
    .filter(
      (nature) =>
        nature.up !== nature.down &&
        nature.up !== oppositeOffense &&
        (nature.down === oppositeOffense ||
          (canLowerSpeed && nature.down === "speed")),
    )
    .forEach((nature) => ids.add(nature.id));

  return [...ids];
}

export function getSpeedNatureCandidates(
  currentNatureId: string,
  mode: "fast" | "slow",
) {
  const ids = new Set([currentNatureId]);

  natures
    .filter((nature) =>
      mode === "fast"
        ? nature.up === "speed" &&
          (nature.down === "attack" || nature.down === "specialAttack")
        : nature.down === "speed" && nature.up !== "speed",
    )
    .forEach((nature) => ids.add(nature.id));

  return [...ids];
}

export function createBuild(
  context: CalculatorAnalysisContext,
  natureId: string,
  evs: StatBlock,
): CalculatorBuildValues {
  return { ...context.player.build, natureId, evs };
}

export function createSeed(
  natureId: string,
  evs: StatBlock,
  focus: SetOptimizationFocus,
  targets: Partial<StatBlock>,
  axis: string,
): CandidateSeed {
  return {
    natureId,
    evs,
    focuses: [focus],
    targets,
    axes: [axis],
  };
}

export function getTargetPointTotal(targets: Partial<StatBlock>) {
  return statKeys.reduce((total, stat) => total + (targets[stat] ?? 0), 0);
}

export function getOutcomeBreakpointSubset<T>(
  entries: T[],
  getTier: (entry: T) => string,
) {
  if (entries.length <= MAX_BREAKPOINTS_PER_MOVE_NATURE) return entries;

  const selected = new Set<T>();
  const firstByTier = new Map<string, T>();
  entries.forEach((entry) => {
    const tier = getTier(entry);
    if (!firstByTier.has(tier)) firstByTier.set(tier, entry);
  });
  selected.add(entries[0]);
  selected.add(entries[entries.length - 1]);

  const available = [...firstByTier.values()].filter(
    (entry) => !selected.has(entry),
  );
  const spaces = MAX_BREAKPOINTS_PER_MOVE_NATURE - selected.size;
  for (let index = 0; index < spaces && available.length > 0; index += 1) {
    const position = Math.floor(((index + 1) * available.length) / (spaces + 1));
    selected.add(available[Math.min(position, available.length - 1)]);
  }

  return entries.filter((entry) => selected.has(entry));
}

export function mergeSeeds(seeds: CandidateSeed[]) {
  const merged = new Map<string, CandidateSeed>();

  for (const seed of seeds) {
    const key = `${seed.natureId}:${statKeys
      .map((stat) => seed.evs[stat])
      .join("-")}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, seed);
      continue;
    }

    existing.focuses = [...new Set([...existing.focuses, ...seed.focuses])];
    existing.axes = [...new Set([...existing.axes, ...seed.axes])];
    for (const stat of statKeys) {
      const target = seed.targets[stat];
      if (target !== undefined) {
        existing.targets[stat] = Math.max(
          existing.targets[stat] ?? 0,
          target,
        );
      }
    }
  }

  return [...merged.values()];
}

export function combineSeeds(
  context: CalculatorAnalysisContext,
  left: CandidateSeed,
  right: CandidateSeed,
) {
  if (left.axes.some((axis) => right.axes.includes(axis))) return [];

  const targets = { ...left.targets };
  for (const stat of statKeys) {
    const rightTarget = right.targets[stat];
    if (rightTarget === undefined) continue;
    targets[stat] = Math.max(targets[stat] ?? 0, rightTarget);
  }
  if (getTargetPointTotal(targets) > CHAMPIONS_MAX_EV_TOTAL) return [];

  return [...new Set([left.natureId, right.natureId])].flatMap(
    (natureId): CandidateSeed[] => {
      const evs = rebalanceSpread(context.player.build.evs, targets);
      if (totalStatPoints(evs) !== CHAMPIONS_MAX_EV_TOTAL) return [];

      return [
        {
          natureId,
          evs,
          focuses: [...new Set([...left.focuses, ...right.focuses])],
          targets,
          axes: [...new Set([...left.axes, ...right.axes])],
        },
      ];
    },
  );
}

export function createCombinedSeeds(
  context: CalculatorAnalysisContext,
  leftSeeds: CandidateSeed[],
  rightSeeds: CandidateSeed[],
  shouldCombine: (left: CandidateSeed, right: CandidateSeed) => boolean =
    () => true,
) {
  const combined: CandidateSeed[] = [];
  for (const left of leftSeeds) {
    for (const right of rightSeeds) {
      if (left === right || !shouldCombine(left, right)) continue;
      combined.push(...combineSeeds(context, left, right));
    }
  }
  return mergeSeeds(combined);
}
