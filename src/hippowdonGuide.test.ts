import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { Generations, toID } from "@smogon/calc";
import { describe, expect, it } from "vitest";
import { calculateChampionsDamage, type CalculatorPokemon, type CalculatorField } from "./calculator/damageCalculator";
import { calculateChampionsStats, getNatureById } from "./data/natures";
import type { StatBlock, TeamMember, PokemonMove, PokemonType } from "./types";

const generation = Generations.get(0);
const zero: StatBlock = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
function pokemon(id: string, nature: string, points: Partial<StatBlock>, moveId: string, item: string, attackBoost = 0): CalculatorPokemon {
  const species = generation.species.get(toID(id))!;
  const data = generation.moves.get(toID(moveId))!;
  const ability = species.abilities?.[0] ?? "";
  const baseStats = { hp: species.baseStats.hp, attack: species.baseStats.atk, defense: species.baseStats.def, specialAttack: species.baseStats.spa, specialDefense: species.baseStats.spd, speed: species.baseStats.spe };
  const evs = { ...zero, ...points };
  const member: TeamMember = { id, name: species.name, showdownId: id, showdownName: species.name, types: species.types.map(type => type.toLowerCase() as PokemonType), roles: [], baseStats, abilities: [ability] };
  const move: PokemonMove = { id: moveId, name: data.name, type: data.type.toLowerCase() as PokemonType, category: data.category, power: data.basePower, accuracy: 100, pp: 10, description: "" };
  return { member, move, item: { id: toID(item), name: item }, ability, natureId: nature, evs, boosts: { attack: attackBoost, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }, currentHp: calculateChampionsStats(baseStats, evs, getNatureById(nature)).hp, status: "healthy" };
}
const field: CalculatorField = { weather: "sand", terrain: "none", room: "none", aura: "none", gameType: "singles", isCritical: false, isSpread: false, isHelpingHand: false, isTailwind: false, isFriendGuard: false, isPlusMinus: false, isWall: false };
const defenders = {
  special: pokemon("hippowdon", "impish", { hp: 32, defense: 2, specialDefense: 32 }, "earthquake", "Leftovers"),
  physical: pokemon("hippowdon", "impish", { hp: 32, defense: 32, specialDefense: 2 }, "earthquake", "Leftovers"),
};
const cases = [
  { id: "salamence", attacker: pokemon("salamencemega", "adamant", { hp: 1, attack: 32, defense: 1, speed: 32 }, "doubleedge", "Salamencite"), ranges: [[114, 135], [94, 112]], ohko: [0, 0] },
  { id: "salamence-boosted", attacker: pokemon("salamencemega", "adamant", { hp: 1, attack: 32, defense: 1, speed: 32 }, "doubleedge", "Salamencite", 1), ranges: [[171, 202], [141, 166]], ohko: [0, 0] },
  { id: "primarina-aria", attacker: pokemon("primarina", "modest", { hp: 32, defense: 20, specialAttack: 14 }, "sparklingaria", "Sitrus Berry"), ranges: [[146, 174], [192, 228]], ohko: [0, 37.5] },
  { id: "primarina-moonblast", attacker: pokemon("primarina", "modest", { hp: 32, defense: 20, specialAttack: 14 }, "moonblast", "Sitrus Berry"), ranges: [[76, 91], [102, 120]], ohko: [0, 0] },
  { id: "primarina-max", attacker: pokemon("primarina", "modest", { hp: 32, defense: 2, specialAttack: 32 }, "sparklingaria", "Sitrus Berry"), ranges: [[162, 192], [212, 252]], ohko: [0, 93.75] },
] as const;

describe.each(["ko", "en"])("Hippowdon practical guide %s", locale => {
  const document = new JSDOM(readFileSync(new URL(`../public/help/hippowdon-${locale}.html`, import.meta.url), "utf8")).window.document;
  it.each(cases)("publishes reproducible damage and knockout chances for $id", entry => {
    for (const [index, build] of (["special", "physical"] as const).entries()) {
      const result = calculateChampionsDamage(entry.attacker, defenders[build], field);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect([result.minDamage, result.maxDamage]).toEqual(entry.ranges[index]);
      expect(result.oneHitKoChance).toBe(entry.ohko[index]);
      const published = document.querySelector(`[data-case="${entry.id}"][data-build="${build}"]`)!;
      expect(published).not.toBeNull();
      expect(Number(published.getAttribute("data-min"))).toBe(result.minDamage);
      expect(Number(published.getAttribute("data-max"))).toBe(result.maxDamage);
      expect(Number(published.getAttribute("data-ohko"))).toBe(result.oneHitKoChance);
      expect(published.textContent).toContain(`${result.minDamage}–${result.maxDamage}`);
      expect(published.textContent).toContain(result.minPercent.toFixed(1));
      expect(published.textContent).toContain(result.maxPercent.toFixed(1));
    }
  });
  it("has working section anchors, canonical and downloads", () => {
    expect(document.querySelector('[rel="canonical"]')?.getAttribute("href")).toBe(`https://pokepilot.app/help/hippowdon-${locale}.html`);
    for (const link of document.querySelectorAll('a[href^="#"]')) expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    for (const build of ["special", "physical"]) expect(document.querySelector(`a[href="/help/hippowdon-${build}.txt"]`)).not.toBeNull();
    expect(document.querySelector("input, .adsbygoogle")).toBeNull();
  });
});

it("matches the two-hit survival example after one Leftovers recovery", () => {
  const hp = 215;
  const recovery = Math.floor(hp / 16);
  expect(recovery).toBe(13);
  expect(hp - 112 + recovery - 112).toBe(4);
  expect(hp - 114 + recovery - 114).toBe(0);
});

it("uses legal Champions spreads and the published final defensive stats", () => {
  for (const [id, defender] of Object.entries(defenders)) {
    expect(Object.values(defender.evs).reduce((sum, value) => sum + value, 0)).toBe(66);
    const stats = calculateChampionsStats(defender.member.baseStats!, defender.evs, getNatureById(defender.natureId));
    expect(stats).toEqual({ hp: 215, attack: 132, defense: id === "special" ? 154 : 187, specialAttack: 79, specialDefense: id === "special" ? 124 : 94, speed: 67 });
  }
  for (const entry of cases) expect(Object.values(entry.attacker.evs).reduce((sum, value) => sum + value, 0)).toBe(66);
});
