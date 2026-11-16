import {
  InMemoryPokePilotOperations,
  type PokePilotOperations,
} from "./pokepilotOperations.js";
import { DurablePokePilotOperations, type PokePilotAnalysisGateNamespace } from "./durablePokePilotOperations.js";

export type PokePilotOperationsRuntime = {
  kind: "memory" | "durable-object";
  operations: PokePilotOperations;
};

export function createPokePilotOperationsRuntime(
  namespace?: PokePilotAnalysisGateNamespace,
  objectName?: string,
): PokePilotOperationsRuntime {
  return namespace
    ? { kind: "durable-object", operations: new DurablePokePilotOperations(namespace, objectName) }
    : { kind: "memory", operations: new InMemoryPokePilotOperations() };
}

let defaultRuntime: PokePilotOperationsRuntime | undefined;

export function getDefaultPokePilotOperationsRuntime() {
  if (!defaultRuntime) {
    defaultRuntime = createPokePilotOperationsRuntime();
  }
  return defaultRuntime;
}
