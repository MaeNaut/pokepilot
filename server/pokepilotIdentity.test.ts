import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSignedPokePilotClientToken,
  readSignedPokePilotClientToken,
  resolvePokePilotIdentity,
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

  it("keeps platform-provided client IPs ahead of a Node socket fallback", () => {
    const secret = "secret";
    const resolution = resolvePokePilotIdentity(
      {
        fallbackIp: "10.0.0.1",
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
      },
      secret,
    );

    expect(resolution.requester.ipHash).toBe(
      createHmac("sha256", secret)
        .update("ip:203.0.113.10")
        .digest("base64url"),
    );
  });

  it("uses a trusted platform IP when one is supplied", () => {
    const secret = "secret";
    const resolution = resolvePokePilotIdentity(
      {
        headers: { "x-forwarded-for": "203.0.113.10" },
        trustedIp: "198.51.100.10",
      },
      secret,
    );

    expect(resolution.requester.ipHash).toBe(
      createHmac("sha256", secret)
        .update("ip:198.51.100.10")
        .digest("base64url"),
    );
  });
});
