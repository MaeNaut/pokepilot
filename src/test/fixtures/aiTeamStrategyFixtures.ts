import type { AiTeamFixture } from "./aiTeamFixtureTypes";

const gameCardsTeamsUrl = "https://www.gamecards.gg/teams";
const strategyFixtureRetrievedAt = "2026-08-01";

/**
 * Focused strategy regressions complement the balanced 20-team baseline.
 * They target interactions that are easy to miss when sets are read one at a
 * time, and remain evaluator-only inputs rather than production prompt hints.
 */
export const aiTeamStrategyFixtures = [
  {
    schemaVersion: 1,
    id: "doubles-strategy-staraptor-charm-funnel",
    title: "Mega Staraptor Charm Ace Funnel",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "GameCards Staraptor and Skarmory Hyper Offense report",
      url: "https://www.gamecards.gg/teams/staraptor-skarmory-hyper-offense",
      indexUrl: gameCardsTeamsUrl,
      author: "mikan_n_kanzume",
      retrievedAt: strategyFixtureRetrievedAt,
    },
    showdownText: `Staraptor @ Staraptite
Ability: Intimidate
Level: 50
EVs: 32 HP / 2 Atk / 32 Spe
Jolly Nature
- Close Combat
- Brave Bird
- Roost
- Protect

Skarmory @ Skarmorite
Ability: Sturdy
Level: 50
EVs: 7 HP / 32 Atk / 27 Spe
Adamant Nature
- Iron Head
- Brave Bird
- Rock Tomb
- Protect

Sylveon @ Fairy Feather
Ability: Pixilate
Level: 50
EVs: 23 HP / 28 SpA / 15 Spe
Modest Nature
- Hyper Voice
- Hyper Beam
- Roar
- Protect

Whimsicott @ Focus Sash
Ability: Prankster
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Tailwind
- Encore
- Charm

Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect

Basculegion @ Choice Scarf
Ability: Adaptability
Level: 50
EVs: 32 Atk / 1 Def / 1 SpD / 32 Spe
Jolly Nature
- Last Respects
- Wave Crash
- Aqua Jet
- Flip Turn`,
    expectations: {
      teamIdentities: [
        "doubles Mega Staraptor ace funnel",
        "fast offense with a matchup-dependent second Mega",
      ],
      criticalObservations: [
        "After Staraptor Mega Evolves into Contrary, allied Prankster Charm becomes a two-stage Attack boost rather than a debuff.",
        "Whimsicott also supplies Tailwind, while the remaining attackers preserve immediate pressure when committing a turn to the Staraptor setup is unsafe.",
        "Mega Skarmory is an alternative Mega for hostile Staraptor matchups, and Sylveon's Roar is anti-Trick-Room insurance rather than a friendly slow mode.",
      ],
      forbiddenConclusions: [
        "Treating Charm only as an opposing Attack debuff and missing the allied Contrary interaction.",
        "Claiming Mega Staraptor and Mega Skarmory can both activate in one battle.",
        "Calling the team a Trick Room composition because Sylveon carries Roar as disruption.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-strategy-floette-delphox-protect-ace",
    title: "Mega Floette and Mega Delphox Protect-the-Ace",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "GameCards Mega Floette and Mega Delphox team report",
      url: "https://www.gamecards.gg/teams/floette-delphox-setup-redirection",
      indexUrl: gameCardsTeamsUrl,
      author: "pokemon_tcg",
      retrievedAt: strategyFixtureRetrievedAt,
      notes:
        "Published as a Regulation M-A team and retained under the current M-B analysis contract as a cross-regulation strategy regression.",
    },
    showdownText: `Vivillon @ Choice Scarf
Ability: Compound Eyes
Level: 50
EVs: 24 Def / 5 SpA / 5 SpD / 32 Spe
Timid Nature
- Sleep Powder
- Hurricane
- Rage Powder
- Tailwind

Sinistcha @ Kasib Berry
Ability: Hospitality
Level: 50
EVs: 32 HP / 24 Def / 10 SpD
Bold Nature
- Matcha Gotcha
- Rage Powder
- Life Dew
- Protect

Maushold @ Chople Berry
Ability: Friend Guard
Level: 50
EVs: 32 HP / 20 Def / 14 SpD
Impish Nature
- Follow Me
- Super Fang
- Feint
- Protect

Delphox @ Delphoxite
Ability: Blaze
Level: 50
EVs: 19 HP / 1 Def / 17 SpA / 29 Spe
Modest Nature
- Heat Wave
- Psychic
- Nasty Plot
- Protect

Floette-Eternal @ Floettite
Ability: Flower Veil
Level: 50
EVs: 4 HP / 25 Def / 5 SpA / 32 Spe
Modest Nature
- Moonblast
- Draining Kiss
- Calm Mind
- Protect

Incineroar @ Passho Berry
Ability: Intimidate
Level: 50
EVs: 31 HP / 7 Def / 20 SpD / 8 Spe
Careful Nature
- Parting Shot
- Fake Out
- Throat Chop
- Flare Blitz`,
    expectations: {
      teamIdentities: [
        "doubles protect-the-ace setup",
        "dual-Mega redirection offense",
      ],
      criticalObservations: [
        "The matchup determines whether Mega Floette sets Calm Mind or Mega Delphox sets Nasty Plot as the single protected win condition.",
        "Vivillon, Sinistcha, and Maushold offer different forms of redirection, sleep, healing, speed control, and Friend Guard rather than three interchangeable empty slots.",
        "Incineroar's Fake Out, Intimidate, and Parting Shot create additional setup turns and help the chosen Mega preserve its snowball.",
      ],
      forbiddenConclusions: [
        "Claiming both Mega setup sweepers can activate in the same battle.",
        "Treating the support-heavy roster as lacking a win condition without recognizing the deliberate ace funnel.",
        "Recommending that all three redirection Pokemon must be selected together in every matchup.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-strategy-zoroark-round-chain",
    title: "Hisuian Zoroark Illusion Round Chain",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "GameCards Mega Gardevoir and Hisuian Zoroark Round report",
      url: "https://www.gamecards.gg/teams/gardevoir-mega-zoroark-hisui-round",
      indexUrl: gameCardsTeamsUrl,
      author: "Andrew Davis",
      retrievedAt: strategyFixtureRetrievedAt,
      notes:
        "Published as a Regulation M-A team and retained under the current M-B analysis contract as a cross-regulation interaction regression.",
    },
    showdownText: `Gardevoir @ Gardevoirite
Ability: Trace
Level: 50
EVs: 32 HP / 9 Def / 25 SpA
Modest Nature
- Hyper Voice
- Round
- Psyshock
- Protect

Farigiraf @ Sitrus Berry
Ability: Armor Tail
Level: 50
EVs: 7 HP / 21 Def / 1 SpA / 32 SpD / 5 Spe
Bold Nature
- Trick Room
- Helping Hand
- Psychic Noise
- Imprison

Dragapult @ Focus Sash
Ability: Infiltrator
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Round
- Draco Meteor
- Hex
- Thunder Wave

Zoroark-Hisui @ Choice Scarf
Ability: Illusion
Level: 50
EVs: 7 HP / 1 Def / 32 SpA / 1 SpD / 25 Spe
Modest Nature
- Round
- Bitter Malice
- Hex
- Icy Wind

Sableye @ Roseli Berry
Ability: Prankster
Level: 50
EVs: 32 HP / 7 Def / 27 SpD
Impish Nature
- Fake Out
- Thunder Wave
- Encore
- Will-O-Wisp

Gengar @ Gengarite
Ability: Cursed Body
Level: 50
EVs: 31 HP / 1 Def / 1 SpA / 1 SpD / 32 Spe
Timid Nature
- Hex
- Sludge Bomb
- Disable
- Protect`,
    expectations: {
      teamIdentities: [
        "doubles Illusion-assisted Round combo",
        "secondary status and Hex offense",
      ],
      criticalObservations: [
        "Choice Scarf Hisuian Zoroark can lead and use Round first, immediately triggering Mega Gardevoir's stronger Pixilate Round in the same turn.",
        "Illusion can present Zoroark as Farigiraf, creating uncertainty around Armor Tail and Fake Out while concealing the Round trigger.",
        "Dragapult supplies another Round option and spreads paralysis for the team's Hex users, while Farigiraf's Imprison plus Trick Room can deny opposing speed reversal.",
      ],
      forbiddenConclusions: [
        "Restricting Hisuian Zoroark to a late-game cleaner and missing it as a possible Round lead.",
        "Separating the two Round users into different turns or claiming Mega Gardevoir is too slow for the chain to work.",
        "Calling the roster a conventional Trick Room team solely because Farigiraf carries Trick Room.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-strategy-froslass-rain-counter",
    title: "Mega Froslass Manual Rain Anti-Sun Tech",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "constructed",
      name: "PokePilot manual-weather interaction case",
      url: "https://serebii.net/potw-champions/478.shtml",
      indexUrl: "https://www.gamecards.gg/teams/froslass-dragonite",
      retrievedAt: strategyFixtureRetrievedAt,
      notes:
        "Adapted from the published Froslass and Dragonite snow roster. Rain Dance is moved onto Mega Froslass to isolate the documented anti-Charizard-Y lure while preserving six legal complete sets.",
    },
    showdownText: `Basculegion @ Sitrus Berry
Ability: Adaptability
Level: 50
EVs: 12 HP / 8 Atk / 27 Def / 9 SpD / 10 Spe
Adamant Nature
- Protect
- Wave Crash
- Aqua Jet
- Last Respects

Sneasler @ Focus Sash
Ability: Unburden
Level: 50
EVs: 32 Atk / 4 Def / 30 Spe
Adamant Nature
- Rock Slide
- Close Combat
- Dire Claw
- Fake Out

Dragonite @ Dragoninite
Ability: Multiscale
Level: 50
EVs: 25 HP / 32 SpA / 9 Spe
Modest Nature
- Dragon Pulse
- Heat Wave
- Extreme Speed
- Tailwind

Ninetales-Alola @ Never-Melt Ice
Ability: Snow Warning
Level: 50
EVs: 9 HP / 11 Def / 19 SpA / 27 Spe
Timid Nature
- Blizzard
- Freeze-Dry
- Protect
- Aurora Veil

Kingambit @ Chople Berry
Ability: Defiant
Level: 50
EVs: 24 HP / 25 Atk / 1 Def / 16 Spe
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Low Kick

Froslass @ Froslassite
Ability: Snow Cloak
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Blizzard
- Shadow Ball
- Aurora Veil
- Rain Dance`,
    expectations: {
      teamIdentities: [
        "doubles snow offense",
        "matchup-specific manual weather counterplay",
      ],
      criticalObservations: [
        "Mega Froslass can use its high Speed to cast Rain Dance after Mega Charizard Y has activated Drought, replacing sun before Charizard attacks and weakening Fire damage.",
        "The Rain Dance slot is a targeted anti-sun lure that can also strengthen Basculegion, not proof that every selection follows a dedicated rain plan.",
        "Rain overwrites Mega Froslass's own Snow, so the line trades continued Blizzard and Aurora Veil support for immediate weather denial in the relevant matchup.",
      ],
      forbiddenConclusions: [
        "Calling Rain Dance redundant or unusable merely because Mega Froslass first sets Snow Warning.",
        "Assuming Mega Charizard Y's Drought must remain active for the whole turn after Mega Evolution.",
        "Reclassifying the entire roster as dedicated rain offense or claiming Mega Froslass and Mega Dragonite can both activate together.",
      ],
    },
  },
] satisfies AiTeamFixture[];
