import { describe, expect, it, vi } from "vitest";
import { InMemoryPokePilotOperations } from "./pokepilotOperations";
import { createPokePilotOperationsRuntime } from "./pokepilotOperationsRuntime";
import { DurablePokePilotOperations } from "./durablePokePilotOperations";

describe("PokePilot operations runtime", () => {
  it("uses local memory for Vite development and evaluation without opening a remote connection", () => {
    const runtime = createPokePilotOperationsRuntime();
    expect(runtime.kind).toBe("memory");
    expect(runtime.operations).toBeInstanceOf(InMemoryPokePilotOperations);
  });

  it("uses the Cloudflare binding without eagerly contacting the gate", () => {
    const namespace = { getByName: vi.fn() };
    const runtime = createPokePilotOperationsRuntime(namespace);
    expect(runtime.kind).toBe("durable-object");
    expect(runtime.operations).toBeInstanceOf(DurablePokePilotOperations);
    expect(namespace.getByName).not.toHaveBeenCalled();
  });
});
