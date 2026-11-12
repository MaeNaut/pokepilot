// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readAccount, logoutAccount, deleteAccount } from "./accountAuth";
import { readAccountPreferences, writeAccountPreferences, readAccountCopilotHistory, writeAccountCopilotHistory } from "./accountStorage";
import { readPersonalApiKeyStatus, savePersonalApiKey, removePersonalApiKey } from "./personalApiKey";
import { readTeamLibrary, saveLibraryTeam, deleteLibraryTeam, orderLibraryTeams } from "./teamLibrary";
import { requestHostedCopilotAnalysis } from "./copilotApi";
import { loadBattleUsageSets } from "./battleUsage";
import { createEmptyBuildState } from "../utils/teamStorage";
import { createSavedTeam } from "../utils/savedTeamLibrary";
import type { CopilotAnalysisRequest } from "../utils/copilotContracts";
import { setUsageMetricsEnabled } from "../utils/usageMetrics";

const team = createSavedTeam({ name: "Test", battleFormat: "singles", slots: Array(6).fill(null), bench: [], buildState: createEmptyBuildState() });
const signal = () => new AbortController().signal;
const actions: Array<[string, () => Promise<unknown>]> = [
  ["account read", () => readAccount()],
  ["logout", () => logoutAccount("account")],
  ["account delete", () => deleteAccount("account")],
  ["preferences read", () => readAccountPreferences(undefined, "account")],
  ["preferences write", () => writeAccountPreferences({ locale: "en", themePreference: "system", battleFormat: "singles", tutorialCompleted: true }, '"v1"', undefined, "account")],
  ["history read", () => readAccountCopilotHistory(undefined, "account")],
  ["history write", () => writeAccountCopilotHistory([], '"v1"', undefined, "account")],
  ["key status", () => readPersonalApiKeyStatus("account")],
  ["key save", () => savePersonalApiKey("not-a-real-key", "account")],
  ["key delete", () => removePersonalApiKey("account")],
  ["team read", () => readTeamLibrary("account", signal())],
  ["team save", () => saveLibraryTeam("account", signal(), team, null)],
  ["team delete", () => deleteLibraryTeam("account", signal(), team)],
  ["team reorder", () => orderLibraryTeams("account", signal(), [team.id])],
  ["analysis", () => requestHostedCopilotAnalysis({ scope: "team", sets: [] } as unknown as CopilotAnalysisRequest, undefined, "low", "gpt-6-luna", "account")],
  ["battle snapshot", () => loadBattleUsageSets("singles")],
];

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

it.each(actions)("carries refusal on the existing %s request, without sending a beacon", async (_label, action) => {
  const fetch = vi.fn().mockRejectedValue(new Error("Mock transport: no network permitted"));
  vi.stubGlobal("fetch", fetch);
  setUsageMetricsEnabled(false);
  expect(fetch).not.toHaveBeenCalled();
  await action().catch(() => undefined);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toMatch(/^\/api\//);
  expect(fetch.mock.calls[0][0]).not.toBe("/api/pokepilot/usage-events");
  expect(new Headers(fetch.mock.calls[0][1].headers).get("X-PokePilot-Usage-Opt-Out")).toBe("1");
});
