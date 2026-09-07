import { normalizeShowdownId } from "../api/showdownIds";
import type { CalculatorField } from "./damageCalculator";

export type EnvironmentSource = { identity: string; ability: string; speed: number | null };
export type EnvironmentSources = { player: EnvironmentSource; opponent: EnvironmentSource };

const weatherAbilities: Record<string, CalculatorField["weather"]> = {
  sandstream: "sand", drought: "sun", drizzle: "rain", snowwarning: "snow",
  orichalcumpulse: "sun",
};
const terrainAbilities: Record<string, CalculatorField["terrain"]> = {
  electricsurge: "electric", grassysurge: "grassy", psychicsurge: "psychic",
  mistysurge: "misty", hadronengine: "electric",
};

export function environmentSourceKey(source: EnvironmentSource) {
  return JSON.stringify([source.identity, normalizeShowdownId(source.ability)]);
}

export function resolveAutomaticEnvironment(sources: EnvironmentSources, previous?: EnvironmentSources) {
  const entries = [sources.player, sources.opponent];
  const changed = entries.map((source, i) => !previous || environmentSourceKey(source)
    !== environmentSourceKey(i === 0 ? previous.player : previous.opponent));
  function resolve<T extends string>(abilities: Record<string, T>): T | "none" {
    const setters = entries.map((source, index) => ({ source, index, value: source.identity
      ? abilities[normalizeShowdownId(source.ability)] : undefined })).filter(entry => entry.value);
    if (!setters.length) return "none";
    // A newly selected setter acts last. Simultaneous setters resolve fast to slow.
    setters.sort((a, b) => Number(changed[a.index]) - Number(changed[b.index])
      || (b.source.speed ?? 0) - (a.source.speed ?? 0));
    return setters[setters.length - 1].value!;
  }
  return { weather: resolve(weatherAbilities), terrain: resolve(terrainAbilities) };
}
