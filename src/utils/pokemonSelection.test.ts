import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPokemon } from "../api/pokeApi";
import { fetchItem } from "../api/showdownCatalog";
import {
  loadPopularSmogonSet,
  resolveSmogonUsageAbility,
  type SmogonUsageSet,
} from "../api/smogonUsage";
import type { TeamMember } from "../types";
import { resolvePokemonChoice, resolveUsageTargetMember } from "./pokemonSelection";
import { createEmptyBuildState, patchBuildStateSlot } from "./teamBuildState";

vi.mock("../api/pokeApi", () => ({ fetchPokemon: vi.fn() }));
vi.mock("../api/showdownCatalog", () => ({ fetchItem: vi.fn() }));
vi.mock("../api/smogonUsage", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/smogonUsage")>(),
  loadPopularSmogonSet: vi.fn(),
}));

const member: TeamMember = {
  id: "scizor", name: "Scizor", types: ["bug", "steel"], roles: [],
  abilities: ["Swarm", "Technician"],
  baseStats: { hp: 70, attack: 130, defense: 100, specialAttack: 55, specialDefense: 80, speed: 65 },
  moves: [{
    id: "bug-bite", name: "Bug Bite", type: "bug", category: "Physical",
    power: 60, accuracy: 100, pp: 20, description: "",
  }],
};
const usageSet: SmogonUsageSet = {
  pokemonId: "scizor", pokemonName: "Scizor", sourceMonth: "2026-06", cutoff: 1630,
  ability: "technician", itemName: "Life Orb", nature: "Adamant",
  evs: { hp: 32, attack: 32, defense: 32 }, moveIds: ["bugbite", "missing"],
};

function options(overrides: Partial<Parameters<typeof resolvePokemonChoice>[0]> = {}) {
  return {
    lookup: member.id, slotIndex: 0, applyUsageStats: true,
    battleFormat: "doubles" as const, customPool: [], pokemonIndex: [],
    getBuildStateSnapshot: createEmptyBuildState,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchPokemon).mockResolvedValue(member);
  vi.mocked(fetchItem).mockResolvedValue({ id: "life-orb", name: "Life Orb" });
  vi.mocked(loadPopularSmogonSet).mockResolvedValue(usageSet);
});

describe("usage ability matching", () => {
  it("preserves canonical names and caller-specific missing-data defaults", () => {
    expect(resolveSmogonUsageAbility(member, "TECHNICIAN")).toBe("Technician");
    expect(resolveSmogonUsageAbility(member, undefined)).toBe("");
    expect(resolveSmogonUsageAbility(member, undefined, "Swarm")).toBe("Swarm");
    expect(resolveSmogonUsageAbility(member, "New Ability")).toBe("New Ability");
  });
});

describe("usage target resolution shared by builder and calculator", () => {
  it("keeps the same Pokemon without another download", async () => {
    expect(await resolveUsageTargetMember("SCIZOR", member)).toBe(member);
    expect(fetchPokemon).not.toHaveBeenCalled();
  });

  it.each([
    ["aegislash-blade", "aegislash-shield"],
    ["palafin-zero", "palafin-hero"],
    ["morpeko-full-belly", "morpeko-hangry"],
  ])("preserves selected battle form %s for usage target %s", async (id, target) => {
    const selected = { ...member, id };
    expect(await resolveUsageTargetMember(target, selected)).toBe(selected);
    expect(fetchPokemon).not.toHaveBeenCalled();
  });

  it("loads a distinct form and falls back only if that load fails", async () => {
    const mega = { ...member, id: "scizor-mega" };
    vi.mocked(fetchPokemon).mockResolvedValueOnce(mega).mockRejectedValueOnce(new Error("offline"));
    expect(await resolveUsageTargetMember(mega.id, member)).toBe(mega);
    expect(await resolveUsageTargetMember(mega.id, member)).toBe(member);
  });
});

describe("team Pokemon choice", () => {
  it.each(["singles", "doubles"] as const)("loads the requested %s usage and normalizes the build", async (battleFormat) => {
    const state = patchBuildStateSlot(createEmptyBuildState(), 0, { nature: "Timid" });
    state.abilityBySlot[1] = "Intimidate";
    const before = structuredClone(state);
    const result = await resolvePokemonChoice(options({ battleFormat, getBuildStateSnapshot: () => state }));
    expect(loadPopularSmogonSet).toHaveBeenCalledWith("scizor", battleFormat);
    expect(fetchItem).toHaveBeenCalledWith("lifeorb");
    expect(result.usageSetFound).toBe(true);
    expect(result.usageSetPatch?.itemLoadFailed).toBe(false);
    expect(result.proposedBuildState).toMatchObject({
      abilityBySlot: { 0: "Technician", 1: "Intimidate" },
      natureBySlot: { 0: "Adamant" },
      moveIdsBySlot: { 0: ["bug-bite", "", "", ""] },
      evsBySlot: { 0: { hp: 32, attack: 32, defense: 2 } },
    });
    expect(state).toEqual(before);
  });

  it("does not fetch usage or reset builds during a manual selection", async () => {
    const state = patchBuildStateSlot(createEmptyBuildState(), 0, { nature: "Careful" });
    const result = await resolvePokemonChoice(options({ applyUsageStats: false, getBuildStateSnapshot: () => state }));
    expect(result.proposedBuildState).toBe(state);
    expect(result.usageSetPatch).toBeNull();
    expect(loadPopularSmogonSet).not.toHaveBeenCalled();
    expect(fetchItem).not.toHaveBeenCalled();
  });

  it("reuses complete local members", async () => {
    expect((await resolvePokemonChoice(options({ customPool: [member] }))).selectedMember).toBe(member);
    expect(fetchPokemon).not.toHaveBeenCalled();
  });

  it.each([
    { ...member, baseStats: undefined },
    { ...member, abilities: undefined },
    { ...member, iconSpriteUrl: "https://play.pokemonshowdown.com/sprites/home/scizor.png" },
    { ...member, iconSpriteUrl: "https://play.pokemonshowdown.com/sprites/home-centered/scizor.png" },
  ])("refreshes incomplete or outdated local members %#", async (cached) => {
    await resolvePokemonChoice(options({ customPool: [cached] }));
    expect(fetchPokemon).toHaveBeenCalledWith(member.id);
  });

  it("clears only the selected slot when usage is unavailable", async () => {
    vi.mocked(loadPopularSmogonSet).mockResolvedValue(null);
    const state = createEmptyBuildState();
    state.natureBySlot = { 0: "Adamant", 1: "Careful" };
    const result = await resolvePokemonChoice(options({ getBuildStateSnapshot: () => state }));
    expect(result.usageSetFound).toBe(false);
    expect(result.usageSetPatch).toBeNull();
    expect(result.proposedBuildState.natureBySlot).toEqual({ 1: "Careful" });
  });

  it("leaves absent optional fields out of the builder patch", async () => {
    vi.mocked(loadPopularSmogonSet).mockResolvedValue({
      pokemonId: member.id, pokemonName: member.name, sourceMonth: "2026-06", cutoff: 1630, moveIds: [],
    });
    const result = await resolvePokemonChoice(options());
    expect(result.usageSetPatch?.patch).toEqual({ item: null, preMegaPokemon: null });
  });

  it("records item failures so recommendation callers can block application", async () => {
    vi.mocked(fetchItem).mockRejectedValue(new Error("offline"));
    const result = await resolvePokemonChoice(options());
    expect(result.usageSetPatch).toMatchObject({ itemLoadFailed: true, patch: { item: null } });
  });

  it("remembers the pre-mega member when usage selects a mega form", async () => {
    const mega = { ...member, id: "scizor-mega" };
    vi.mocked(loadPopularSmogonSet).mockResolvedValue({ ...usageSet, pokemonName: "Scizor-Mega" });
    vi.mocked(fetchPokemon).mockResolvedValueOnce(member).mockResolvedValueOnce(mega);
    const result = await resolvePokemonChoice(options());
    expect(result.targetMember).toBe(mega);
    expect(result.proposedBuildState.preMegaPokemonBySlot[0]).toBe("scizor");
  });

  it("takes the build snapshot after asynchronous loading completes", async () => {
    const snapshot = vi.fn(createEmptyBuildState);
    vi.mocked(fetchItem).mockImplementation(async () => {
      expect(snapshot).not.toHaveBeenCalled();
      return { id: "life-orb", name: "Life Orb" };
    });
    await resolvePokemonChoice(options({ getBuildStateSnapshot: snapshot }));
    expect(snapshot).toHaveBeenCalledOnce();
  });

  it("propagates initial lookup failures to the caller's error handling", async () => {
    vi.mocked(fetchPokemon).mockRejectedValue(new Error("lookup failed"));
    await expect(resolvePokemonChoice(options())).rejects.toThrow("lookup failed");
    expect(loadPopularSmogonSet).not.toHaveBeenCalled();
  });
});
