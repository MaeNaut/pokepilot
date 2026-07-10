import type { TeamSlot } from "../types";

type CopilotPanelProps = {
  team: TeamSlot[];
  pokemonCount: number;
  indexStatus: "idle" | "loading" | "ready" | "error";
};

export function CopilotPanel({ team, pokemonCount, indexStatus }: CopilotPanelProps) {
  const filledSlots = team.filter(Boolean).length;
  const indexLabel =
    indexStatus === "ready"
      ? `${pokemonCount} Pokemon indexed`
      : indexStatus === "loading"
        ? "Loading Pokemon index"
        : indexStatus === "error"
          ? "Pokemon index failed"
          : "Pokemon index idle";

  return (
    <aside className="copilot-panel" aria-labelledby="copilot-title">
      <div>
        <p className="copilot-eyebrow">Copilot</p>
        <h2 id="copilot-title">Pilot Chat</h2>
        <p>
          This space will become the team-aware strategy assistant once the builder
          model is stable.
        </p>
      </div>

      <div className="copilot-status">
        <span>{filledSlots}/6 team slots filled</span>
        <span>{indexLabel}</span>
        <span>Regulation M-B target</span>
        <span>AI route pending</span>
      </div>
    </aside>
  );
}
