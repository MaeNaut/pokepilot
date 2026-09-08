import { describe, expect, it } from "vitest";
import { defaultEvs } from "../data/natures";
import type { PokemonMove, TeamMember } from "../types";
import {
  createCalculatorBattleState,
  createDefaultCalculatorField,
  getCalculatorMaxHp,
} from "./calculatorViewModel";
import type {
  CalculatorAnalysisContext,
  CalculatorAnalysisSide,
} from "./setOptimizer/types";
import { createTeamMatchupPlan } from "./teamMatchup";

const earthquake: PokemonMove = {
  id: "earthquake",
  name: "Earthquake",
  type: "ground",
  category: "Physical",
  power: 100,
  accuracy: 100,
  pp: 10,
  description: "",
};
const tackle: PokemonMove = {
  id: "tackle",
  name: "Tackle",
  type: "normal",
  category: "Physical",
  power: 40,
  accuracy: 100,
  pp: 35,
  description: "",
};
const dragonClaw: PokemonMove = {
  ...tackle,
  id: "dragonclaw",
  name: "Dragon Claw",
  type: "dragon",
  power: 80,
};
const sacredSword: PokemonMove = {
  ...tackle,
  id: "sacredsword",
  name: "Sacred Sword",
  type: "fighting",
  power: 90,
  description: "Ignores the target's stat stage changes.",
};
const closeCombat: PokemonMove = {
  ...sacredSword,
  id: "closecombat",
  name: "Close Combat",
  power: 120,
  description: "Lowers the user's Defense and Special Defense by 1 stage.",
};
const rechargingDragonClaw: PokemonMove = {
  ...dragonClaw,
  id: "rechargingdragonclaw",
  name: "Recharging Dragon Claw",
  tags: ["Recharge"],
};
const protect: PokemonMove = {
  ...tackle,
  id: "protect",
  name: "Protect",
  category: "Status",
  power: null,
};

const garchomp: TeamMember = {
  id: "garchomp",
  name: "Garchomp",
  showdownName: "Garchomp",
  types: ["dragon", "ground"],
  roles: [],
  abilities: ["Rough Skin"],
  moves: [earthquake, protect],
  baseStats: {
    hp: 108,
    attack: 130,
    defense: 95,
    specialAttack: 80,
    specialDefense: 85,
    speed: 102,
  },
};
const incineroar: TeamMember = {
  id: "incineroar",
  name: "Incineroar",
  showdownName: "Incineroar",
  types: ["fire", "dark"],
  roles: [],
  abilities: ["Intimidate"],
  moves: [tackle],
  baseStats: {
    hp: 95,
    attack: 115,
    defense: 90,
    specialAttack: 80,
    specialDefense: 90,
    speed: 60,
  },
};
const archaludon: TeamMember = {
  id: "archaludon",
  name: "Archaludon",
  showdownName: "Archaludon",
  types: ["steel", "dragon"],
  roles: [],
  abilities: ["Stamina"],
  moves: [tackle],
  baseStats: {
    hp: 90,
    attack: 105,
    defense: 130,
    specialAttack: 125,
    specialDefense: 65,
    speed: 85,
  },
};
const aegislashShield: TeamMember = {
  id: "aegislash-shield",
  name: "Aegislash",
  showdownName: "Aegislash-Shield",
  types: ["steel", "ghost"],
  roles: [],
  abilities: ["Stance Change"],
  moves: [sacredSword],
  baseStats: {
    hp: 60,
    attack: 50,
    defense: 140,
    specialAttack: 50,
    specialDefense: 140,
    speed: 60,
  },
};
const scrafty: TeamMember = {
  id: "scrafty",
  name: "Scrafty",
  showdownName: "Scrafty",
  types: ["dark", "fighting"],
  roles: [],
  abilities: ["Intimidate"],
  moves: [closeCombat],
  baseStats: {
    hp: 65,
    attack: 90,
    defense: 115,
    specialAttack: 45,
    specialDefense: 115,
    speed: 58,
  },
};

function createSide(
  member: TeamMember,
  moves: Array<PokemonMove | undefined>,
): CalculatorAnalysisSide {
  const build = {
    item: null,
    ability: member.abilities?.[0] ?? "",
    natureId: "hardy",
    evs: { ...defaultEvs },
    moveIds: moves.map((move) => move?.id ?? ""),
  };
  const maxHp = getCalculatorMaxHp(member, build);
  return {
    member,
    build,
    battle: createCalculatorBattleState(maxHp),
    moves,
    maxHp,
  };
}

describe("team matchup analysis", () => {
  it("ranks a faster knockout threat as an existing team answer", () => {
    const player = createSide(garchomp, [earthquake]);
    const opponent = createSide(incineroar, [tackle]);
    const context: CalculatorAnalysisContext = {
      battleFormat: "singles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player,
      opponent,
      roster: [{ ...player, slotIndex: 0 }],
      field: createDefaultCalculatorField("singles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan).toMatchObject({
      status: "ready",
      opponentId: "incineroar",
      members: [
        {
          pokemonId: "garchomp",
          responseTier: "answer",
          speed: { relation: "faster" },
          offenseBenchmarks: [
            expect.objectContaining({
              moveId: "earthquake",
              source: "selected",
            }),
          ],
        },
      ],
    });
  });

  it("ignores status moves and requires an opponent and roster", () => {
    const player = createSide(garchomp, [protect]);
    const opponent = createSide(incineroar, [protect]);
    const context: CalculatorAnalysisContext = {
      battleFormat: "singles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player,
      opponent,
      roster: [{ ...player, slotIndex: 0 }],
      field: createDefaultCalculatorField("singles"),
    };

    expect(createTeamMatchupPlan(context)).toMatchObject({
      status: "unavailable",
      reason: "missing-benchmarks",
    });
    expect(createTeamMatchupPlan({
      ...context,
      opponent: { ...opponent, member: null },
    })).toMatchObject({ status: "unavailable", reason: "missing-opponent" });
    expect(createTeamMatchupPlan({ ...context, roster: [] })).toMatchObject({
      status: "unavailable",
      reason: "missing-roster",
    });
  });

  it("retains every configured damaging move even when one is not in the top two", () => {
    const player = createSide(garchomp, [earthquake, dragonClaw, sacredSword]);
    const opponent = createSide(incineroar, [tackle]);
    const context: CalculatorAnalysisContext = {
      battleFormat: "singles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player,
      opponent,
      roster: [{ ...player, slotIndex: 0 }],
      field: createDefaultCalculatorField("singles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    expect(plan.members[0].offenseBenchmarks.map(({ moveId }) => moveId))
      .toEqual(expect.arrayContaining([
        "earthquake",
        "dragonclaw",
        "sacredsword",
      ]));
  });

  it("counts forced recharge turns and ranks an equal non-recharge attack first", () => {
    const rechargingSide = createSide(garchomp, [rechargingDragonClaw]);
    const continuousSide = createSide(garchomp, [dragonClaw]);
    const opponent = createSide(incineroar, [tackle]);
    const context: CalculatorAnalysisContext = {
      battleFormat: "singles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player: rechargingSide,
      opponent,
      roster: [
        { ...rechargingSide, slotIndex: 0 },
        { ...continuousSide, slotIndex: 1 },
      ],
      field: createDefaultCalculatorField("singles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    expect(plan.members[0].slotIndex).toBe(1);
    const rechargingBenchmark = plan.members.find(
      ({ slotIndex }) => slotIndex === 0,
    )?.offenseBenchmarks[0];
    expect(rechargingBenchmark?.requiresRecharge).toBe(true);
    expect(rechargingBenchmark?.guaranteedActionTurns).toBe(
      (rechargingBenchmark?.result.guaranteedKoHits ?? 0) * 2 - 1,
    );
  });

  it("keeps the two strongest observed moves when no move is configured", () => {
    const player = createSide(garchomp, []);
    player.usageMoves = [tackle, dragonClaw, sacredSword];
    const opponent = createSide(incineroar, [tackle]);
    const context: CalculatorAnalysisContext = {
      battleFormat: "singles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player,
      opponent,
      roster: [{ ...player, slotIndex: 0 }],
      field: createDefaultCalculatorField("singles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    expect(plan.members[0].offenseBenchmarks).toHaveLength(2);
    expect(plan.members[0].offenseBenchmarks.every(
      ({ source }) => source === "usage",
    )).toBe(true);
  });

  it("recalculates physical follow-up hits after Stamina raises Defense", () => {
    const player = createSide(garchomp, [earthquake, sacredSword, tackle]);
    const opponent = createSide(archaludon, [tackle]);
    const context: CalculatorAnalysisContext = {
      battleFormat: "doubles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player,
      opponent,
      roster: [{ ...player, slotIndex: 0 }],
      field: createDefaultCalculatorField("doubles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    const benchmarks = plan.members[0].offenseBenchmarks;
    const earthquakeSequence = benchmarks.find(
      ({ moveId }) => moveId === "earthquake",
    )?.persistentSequence;
    const sacredSwordSequence = benchmarks.find(
      ({ moveId }) => moveId === "sacredsword",
    )?.persistentSequence;
    const tackleBenchmark = benchmarks.find(({ moveId }) => moveId === "tackle");

    expect(earthquakeSequence).toMatchObject({
      triggerAbilityId: "stamina",
      boostedStat: "defense",
      stagesPerHit: 1,
      boostAffectedDamage: true,
    });
    expect(earthquakeSequence?.hits[1].maxPercent).toBeLessThan(
      earthquakeSequence?.hits[0].maxPercent ?? 0,
    );
    expect(sacredSwordSequence).toMatchObject({
      triggerAbilityId: "stamina",
      boostAffectedDamage: false,
    });
    expect(sacredSwordSequence?.hits[1].maxPercent).toBe(
      sacredSwordSequence?.hits[0].maxPercent,
    );
    expect(tackleBenchmark?.persistentSequence).toMatchObject({
      possibleKoHits: null,
      guaranteedKoHits: null,
    });
    expect(tackleBenchmark).toMatchObject({
      possibleActionTurns: null,
      guaranteedActionTurns: null,
    });
  });

  it("ranks Stance Change Sacred Sword as persistent pressure into Stamina", () => {
    const player = createSide(aegislashShield, [
      sacredSword,
      { ...tackle, id: "shadowsneak", name: "Shadow Sneak", type: "ghost" },
      { ...tackle, id: "ironhead", name: "Iron Head", type: "steel", power: 80 },
    ]);
    player.build.evs.attack = 32;
    const opponent = createSide(archaludon, [tackle]);
    opponent.build.evs.hp = 32;
    opponent.maxHp = getCalculatorMaxHp(archaludon, opponent.build);
    opponent.battle = createCalculatorBattleState(opponent.maxHp);
    const context: CalculatorAnalysisContext = {
      battleFormat: "doubles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player,
      opponent,
      roster: [{ ...player, slotIndex: 0 }],
      field: createDefaultCalculatorField("doubles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    expect(plan.members[0].offenseBenchmarks[0]).toMatchObject({
      moveId: "sacredsword",
      persistentSequence: {
        triggerAbilityId: "stamina",
        boostAffectedDamage: false,
      },
    });
  });

  it("orders the stronger persistent answer before a roster-order alternative", () => {
    const firstPlayer = createSide(scrafty, [closeCombat]);
    const aegislash = createSide(aegislashShield, [sacredSword]);
    aegislash.build.evs.attack = 32;
    const opponent = createSide(archaludon, [tackle]);
    opponent.build.evs.hp = 32;
    opponent.maxHp = getCalculatorMaxHp(archaludon, opponent.build);
    opponent.battle = createCalculatorBattleState(opponent.maxHp);
    const context: CalculatorAnalysisContext = {
      battleFormat: "doubles",
      selectedSlot: 0,
      direction: "player-to-opponent",
      player: firstPlayer,
      opponent,
      roster: [
        { ...firstPlayer, slotIndex: 0 },
        { ...aegislash, slotIndex: 4 },
      ],
      field: createDefaultCalculatorField("doubles"),
    };

    const plan = createTeamMatchupPlan(context);
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;

    expect(plan.members[0]).toMatchObject({
      pokemonId: "aegislash-shield",
      offenseBenchmarks: [
        expect.objectContaining({ moveId: "sacredsword" }),
      ],
    });
  });
});
