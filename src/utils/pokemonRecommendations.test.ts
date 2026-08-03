import { describe, expect, it } from "vitest";
import type { ShowdownDataSnapshot } from "../api/showdownData";
import type { PokemonRecommendationOption } from "./pokemonRecommendations";
import { rankPokemonRecommendationCandidates } from "./pokemonRecommendations";
import type { TeamDiagnosticsResult } from "./teamDiagnostics";

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
});
