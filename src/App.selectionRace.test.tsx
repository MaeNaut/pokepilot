// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import type { TeamBuilder } from "./components/TeamBuilder";
import type { CopilotPanel } from "./components/CopilotPanel";
import type { NewTeamControl } from "./components/NewTeamControl";
import type { SavedTeamRow } from "./components/SavedTeamRow";
import { deferred } from "./test/renderHook";
import { resolvePokemonChoice } from "./utils/pokemonSelection";
import { createEmptyBuildState, type SavedTeamSummary } from "./utils/teamStorage";
import { hydrateSavedTeamMembers, hydrateSavedBench } from "./utils/savedTeamLibrary";
import { buildImportedShowdownSnapshot } from "./utils/showdownImport";

const state = vi.hoisted(() => ({
  builder: null as unknown as ComponentProps<typeof TeamBuilder>,
  copilot: null as unknown as ComponentProps<typeof CopilotPanel>,
  newTeam: null as unknown as ComponentProps<typeof NewTeamControl>,
  savedRow: null as unknown as ComponentProps<typeof SavedTeamRow>,
  savedTeams: [] as SavedTeamSummary[],
  save: vi.fn(),
  refresh: vi.fn(),
  accountId: "a" as string | null,
  accountStatus: null as "loading" | "error" | null,
  t: (key: string) => key,
  data: {
    pokemonIndex: [], itemIndex: [], abilityIndex: [], showdownLegality: null,
    pokemonIndexStatus: "ready", itemIndexStatus: "ready", showdownLegalityStatus: "ready",
  },
}));
vi.mock("./components/TeamBuilder", () => ({ TeamBuilder: (props: typeof state.builder) => { state.builder = props; return null; } }));
vi.mock("./components/NewTeamControl", () => ({ NewTeamControl: (props: typeof state.newTeam) => { state.newTeam = props; return null; } }));
vi.mock("./components/SavedTeamRow", () => ({ SavedTeamRow: (props: typeof state.savedRow) => { state.savedRow = props; return null; } }));
vi.mock("./components/CopilotPanel", () => ({ CopilotPanel: (props: typeof state.copilot) => { state.copilot = props; return null; } }));
vi.mock("./components/TeamDiagnostics", () => ({ TeamDiagnostics: () => null }));
vi.mock("./components/HeaderAccountMenu", () => ({ HeaderAccountMenu: () => null }));
vi.mock("./components/HeaderModeControls", () => ({ AppModeControl: () => null, BattleFormatControl: () => null }));
vi.mock("./components/WorkspaceTutorial", () => ({ WorkspaceTutorial: () => null }));
vi.mock("./components/PrivacyControl", () => ({ PrivacyControl: () => null }));
vi.mock("./components/CopilotDrawer", () => ({ CopilotDrawer: ({ children }: { children: ReactNode }) => children }));
vi.mock("./hooks/useBuilderData", () => ({ useBuilderData: () => state.data }));
vi.mock("./hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("./hooks/useAccount", () => ({ useAccount: () => ({
  enabled: true, status: state.accountStatus ?? (state.accountId ? "ready" : "guest"),
  user: state.accountStatus ? null : state.accountId ? { id: state.accountId } : null,
}) }));
vi.mock("./hooks/useAccountPreferencesSync", () => ({ useAccountPreferencesSync: () => {} }));
vi.mock("./hooks/useTeamWorkspaceRestore", () => ({ useTeamWorkspaceRestore: () => {} }));
vi.mock("./hooks/useSavedTeams", async importOriginal => ({
  ...await importOriginal<typeof import("./hooks/useSavedTeams")>(),
  useSavedTeams: () => ({ teams: state.savedTeams, isHydrated: true, save: state.save, refresh: state.refresh }),
}));
vi.mock("./utils/savedTeamLibrary", async (original) => ({
  ...await original<typeof import("./utils/savedTeamLibrary")>(),
  hydrateSavedTeamMembers: vi.fn(), hydrateSavedBench: vi.fn(),
}));
vi.mock("./utils/showdownImport", async (original) => ({
  ...await original<typeof import("./utils/showdownImport")>(), buildImportedShowdownSnapshot: vi.fn(),
}));
vi.mock("./i18n/useLocalization", () => ({ useLocalization: () => ({
  locale: "en", t: state.t, gameName: (_kind: string, id: string) => id,
}) }));
vi.mock("./theme/useTheme", () => ({ useTheme: () => ({ themePreference: "light" }) }));
vi.mock("./battleFormat/useBattleFormat", () => ({ useBattleFormat: () => ({ battleFormat: "singles", setBattleFormat: () => {} }) }));
vi.mock("./appMode/useAppMode", () => ({ useAppMode: () => ({ appMode: "builder" }) }));
vi.mock("./utils/pokemonSelection", async (original) => ({
  ...await original<typeof import("./utils/pokemonSelection")>(), resolvePokemonChoice: vi.fn(),
}));
vi.mock("./utils/recommendedPokemonApplication", async (original) => ({
  ...await original<typeof import("./utils/recommendedPokemonApplication")>(),
  validateRecommendedPokemonApplication: () => ({ status: "valid" }),
}));

type Selection = Awaited<ReturnType<typeof resolvePokemonChoice>>;
function result(id = "lucario"): Selection {
  const member = { id, name: id, types: ["fighting"] as const, roles: [], source: "local" as const, abilities: ["inner-focus"] };
  const selectedMember = { ...member, types: [...member.types] };
  return { selectedMember, targetMember: selectedMember, usageSetPatch: null,
    proposedBuildState: createEmptyBuildState(), usageSetFound: false };
}
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  localStorage.clear();
  state.accountId = "a";
  state.accountStatus = null;
  state.savedTeams = [];
  state.save.mockReset().mockImplementation(async (snapshot, id) => {
    const saved = { ...snapshot, id: id ?? "new-team", version: 1, createdAt: "2026-10-01", updatedAt: "2026-10-01" };
    state.savedTeams = [saved];
    return saved;
  });
  state.refresh.mockReset().mockResolvedValue(true);
  vi.mocked(resolvePokemonChoice).mockReset();
});
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

it.each(["loading", "error"] as const)("does not misreport a team limit while account status is %s", async (status) => {
  state.accountStatus = status;
  const app = await mount();
  const save = app.container.querySelector<HTMLButtonElement>(".desktop-team-save");
  expect(save?.disabled).toBe(false);
  expect(save?.title).toBe(status === "loading" ? "account.checking" : "account.unavailable");
  await act(async () => { save!.click(); });
  expect(app.container.textContent).toContain(status === "loading" ? "account.checking" : "account.unavailable");
  expect(app.container.textContent).not.toContain("team.limitReached");
});
async function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async () => { await act(async () => { root.render(<App />); }); };
  await render();
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  return { render, container };
}

it("auto-saves a new team once and checks unchanged teams without rewriting them", async () => {
  vi.mocked(resolvePokemonChoice).mockResolvedValue(result());
  await mount();
  await act(async () => { await state.builder.onSelectPokemon(0, "lucario"); });
  let saved!: Awaited<ReturnType<typeof state.copilot.onSaveTeamForAnalysis>>;
  await act(async () => { saved = await state.copilot.onSaveTeamForAnalysis(); });
  expect(saved?.teamId).toBe("new-team");
  expect(saved?.isCurrent()).toBe(true);
  expect(state.copilot.savedTeamId).toBe("new-team");
  await act(async () => { saved = await state.copilot.onSaveTeamForAnalysis(); });
  expect(saved?.teamId).toBe("new-team");
  expect(state.save).toHaveBeenCalledTimes(1);
  expect(state.refresh).toHaveBeenCalledWith(true);
});

it.each(["save-failure", "peer-update"])("blocks analysis team saving on %s", async (failure) => {
  await mount();
  if (failure === "save-failure") state.save.mockResolvedValue(null);
  else {
    await act(async () => { await state.copilot.onSaveTeamForAnalysis(); });
    state.refresh.mockResolvedValue(false);
  }
  let saved!: unknown;
  await act(async () => { saved = await state.copilot.onSaveTeamForAnalysis(); });
  expect(saved).toBeNull();
});

it.each(["edit", "new-team", "logout"])("does not start analysis after the workspace changes during saving: %s", async (change) => {
  const pending = deferred<SavedTeamSummary>();
  state.save.mockReturnValue(pending.promise);
  vi.mocked(resolvePokemonChoice).mockResolvedValue(result());
  const app = await mount();
  let operation!: ReturnType<typeof state.copilot.onSaveTeamForAnalysis>;
  await act(async () => { operation = state.copilot.onSaveTeamForAnalysis(); });
  if (change === "edit") await act(async () => { await state.builder.onSelectPokemon(0, "lucario"); });
  else if (change === "new-team") await act(async () => { state.newTeam.onCreateTeam(); });
  else { state.accountId = null; await app.render(); }
  await act(async () => { pending.resolve({
    version: 1, id: "late", name: "Untitled Team", battleFormat: "singles", slots: Array(6).fill(null),
    bench: [], createdAt: "2026-10-01", updatedAt: "2026-10-01",
  }); });
  expect(await operation).toBeNull();
  expect(state.copilot.savedTeamId).toBeNull();
});

it.each(["new-team", "logout"] as const)("discards a selection completed after %s", async (transition) => {
  const pending = deferred<Selection>();
  vi.mocked(resolvePokemonChoice).mockReturnValue(pending.promise);
  const app = await mount();
  let operation!: Promise<void>;
  await act(async () => { operation = state.builder.onSelectPokemon(0, "lucario"); });
  if (transition === "new-team") await act(async () => { state.newTeam.onCreateTeam(); });
  else { state.accountId = null; await app.render(); }
  await act(async () => { pending.resolve(result()); await operation; });
  expect(state.builder.team.every((member) => member === null)).toBe(true);
  expect(state.builder.pool).toHaveLength(0);
  expect(state.builder.buildState.abilityBySlot).toEqual({});
  expect(state.builder.selectingPokemonSlot).toBeNull();
});

it("keeps an ordinary selection working when the workspace has not changed", async () => {
  vi.mocked(resolvePokemonChoice).mockResolvedValue(result());
  await mount();
  await act(async () => { await state.builder.onSelectPokemon(0, "lucario"); });
  expect(state.builder.team[0]?.id).toBe("lucario");
  expect(state.builder.selectingPokemonSlot).toBeNull();
});

it("does not show a stale failure or clear a newer selection's loading state", async () => {
  const old = deferred<Selection>();
  const next = deferred<Selection>();
  vi.mocked(resolvePokemonChoice).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  await mount();
  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(async () => { first = state.builder.onSelectPokemon(0, "lucario"); });
  await act(async () => { state.newTeam.onCreateTeam(); });
  expect(state.builder.selectingPokemonSlot).toBeNull();
  await act(async () => { second = state.builder.onSelectPokemon(1, "pikachu"); });
  await act(async () => { old.reject(new Error("old network failure")); await first; });
  expect(state.builder.searchError).toBeNull();
  expect(state.builder.failedPokemonSelectionSlot).toBeNull();
  expect(state.builder.selectingPokemonSlot).toBe(1);
  await act(async () => { next.resolve(result("pikachu")); await second; });
  expect(state.builder.team[0]).toBeNull();
  expect(state.builder.team[1]?.id).toBe("pikachu");
});

it("discards a late success without publishing its missing-usage notice", async () => {
  const old = deferred<Selection>();
  vi.mocked(resolvePokemonChoice).mockReturnValue(old.promise);
  await mount();
  let operation!: Promise<void>;
  await act(async () => { operation = state.builder.onSelectPokemon(0, "lucario", { applyUsageStats: true }); });
  await act(async () => { state.newTeam.onCreateTeam(); });
  await act(async () => { old.resolve(result()); await operation; });
  expect(state.builder.searchNotice).toBeNull();
  expect(state.builder.team[0]).toBeNull();
});

it("invalidates selection as soon as loading a saved team begins", async () => {
  state.savedTeams = [{
    version: 1, id: "saved", name: "Saved", battleFormat: "singles",
    slots: Array(6).fill(null), bench: [], createdAt: "", updatedAt: "",
  }];
  const old = deferred<Selection>();
  const load = deferred<Awaited<ReturnType<typeof hydrateSavedTeamMembers>>>();
  vi.mocked(resolvePokemonChoice).mockReturnValue(old.promise);
  vi.mocked(hydrateSavedTeamMembers).mockReturnValue(load.promise);
  vi.mocked(hydrateSavedBench).mockResolvedValue([]);
  const app = await mount();
  let operation!: Promise<void>;
  await act(async () => { operation = state.builder.onSelectPokemon(0, "lucario"); });
  await act(async () => { app.container.querySelector<HTMLButtonElement>('[aria-label="team.manage"]')!.click(); });
  await act(async () => { state.savedRow.onSelect(state.savedTeams[0]); });
  expect(state.builder.selectingPokemonSlot).toBeNull();
  await act(async () => { old.resolve(result()); await operation; });
  expect(state.builder.team[0]).toBeNull();
  await act(async () => { load.resolve(Array(6).fill(null)); });
  expect(state.builder.teamName).toBe("Saved");
});

it("invalidates selection when importing a new team", async () => {
  const old = deferred<Selection>();
  const imported = deferred<Awaited<ReturnType<typeof buildImportedShowdownSnapshot>>>();
  vi.mocked(resolvePokemonChoice).mockReturnValue(old.promise);
  vi.mocked(buildImportedShowdownSnapshot).mockReturnValue(imported.promise);
  await mount();
  let operation!: Promise<void>;
  await act(async () => { operation = state.builder.onSelectPokemon(0, "lucario"); });
  await act(async () => { state.newTeam.onShowdownDraftChange("Pikachu"); });
  await act(async () => { state.newTeam.onImport(); });
  await act(async () => { old.resolve(result()); await operation; });
  expect(state.builder.team[0]).toBeNull();
  await act(async () => { imported.resolve({
    members: [result("pikachu").targetMember, null, null, null, null, null],
    buildState: createEmptyBuildState(),
  }); });
  expect(state.builder.team[0]?.id).toBe("pikachu");
});

it("discards a slot import completed after creating a new team", async () => {
  const pending = deferred<Awaited<ReturnType<typeof buildImportedShowdownSnapshot>>>();
  vi.mocked(buildImportedShowdownSnapshot).mockReturnValue(pending.promise);
  await mount();
  let operation!: Promise<void>;
  await act(async () => { operation = state.builder.onImportShowdown(0, "Lucario"); });
  await act(async () => { state.newTeam.onCreateTeam(); });
  await act(async () => { pending.resolve({
    members: [result().targetMember, null, null, null, null, null],
    buildState: createEmptyBuildState(),
  }); await operation; });
  expect(state.builder.team[0]).toBeNull();
  expect(state.builder.pool).toHaveLength(0);
});

it("discards a recommendation bench save completed in a new empty workspace", async () => {
  const pending = deferred<Selection>();
  vi.mocked(resolvePokemonChoice).mockReturnValue(pending.promise);
  await mount();
  let operation!: ReturnType<typeof state.copilot.onSaveRecommendedPokemon>;
  await act(async () => { operation = state.copilot.onSaveRecommendedPokemon(0, "lucario"); });
  await act(async () => { state.newTeam.onCreateTeam(); });
  let outcome!: Awaited<typeof operation>;
  await act(async () => { pending.resolve(result()); outcome = await operation; });
  expect(outcome).toMatchObject({ status: "blocked", reason: "stale" });
  expect(state.builder.bench).toHaveLength(0);
});

it("never adds more than six bench entries from overlapping recommendation saves", async () => {
  vi.mocked(resolvePokemonChoice).mockResolvedValue(result());
  await mount();
  let outcomes!: Awaited<ReturnType<typeof state.copilot.onSaveRecommendedPokemon>>[];
  await act(async () => {
    outcomes = await Promise.all(Array.from({ length: 7 }, () =>
      state.copilot.onSaveRecommendedPokemon(0, "lucario")));
  });
  expect(state.builder.bench).toHaveLength(6);
  expect(outcomes.filter((outcome) => outcome.status === "saved")).toHaveLength(6);
  expect(outcomes.filter((outcome) => outcome.status === "blocked" && outcome.reason === "bench-full")).toHaveLength(1);
});
