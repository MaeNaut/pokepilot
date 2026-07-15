import { describe, expect, it } from "vitest";
import type { TeamBuildState } from "../hooks/useTeamBuildState";
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
      version: 1,
      scope: "pokemon",
      teamName: "Test Team",
      selectedSlot: 0,
      diagnostics: {
        filledSlots: 1,
        coverageCount: 5,
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
      moves: [{ id: "close-combat", name: "Close Combat" }],
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
