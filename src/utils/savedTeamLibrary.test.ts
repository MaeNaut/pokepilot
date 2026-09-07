import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPokemon } from "../api/pokeApi";
import { defaultEvs } from "../data/natures";
import type { TeamMember } from "../types";
import { copySavedTeam, createSavedTeam, hydrateSavedBench, hydrateSavedTeamMembers, renameSavedTeam } from "./savedTeamLibrary";
import { createEmptyBuildState, type TeamSnapshot } from "./teamStorage";

vi.mock("../api/pokeApi", () => ({ fetchPokemon: vi.fn() }));
afterEach(() => vi.resetAllMocks());

function snapshot(): TeamSnapshot {
  return {
    name: "Rain", battleFormat: "doubles",
    slots: [{ pokemonId: "pelipper", name: "Pelipper" }, null],
    bench: [],
    buildState: createEmptyBuildState(),
  };
}
const pelipper: TeamMember = { id: "pelipper", name: "Pelipper", types: ["water", "flying"], roles: [] };

describe("saved team records", () => {
  it("creates a new identity and preserves the complete build snapshot", () => {
    const input = snapshot();
    const team = createSavedTeam(input);
    expect(team).toMatchObject(input);
    expect(team.id).toBeTruthy();
    expect(team.createdAt).toBe(team.updatedAt);
  });
  it("preserves identity and creation time when overwriting", () => {
    const previous = { ...createSavedTeam(snapshot()), createdAt: "2020-01-01" };
    const next = createSavedTeam({ ...snapshot(), name: "Updated" }, previous);
    expect(next).toMatchObject({ id: previous.id, createdAt: previous.createdAt, name: "Updated" });
    expect(previous.name).toBe("Rain");
  });
  it("renames without altering builds or the source record", () => {
    const previous = createSavedTeam(snapshot());
    const next = renameSavedTeam(previous, "New name");
    expect(next.buildState).toBe(previous.buildState);
    expect(next.id).toBe(previous.id);
    expect(next.name).toBe("New name");
    expect(previous.name).toBe("Rain");
  });
  it("copies under a new identity and finds an unused name", () => {
    const original = createSavedTeam(snapshot());
    const first = copySavedTeam(original, [original]);
    const second = copySavedTeam(original, [original, first]);
    expect(first.id).not.toBe(original.id);
    expect(second.name).toBe("Rain Copy 2");
    expect(second.buildState).toEqual(original.buildState);
  });
});

describe("saved team hydration", () => {
  it("reuses current sprites from the pool and preserves empty slots", async () => {
    const team = await hydrateSavedTeamMembers(createSavedTeam(snapshot()), [pelipper]);
    expect(team).toEqual([pelipper, null]);
    expect(team[0]).toBe(pelipper);
    expect(fetchPokemon).not.toHaveBeenCalled();
  });
  it("refreshes the legacy full-size Showdown preview sprite", async () => {
    vi.mocked(fetchPokemon).mockResolvedValue(pelipper);
    await hydrateSavedTeamMembers(createSavedTeam(snapshot()), [
      { ...pelipper, iconSpriteUrl: "https://play.pokemonshowdown.com/sprites/home/pelipper.png" },
    ]);
    expect(fetchPokemon).toHaveBeenCalledWith("pelipper");
  });
  it("uses saved identity for offline fallback", async () => {
    vi.mocked(fetchPokemon).mockRejectedValue(new Error("offline"));
    const team = await hydrateSavedTeamMembers(createSavedTeam(snapshot()), []);
    expect(team[0]).toMatchObject({ id: "pelipper", name: "Pelipper", source: "local" });
    expect(team[1]).toBeNull();
  });
  it("keeps slot order when requests finish out of order", async () => {
    let finish!: (member: TeamMember) => void;
    vi.mocked(fetchPokemon).mockImplementation((id) => id === "pelipper"
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve({ ...pelipper, id }));
    const saved = createSavedTeam(snapshot());
    saved.slots.push({ pokemonId: "scizor", name: "Scizor" });
    const pending = hydrateSavedTeamMembers(saved, []);
    finish(pelipper);
    expect((await pending).map((member) => member?.id ?? null)).toEqual(["pelipper", null, "scizor"]);
  });
  it("preserves bench identity and exact empty build selections", async () => {
    const saved = createSavedTeam(snapshot());
    const build = { item: null, ability: "", nature: "hardy", evs: { ...defaultEvs }, moveIds: ["", "", "", ""], preMegaPokemon: "" };
    saved.bench = [{ id: "bench-1", pokemon: { pokemonId: "pelipper", name: "Pelipper" }, build }];
    expect(await hydrateSavedBench(saved, [pelipper])).toEqual([{ id: "bench-1", member: pelipper, build }]);
  });
});
