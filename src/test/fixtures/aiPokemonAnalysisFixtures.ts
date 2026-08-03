import type { AiTeamFixtureExpectations } from "./aiTeamFixtureTypes";

export type AiPokemonAnalysisFixture = {
  schemaVersion: 1;
  id: string;
  teamFixtureId: string;
  selectedSlot: number;
  expectedPokemonName: string;
  expectations: AiTeamFixtureExpectations;
};

export const aiPokemonAnalysisFixtures = [
  {
    schemaVersion: 1,
    id: "pokemon-zoroark-round-illusion",
    teamFixtureId: "doubles-strategy-zoroark-round-chain",
    selectedSlot: 3,
    expectedPokemonName: "Zoroark-Hisui",
    expectations: {
      teamIdentities: [
        "Choice Scarf Round trigger",
        "Illusion-assisted opening and post-Trick-Room attacker",
      ],
      criticalObservations: [
        "Choice Scarf Hisuian Zoroark is the first Round user, while Mega Gardevoir is the strongest boosted responder through Pixilate.",
        "Illusion should compare Farigiraf's apparent Armor Tail priority protection with Gengar's current Cursed Body and optional Mega Shadow Tag pressure; either presentation is defensible when its concrete first-turn tradeoff is explained.",
        "The fast Zoroark can pressure before Trick Room, be preserved while Trick Room is active, and return after it expires rather than being treated as a normal in-room attacker.",
      ],
      forbiddenConclusions: [
        "Claiming that a slower teammate starts Round before Choice Scarf Hisuian Zoroark under ordinary move order.",
        "Treating all Round partners as interchangeable instead of comparing Mega Gardevoir's Pixilate response.",
        "Using the other active lead as the Illusion presentation or recommending a disguise from generic visual ambiguity without a concrete decision impact.",
        "Telling Hisuian Zoroark to attack freely during Trick Room without a supplied priority or forced-order interaction.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "pokemon-swampert-rain-positioning",
    teamFixtureId: "doubles-pokefeed-swampert-rain",
    selectedSlot: 1,
    expectedPokemonName: "Swampert",
    expectations: {
      teamIdentities: [
        "Mega Swampert rain attacker",
        "Earthquake positioning with exact defensive relations",
      ],
      criticalObservations: [
        "Pelipper's Drizzle activates Mega Swampert's Swift Swim branch, while Sableye can restore rain manually.",
        "Pelipper is the supplied Ground-immune Earthquake partner.",
        "Sinistcha resists Ground but still takes Earthquake, while Archaludon and Sneasler are weak to Ground.",
      ],
      forbiddenConclusions: [
        "Calling Sinistcha immune to Ground or a damage-free Earthquake partner.",
        "Claiming Rage Powder protects an ally from Earthquake or from an unsupported spread interaction.",
        "Ignoring the distinction between Pelipper's immunity and Sinistcha's resistance.",
      ],
    },
  },
] as const satisfies readonly AiPokemonAnalysisFixture[];
