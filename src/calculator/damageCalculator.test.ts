import { describe, expect, it } from "vitest";
import type { PokemonMove, StatBlock, TeamMember } from "../types";
import {
  calculateChampionsDamage,
  statPointsToEvs,
  type CalculatorField,
  type CalculatorPokemon,
} from "./damageCalculator";

const emptyEvs: StatBlock = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

const earthquake: PokemonMove = {
  id: "earthquake",
  name: "Earthquake",
  type: "ground",
  category: "Physical",
  power: 100,
  accuracy: 100,
  pp: 10,
  description: "",
  tags: ["Spread: Adjacent"],
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

const moonblast: PokemonMove = {
  id: "moonblast",
  name: "Moonblast",
  type: "fairy",
  category: "Special",
  power: 95,
  accuracy: 100,
  pp: 15,
  description: "",
};

const electroBall: PokemonMove = {
  id: "electro-ball",
  name: "Electro Ball",
  type: "electric",
  category: "Special",
  power: null,
  accuracy: 100,
  pp: 10,
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

const bodySlam: PokemonMove = {
  id: "body-slam",
  name: "Body Slam",
  type: "normal",
  category: "Physical",
  power: 85,
  accuracy: 100,
  pp: 15,
  description: "",
};

const garchomp: TeamMember = {
  id: "garchomp",
  name: "Garchomp",
  showdownId: "garchomp",
  showdownName: "Garchomp",
  types: ["dragon", "ground"],
  roles: [],
  baseStats: {
    hp: 108,
    attack: 130,
    defense: 95,
    specialAttack: 80,
    specialDefense: 85,
    speed: 102,
  },
  abilities: ["Rough Skin"],
  moves: [earthquake],
};

const incineroar: TeamMember = {
  id: "incineroar",
  name: "Incineroar",
  showdownId: "incineroar",
  showdownName: "Incineroar",
  types: ["fire", "dark"],
  roles: [],
  baseStats: {
    hp: 95,
    attack: 115,
    defense: 90,
    specialAttack: 80,
    specialDefense: 90,
    speed: 60,
  },
  abilities: ["Intimidate"],
  moves: [earthquake],
};

const gengar: TeamMember = {
  id: "gengar",
  name: "Gengar",
  showdownId: "gengar",
  showdownName: "Gengar",
  types: ["ghost", "poison"],
  roles: [],
  baseStats: {
    hp: 60,
    attack: 65,
    defense: 60,
    specialAttack: 130,
    specialDefense: 75,
    speed: 110,
  },
  abilities: ["Cursed Body"],
  moves: [bodySlam],
};

const field: CalculatorField = {
  weather: "none",
  terrain: "none",
  room: "none",
  aura: "none",
  gameType: "singles",
  isCritical: false,
  isSpread: false,
  isHelpingHand: false,
  isTailwind: false,
  isFriendGuard: false,
  isPlusMinus: false,
  isWall: false,
};

function createPokemon(
  member: TeamMember,
  options: Partial<CalculatorPokemon> = {},
): CalculatorPokemon {
  return {
    member,
    item: null,
    ability: member.abilities?.[0] ?? "",
    natureId: "hardy",
    evs: emptyEvs,
    boosts: {
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    },
    currentHp: member.baseStats!.hp + 75,
    status: "healthy",
    move: earthquake,
    ...options,
  };
}

describe("Champions damage calculator adapter", () => {
  it("maps Champions stat points to equivalent level 50 EV values", () => {
    expect(statPointsToEvs(0)).toBe(0);
    expect(statPointsToEvs(1)).toBe(4);
    expect(statPointsToEvs(2)).toBe(12);
    expect(statPointsToEvs(32)).toBe(252);
  });

  it("calculates a deterministic 16-roll damage range", () => {
    const result = calculateChampionsDamage(
      createPokemon(garchomp, {
        natureId: "adamant",
        evs: { ...emptyEvs, attack: 32 },
      }),
      createPokemon(incineroar, {
        natureId: "impish",
        evs: { ...emptyEvs, hp: 32, defense: 32 },
        currentHp: 202,
      }),
      field,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }

    expect([result.minDamage, result.maxDamage]).toEqual([146, 174]);
    expect(result.effectiveness).toBe(2);
    expect(result.oneHitKoChance).toBe(0);
    expect(result.koHits).toBe(2);
    expect(result.koChance).toBe(100);
    expect(result.offensivePower).toBe(30_000);
  });

  it("applies the doubles spread modifier only when requested", () => {
    const attacker = createPokemon(garchomp, {
      natureId: "adamant",
      evs: { ...emptyEvs, attack: 32 },
    });
    const defender = createPokemon(incineroar);
    const singleTarget = calculateChampionsDamage(attacker, defender, field);
    const spread = calculateChampionsDamage(attacker, defender, {
      ...field,
      gameType: "doubles",
      isSpread: true,
    });

    expect(singleTarget.status).toBe("ready");
    expect(spread.status).toBe("ready");

    if (singleTarget.status === "ready" && spread.status === "ready") {
      expect(spread.maxDamage).toBeLessThan(singleTarget.maxDamage);
    }
  });

  it("applies critical-hit, weather, item, and ability modifiers", () => {
    const attacker = createPokemon(garchomp, {
      move: flamethrower,
    });
    const defender = createPokemon(incineroar);
    const baseline = calculateChampionsDamage(attacker, defender, field);
    const critical = calculateChampionsDamage(attacker, defender, {
      ...field,
      isCritical: true,
    });
    const rain = calculateChampionsDamage(attacker, defender, {
      ...field,
      weather: "rain",
    });
    const lifeOrb = calculateChampionsDamage(
      {
        ...attacker,
        item: {
          id: "life-orb",
          showdownId: "lifeorb",
          name: "Life Orb",
        },
      },
      defender,
      field,
    );
    const hugePower = calculateChampionsDamage(
      {
        ...createPokemon(garchomp, {
          move: earthquake,
        }),
        ability: "Huge Power",
      },
      defender,
      field,
    );
    const normalAttack = calculateChampionsDamage(
      createPokemon(garchomp, {
        move: earthquake,
      }),
      defender,
      field,
    );

    expect(baseline.status).toBe("ready");
    expect(critical.status).toBe("ready");
    expect(rain.status).toBe("ready");
    expect(lifeOrb.status).toBe("ready");
    expect(hugePower.status).toBe("ready");
    expect(normalAttack.status).toBe("ready");

    if (
      baseline.status === "ready" &&
      critical.status === "ready" &&
      rain.status === "ready" &&
      lifeOrb.status === "ready" &&
      hugePower.status === "ready" &&
      normalAttack.status === "ready"
    ) {
      expect(critical.minDamage).toBeGreaterThan(baseline.minDamage);
      expect(rain.maxDamage).toBeLessThan(baseline.maxDamage);
      expect(lifeOrb.minDamage).toBeGreaterThan(baseline.minDamage);
      expect(hugePower.minDamage).toBeGreaterThan(normalAttack.minDamage);
    }
  });

  it("applies the M-B room, gravity, and aura effects", () => {
    const defender = createPokemon(incineroar);
    const lifeOrbAttacker = createPokemon(garchomp, {
      move: flamethrower,
      item: {
        id: "life-orb",
        showdownId: "lifeorb",
        name: "Life Orb",
      },
    });
    const itemActive = calculateChampionsDamage(
      lifeOrbAttacker,
      defender,
      field,
    );
    const magicRoom = calculateChampionsDamage(lifeOrbAttacker, defender, {
      ...field,
      room: "magic",
    });

    const physicalAttacker = createPokemon(garchomp, { move: bodySlam });
    const unevenDefender = createPokemon({
      ...incineroar,
      baseStats: {
        ...incineroar.baseStats!,
        defense: 150,
        specialDefense: 50,
      },
    });
    const normalDefense = calculateChampionsDamage(
      physicalAttacker,
      unevenDefender,
      field,
    );
    const wonderRoom = calculateChampionsDamage(
      physicalAttacker,
      unevenDefender,
      {
        ...field,
        room: "wonder",
      },
    );

    const levitatingDefender = createPokemon(gengar, {
      ability: "Levitate",
    });
    const groundImmune = calculateChampionsDamage(
      createPokemon(garchomp, { move: earthquake }),
      levitatingDefender,
      field,
    );
    const gravity = calculateChampionsDamage(
      createPokemon(garchomp, { move: earthquake }),
      levitatingDefender,
      {
        ...field,
        room: "gravity",
      },
    );

    const fairyAttacker = createPokemon(garchomp, { move: moonblast });
    const noAura = calculateChampionsDamage(fairyAttacker, defender, field);
    const fairyAura = calculateChampionsDamage(fairyAttacker, defender, {
      ...field,
      aura: "fairy",
    });

    expect(itemActive.status).toBe("ready");
    expect(magicRoom.status).toBe("ready");
    expect(normalDefense.status).toBe("ready");
    expect(wonderRoom.status).toBe("ready");
    expect(groundImmune.status).toBe("ready");
    expect(gravity.status).toBe("ready");
    expect(noAura.status).toBe("ready");
    expect(fairyAura.status).toBe("ready");

    if (
      itemActive.status === "ready" &&
      magicRoom.status === "ready" &&
      normalDefense.status === "ready" &&
      wonderRoom.status === "ready" &&
      groundImmune.status === "ready" &&
      gravity.status === "ready" &&
      noAura.status === "ready" &&
      fairyAura.status === "ready"
    ) {
      expect(magicRoom.maxDamage).toBeLessThan(itemActive.maxDamage);
      expect(wonderRoom.minDamage).toBeGreaterThan(normalDefense.minDamage);
      expect(groundImmune.maxDamage).toBe(0);
      expect(gravity.minDamage).toBeGreaterThan(0);
      expect(gravity.effectiveness).toBe(2);
      expect(fairyAura.minDamage).toBeGreaterThan(noAura.minDamage);
    }
  });

  it("applies the legal M-B ally effects to the correct battle side", () => {
    const defender = createPokemon(incineroar);
    const specialAttacker = createPokemon(garchomp, {
      ability: "Plus",
      move: flamethrower,
    });
    const baseline = calculateChampionsDamage(
      specialAttacker,
      defender,
      field,
    );
    const plusMinus = calculateChampionsDamage(
      specialAttacker,
      defender,
      {
        ...field,
        isPlusMinus: true,
      },
    );
    const friendGuard = calculateChampionsDamage(
      specialAttacker,
      defender,
      {
        ...field,
        gameType: "doubles",
        isFriendGuard: true,
      },
    );
    const noTailwind = calculateChampionsDamage(
      createPokemon(garchomp, { move: electroBall }),
      defender,
      field,
    );
    const tailwind = calculateChampionsDamage(
      createPokemon(garchomp, { move: electroBall }),
      defender,
      {
        ...field,
        isTailwind: true,
      },
    );

    expect(baseline.status).toBe("ready");
    expect(plusMinus.status).toBe("ready");
    expect(friendGuard.status).toBe("ready");
    expect(noTailwind.status).toBe("ready");
    expect(tailwind.status).toBe("ready");

    if (
      baseline.status === "ready" &&
      plusMinus.status === "ready" &&
      friendGuard.status === "ready" &&
      noTailwind.status === "ready" &&
      tailwind.status === "ready"
    ) {
      expect(plusMinus.minDamage).toBeGreaterThan(baseline.minDamage);
      expect(friendGuard.maxDamage).toBeLessThan(baseline.maxDamage);
      expect(tailwind.minDamage).toBeGreaterThan(noTailwind.minDamage);
    }
  });

  it("applies one wall control to both physical and special attacks", () => {
    const defender = createPokemon(incineroar);
    const physicalAttacker = createPokemon(garchomp, { move: earthquake });
    const specialAttacker = createPokemon(garchomp, { move: flamethrower });
    const physicalBaseline = calculateChampionsDamage(
      physicalAttacker,
      defender,
      field,
    );
    const physicalWall = calculateChampionsDamage(
      physicalAttacker,
      defender,
      {
        ...field,
        gameType: "doubles",
        isWall: true,
      },
    );
    const specialBaseline = calculateChampionsDamage(
      specialAttacker,
      defender,
      field,
    );
    const specialWall = calculateChampionsDamage(
      specialAttacker,
      defender,
      {
        ...field,
        gameType: "doubles",
        isWall: true,
      },
    );

    expect(physicalBaseline.status).toBe("ready");
    expect(physicalWall.status).toBe("ready");
    expect(specialBaseline.status).toBe("ready");
    expect(specialWall.status).toBe("ready");

    if (
      physicalBaseline.status === "ready" &&
      physicalWall.status === "ready" &&
      specialBaseline.status === "ready" &&
      specialWall.status === "ready"
    ) {
      expect(physicalWall.maxDamage).toBeLessThan(physicalBaseline.maxDamage);
      expect(specialWall.maxDamage).toBeLessThan(specialBaseline.maxDamage);
    }
  });

  it("reports status moves as unsupported instead of approximating damage", () => {
    expect(
      calculateChampionsDamage(
        createPokemon(garchomp, { move: protect }),
        createPokemon(incineroar),
        field,
      ),
    ).toEqual({
      status: "unsupported",
      reason: "status-move",
    });
  });

  it("reports immunity as zero damage without asking the engine for a KO chance", () => {
    const result = calculateChampionsDamage(
      createPokemon(garchomp, { move: bodySlam }),
      createPokemon(gengar),
      field,
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }

    expect([result.minDamage, result.maxDamage]).toEqual([0, 0]);
    expect(result.effectiveness).toBe(0);
    expect(result.oneHitKoChance).toBe(0);
    expect(result.koHits).toBe(0);
    expect(result.koChance).toBeNull();
  });
});
