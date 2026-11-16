import { randomUUID } from "node:crypto";
import {
  InMemoryPokePilotOperations,
  PokePilotCapacityError,
  type PokePilotRequester,
  type PokePilotRequestAdmissionDecision,
  type PokePilotRunOnceOptions,
} from "./pokepilotOperations.js";

export interface PokePilotAnalysisGateClient {
  admit(requester: PokePilotRequester, token: string): Promise<PokePilotRequestAdmissionDecision>;
  acquire(requesterId: string, token: string): Promise<boolean>;
  release(token: string): Promise<void>;
}

export interface PokePilotAnalysisGateNamespace {
  getByName(name: string): PokePilotAnalysisGateClient;
}

export class DurablePokePilotOperations extends InMemoryPokePilotOperations {
  constructor(private readonly namespace: PokePilotAnalysisGateNamespace, private readonly objectName = "analysis-v1") {
    super();
  }

  override async admitRequest(requester: PokePilotRequester, _now: number) {
    void _now;
    return this.namespace.getByName(this.objectName).admit(requester, randomUUID());
  }

  override runOnce<T>(key: string, task: () => Promise<T>, options: PokePilotRunOnceOptions = {}) {
    // Only the local leader acquires a permit. Neither the task nor its result crosses RPC.
    return super.runOnce(key, async () => {
      if (!options.capacity) return task();
      const gate = this.namespace.getByName(this.objectName);
      const token = randomUUID();
      if (!await gate.acquire(options.capacity.requesterId, token)) throw new PokePilotCapacityError();
      try {
        return await task();
      } finally {
        // An expiring permit recovers after crashes; cleanup must not discard a paid result.
        try {
          await gate.release(token);
        } catch {
          console.warn("[PokePilot API] Analysis permit cleanup failed.");
        }
      }
    }, { ...options, capacity: undefined });
  }
}
