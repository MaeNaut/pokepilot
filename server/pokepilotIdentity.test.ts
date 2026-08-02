import { describe, expect, it } from "vitest";
import {
  createSignedPokePilotClientToken,
  readSignedPokePilotClientToken,
} from "./pokepilotIdentity";

describe("PokePilot anonymous client identity", () => {
  it("round-trips a server-signed anonymous client ID", () => {
    const token = createSignedPokePilotClientToken("client-a", "secret");

    expect(readSignedPokePilotClientToken(token, "secret")).toBe("client-a");
  });

  it("rejects a modified or differently signed client token", () => {
    const token = createSignedPokePilotClientToken("client-a", "secret");

    expect(
      readSignedPokePilotClientToken(token.replace("client-a", "client-b"), "secret"),
    ).toBeNull();
    expect(readSignedPokePilotClientToken(token, "other-secret")).toBeNull();
  });
});
