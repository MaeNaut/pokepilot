import { describe, expect, it } from "vitest";
import { defaultEvs } from "../data/natures";
import type { PokemonMove, PokemonType, TeamMember } from "../types";
import type { ShowdownDataSnapshot } from "../api/showdownData";
import type { CopilotRecommendationCandidateSnapshot } from "../utils/pokemonRecommendations";
import { selectMetaThreatReplacementCandidates } from "../utils/metaThreatRecommendations";
import {
  createCalculatorBattleState,
  getCalculatorMaxHp,
} from "./calculatorViewModel";
import type { CalculatorAnalysisSide } from "./setOptimizer/types";
import {
  createMetaThreatAnalysisPlan,
  selectMetaThreatCandidates,
  type MetaThreatAnalysisInput,
  type MetaThreatCandidate,
} from "./metaThreatAnalysis";

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
const sacredSword: PokemonMove = {
  ...tackle,
  id: "sacredsword",
  name: "Sacred Sword",
  type: "fighting",
  power: 90,
  description: "Ignores the target's stat stage changes.",
};

function createMember({
  id,
  name = id,
  showdownName = name,
  types = ["normal"],
  ability = "Pressure",
  moves = [tackle],
  baseStats = {
    hp: 80,
    attack: 100,
    defense: 100,
    specialAttack: 100,
    specialDefense: 100,
    speed: 80,
  },
}: {
  id: string;
  name?: string;
  showdownName?: string;
  types?: PokemonType[];
  ability?: string;
  moves?: PokemonMove[];
  baseStats?: TeamMember["baseStats"];
}): TeamMember {
  return {
    id,
    name,
    showdownName,
    types,
    roles: [],
    abilities: [ability],
    moves,
    baseStats,
  };
}

function createSide(
  member: TeamMember,
  moves: PokemonMove[],
  usageOnly = false,
): CalculatorAnalysisSide {
  const build = {
    item: null,
    ability: member.abilities?.[0] ?? "",
    natureId: "hardy",
    evs: { ...defaultEvs },
    moveIds: moves.map((move) => move.id),
  };
  const maxHp = getCalculatorMaxHp(member, build);
  return {
    member,
    build,
    battle: createCalculatorBattleState(maxHp),
    moves: usageOnly ? [] : moves,
    ...(usageOnly ? { usageMoves: moves } : {}),
    maxHp,
  };
}

function createCandidate(
  usageRank: number,
  member: TeamMember,
  moves = member.moves ?? [],
): MetaThreatCandidate {
  return {
    usageRank,
    sourceMonth: "2026-08",
    cutoff: 1630,
    opponent: createSide(member, moves, true),
  };
}

describe("meta threat analysis", () => {
  it("keeps broad usage coverage and adds a lower-usage team-specific threat", () => {
    const grassMember = createMember({
      id: "rillaboom",
      name: "Rillaboom",
      showdownName: "Rillaboom",
      types: ["grass"],
    });
    const roster = [{ ...createSide(grassMember, [tackle]), slotIndex: 0 }];
    const neutralCandidates = Array.from({ length: 40 }, (_, index) =>
      createCandidate(
        index + 1,
        createMember({ id: `candidate-${index + 1}` }),
      ),
    );
    const fireMove: PokemonMove = {
      ...tackle,
      id: "flamethrower",
      name: "Flamethrower",
      type: "fire",
      category: "Special",
      power: 90,
    };
    const specialist = createCandidate(
      41,
      createMember({
        id: "fire-specialist",
        types: ["fire"],
        moves: [fireMove],
      }),
      [fireMove],
    );
    const input: MetaThreatAnalysisInput = {
      battleFormat: "doubles",
      roster,
      candidates: [...neutralCandidates, specialist],
    };

    const selected = selectMetaThreatCandidates(input);

    expect(selected).toHaveLength(40);
    expect(selected.slice(0, 30).map(({ usageRank }) => usageRank)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(selected.some(({ usageRank }) => usageRank === 41)).toBe(true);
  });

  it("carries Stamina sequences into the general threat shortlist", () => {
    const aegislash = createMember({
      id: "aegislash-shield",
      name: "Aegislash",
      showdownName: "Aegislash-Shield",
      types: ["steel", "ghost"],
      ability: "Stance Change",
      moves: [sacredSword],
      baseStats: {
        hp: 60,
        attack: 50,
        defense: 140,
        specialAttack: 50,
        specialDefense: 140,
        speed: 60,
      },
    });
    const archaludon = createMember({
      id: "archaludon",
      name: "Archaludon",
      showdownName: "Archaludon",
      types: ["steel", "dragon"],
      ability: "Stamina",
      moves: [tackle],
      baseStats: {
        hp: 90,
        attack: 105,
        defense: 130,
        specialAttack: 125,
        specialDefense: 65,
        speed: 85,
      },
    });
    const roster = [{ ...createSide(aegislash, [sacredSword]), slotIndex: 0 }];
    const input: MetaThreatAnalysisInput = {
      battleFormat: "doubles",
      roster,
      candidates: [createCandidate(1, archaludon, [tackle])],
    };

    const plan = createMetaThreatAnalysisPlan(input);

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.threats[0].matchup.members[0].offenseBenchmarks[0]).toMatchObject({
      moveId: "sacredsword",
      persistentSequence: {
        triggerAbilityId: "stamina",
        boostAffectedDamage: false,
      },
    });
  });

  it("keeps only usage-backed replacements that verify against a structural threat", () => {
    const flamethrower: PokemonMove = {
      ...tackle,
      id: "flamethrower",
      name: "Flamethrower",
      type: "fire",
      category: "Special",
      power: 90,
    };
    const hydroPump: PokemonMove = {
      ...tackle,
      id: "hydropump",
      name: "Hydro Pump",
      type: "water",
      category: "Special",
      power: 200,
    };
    const rosterMember = createMember({
      id: "grass-roster",
      types: ["grass"],
      baseStats: {
        hp: 60,
        attack: 60,
        defense: 50,
        specialAttack: 60,
        specialDefense: 50,
        speed: 40,
      },
    });
    const threatMember = createMember({
      id: "fire-threat",
      types: ["fire"],
      moves: [flamethrower],
      baseStats: {
        hp: 80,
        attack: 70,
        defense: 80,
        specialAttack: 150,
        specialDefense: 80,
        speed: 100,
      },
    });
    const plan = createMetaThreatAnalysisPlan({
      battleFormat: "singles",
      roster: [{ ...createSide(rosterMember, [tackle]), slotIndex: 0 }],
      candidates: [createCandidate(1, threatMember, [flamethrower])],
    });
    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.threats[0].riskSignals).toMatchObject({
      answerCount: 0,
      checkCount: 0,
    });

    const candidate: CopilotRecommendationCandidateSnapshot = {
      pokemonId: "water-answer",
      displayName: "Water Answer",
      target: {
        mode: "replacement",
        slotIndex: 0,
        currentPokemonId: rosterMember.id,
        currentDisplayName: rosterMember.name,
        currentRoleIds: [],
        currentSetterConceptIds: [],
        currentAceConceptIds: [],
        currentResponsibilityIds: [],
        currentSupportElements: [],
        megaOptionPokemonId: null,
        allySupportLinks: [],
      },
      types: ["water"],
      typeDisplayNames: ["Water"],
      abilities: [{ id: "torrent", displayName: "Torrent" }],
      baseStats: {
        hp: 200,
        attack: 60,
        defense: 200,
        specialAttack: 200,
        specialDefense: 200,
        speed: 200,
      },
      speedTier: "very-fast",
      requiresMegaStone: false,
      usageRank: 20,
      commonSet: {
        ability: "Torrent",
        item: null,
        nature: "Modest",
        moves: [{
          id: hydroPump.id,
          displayName: hydroPump.name,
          type: hydroPump.type,
          category: "Special",
          power: hydroPump.power,
        }],
      },
      responsibilityIds: [],
      fit: {
        weakTo: ["electric", "grass"],
        resistsTeamThreats: ["fire"],
        amplifiesTeamThreats: [],
        addsUnansweredWeaknesses: [],
        coversTypes: ["fire"],
        roleContributions: [],
        roleRedundancies: [],
        conceptSynergies: [],
        conflicts: [],
      },
    };
    const showdownData: ShowdownDataSnapshot = {
      speciesById: {
        wateranswer: {
          id: "water-answer",
          name: "Water Answer",
          types: ["water"],
          baseStats: candidate.baseStats!,
          abilities: ["Torrent"],
        },
      },
      movesById: { [hydroPump.id]: hydroPump },
    };
    const replacements = selectMetaThreatReplacementCandidates({
      plan,
      candidates: [candidate],
      usageSets: [{
        pokemonId: candidate.pokemonId,
        pokemonName: candidate.displayName,
        sourceMonth: "2026-08",
        cutoff: 1630,
        ability: "Torrent",
        nature: "modest",
        evs: { specialAttack: 32, speed: 32 },
        moveIds: [hydroPump.id],
      }],
      showdownData,
      itemIndex: [],
    });

    expect(replacements).toHaveLength(1);
    expect(replacements[0]).toMatchObject({
      candidate: { pokemonId: "water-answer" },
      threatPokemonId: "fire-threat",
      member: { responseTier: "answer" },
    });
  });
});
