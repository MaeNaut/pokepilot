import { readFileSync } from "node:fs";
import { normalizeShowdownSnapshot } from "../../api/showdownData";
import { parseShowdownTeam, type ParsedShowdownPokemon } from "../../utils/showdownText";
import { normalizeShowdownId } from "../../api/showdownIds";
import { calculateChampionsDamage, type CalculatorPokemon } from "../../calculator/damageCalculator";
import { createDefaultCalculatorField, getCalculatorMaxHp } from "../../calculator/calculatorViewModel";
import type { StatBlock } from "../../types";

const raw = JSON.parse(readFileSync(new URL("../../../public/data/showdown-battle-mc.json", import.meta.url), "utf8"));
const snapshot = normalizeShowdownSnapshot(raw.species, raw.moves);
export const publicExampleText = readFileSync(new URL("../../../public/help/kabamanda-team.txt", import.meta.url), "utf8");
export const publicExampleTeam = parseShowdownTeam(publicExampleText);
const empty: StatBlock = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };

function side(set: ParsedShowdownPokemon, moveName: string): CalculatorPokemon {
  const species = snapshot.speciesById[normalizeShowdownId(set.pokemonName)];
  const move = snapshot.movesById[normalizeShowdownId(moveName)];
  if (!species?.types || !species.baseStats || !move) throw new Error(`Missing example data: ${set.pokemonName}/${moveName}`);
  const member = { id: species.id, name: species.name, showdownId: species.id, showdownName: species.name,
    types: [...species.types], roles: [], baseStats: species.baseStats, abilities: [...species.abilities], moves: [move] };
  const build = { item: set.itemName ? { id: normalizeShowdownId(set.itemName), name: set.itemName } : null,
    ability: set.ability ?? species.abilities[0], natureId: set.nature?.toLowerCase() ?? "hardy",
    evs: { ...empty, ...set.evs }, moveIds: [move.id] };
  return { member, ...build, boosts: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    currentHp: getCalculatorMaxHp(member, build), status: "healthy", move };
}

const mence = publicExampleTeam[1];
const lucario = publicExampleTeam[2];
const primarina = publicExampleTeam[5];
const baxcalibur: ParsedShowdownPokemon = { pokemonName: "Baxcalibur", ability: "Thermal Exchange", nature: "Adamant",
  itemName: "Focus Sash", evs: { hp: 1, attack: 32, specialDefense: 1, speed: 32 }, moves: ["Ice Shard"] };

export const publicExampleCalculations = [
  { id: "double-edge", attacker: side(mence, "Double-Edge"), defender: side(primarina, "Moonblast") },
  { id: "boosted-double-edge", attacker: { ...side(mence, "Double-Edge"), boosts: { attack: 1, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } }, defender: side(primarina, "Moonblast") },
  { id: "ice-shard", attacker: side(baxcalibur, "Ice Shard"), defender: side(mence, "Double-Edge") },
  { id: "aura-sphere", attacker: side(lucario, "Aura Sphere"), defender: side(baxcalibur, "Ice Shard") },
].map((entry) => ({ ...entry, result: calculateChampionsDamage(entry.attacker, entry.defender, createDefaultCalculatorField("singles")) }));
