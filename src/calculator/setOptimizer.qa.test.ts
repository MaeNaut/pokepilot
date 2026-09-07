import { describe, expect, it } from "vitest";
import { calculateChampionsStats, defaultEvs, getNatureById } from "../data/natures";
import type { PokemonMove, TeamMember } from "../types";
import { createCalculatorBattleState, createDefaultCalculatorField } from "./calculatorViewModel";
import { createSetOptimizationPlan, type CalculatorAnalysisContext } from "./setOptimizer";

describe("sample optimization QA regressions", () => {
  it.each([false, true])("does not dismantle an invested fast attacker (damaging matchup: %s)", (damagingMatchup) => {
    const fakeOut: PokemonMove = { id: "fakeout", name: "Fake Out", type: "normal", category: "Physical", power: 40, accuracy: 100, pp: 10, description: "" };
    const protect: PokemonMove = { id: "protect", name: "Protect", type: "normal", category: "Status", power: null, accuracy: null, pp: 10, description: "" };
    const player: TeamMember = {
      id: "weavile", name: "Weavile", showdownName: "Weavile", types: ["dark", "ice"], roles: [], abilities: ["Pressure"],
      baseStats: { hp: 70, attack: 120, defense: 65, specialAttack: 45, specialDefense: 85, speed: 125 },
    };
    const opponent: TeamMember = {
      id: "gholdengo", name: "Gholdengo", showdownName: "Gholdengo", types: ["steel", "ghost"], roles: [], abilities: ["Good as Gold"],
      baseStats: { hp: 87, attack: 60, defense: 95, specialAttack: 133, specialDefense: 91, speed: 84 },
    };
    function side(member: TeamMember, natureId: string, physical: boolean, move: PokemonMove) {
      const evs = { ...defaultEvs, hp: 2, speed: 32, ...(physical ? { attack: 32 } : { specialAttack: 32 }) };
      const maxHp = calculateChampionsStats(member.baseStats!, evs, getNatureById(natureId)).hp;
      return { member, build: { item: null, ability: member.abilities![0], natureId, evs, moveIds: [move.id] }, moves: [move], maxHp, battle: createCalculatorBattleState(maxHp) };
    }
    const context: CalculatorAnalysisContext = {
      battleFormat: "doubles", selectedSlot: 0, direction: "player-to-opponent",
      player: side(player, "jolly", true, fakeOut), opponent: side(opponent, "timid", false, protect),
      field: createDefaultCalculatorField("doubles"),
    };
    if (damagingMatchup) {
      const icePunch: PokemonMove = { ...fakeOut, id: "icepunch", name: "Ice Punch", type: "ice", power: 75 };
      const shadowBall: PokemonMove = { ...fakeOut, id: "shadowball", name: "Shadow Ball", type: "ghost", category: "Special", power: 80 };
      context.player.moves = [icePunch];
      context.player.build.moveIds = [icePunch.id];
      context.opponent.moves = [shadowBall];
      context.opponent.build.moveIds = [shadowBall.id];
    }
    const expectedIds = damagingMatchup ? ["set-current"] : [];
    expect(createSetOptimizationPlan(context).candidates.map(({ id }) => id)).toEqual(expectedIds);
    context.direction = "opponent-to-player";
    expect(createSetOptimizationPlan(context).candidates.map(({ id }) => id)).toEqual(expectedIds);
  });
});
