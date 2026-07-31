import { aiTeamDoublesFixtures } from "./aiTeamDoublesFixtures";
import { aiTeamSinglesFixtures } from "./aiTeamSinglesFixtures";

export type {
  AiTeamFixture,
  AiTeamFixtureExpectations,
  AiTeamFixtureOrigin,
  AiTeamFixtureSource,
} from "./aiTeamFixtureTypes";

export { aiTeamDoublesFixtures, aiTeamSinglesFixtures };

export const aiTeamFixtures = [
  ...aiTeamSinglesFixtures,
  ...aiTeamDoublesFixtures,
];
