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
  {
    schemaVersion: 1,
    id: "pokemon-hippowdon-singles-anchor",
    teamFixtureId: "singles-m3-02-sand-dual-mega",
    selectedSlot: 0,
    expectedPokemonName: "Hippowdon",
    expectations: {
      teamIdentities: [
        "Singles defensive anchor and phazer",
        "self-contained sand support rather than dedicated sand offense",
      ],
      criticalObservations: [
        "Hippowdon combines Yawn, Whirlwind, recovery, and physical bulk to create positioning and chip for either Mega branch.",
        "Sand Stream supplies passive chip and self-contained value, but the roster has no supplied Sand Rush beneficiary.",
        "Its Earthquake is a Singles attack and must not be discussed through ally-positioning assumptions.",
      ],
      forbiddenConclusions: [
        "Calling Hippowdon an incomplete weather setter because the roster lacks a Sand Rush ace.",
        "Applying Doubles spread-damage or partner-immunity logic to Earthquake.",
        "Treating its low Speed as proof that the team uses Trick Room.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "pokemon-metagross-singles-setup",
    teamFixtureId: "singles-m3-06-metagross-gyarados",
    selectedSlot: 0,
    expectedPokemonName: "Metagross",
    expectations: {
      teamIdentities: [
        "Mega Metagross defensive setup branch",
        "Iron Defense and Body Press win condition",
      ],
      criticalObservations: [
        "The configured Metagross uses Iron Defense to strengthen both physical durability and Body Press rather than relying on a conventional Attack-invested four-attack set.",
        "Bullet Punch supplies priority while Psychic Fangs preserves direct STAB pressure and screen removal value.",
        "Mega Gyarados is a mutually exclusive matchup branch, not a second simultaneous activation.",
      ],
      forbiddenConclusions: [
        "Describing the set as a standard all-out physical attacker from species reputation alone.",
        "Claiming its Body Press damage scales from Attack investment.",
        "Treating Mega Metagross and Mega Gyarados as simultaneously active.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "pokemon-pelipper-rain-support",
    teamFixtureId: "doubles-pokefeed-swampert-rain",
    selectedSlot: 0,
    expectedPokemonName: "Pelipper",
    expectations: {
      teamIdentities: [
        "Doubles rain setter and speed-control support",
        "Wide Guard and Ground-immune positioning partner",
      ],
      criticalObservations: [
        "Drizzle enables Mega Swampert and Electro Shot Archaludon while Tailwind provides a separate teamwide speed-control layer.",
        "Pelipper is genuinely immune to Swampert's Earthquake through its current defensive profile.",
        "Wide Guard is a matchup tool against opposing spread attacks rather than generic single-target protection.",
      ],
      forbiddenConclusions: [
        "Calling Pelipper merely a rain attacker and omitting its Tailwind or Wide Guard responsibilities.",
        "Confusing a Ground resistance with the supplied Ground immunity.",
        "Claiming Pelipper and Sableye must both spend the same turn setting rain.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "pokemon-maushold-ace-support",
    teamFixtureId: "doubles-strategy-floette-delphox-protect-ace",
    selectedSlot: 2,
    expectedPokemonName: "Maushold",
    expectations: {
      teamIdentities: [
        "Friend Guard and Follow Me ace support",
        "matchup-dependent utility rather than a mandatory attacker",
      ],
      criticalObservations: [
        "Friend Guard and Follow Me protect whichever Mega setup branch is selected without implying that both Mega Pokemon activate.",
        "Feint can punish Protect while Super Fang creates progress without requiring offensive investment.",
        "Maushold competes with the roster's other support options by matchup and need not be selected alongside every redirection user.",
      ],
      forbiddenConclusions: [
        "Judging Maushold as an underpowered attacker because its primary responsibility is support.",
        "Recommending all redirection Pokemon in the same four-Pokemon lineup by default.",
        "Treating Friend Guard as protection while Maushold is not active beside the beneficiary.",
      ],
    },
  },
] as const satisfies readonly AiPokemonAnalysisFixture[];
