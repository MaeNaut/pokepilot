import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { analyzeTeam } from "../utils/teamDiagnostics";
import { TeamDiagnostics } from "./TeamDiagnostics";

vi.mock("../i18n/useLocalization", () => ({
  useLocalization: () => ({
    t: (key: string) => key,
    gameName: (_kind: string, id: string) => id,
  }),
}));

function emptyDiagnostics() {
  return analyzeTeam([], {
    moveIdsBySlot: {}, evsBySlot: {}, natureBySlot: {}, abilityBySlot: {},
  });
}

describe("TeamDiagnostics table", () => {
  it("renders a full-width table and two compact tables for responsive display", () => {
    const html = renderToStaticMarkup(createElement(TeamDiagnostics, { diagnostics: emptyDiagnostics() }));
    expect(html.match(/<table /g)).toHaveLength(3);
    expect(html.match(/<th scope="col">/g)).toHaveLength(36);
    expect(html.match(/<th scope="row"/g)).toHaveLength(6);
    expect(html.match(/<td class="is-zero">0<\/td>/g)).toHaveLength(72);
    expect(html).toContain('aria-valuenow="0"');
  });

  it("keeps weakness counts separate and combines resistance with immunity", () => {
    const diagnostics = emptyDiagnostics();
    diagnostics.defensiveMatchups[0] = {
      ...diagnostics.defensiveMatchups[0], weakCount: 2, resistCount: 1, immuneCount: 3,
    };
    const html = renderToStaticMarkup(createElement(TeamDiagnostics, { diagnostics }));
    expect(html).toContain('diagnostics.weak</th><td>2</td>');
    expect(html).toContain('diagnostics.resist</th><td>4</td>');
    expect(html).toContain('diagnostics.resist: diagnostics.resistHint');
    expect(html.match(/<td class="is-zero">0<\/td>/g)).toHaveLength(68);
  });

  it.each([
    [1, 0, 0, false],
    [2, 0, 0, true],
    [3, 1, 1, true],
    [2, 1, 1, false],
    [2, 0, 3, false],
  ])("highlights only uncovered shared weaknesses (%i/%i/%i)", (weakCount, resistCount, immuneCount, exposed) => {
    const diagnostics = emptyDiagnostics();
    diagnostics.defensiveMatchups[0] = {
      ...diagnostics.defensiveMatchups[0], weakCount, resistCount, immuneCount,
    };
    const html = renderToStaticMarkup(createElement(TeamDiagnostics, { diagnostics }));
    expect(html.includes('class="is-exposed"')).toBe(exposed);
    if (exposed) expect(html.match(/class="is-exposed"/g)).toHaveLength(4);
  });
});
