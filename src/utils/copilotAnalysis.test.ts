import { describe, expect, it } from "vitest";
import type { TeamBuildState } from "./teamBuildState";
import type { PokemonMove, TeamMember } from "../types";
import type { TeamDiagnosticsResult } from "./teamDiagnostics";
import type { TeamValidityResult } from "./teamValidity";
import {
  createCopilotAnalysisRequest,
  createLocalCopilotAnalysis,
  getCopilotRequestFingerprint,
} from "./copilotAnalysis";

const closeCombat: PokemonMove = {
  id: "close-combat",
  name: "Close Combat",
  type: "fighting",
  category: "physical",
  power: 120,
  accuracy: 100,
  pp: 5,
  description: "",
};

const member: TeamMember = {
  id: "test-pokemon",
  name: "Test Pokemon",
  types: ["fighting"],
  roles: [],
  abilities: ["Intimidate"],
  moves: [closeCombat],
};

const buildState: TeamBuildState = {
  itemBySlot: { 0: { id: "sitrus-berry", name: "Sitrus Berry" } },
  abilityBySlot: { 0: "Intimidate" },
  natureBySlot: { 0: "adamant" },
  evsBySlot: {
    0: {
      hp: 32,
      attack: 32,
      defense: 2,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    },
  },
  moveIdsBySlot: { 0: ["close-combat", "", "", ""] },
  preMegaPokemonBySlot: {},
  candidateFiltersBySlot: {},
};

const diagnostics: TeamDiagnosticsResult = {
  filledSlots: 1,
  defensiveMatchups: [],
  attackingTypes: ["fighting"],
  coveredDefendingTypes: ["normal", "ice", "rock", "dark", "steel"],
  uncoveredDefendingTypes: ["ghost"],
  roles: [
    {
      id: "physical-attacker",
      label: "Physical Attacker",
      description: "",
      slotIndexes: [0],
    },
    {
      id: "special-attacker",
      label: "Special Attacker",
      description: "",
      slotIndexes: [],
    },
    {
      id: "physical-wall",
      label: "Physical Wall",
      description: "",
      slotIndexes: [],
    },
    {
      id: "special-wall",
      label: "Special Wall",
      description: "",
      slotIndexes: [],
    },
    {
      id: "supporter",
      label: "Supporter",
      description: "",
      slotIndexes: [],
    },
    {
      id: "setter",
      label: "Setter",
      description: "",
      slotIndexes: [],
    },
  ],
  concepts: [],
  alerts: [
    {
      id: "open-slots",
      tone: "info",
      message: "5 team slots are still open.",
    },
  ],
};

const validity: TeamValidityResult = {
  status: "valid",
  slotResults: [
    {
      slotIndex: 0,
      status: "valid",
      issues: [],
    },
  ],
  teamIssues: [],
  errorCount: 0,
  unavailableCount: 0,
};

describe("Copilot analysis", () => {
  it("builds a compact, versioned request from editor state", () => {
    const request = createCopilotAnalysisRequest({
      scope: "pokemon",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });

    expect(request).toMatchObject({
      version: 2,
      scope: "pokemon",
      battleFormat: "doubles",
      teamName: "Test Team",
      selectedSlot: 0,
      diagnostics: {
        filledSlots: 1,
        coverageCount: 5,
        offensiveProfile: {
          physicalMoveCount: 1,
          specialMoveCount: 0,
          spreadMoveCount: 0,
          physicalSetSlots: [0],
          specialSetSlots: [],
          spreadSetSlots: [],
        },
        validity: { status: "valid" },
      },
    });
    expect(request.sets[0]).toMatchObject({
      pokemonId: "test-pokemon",
      item: "Sitrus Berry",
      ability: "Intimidate",
      nature: "Adamant",
      evTotal: 66,
      roleIds: ["physical-attacker"],
      moves: [
        {
          id: "close-combat",
          name: "Close Combat",
          category: "physical",
          spreadTarget: null,
        },
      ],
      defensiveProfile: {
        weaknesses: [
          { type: "flying", multiplier: 2 },
          { type: "psychic", multiplier: 2 },
          { type: "fairy", multiplier: 2 },
        ],
        resistances: [
          { type: "bug", multiplier: 0.5 },
          { type: "rock", multiplier: 0.5 },
          { type: "dark", multiplier: 0.5 },
        ],
        immunities: [],
      },
      offensiveProfile: {
        physicalMoveIds: ["close-combat"],
        specialMoveIds: [],
        statusMoveIds: [],
        spreadMoveIds: [],
      },
    });
  });

  it("summarizes mixed damage sources, spread moves, and ability immunities", () => {
    const thunderbolt: PokemonMove = {
      id: "thunderbolt",
      name: "Thunderbolt",
      type: "electric",
      category: "Special",
      power: 90,
      accuracy: 100,
      pp: 15,
      description: "",
    };
    const rockSlide: PokemonMove = {
      id: "rock-slide",
      name: "Rock Slide",
      type: "rock",
      category: "Physical",
      power: 75,
      accuracy: 90,
      pp: 10,
      description: "",
      tags: ["Spread: Foes"],
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
    const mixedMember: TeamMember = {
      ...member,
      id: "mixed-pokemon",
      name: "Mixed Pokemon",
      types: ["water"],
      abilities: ["Lightning Rod"],
      moves: [thunderbolt, rockSlide, protect],
    };
    const mixedBuildState: TeamBuildState = {
      ...buildState,
      abilityBySlot: { 0: "Lightning Rod" },
      moveIdsBySlot: {
        0: ["thunderbolt", "rock-slide", "protect", ""],
      },
    };
    const request = createCopilotAnalysisRequest({
      scope: "team",
      teamName: "Mixed Team",
      team: [mixedMember, null, null, null, null, null],
      selectedSlot: 0,
      buildState: mixedBuildState,
      diagnostics,
      validity,
    });

    expect(request.sets[0]).toMatchObject({
      moves: [
        { id: "thunderbolt", category: "special", spreadTarget: null },
        { id: "rock-slide", category: "physical", spreadTarget: "foes" },
        { id: "protect", category: "status", spreadTarget: null },
      ],
      defensiveProfile: {
        immunities: [
          {
            type: "electric",
            cause: "ability",
            ability: "Lightning Rod",
          },
        ],
      },
      offensiveProfile: {
        physicalMoveIds: ["rock-slide"],
        specialMoveIds: ["thunderbolt"],
        statusMoveIds: ["protect"],
        spreadMoveIds: ["rock-slide"],
      },
    });
    expect(request.diagnostics.offensiveProfile).toEqual({
      physicalMoveCount: 1,
      specialMoveCount: 1,
      spreadMoveCount: 1,
      physicalSetSlots: [0],
      specialSetSlots: [0],
      spreadSetSlots: [0],
    });
  });

  it("turns team diagnostics into prioritized structured guidance", () => {
    const request = createCopilotAnalysisRequest({
      scope: "team",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });
    const response = createLocalCopilotAnalysis(request);

    expect(response).toMatchObject({
      version: 1,
      source: "local",
      scope: "team",
      title: "Test Team",
    });
    expect(response.summary).toContain("1/6 active sets");
    expect(response.recommendations[0]).toMatchObject({
      id: "fill-team",
      priority: "medium",
    });
  });

  it("renders deterministic team guidance in Korean", () => {
    const request = createCopilotAnalysisRequest({
      scope: "team",
      teamName: "테스트 팀",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });
    const response = createLocalCopilotAnalysis(request, "ko");

    expect(response.summary).toContain("활성 샘플 1/6");
    expect(response.playstyle).toBe("밸런스형");
    expect(response.recommendations[0]).toMatchObject({
      id: "fill-team",
      title: "활성 파티 완성",
    });
  });

  it("does not recommend an ace from setup alone", () => {
    const request = createCopilotAnalysisRequest({
      scope: "team",
      teamName: "Weather Utility",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics: {
        ...diagnostics,
        concepts: [
          {
            id: "sand",
            label: "Sand",
            status: "setup-only",
            setterSlots: [0],
            aceSlots: [],
            dependentAceSlots: [],
            independentAttackerSlots: [0],
            hasIndependentAttacker: true,
          },
        ],
      },
      validity,
    });
    const response = createLocalCopilotAnalysis(request);

    expect(
      response.recommendations.some(
        (recommendation) => recommendation.id === "concept-sand-ace",
      ),
    ).toBe(false);
  });

  it("does not stale team analysis when only the displayed slot changes", () => {
    const request = createCopilotAnalysisRequest({
      scope: "team",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });

    expect(getCopilotRequestFingerprint(request)).toBe(
      getCopilotRequestFingerprint({ ...request, selectedSlot: 1 }),
    );
  });

  it("stales Pokemon analysis only when the selected set changes", () => {
    const request = createCopilotAnalysisRequest({
      scope: "pokemon",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });
    const fingerprint = getCopilotRequestFingerprint(request);

    expect(
      getCopilotRequestFingerprint({ ...request, teamName: "Renamed Team" }),
    ).toBe(fingerprint);
    expect(
      getCopilotRequestFingerprint({
        ...request,
        sets: request.sets.map((set) => ({ ...set, nature: "Jolly" })),
      }),
    ).not.toBe(fingerprint);
  });

  it("summarizes the selected Pokemon without treating empty move slots as errors", () => {
    const request = createCopilotAnalysisRequest({
      scope: "pokemon",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });
    const response = createLocalCopilotAnalysis(request);

    expect(response.title).toBe("Test Pokemon");
    expect(response.summary).toContain("1 selected move");
    expect(response.strengths).toContain("All 66 EV points are allocated.");
    expect(response.weaknesses).not.toContain("No moves are currently configured for set analysis.");
  });

  it("localizes Pokemon roles, abilities, natures, and generated prose", () => {
    const request = createCopilotAnalysisRequest({
      scope: "pokemon",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 0,
      buildState,
      diagnostics,
      validity,
    });
    const response = createLocalCopilotAnalysis(request, "ko");

    expect(response.playstyle).toBe("물리 어태커");
    expect(response.summary).toContain("물리 어태커");
    expect(response.summary).toContain("위협 특성");
    expect(response.summary).toContain("고집 성격");
    expect(response.strengths).toContain("노력치 66포인트 투자 완료");
  });

  it("includes saved empty-slot requirements in the request and Pokemon recommendation", () => {
    const filteredBuildState: TeamBuildState = {
      ...buildState,
      candidateFiltersBySlot: {
        1: {
          types: ["fire", "flying"],
          ability: { id: "drought", name: "Drought" },
          moves: [{ id: "tailwind", name: "Tailwind" }],
        },
      },
    };
    const request = createCopilotAnalysisRequest({
      scope: "pokemon",
      teamName: "Test Team",
      team: [member, null, null, null, null, null],
      selectedSlot: 1,
      buildState: filteredBuildState,
      diagnostics,
      validity,
    });
    const response = createLocalCopilotAnalysis(request);

    expect(request.candidateFilters[0]).toMatchObject({
      slotIndex: 1,
      types: ["fire", "flying"],
      ability: { id: "drought", name: "Drought" },
      moves: [{ id: "tailwind", name: "Tailwind" }],
    });
    expect(response.summary).toContain("Fire type, Flying type, Drought ability");
    expect(response.recommendations[0]?.title).toBe("Choose a matching Pokemon");
  });
});
