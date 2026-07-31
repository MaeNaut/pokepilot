import type { BattleFormat } from "../../battleFormat/battleFormat";

export type AiTeamFixtureOrigin = "published" | "constructed";

export type AiTeamFixtureSource = {
  origin: AiTeamFixtureOrigin;
  name: string;
  url?: string;
  indexUrl?: string;
  author?: string;
  placement?: string;
  retrievedAt: string;
  notes?: string;
};

export type AiTeamFixtureExpectations = {
  /**
   * Broad identities that a useful analysis may recognize. These are not an
   * exact-answer template and do not require the model to use the same words.
   */
  teamIdentities: string[];
  /**
   * Strategically important facts that should survive summarization.
   */
  criticalObservations: string[];
  /**
   * Claims that would reveal a format mistake, archetype-forcing, or a serious
   * misunderstanding of the supplied sets.
   */
  forbiddenConclusions: string[];
};

export type AiTeamFixture = {
  schemaVersion: 1;
  id: string;
  title: string;
  regulation: "M-B";
  battleFormat: BattleFormat;
  source: AiTeamFixtureSource;
  showdownText: string;
  expectations: AiTeamFixtureExpectations;
};

export const AI_TEAM_FIXTURE_RETRIEVED_AT = "2026-07-27";
