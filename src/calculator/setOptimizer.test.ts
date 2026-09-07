import { describe, expect, it } from "vitest";
import {
  CHAMPIONS_MAX_EV_PER_STAT,
  CHAMPIONS_MAX_EV_TOTAL,
  defaultEvs,
  getNatureById,
  statKeys,
} from "../data/natures";
import type { PokemonMove, TeamMember } from "../types";
import { createCalculatorBattleState, createDefaultCalculatorField } from "./calculatorViewModel";
import { createOptimizationEvaluator, getDamagingMoves } from "./setOptimizer/evaluator";
import { minimizeRedundantDefense } from "./setOptimizer/defenseInvestment";
import {
  createSetOptimizationPlan,
  type CalculatorAnalysisContext,
} from "./setOptimizer";

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

const bodyPress: PokemonMove = {
  id: "body-press",
  name: "Body Press",
  type: "fighting",
  category: "Physical",
  power: 80,
  accuracy: 100,
  pp: 10,
  description: "",
};

const psyshock: PokemonMove = {
  id: "psyshock",
  name: "Psyshock",
  type: "psychic",
  category: "Special",
  power: 80,
  accuracy: 100,
  pp: 10,
  description: "",
};

const flamethrower: PokemonMove = {
  id: "flamethrower",
  name: "Flamethrower",
  type: "fire",
  category: "Special",
  power: 90,
  accuracy: 100,
  pp: 15,
  description: "",
};

const bugBite: PokemonMove = {
  id: "bug-bite",
  name: "Bug Bite",
  type: "bug",
  category: "Physical",
  power: 60,
  accuracy: 100,
  pp: 20,
  description: "",
};

const dualWingbeat: PokemonMove = {
  id: "dual-wingbeat",
  name: "Dual Wingbeat",
  type: "flying",
  category: "Physical",
  power: 40,
  accuracy: 90,
  pp: 10,
  description: "",
};

const foulPlay: PokemonMove = {
  id: "foul-play",
  name: "Foul Play",
  type: "dark",
  category: "Physical",
  power: 95,
  accuracy: 100,
  pp: 15,
  description: "",
};

const protect: PokemonMove = {
  id: "protect",
  name: "Protect",
  type: "normal",
  category: "Status",
  power: null,
  accuracy: null,
  pp: 10,
  description: "",
};

const attacker: TeamMember = {
  id: "garchomp",
  name: "Garchomp",
  showdownName: "Garchomp",
  types: ["dragon", "ground"],
  roles: [],
  abilities: ["Rough Skin"],
  moves: [earthquake, tackle],
  baseStats: {
    hp: 108,
    attack: 130,
    defense: 95,
    specialAttack: 80,
    specialDefense: 85,
    speed: 102,
  },
};

const defender: TeamMember = {
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

function createContext(
  direction: CalculatorAnalysisContext["direction"],
  player: TeamMember = attacker,
  opponent: TeamMember = defender,
  playerMoves: Array<PokemonMove | undefined> = [earthquake],
  opponentMoves: Array<PokemonMove | undefined> = [tackle],
): CalculatorAnalysisContext {
  return {
    battleFormat: "singles",
    selectedSlot: 0,
    direction,
    player: {
      member: player,
      build: {
        item: null,
        ability: player.abilities?.[0] ?? "",
        natureId: "hardy",
        evs: { ...defaultEvs },
        moveIds: playerMoves.flatMap((move) => (move ? [move.id] : [])),
      },
      battle: createCalculatorBattleState(player.baseStats!.hp + 75),
      moves: playerMoves,
      maxHp: player.baseStats!.hp + 75,
    },
    opponent: {
      member: opponent,
      build: {
        item: null,
        ability: opponent.abilities?.[0] ?? "",
        natureId: "hardy",
        evs: { ...defaultEvs },
        moveIds: opponentMoves.flatMap((move) => (move ? [move.id] : [])),
      },
      battle: createCalculatorBattleState(opponent.baseStats!.hp + 75),
      moves: opponentMoves,
      maxHp: opponent.baseStats!.hp + 75,
    },
    field: createDefaultCalculatorField("singles"),
  };
}

describe("exact-target set optimizer", () => {
  it("does not replace Brave HA Tyranitar with percent-only bulk against Life Orb Gholdengo in sand", () => {
    const knockOff: PokemonMove = { ...tackle, id: "knockoff", name: "Knock Off", type: "dark", power: 65 };
    const rockSlide: PokemonMove = { ...tackle, id: "rockslide", name: "Rock Slide", type: "rock", power: 75, tags: ["Spread: Foes"] };
    const makeItRain: PokemonMove = { ...flamethrower, id: "makeitrain", name: "Make It Rain", type: "steel", power: 120, tags: ["Spread: Foes"] };
    const shadowBall: PokemonMove = { ...flamethrower, id: "shadowball", name: "Shadow Ball", type: "ghost", power: 80 };
    const thunderbolt: PokemonMove = { ...flamethrower, id: "thunderbolt", name: "Thunderbolt", type: "electric" };
    const tyranitar: TeamMember = {
      ...attacker, id: "tyranitar", name: "Tyranitar", showdownName: "Tyranitar",
      types: ["rock", "dark"], abilities: ["Sand Stream"],
      baseStats: { hp: 100, attack: 134, defense: 110, specialAttack: 95, specialDefense: 100, speed: 61 },
    };
    const gholdengo: TeamMember = {
      ...defender, id: "gholdengo", name: "Gholdengo", showdownName: "Gholdengo",
      types: ["steel", "ghost"], abilities: ["Good as Gold"],
      baseStats: { hp: 87, attack: 60, defense: 95, specialAttack: 133, specialDefense: 91, speed: 84 },
    };
    const context = createContext("player-to-opponent", tyranitar, gholdengo,
      [rockSlide, knockOff, { ...earthquake, tags: ["Spread: All"] }, protect], [shadowBall, makeItRain, protect]);
    context.battleFormat = "doubles";
    context.field = { ...createDefaultCalculatorField("doubles"), weather: "sand" };
    context.player.build.natureId = "brave";
    context.player.build.item = { id: "tyranitarite", name: "Tyranitarite" };
    context.player.build.evs = { ...defaultEvs, hp: 32, attack: 32, defense: 1, specialDefense: 1 };
    context.player.maxHp = 207;
    context.player.battle = createCalculatorBattleState(207);
    context.opponent.build.natureId = "timid";
    context.opponent.build.item = { id: "life-orb", showdownId: "lifeorb", name: "Life Orb" };
    context.opponent.build.evs = { ...defaultEvs, hp: 2, specialAttack: 32, speed: 32 };
    context.opponent.maxHp = 164;
    context.opponent.battle = createCalculatorBattleState(164);
    context.opponent.usageMoves = [thunderbolt];

    const evaluator = createOptimizationEvaluator(context);
    expect(evaluator.calculate(makeItRain, context.player.build, "opponent-to-player"))
      .toMatchObject({ minDamage: 133, maxDamage: 159 });
    expect(evaluator.calculate(knockOff, context.player.build, "player-to-opponent"))
      .toMatchObject({ minDamage: 194, maxDamage: 230 });
    const plan = createSetOptimizationPlan(context);
    expect(plan.candidates).toEqual([]);
    expect(plan.status).toBe("unavailable");

    // Without sand, the same matchup has a real OHKO risk worth addressing.
    context.field.weather = "none";
    expect(createSetOptimizationPlan(context).candidates.length).toBeGreaterThan(0);

    context.field.weather = "sand";
    context.direction = "opponent-to-player";
    context.opponent.build.item = null;
    const noItemEvaluator = createOptimizationEvaluator(context);
    const optimized = minimizeRedundantDefense(context, {
      natureId: "brave", evs: { ...defaultEvs, hp: 32, defense: 4, specialDefense: 30 },
      focuses: ["defense"], targets: { hp: 32, specialDefense: 30 }, axes: ["defense:specialDefense"],
    }, getDamagingMoves(context.player), getDamagingMoves(context.opponent), noItemEvaluator);
    expect(optimized.evs).toEqual({ ...defaultEvs, hp: 32, defense: 8, specialDefense: 26 });
    expect(noItemEvaluator.calculate(makeItRain, { ...context.player.build, evs: optimized.evs }, "opponent-to-player"))
      .toMatchObject({ minDamage: 84, maxDamage: 102, koHits: 3, koChance: 100 });
    const belowBoundary = noItemEvaluator.calculate(makeItRain, {
      ...context.player.build, evs: { ...optimized.evs, specialDefense: 25, defense: 9 },
    }, "opponent-to-player");
    expect(belowBoundary?.koHits).toBe(2);
    expect(belowBoundary?.koChance).toBeGreaterThan(0);
    const noItemPlan = createSetOptimizationPlan(context);
    expect(noItemPlan.candidates.length).toBeGreaterThan(0);
    expect(noItemPlan.candidates.some((candidate) => candidate.natureId === "brave"
      && candidate.evs.specialDefense > 26 && candidate.evs.specialDefense < 32)).toBe(false);
  });

  it("evaluates every legal candidate across offense, defense, and Speed", () => {
    const context = createContext("player-to-opponent", attacker, defender, [earthquake], [{ ...flamethrower, type: "ice" }]);
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      attack: 32,
      defense: 2,
    };
    const plan = createSetOptimizationPlan(context);

    expect(plan.status).toBe("ready");
    expect(plan.configuredDirection).toBe("player-to-opponent");
    expect(plan.candidates.length).toBeGreaterThan(0);
    expect(plan.candidates.length).toBeLessThanOrEqual(8);
    expect(new Set(plan.candidates.map((candidate) => candidate.id)).size).toBe(
      plan.candidates.length,
    );

    for (const candidate of plan.candidates) {
      expect(candidate.evTotal).toBe(66);
      expect(
        statKeys.every(
          (stat) => candidate.evs[stat] >= 0 && candidate.evs[stat] <= 32,
        ),
      ).toBe(true);
      expect(candidate.focuses.length).toBeGreaterThan(0);
      expect(candidate.offenseBenchmarks.length).toBeLessThanOrEqual(2);
      expect(candidate.defenseBenchmarks.length).toBeLessThanOrEqual(2);
      expect(candidate.speedBenchmark.current.opponentSpeed).toBe(
        candidate.speedBenchmark.optimized.opponentSpeed,
      );
    }
    expect(
      plan.candidates.some(
        (candidate) =>
          candidate.focuses.includes("offense") &&
          candidate.focuses.includes("defense"),
      ),
    ).toBe(true);
  });

  it("uses unselected usage moves for offense and defense benchmarks", () => {
    const context = createContext(
      "player-to-opponent",
      attacker,
      defender,
      [protect],
      [protect],
    );
    context.player.usageMoves = [earthquake];
    context.opponent.usageMoves = [earthquake];

    const plan = createSetOptimizationPlan(context);

    expect(plan.status).toBe("ready");
    expect(
      plan.candidates.some((candidate) =>
        candidate.offenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === earthquake.id && benchmark.source === "usage",
        ),
      ),
    ).toBe(true);
    expect(
      plan.candidates.some((candidate) =>
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === earthquake.id && benchmark.source === "usage",
        ),
      ),
    ).toBe(true);
  });

  it("keeps a selected move's source when usage data contains the same move", () => {
    const context = createContext("player-to-opponent");
    context.player.usageMoves = [earthquake];

    const plan = createSetOptimizationPlan(context);
    const earthquakeBenchmarks = plan.candidates.flatMap((candidate) =>
      candidate.offenseBenchmarks.filter(
        (benchmark) => benchmark.moveId === earthquake.id,
      ),
    );

    expect(earthquakeBenchmarks.length).toBeGreaterThan(0);
    expect(
      earthquakeBenchmarks.every((benchmark) => benchmark.source === "selected"),
    ).toBe(true);
  });

  it("does not spend offense when it cannot improve the guaranteed hit count", () => {
    const restrainedEarthquake = {
      ...earthquake,
      id: "restrained-earthquake",
      power: 60,
    };
    const context = createContext(
      "player-to-opponent",
      { ...attacker, moves: [restrainedEarthquake] },
      defender,
      [restrainedEarthquake],
      [{ ...flamethrower, type: "ice", power: 140 }],
    );
    context.player.build.natureId = "adamant";
    context.player.build.evs = {
      ...defaultEvs,
      attack: 32,
      defense: 2,
      specialDefense: 32,
    };
    const plan = createSetOptimizationPlan(context);
    const efficientCandidate = plan.candidates.find(
      (candidate) =>
        candidate.evs.attack === 0 &&
        candidate.offenseBenchmarks.some(
          (benchmark) => benchmark.moveId === restrainedEarthquake.id,
        ),
    );

    expect(plan.status).toBe("ready");
    expect(efficientCandidate).toBeDefined();
    const benchmark = efficientCandidate?.offenseBenchmarks.find(
      (entry) => entry.moveId === restrainedEarthquake.id,
    );

    expect(benchmark?.current.guaranteedKoHits).toBe(2);
    expect(benchmark?.optimized.guaranteedKoHits).toBe(2);
    expect(efficientCandidate?.statPointChanges.attack).toBe(-32);
    expect(efficientCandidate?.evs).toMatchObject({
      hp: 32,
      attack: 0,
      defense: 2,
      specialDefense: 32,
    });
    expect(efficientCandidate?.evTotal).toBe(66);
    expect(
      plan.candidates
        .filter((candidate) =>
          candidate.offenseBenchmarks.some(
            (entry) => entry.moveId === restrainedEarthquake.id,
          ),
        )
        .every((candidate) => candidate.evs.attack === 0),
    ).toBe(true);
    expect(
      plan.candidates.every(
        (candidate) =>
          !["defense", "specialDefense"].includes(
            getNatureById(candidate.natureId).down,
          ),
      ),
    ).toBe(true);
  });

  it("keeps investment that opens a meaningful OHKO chance", () => {
    const chanceStrike: PokemonMove = {
      ...earthquake,
      id: "chance-strike",
      name: "Chance Strike",
      type: "normal",
      power: 254,
    };
    const neutralDefender = {
      ...defender,
      abilities: ["Blaze"],
    };
    const context = createContext(
      "player-to-opponent",
      { ...attacker, moves: [chanceStrike] },
      neutralDefender,
      [chanceStrike],
    );
    context.player.build.natureId = "adamant";
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      defense: 32,
      specialDefense: 2,
    };
    context.opponent.build.evs = {
      ...defaultEvs,
      hp: 32,
      attack: 32,
      specialDefense: 2,
    };
    context.opponent.maxHp = 202;
    context.opponent.battle = createCalculatorBattleState(202);

    const plan = createSetOptimizationPlan(context);
    const probabilityCandidate = plan.candidates.find((candidate) => {
      const benchmark = candidate.offenseBenchmarks.find(
        (entry) => entry.moveId === chanceStrike.id,
      );
      return (
        candidate.evs.attack > 0 &&
        benchmark?.current.guaranteedKoHits === 2 &&
        benchmark.optimized.guaranteedKoHits === 2 &&
        benchmark.current.oneHitKoChance === 0 &&
        benchmark.optimized.oneHitKoChance >= 6.25
      );
    });
    expect(plan.status).toBe("ready");
    expect(probabilityCandidate).toBeDefined();
    expect(probabilityCandidate?.evs.hp).toBe(CHAMPIONS_MAX_EV_PER_STAT);
    expect(
      Math.max(
        ...plan.candidates.flatMap((candidate) =>
          candidate.offenseBenchmarks
            .filter((benchmark) => benchmark.moveId === chanceStrike.id)
            .map((benchmark) => benchmark.optimized.oneHitKoChance),
        ),
      ),
    ).toBe(12.5);
  });

  it("keeps investment that raises the chance of a multi-hit KO", () => {
    const chanceStrike: PokemonMove = {
      ...earthquake,
      id: "two-hit-chance-strike",
      name: "Two-Hit Chance Strike",
      type: "normal",
      power: 130,
    };
    const neutralDefender = {
      ...defender,
      abilities: ["Blaze"],
    };
    const context = createContext(
      "player-to-opponent",
      { ...attacker, moves: [chanceStrike] },
      neutralDefender,
      [chanceStrike],
    );
    context.player.build.natureId = "adamant";
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      defense: 32,
      specialDefense: 2,
    };
    context.opponent.build.evs = {
      ...defaultEvs,
      hp: 32,
      attack: 32,
      specialDefense: 2,
    };
    context.opponent.maxHp = 202;
    context.opponent.battle = createCalculatorBattleState(202);

    const plan = createSetOptimizationPlan(context);
    const probabilityCandidate = plan.candidates.find((candidate) => {
      const benchmark = candidate.offenseBenchmarks.find(
        (entry) => entry.moveId === chanceStrike.id,
      );
      return (
        candidate.evs.attack > 0 &&
        benchmark?.current.guaranteedKoHits === 3 &&
        benchmark.optimized.guaranteedKoHits === 3 &&
        benchmark.current.koHits === 3 &&
        benchmark.optimized.koHits === 2 &&
        (benchmark.optimized.koChance ?? 0) >= 6.25
      );
    });

    expect(plan.status).toBe("ready");
    expect(probabilityCandidate).toBeDefined();
    expect(probabilityCandidate?.evs.hp).toBe(CHAMPIONS_MAX_EV_PER_STAT);
  });

  it("keeps HP as the foundation when adding a useful offensive axis", () => {
    const neutralStrike: PokemonMove = {
      ...earthquake,
      id: "neutral-strike",
      name: "Neutral Strike",
      type: "normal",
      power: 100,
    };
    const context = createContext(
      "player-to-opponent",
      { ...attacker, moves: [neutralStrike] },
      defender,
      [neutralStrike],
    );
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      defense: 2,
      specialDefense: 32,
    };
    const plan = createSetOptimizationPlan(context);
    const offensiveCandidates = plan.candidates.filter(
      (candidate) =>
        candidate.evs.attack > 0 &&
        candidate.offenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === neutralStrike.id &&
            (benchmark.optimized.guaranteedKoHits ?? Number.POSITIVE_INFINITY) <
              (benchmark.current.guaranteedKoHits ?? Number.POSITIVE_INFINITY),
        ),
    );

    expect(plan.status).toBe("ready");
    expect(offensiveCandidates.length).toBeGreaterThan(0);
    expect(
      offensiveCandidates.every(
        (candidate) => candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT,
      ),
    ).toBe(true);
  });

  it("does not chase impractical hit-count gains with a weak utility attack", () => {
    const utilityAttack = {
      ...tackle,
      id: "utility-attack",
      category: "Special",
      power: 20,
    };
    const plan = createSetOptimizationPlan(
      createContext(
        "player-to-opponent",
        { ...attacker, moves: [utilityAttack] },
        defender,
        [utilityAttack],
        [earthquake],
      ),
    );

    expect(plan.status).toBe("ready");
    expect(
      plan.candidates.every((candidate) =>
        candidate.offenseBenchmarks.every(
          (benchmark) => benchmark.moveId !== utilityAttack.id,
        ),
      ),
    ).toBe(true);
  });

  it("uses incoming calculator moves when building survival candidates", () => {
    const context = createContext(
      "opponent-to-player",
      defender,
      attacker,
      [tackle],
      [earthquake],
    );
    const plan = createSetOptimizationPlan(context);

    expect(plan.status).toBe("ready");
    const defensiveCandidates = plan.candidates.filter((candidate) =>
      candidate.defenseBenchmarks.some(
        (benchmark) =>
          benchmark.moveId === "earthquake" &&
          (benchmark.optimized.possibleKoHits ?? 0) >
            (benchmark.current.possibleKoHits ?? 0),
      ),
    );

    expect(plan.configuredDirection).toBe("opponent-to-player");
    expect(defensiveCandidates.length).toBeGreaterThan(0);
    expect(
      defensiveCandidates.every(
        (candidate) => candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT,
      ),
    ).toBe(true);
    expect(
      defensiveCandidates.every((candidate) =>
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === "earthquake" &&
            (benchmark.optimized.possibleKoHits ?? 0) >=
              (benchmark.current.possibleKoHits ?? 0),
        ),
      ),
    ).toBe(true);
  });

  it("keeps a bulk breakpoint that meaningfully lowers an incoming KO chance", () => {
    const pressureMove: PokemonMove = {
      ...earthquake,
      id: "probability-pressure",
      name: "Probability Pressure",
      type: "normal",
      power: 200,
    };
    const neutralDefender = {
      ...defender,
      abilities: ["Blaze"],
    };
    const context = createContext(
      "opponent-to-player",
      neutralDefender,
      { ...attacker, moves: [pressureMove] },
      [earthquake],
      [pressureMove],
    );
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      attack: 32,
      defense: 2,
    };

    const plan = createSetOptimizationPlan(context);
    const probabilityCandidate = plan.candidates.find((candidate) => {
      const benchmark = candidate.defenseBenchmarks.find(
        (entry) => entry.moveId === pressureMove.id,
      );
      return (
        benchmark?.current.possibleKoHits ===
          benchmark?.optimized.possibleKoHits &&
        benchmark?.current.koHits === benchmark?.optimized.koHits &&
        (benchmark?.current.koChance ?? 0) -
          (benchmark?.optimized.koChance ?? 0) >=
          6.25
      );
    });

    expect(plan.status).toBe("ready");
    expect(probabilityCandidate).toBeDefined();
    expect(probabilityCandidate?.evs.hp).toBe(CHAMPIONS_MAX_EV_PER_STAT);
    expect(probabilityCandidate?.evs.defense).toBeGreaterThan(2);
  });

  it("can combine physical and special survival breakpoints", () => {
    const physicalPressure: PokemonMove = {
      ...earthquake,
      id: "mixed-physical-pressure",
      type: "normal",
      power: 200,
    };
    const specialPressure: PokemonMove = {
      ...flamethrower,
      id: "mixed-special-pressure",
      type: "normal",
      power: 260,
    };
    const mixedAttacker: TeamMember = {
      ...attacker,
      moves: [physicalPressure, specialPressure],
      baseStats: {
        ...attacker.baseStats!,
        specialAttack: 130,
      },
    };
    const context = createContext(
      "opponent-to-player",
      { ...defender, abilities: ["Blaze"] },
      mixedAttacker,
      [earthquake],
      [physicalPressure, specialPressure],
    );
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      attack: 32,
      defense: 2,
    };

    const plan = createSetOptimizationPlan(context);
    const mixedBulkCandidate = plan.candidates.find((candidate) => {
      const physical = candidate.defenseBenchmarks.find(
        (entry) => entry.moveId === physicalPressure.id,
      );
      const special = candidate.defenseBenchmarks.find(
        (entry) => entry.moveId === specialPressure.id,
      );
      return (
        candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
        candidate.evs.defense > 2 &&
        candidate.evs.specialDefense > 0 &&
        physical !== undefined &&
        special !== undefined
      );
    });

    expect(plan.status).toBe("ready");
    expect(mixedBulkCandidate).toBeDefined();
  });

  it("keeps both maximum physical bulk and a minimum survival spread with reserve special bulk", () => {
    const farigiraf: TeamMember = {
      id: "farigiraf",
      name: "Farigiraf",
      showdownName: "Farigiraf",
      types: ["normal", "psychic"],
      roles: [],
      abilities: ["Armor Tail"],
      moves: [protect, psyshock],
      baseStats: {
        hp: 120,
        attack: 90,
        defense: 70,
        specialAttack: 110,
        specialDefense: 70,
        speed: 60,
      },
    };
    const scizor: TeamMember = {
      id: "scizor",
      name: "Scizor",
      showdownName: "Scizor",
      types: ["bug", "steel"],
      roles: [],
      abilities: ["Technician"],
      moves: [protect, bugBite, dualWingbeat],
      baseStats: {
        hp: 70,
        attack: 130,
        defense: 100,
        specialAttack: 55,
        specialDefense: 80,
        speed: 65,
      },
    };
    const context = createContext(
      "opponent-to-player",
      farigiraf,
      scizor,
      [protect],
      [protect],
    );
    context.player.usageMoves = [psyshock];
    context.opponent.usageMoves = [bugBite, dualWingbeat];
    context.player.build.ability = "Armor Tail";
    context.opponent.build.ability = "Technician";
    context.opponent.build.natureId = "adamant";
    context.opponent.build.evs = {
      ...defaultEvs,
      hp: 30,
      attack: 32,
      specialDefense: 3,
      speed: 1,
    };
    context.opponent.maxHp = 175;
    context.opponent.battle = createCalculatorBattleState(175);

    const plan = createSetOptimizationPlan(context);
    const bugBiteCandidates = plan.candidates.filter((candidate) =>
      candidate.defenseBenchmarks.some(
        (benchmark) =>
          benchmark.moveId === bugBite.id &&
          benchmark.source === "usage" &&
          benchmark.current.possibleKoHits === 1 &&
          (benchmark.optimized.possibleKoHits ?? 0) >= 2,
      ),
    );
    const maximumPhysicalBulk = bugBiteCandidates.find(
      (candidate) =>
        candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
        candidate.evs.defense === CHAMPIONS_MAX_EV_PER_STAT,
    );
    const survivalWithSpecialBulk = bugBiteCandidates.find(
      (candidate) =>
        candidate.profiles.includes("physical-survival-with-reserve"),
    );

    expect(plan.status).toBe("ready");
    expect(maximumPhysicalBulk).toBeDefined();
    expect(survivalWithSpecialBulk).toBeDefined();
    expect(maximumPhysicalBulk!.maxedStats).toEqual(
      expect.arrayContaining(["hp", "defense"]),
    );
    expect(maximumPhysicalBulk!.profiles).toContain(
      "physical-bulk-maximum",
    );
    expect(survivalWithSpecialBulk!.maxedStats).toContain("hp");
    expect(survivalWithSpecialBulk!.maxedStats).not.toContain("defense");
    expect(survivalWithSpecialBulk!.profiles).toContain(
      "physical-survival-with-reserve",
    );
    expect(
      bugBiteCandidates.filter((candidate) =>
        candidate.profiles.includes("physical-survival-with-reserve"),
      ),
    ).toHaveLength(1);
    expect(survivalWithSpecialBulk!.evs.specialDefense).toBe(
      Math.max(
        ...bugBiteCandidates
          .filter(
            (candidate) =>
              candidate.evs.hp === CHAMPIONS_MAX_EV_PER_STAT &&
              candidate.evs.defense < CHAMPIONS_MAX_EV_PER_STAT,
          )
          .map((candidate) => candidate.evs.specialDefense),
      ),
    );
    expect(
      maximumPhysicalBulk!.defenseBenchmarks.find(
        (benchmark) => benchmark.moveId === bugBite.id,
      )?.optimizedVsCurrent,
    ).toBe("better");
    expect(
      maximumPhysicalBulk!.defenseBenchmarks.find(
        (benchmark) => benchmark.moveId === bugBite.id,
      )?.relevantStat,
    ).toBe("defense");
    expect(
      survivalWithSpecialBulk!.defenseBenchmarks.find(
        (benchmark) => benchmark.moveId === bugBite.id,
      )?.optimizedVsCurrent,
    ).toBe("better");
    expect(
      survivalWithSpecialBulk!.evs.specialDefense,
    ).toBeGreaterThan(maximumPhysicalBulk!.evs.specialDefense);
    expect(survivalWithSpecialBulk!.evs).toMatchObject({
      hp: 32,
      attack: 0,
      specialAttack: 0,
      speed: 0,
    });
    expect(survivalWithSpecialBulk!.evs.specialDefense).toBe(
      CHAMPIONS_MAX_EV_TOTAL -
        survivalWithSpecialBulk!.evs.hp -
        survivalWithSpecialBulk!.evs.defense,
    );
  });

  it("keeps both maximum special bulk and a minimum survival spread with reserve physical bulk", () => {
    const specialPressure: PokemonMove = {
      ...flamethrower,
      id: "special-endpoint-pressure",
      name: "Special Endpoint Pressure",
      type: "normal",
      power: 180,
    };
    const specialAttacker: TeamMember = {
      ...attacker,
      moves: [specialPressure],
      baseStats: {
        ...attacker.baseStats!,
        specialAttack: 130,
      },
    };
    const context = createContext(
      "opponent-to-player",
      { ...defender, abilities: ["Blaze"] },
      specialAttacker,
      [tackle],
      [specialPressure],
    );
    context.player.build.evs = {
      ...defaultEvs,
      hp: 32,
      attack: 32,
      defense: 2,
    };
    context.opponent.build.natureId = "modest";
    context.opponent.build.evs = {
      ...defaultEvs,
      hp: 32,
      specialAttack: 32,
      defense: 2,
    };

    const plan = createSetOptimizationPlan(context);
    const specialBulkCandidates = plan.candidates.filter((candidate) =>
      candidate.defenseBenchmarks.some(
        (benchmark) =>
          benchmark.moveId === specialPressure.id &&
          benchmark.relevantStat === "specialDefense" &&
          benchmark.optimizedVsCurrent === "better",
      ),
    );
    const maximumSpecialBulk = specialBulkCandidates.find((candidate) =>
      candidate.profiles.includes("special-bulk-maximum"),
    );
    const survivalWithPhysicalBulk = specialBulkCandidates.find((candidate) =>
      candidate.profiles.includes("special-survival-with-reserve"),
    );

    expect(plan.status).toBe("ready");
    expect(maximumSpecialBulk).toBeDefined();
    expect(maximumSpecialBulk?.evs).toMatchObject({
      hp: CHAMPIONS_MAX_EV_PER_STAT,
      specialDefense: CHAMPIONS_MAX_EV_PER_STAT,
    });
    expect(survivalWithPhysicalBulk).toBeDefined();
    expect(survivalWithPhysicalBulk?.evs.hp).toBe(
      CHAMPIONS_MAX_EV_PER_STAT,
    );
    expect(survivalWithPhysicalBulk!.evs.specialDefense).toBeLessThan(
      CHAMPIONS_MAX_EV_PER_STAT,
    );
    expect(survivalWithPhysicalBulk!.evs.defense).toBeGreaterThan(
      maximumSpecialBulk!.evs.defense,
    );
  });

  it("invests in Defense for Body Press instead of Attack", () => {
    const plan = createSetOptimizationPlan(
      createContext(
        "player-to-opponent",
        { ...attacker, moves: [bodyPress] },
        defender,
        [bodyPress],
      ),
    );

    expect(plan.status).toBe("ready");
    expect(plan.candidates.length).toBeGreaterThan(0);
    expect(
      plan.candidates.some(
        (candidate) =>
          candidate.natureId !== "hardy" &&
          getNatureById(candidate.natureId).up === "defense",
      ),
    ).toBe(true);
    expect(
      plan.candidates.some((candidate) =>
        candidate.offenseBenchmarks.some(
          (benchmark) => benchmark.moveId === bodyPress.id,
        ),
      ),
    ).toBe(true);
  });

  it("invests in Defense against Psyshock despite its Special category", () => {
    const strongPsyshock = { ...psyshock, power: 160 };
    const neutralDefender = {
      ...defender,
      id: "snorlax",
      name: "Snorlax",
      showdownName: "Snorlax",
      types: ["normal"],
    } as TeamMember;
    const plan = createSetOptimizationPlan(
      createContext(
        "opponent-to-player",
        neutralDefender,
        { ...attacker, moves: [strongPsyshock] },
        [tackle],
        [strongPsyshock],
      ),
    );

    expect(plan.status).toBe("ready");
    expect(plan.candidates.length).toBeGreaterThan(0);
    expect(
      plan.candidates.some(
        (candidate) =>
          candidate.natureId !== "hardy" &&
          getNatureById(candidate.natureId).up === "defense",
      ),
    ).toBe(true);
  });

  it("does not tune the user's Attack for Foul Play", () => {
    const plan = createSetOptimizationPlan(
      createContext(
        "player-to-opponent",
        { ...attacker, moves: [foulPlay] },
        defender,
        [foulPlay],
        [earthquake],
      ),
    );

    expect(plan.status).toBe("ready");
    expect(
      plan.candidates.every((candidate) =>
        candidate.offenseBenchmarks.every(
          (benchmark) => benchmark.moveId !== foulPlay.id,
        ),
      ),
    ).toBe(true);
  });

  it("can optimize from the opposite side when the configured side has no attack", () => {
    const plan = createSetOptimizationPlan(
      createContext(
        "player-to-opponent",
        defender,
        attacker,
        [protect],
        [earthquake],
      ),
    );

    expect(plan.status).toBe("ready");
    expect(
      plan.candidates.some((candidate) =>
        candidate.defenseBenchmarks.some(
          (benchmark) =>
            benchmark.moveId === earthquake.id &&
            (benchmark.optimized.possibleKoHits ?? 0) >
              (benchmark.current.possibleKoHits ?? 0),
        ),
      ),
    ).toBe(true);
  });

  it("requires a damaging move on at least one side", () => {
    const plan = createSetOptimizationPlan(
      createContext(
        "player-to-opponent",
        attacker,
        defender,
        [protect],
        [protect],
      ),
    );

    expect(plan).toMatchObject({
      status: "unavailable",
      reason: "missing-damaging-move",
      candidates: [],
    });
  });
});
