import { beforeEach, expect, it, vi } from "vitest";
import { deleteCurrentAccount, readAccountSession } from "./accountAuth";
import { handleAccount } from "./accountEndpoint";
import type { WorkerEnvironment } from "./env";

vi.mock("./accountAuth.js", async (original) => ({
  ...await original<typeof import("./accountAuth")>(),
  readAccountSession: vi.fn(), deleteCurrentAccount: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAccountSession).mockResolvedValue({ account: { id: "new-account" } });
});

it("requires the displayed account ID before deleting an account", async () => {
  const env = { POKEPILOT_AUTH_REQUIRED: "true" } as WorkerEnvironment;
  const request = (accountId?: string) => new Request("https://pokepilot.app/api/pokepilot/account", {
    method: "DELETE",
    ...(accountId ? { headers: { "X-PokePilot-Account-Id": accountId } } : {}),
  });
  expect((await handleAccount(request("old-account"), env)).status).toBe(403);
  expect((await handleAccount(request(), env)).status).toBe(403);
  expect(deleteCurrentAccount).not.toHaveBeenCalled();
});
