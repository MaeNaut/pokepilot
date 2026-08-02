import { aiTeamDoublesFixtures } from "./aiTeamDoublesFixtures";
import { aiTeamSinglesFixtures } from "./aiTeamSinglesFixtures";
import { aiTeamStrategyFixtures } from "./aiTeamStrategyFixtures";

export type {
  AiTeamFixture,
  AiTeamFixtureExpectations,
  AiTeamFixtureOrigin,
  AiTeamFixtureSource,
} from "./aiTeamFixtureTypes";

export {
  aiTeamDoublesFixtures,
  aiTeamSinglesFixtures,
  aiTeamStrategyFixtures,
};

export const aiTeamBaselineFixtures = [
  ...aiTeamSinglesFixtures,
  ...aiTeamDoublesFixtures,
];

export const aiTeamFixtures = [
  ...aiTeamBaselineFixtures,
  ...aiTeamStrategyFixtures,
];
