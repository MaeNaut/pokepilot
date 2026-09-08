import { describe, expect, it } from "vitest";
import type { ShowdownDataSnapshot } from "../api/showdownData";
import type { PokemonIndexEntry, PokemonMove, TeamMember } from "../types";
import { createEmptyBuildState } from "./teamBuildState";
import {
  createPokemonRecommendationTargets,
  rankPokemonRecommendationCandidates,
  rankUniversalPokemonRecommendationCandidates,
  type PokemonRecommendationOption,
} from "./pokemonRecommendations";
import { analyzeTeam, type TeamDiagnosticsResult } from "./teamDiagnostics";

const diagnostics: TeamDiagnosticsResult = {
  filledSlots: 2,
  defensiveMatchups: [
    {
      type: "ground",
      weakCount: 2,
      fourTimesWeakCount: 0,
      resistCount: 0,
      immuneCount: 0,
    },
  ],
  attackingTypes: [],
  coveredDefendingTypes: [],
  uncoveredDefendingTypes: ["water"],
  roles: [],
  concepts: [],
  alerts: [],
};

const options: PokemonRecommendationOption[] = [
  {
    id: "scrafty",
    speciesKey: "scrafty",
    displayName: "Scrafty",
    types: ["dark", "fighting"],
    typeDisplayNames: ["Dark", "Fighting"],
    abilities: [{ id: "intimidate", displayName: "Intimidate" }],
    legalMoveIds: ["closecombat"],
  },
  {
    id: "rotom-wash",
    speciesKey: "rotom",
    displayName: "Rotom Wash",
    types: ["electric", "water"],
    typeDisplayNames: ["Electric", "Water"],
    abilities: [{ id: "levitate", displayName: "Levitate" }],
    legalMoveIds: ["thunderbolt", "hydropump"],
  },
  {
    id: "gastrodon",
    speciesKey: "gastrodon",
    displayName: "Gastrodon",
    types: ["water", "ground"],
    typeDisplayNames: ["Water", "Ground"],
    abilities: [{ id: "stormdrain", displayName: "Storm Drain" }],
    legalMoveIds: ["earthpower"],
  },
];

const showdownData: ShowdownDataSnapshot = {
  speciesById: {
    rotomwash: {
      id: "rotomwash",
      name: "Rotom-Wash",
      types: ["electric", "water"],
      abilities: ["Levitate"],
      baseStats: {
        hp: 50,
        attack: 65,
        defense: 107,
        specialAttack: 105,
        specialDefense: 107,
        speed: 86,
      },
    },
  },
  movesById: {
    closecombat: {
      id: "closecombat",
      name: "Close Combat",
      type: "fighting" as const,
      category: "Physical",
      power: 120,
      accuracy: 100,
      pp: 5,
      description: "",
    },
    thunderbolt: {
      id: "thunderbolt",
      name: "Thunderbolt",
      type: "electric" as const,
      category: "Special",
      power: 90,
      accuracy: 100,
      pp: 15,
      description: "",
    },
    ironhead: {
      id: "ironhead",
      name: "Iron Head",
      type: "steel" as const,
      category: "Physical",
      power: 80,
      accuracy: 100,
      pp: 15,
      description: "",
    },
  },
};

describe("rankPokemonRecommendationCandidates", () => {
  it("protects a supported Mega axis when evaluating full-team replacements", () => {
    const createMove = (
      id: string,
      category: "physical" | "status",
    ): PokemonMove => ({
      id,
      name: id,
      type: category === "physical" ? "steel" : "fighting",
      category,
      power: category === "physical" ? 80 : null,
      accuracy: 100,
      pp: 10,
      description: "",
    });
    const createMember = (
      id: string,
      moves: PokemonMove[],
    ): TeamMember => ({
      id,
      name: id,
      types: ["normal"],
      roles: [],
      abilities: ["intimidate"],
      moves,
      baseStats: {
        hp: 80,
        attack: 100,
        defense: 80,
        specialAttack: 60,
        specialDefense: 80,
        speed: 70,
      },
    });
    const coaching = createMove("coaching", "status");
    const ironHead = createMove("ironhead", "physical");
    const team = [
      createMember("scrafty", [coaching]),
      createMember("mawile", [ironHead]),
      createMember("filler-2", [ironHead]),
      createMember("filler-3", [ironHead]),
      createMember("filler-4", [ironHead]),
      createMember("filler-5", [ironHead]),
    ];
    const buildState = createEmptyBuildState();
    buildState.moveIdsBySlot = {
      0: ["coaching"],
      1: ["ironhead"],
      2: ["ironhead"],
      3: ["ironhead"],
      4: ["ironhead"],
      5: ["ironhead"],
    };
    buildState.itemBySlot = {
      1: {
        id: "mawilite",
        name: "Mawilite",
        category: "Mega Stones",
      },
    };
    const pokemonIndex: PokemonIndexEntry[] = [
      {
        name: "mawile",
        showdownId: "mawile",
        displayName: "Mawile",
        speciesKey: "mawile",
        sortNumber: 303,
        types: ["steel", "fairy"],
        abilities: ["intimidate"],
        formKind: "base",
        isSelectorOption: true,
      },
      {
        name: "mawile-mega",
        showdownId: "mawilemega",
        displayName: "Mega Mawile",
        speciesKey: "mawile",
        sortNumber: 303,
        types: ["steel", "fairy"],
        abilities: ["hugepower"],
        formKind: "mega",
        isSelectorOption: true,
      },
    ];
    const teamDiagnostics = analyzeTeam(team, buildState, team);
    const targets = createPokemonRecommendationTargets({
      team,
      selectedSlot: 0,
      buildState,
      diagnostics: teamDiagnostics,
      pokemonIndex,
      getCurrentPokemonDisplayName: (member) => member.name,
    });
    const mawileTarget = targets.find((target) => target.slotIndex === 1);
    const scraftyTarget = targets.find((target) => target.slotIndex === 0);
    const fillerTarget = targets.find((target) => target.slotIndex === 2);

    expect(mawileTarget).toMatchObject({
      megaOptionPokemonId: "mawile-mega",
      allySupportLinks: [
        {
          sourceSlotIndex: 0,
          sourceKind: "move",
          sourceId: "coaching",
          responsibilityId: "ally-damage-amplification",
        },
      ],
    });
    expect(mawileTarget!.replacementLossPenalty).toBeGreaterThan(
      fillerTarget!.replacementLossPenalty ?? 0,
    );
    expect(scraftyTarget).toMatchObject({
      currentSupportElements: [
        {
          kind: "move",
          id: "coaching",
          responsibilityIds: ["ally-damage-amplification"],
        },
      ],
    });
    expect(scraftyTarget!.replacementLossPenalty).toBeGreaterThan(
      fillerTarget!.replacementLossPenalty ?? 0,
    );
  });

  it("keeps an addition candidate tied to its actual empty slot", () => {
    const result = rankUniversalPokemonRecommendationCandidates({
      options,
      targets: [
        {
          mode: "addition",
          slotIndex: 4,
          currentPokemonId: null,
          currentDisplayName: null,
          currentSpeciesKey: null,
          filters: { types: [], ability: null, moves: [] },
          occupiedSpeciesKeys: new Set(["scrafty"]),
          diagnostics,
          existingMegaOptionCount: 0,
        },
      ],
      usageIds: ["scrafty", "rotom-wash", "gastrodon"],
      showdownData,
    });

    expect(result[0].target).toMatchObject({
      mode: "addition",
      slotIndex: 4,
      currentPokemonId: null,
      currentDisplayName: null,
    });
  });

  it("assigns a full-team candidate to the replacement where it improves fit most", () => {
    const neutralDiagnostics: TeamDiagnosticsResult = {
      ...diagnostics,
      defensiveMatchups: [],
      uncoveredDefendingTypes: [],
    };
    const result = rankUniversalPokemonRecommendationCandidates({
      options,
      targets: [
        {
          mode: "replacement",
          slotIndex: 0,
          currentPokemonId: "scrafty",
          currentDisplayName: "Scrafty",
          currentSpeciesKey: "scrafty",
          filters: { types: [], ability: null, moves: [] },
          occupiedSpeciesKeys: new Set(["gastrodon"]),
          diagnostics,
          existingMegaOptionCount: 0,
        },
        {
          mode: "replacement",
          slotIndex: 1,
          currentPokemonId: "gastrodon",
          currentDisplayName: "Gastrodon",
          currentSpeciesKey: "gastrodon",
          filters: { types: [], ability: null, moves: [] },
          occupiedSpeciesKeys: new Set(["scrafty"]),
          diagnostics: neutralDiagnostics,
          existingMegaOptionCount: 0,
        },
      ],
      usageIds: ["scrafty", "rotom-wash", "gastrodon"],
      showdownData,
    });
    const rotom = result.find((candidate) => candidate.pokemonId === "rotom-wash");

    expect(rotom?.target).toMatchObject({
      mode: "replacement",
      slotIndex: 0,
      currentPokemonId: "scrafty",
      currentDisplayName: "Scrafty",
    });
    expect(result.some((candidate) => candidate.pokemonId === "scrafty")).toBe(false);
    expect(result.some((candidate) => candidate.pokemonId === "gastrodon")).toBe(false);
  });

  it("prioritizes concrete defensive and coverage fit over adjacent usage ranks", () => {
    const result = rankPokemonRecommendationCandidates({
      options,
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics,
      usageIds: ["scrafty", "rotom-wash", "gastrodon"],
      showdownData,
    });

    expect(result[0]).toMatchObject({
      pokemonId: "rotom-wash",
      usageRank: 2,
      fit: {
        resistsTeamThreats: ["ground"],
        coversTypes: ["water"],
      },
    });
  });

  it("enforces saved filters and excludes occupied species", () => {
    const result = rankPokemonRecommendationCandidates({
      options,
      filters: {
        types: ["water"],
        ability: null,
        moves: [{ id: "thunderbolt", name: "Thunderbolt" }],
      },
      occupiedSpeciesKeys: new Set(["gastrodon"]),
      diagnostics,
      usageIds: ["scrafty", "gastrodon", "rotom-wash"],
      showdownData,
    });

    expect(result.map((candidate) => candidate.pokemonId)).toEqual([
      "rotom-wash",
    ]);
  });

  it("bounds verbose ability effects before creating the API snapshot", () => {
    const verboseEffect = "x".repeat(1_200);
    const result = rankPokemonRecommendationCandidates({
      options: [
        {
          ...options[0],
          abilities: [
            {
              id: "intimidate",
              displayName: "Intimidate",
              effect: verboseEffect,
            },
          ],
        },
      ],
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics,
      usageIds: ["scrafty"],
      showdownData,
    });

    expect(result[0].abilities[0]).toMatchObject({
      id: "intimidate",
      displayName: "Intimidate",
    });
    expect(result[0].abilities[0].effect).toHaveLength(320);
    expect(result[0].abilities[0].effect?.endsWith("...")).toBe(true);
  });

  it("adds exact defensive weaknesses and mechanic-derived responsibilities", () => {
    const result = rankPokemonRecommendationCandidates({
      options: [
        {
          id: "farigiraf",
          speciesKey: "farigiraf",
          displayName: "Farigiraf",
          types: ["normal", "psychic"],
          typeDisplayNames: ["Normal", "Psychic"],
          abilities: [
            {
              id: "armortail",
              displayName: "Armor Tail",
              effect:
                "Priority moves used by opposing Pokemon targeting this Pokemon or its allies are prevented from having an effect.",
            },
          ],
          legalMoveIds: ["helpinghand", "trickroom"],
        },
      ],
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics,
      usageIds: ["farigiraf"],
      usageSets: [
        {
          pokemonId: "farigiraf",
          pokemonName: "Farigiraf",
          sourceMonth: "2026-07",
          cutoff: 1500,
          ability: "Armor Tail",
          nature: "Quiet",
          evs: { hp: 252, specialAttack: 252 },
          moveIds: ["helpinghand", "trickroom"],
        },
      ],
      showdownData: {
        speciesById: {
          farigiraf: {
            id: "farigiraf",
            name: "Farigiraf",
            types: ["normal", "psychic"],
            abilities: ["Armor Tail"],
            baseStats: {
              hp: 120,
              attack: 90,
              defense: 70,
              specialAttack: 110,
              specialDefense: 70,
              speed: 60,
            },
          },
        },
        movesById: {
          helpinghand: {
            id: "helpinghand",
            name: "Helping Hand",
            type: "normal",
            category: "Status",
            power: null,
            accuracy: 100,
            pp: 20,
            description: "The target's next attack has 1.5x power.",
          },
          trickroom: {
            id: "trickroom",
            name: "Trick Room",
            type: "psychic",
            category: "Status",
            power: null,
            accuracy: 100,
            pp: 5,
            description: "For 5 turns, slower Pokemon move first.",
          },
        },
      },
    });

    expect(result[0]).toMatchObject({
      responsibilityIds: [
        "priority-denial",
        "ally-damage-amplification",
        "turn-order-control",
      ],
      fit: {
        weakTo: expect.arrayContaining(["bug", "dark"]),
      },
    });
  });

  it("keeps a lower-usage defensive specialist in a compact diversified shortlist", () => {
    const neutralOptions = Array.from({ length: 19 }, (_, index) => ({
      id: `neutral-${index + 1}`,
      speciesKey: `neutral-${index + 1}`,
      displayName: `Neutral ${index + 1}`,
      types: ["normal" as const],
      typeDisplayNames: ["Normal"],
      abilities: [],
      legalMoveIds: [],
    }));
    const nicheOption: PokemonRecommendationOption = {
      id: "niche-flyer",
      speciesKey: "niche-flyer",
      displayName: "Niche Flyer",
      types: ["flying"],
      typeDisplayNames: ["Flying"],
      abilities: [],
      legalMoveIds: [],
    };
    const allOptions = [...neutralOptions, nicheOption];

    const result = rankPokemonRecommendationCandidates({
      options: allOptions,
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics,
      usageIds: allOptions.map((option) => option.id),
      showdownData,
      limit: 12,
    });

    expect(result).toHaveLength(12);
    expect(result).toContainEqual(
      expect.objectContaining({
        pokemonId: "niche-flyer",
        usageRank: 20,
        fit: expect.objectContaining({ resistsTeamThreats: ["ground"] }),
      }),
    );
  });

  it("describes common-set, speed-mode, role, and Mega tradeoffs without species rules", () => {
    const trickRoomDiagnostics: TeamDiagnosticsResult = {
      ...diagnostics,
      roles: [
        {
          id: "physical-attacker",
          label: "Physical Attacker",
          description: "",
          slotIndexes: [0, 1],
        },
      ],
      concepts: [
        {
          id: "trick-room",
          label: "Trick Room",
          status: "complete",
          setterSlots: [0],
          aceSlots: [1],
          dependentAceSlots: [1],
          independentAttackerSlots: [],
          hasIndependentAttacker: false,
        },
      ],
    };
    const result = rankPokemonRecommendationCandidates({
      options: [
        {
          id: "slow-mega",
          speciesKey: "slow-mon",
          displayName: "Slow Mega",
          types: ["steel"],
          typeDisplayNames: ["Steel"],
          abilities: [{ id: "hugepower", displayName: "Huge Power" }],
          legalMoveIds: ["closecombat"],
          isMegaForm: true,
        },
      ],
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics: trickRoomDiagnostics,
      usageIds: ["slow-mega"],
      usageSets: [
        {
          pokemonId: "slow-mega",
          pokemonName: "Slow Mega",
          sourceMonth: "2026-07",
          cutoff: 1500,
          ability: "Huge Power",
          itemName: "Slowmonite",
          nature: "Brave",
          evs: { hp: 252, attack: 252, speed: 0 },
          moveIds: ["closecombat", "ironhead"],
        },
      ],
      showdownData: {
        ...showdownData,
        speciesById: {
          slowmega: {
            id: "slowmega",
            name: "Slow Mega",
            types: ["steel"],
            abilities: ["Huge Power"],
            baseStats: {
              hp: 90,
              attack: 140,
              defense: 110,
              specialAttack: 50,
              specialDefense: 90,
              speed: 45,
            },
          },
        },
      },
      existingMegaOptionCount: 2,
    });

    expect(result[0]).toMatchObject({
      baseStats: { speed: 45 },
      speedTier: "very-slow",
      requiresMegaStone: true,
      commonSet: {
        ability: "Huge Power",
        item: "Slowmonite",
        nature: "Brave",
        moves: [
          { id: "closecombat", category: "Physical" },
          { id: "ironhead", category: "Physical" },
        ],
      },
      fit: {
        roleRedundancies: ["physical-attacker"],
        conceptSynergies: ["trick-room"],
        conflicts: ["would-be-third-mega-option"],
      },
    });
  });

  it("marks an ability tied to a different active weather as a conflict", () => {
    const sandDiagnostics: TeamDiagnosticsResult = {
      ...diagnostics,
      concepts: [
        {
          id: "sand",
          label: "Sand",
          status: "setup-only",
          setterSlots: [0],
          aceSlots: [],
          dependentAceSlots: [],
          independentAttackerSlots: [],
          hasIndependentAttacker: false,
        },
      ],
    };
    const result = rankPokemonRecommendationCandidates({
      options: [
        {
          id: "charizard",
          speciesKey: "charizard",
          displayName: "Charizard",
          types: ["fire", "flying"],
          typeDisplayNames: ["Fire", "Flying"],
          abilities: [{ id: "solar-power", displayName: "Solar Power" }],
          legalMoveIds: [],
        },
      ],
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics: sandDiagnostics,
      usageIds: ["charizard"],
      usageSets: [
        {
          pokemonId: "charizard",
          pokemonName: "Charizard",
          sourceMonth: "2026-07",
          cutoff: 1500,
          ability: "Solar Power",
          nature: "Timid",
          evs: { specialAttack: 252, speed: 252 },
          moveIds: [],
        },
      ],
      showdownData,
    });

    expect(result[0].fit).toMatchObject({
      conceptSynergies: [],
      conflicts: ["common-ability-benefits-from-sun-not-active-sand"],
    });
  });

  it("ranks a weather-conflicting candidate below a compatible alternative", () => {
    const sandDiagnostics: TeamDiagnosticsResult = {
      ...diagnostics,
      defensiveMatchups: [],
      uncoveredDefendingTypes: [],
      concepts: [
        {
          id: "sand",
          label: "Sand",
          status: "setup-only",
          setterSlots: [0],
          aceSlots: [],
          dependentAceSlots: [],
          independentAttackerSlots: [],
          hasIndependentAttacker: false,
        },
      ],
    };
    const result = rankPokemonRecommendationCandidates({
      options: [
        {
          id: "pelipper",
          speciesKey: "pelipper",
          displayName: "Pelipper",
          types: ["water", "flying"],
          typeDisplayNames: ["Water", "Flying"],
          abilities: [{ id: "drizzle", displayName: "Drizzle" }],
          legalMoveIds: [],
        },
        {
          id: "corviknight",
          speciesKey: "corviknight",
          displayName: "Corviknight",
          types: ["flying", "steel"],
          typeDisplayNames: ["Flying", "Steel"],
          abilities: [{ id: "pressure", displayName: "Pressure" }],
          legalMoveIds: [],
        },
      ],
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics: sandDiagnostics,
      usageIds: ["pelipper", "corviknight"],
      showdownData,
    });

    expect(result.map((candidate) => candidate.pokemonId)).toEqual([
      "corviknight",
      "pelipper",
    ]);
  });

  it("reserves broad usage coverage while retaining a lower-usage fit candidate", () => {
    const broadOptions = Array.from({ length: 40 }, (_, index) => ({
      id: `candidate-${index + 1}`,
      speciesKey: `candidate-${index + 1}`,
      displayName: `Candidate ${index + 1}`,
      types: [index === 39 ? ("flying" as const) : ("normal" as const)],
      typeDisplayNames: index === 39 ? ["Flying"] : ["Normal"],
      abilities: [],
      legalMoveIds: [],
    }));
    const result = rankPokemonRecommendationCandidates({
      options: broadOptions,
      filters: { types: [], ability: null, moves: [] },
      occupiedSpeciesKeys: new Set(),
      diagnostics: {
        ...diagnostics,
        defensiveMatchups: [
          {
            type: "ground",
            weakCount: 3,
            fourTimesWeakCount: 0,
            resistCount: 0,
            immuneCount: 0,
          },
        ],
      },
      usageIds: broadOptions.map((option) => option.id),
      showdownData,
      limit: 10,
    });

    expect(result).toHaveLength(10);
    expect(result.map((candidate) => candidate.pokemonId)).toEqual(
      expect.arrayContaining([
        "candidate-8",
        "candidate-40",
      ]),
    );
  });
});
