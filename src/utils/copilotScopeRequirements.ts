import type { BattleFormat } from "../battleFormat/battleFormat";
import type { TeamSlot } from "../types";
import type { CopilotAnalysisScope } from "./copilotContracts";

export type CopilotScopeRequirement =
  | {
      kind: "minimum-team-size";
      activeCount: number;
      requiredCount: number;
    }
  | { kind: "selected-pokemon" };

export function getCopilotScopeRequirement({
  scope,
  battleFormat,
  team,
  selectedSlot,
}: {
  scope: CopilotAnalysisScope;
  battleFormat: BattleFormat;
  team: TeamSlot[];
  selectedSlot: number;
}): CopilotScopeRequirement | null {
  const activeCount = team.filter(Boolean).length;
  const requiredCount = battleFormat === "singles" ? 3 : 4;

  if (
    (scope === "team" || scope === "recommendation") &&
    activeCount < requiredCount
  ) {
    return { kind: "minimum-team-size", activeCount, requiredCount };
  }

  if (scope === "pokemon" && !team[selectedSlot]) {
    return { kind: "selected-pokemon" };
  }

  return null;
}
