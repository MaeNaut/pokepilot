import type { AiTeamFixture } from "./aiTeamFixtureTypes";
import { AI_TEAM_FIXTURE_RETRIEVED_AT } from "./aiTeamFixtureTypes";

const pokeFeedTeamsUrl = "https://pokefeed.app/teams";
const officialDoublesOverviewUrl =
  "https://www.pokemon.com/us/features/pokemon-champions-regulation-m-b-double-battles-overview";

export const aiTeamDoublesFixtures = [
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-zardwile-tailroom",
    title: "ZardWile Tail Room",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/zardwile-tail-room",
      indexUrl: pokeFeedTeamsUrl,
      author: "Sparkles",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Charizard @ Charizardite Y
Ability: Blaze
Level: 50
EVs: 14 HP / 18 Def / 10 SpA / 24 Spe
Modest Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect

Mawile @ Mawilite
Ability: Hyper Cutter
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Brave Nature
- Play Rough
- Iron Head
- Sucker Punch
- Protect

Sylveon @ Fairy Feather
Ability: Pixilate
Level: 50
EVs: 9 HP / 22 Def / 20 SpA / 15 Spe
Modest Nature
- Hyper Voice
- Hyper Beam
- Quick Attack
- Detect

Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect

Whimsicott @ Focus Sash
Ability: Prankster
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Tailwind
- Encore
- Protect

Farigiraf @ Sitrus Berry
Ability: Armor Tail
Level: 50
EVs: 17 HP / 20 Def / 10 SpA / 19 SpD
Modest Nature
- Twin Beam
- Thunderbolt
- Trick Room
- Helping Hand`,
    expectations: {
      teamIdentities: ["doubles Tailroom", "dual-Mega flexible offense"],
      criticalObservations: [
        "Whimsicott Tailwind and Farigiraf Trick Room provide opposite speed modes.",
        "Mega Charizard Y and Mega Mawile are matchup-dependent alternatives.",
        "Sylveon and Garchomp function in either speed mode and reduce mode dependence.",
      ],
      forbiddenConclusions: [
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Treating the team as exclusively Trick Room or exclusively Tailwind.",
        "Ignoring doubles spread pressure from Heat Wave, Hyper Voice, Earthquake, and Rock Slide.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-charizard-rain",
    title: "Mega Charizard and Pelipper Dual Weather",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/mega-charizard-pelliper-lexicon-vgc",
      indexUrl: pokeFeedTeamsUrl,
      author: "theiappi95",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes: "PokeFeed lists replica code 4122KDDUN0.",
    },
    showdownText: `Charizard @ Charizardite Y
Ability: Blaze
Level: 50
EVs: 30 HP / 4 Def / 21 SpA / 11 Spe
Modest Nature
- Protect
- Heat Wave
- Weather Ball
- Solar Beam

Grimmsnarl @ Light Clay
Ability: Prankster
Level: 50
EVs: 32 HP / 13 Def / 21 SpD
Sassy Nature
- Spirit Break
- Reflect
- Light Screen
- Parting Shot

Pelipper @ Sitrus Berry
Ability: Drizzle
Level: 50
EVs: 31 HP / 1 Def / 5 SpA / 18 SpD / 11 Spe
Modest Nature
- Hurricane
- Weather Ball
- Tailwind
- Wide Guard

Archaludon @ Leftovers
Ability: Stamina
Level: 50
EVs: 32 HP / 1 SpA / 22 SpD / 11 Spe
Calm Nature
- Protect
- Electro Shot
- Dragon Pulse
- Flash Cannon

Basculegion @ Choice Scarf
Ability: Adaptability
Level: 50
EVs: 23 Atk / 11 Def / 32 Spe
Jolly Nature
- Flip Turn
- Wave Crash
- Aqua Jet
- Last Respects

Venusaur @ Focus Sash
Ability: Chlorophyll
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Protect
- Sleep Powder
- Sludge Bomb
- Earth Power`,
    expectations: {
      teamIdentities: ["doubles dual weather", "screens balance"],
      criticalObservations: [
        "Charizard and Venusaur form the sun mode, while Pelipper, Archaludon, and Basculegion form the rain mode.",
        "Grimmsnarl screens and Parting Shot help either mode operate.",
        "Weather replacement is deliberate mode switching rather than an automatic flaw.",
      ],
      forbiddenConclusions: [
        "Calling the opposing weather setters inherently incompatible.",
        "Claiming sun and rain can be active simultaneously.",
        "Ignoring Tailwind and Choice Scarf when discussing speed control.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-snow-trickroom",
    title: "Snow Trick Room",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/snow-trickroom",
      indexUrl: pokeFeedTeamsUrl,
      author: "tacticien",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Abomasnow @ Abomasite
Ability: Snow Warning
Level: 50
EVs: 29 HP / 1 Def / 32 SpA / 1 SpD / 3 Spe
Quiet Nature
- Blizzard
- Energy Ball
- Earth Power
- Protect

Oranguru @ Mental Herb
Ability: Inner Focus
Level: 50
EVs: 32 HP / 32 Def / 2 Spe
Relaxed Nature
- Trick Room
- Instruct
- Psychic
- Scary Face

Rotom-Frost @ Choice Scarf
Ability: Levitate
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Calm Nature
- Blizzard
- Volt Switch
- Discharge
- Will-O-Wisp

Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect

Primarina @ Mystic Water
Ability: Liquid Voice
Level: 50
EVs: 12 HP / 32 SpA / 22 SpD
Sassy Nature
- Hyper Voice
- Moonblast
- Uproar
- Protect

Golurk @ Golurkite
Ability: Iron Fist
Level: 50
EVs: 2 HP / 32 Atk / 32 SpD
Brave Nature
- Headlong Rush
- Poltergeist
- Ice Punch
- Protect`,
    expectations: {
      teamIdentities: ["doubles snow", "Trick Room with a fast off-mode"],
      criticalObservations: [
        "Oranguru enables slow Mega Abomasnow, Primarina, and Mega Golurk through Trick Room and Instruct.",
        "Choice Scarf Rotom-Frost and Garchomp provide a functional fast mode outside Trick Room.",
        "Mega Abomasnow and Mega Golurk are alternative Mega selections.",
      ],
      forbiddenConclusions: [
        "Claiming every attacker depends on Trick Room.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Missing the shared Blizzard pressure enabled by snow.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-maus-ape",
    title: "MausApe With Snow Trick Room",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/maus-ape",
      indexUrl: pokeFeedTeamsUrl,
      author: "tacticien",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes: "PokeFeed lists replica code 8011U9LKEK.",
    },
    showdownText: `Annihilape @ Leftovers
Ability: Defiant
Level: 50
EVs: 23 HP / 5 Atk / 14 Def / 22 SpD / 2 Spe
Adamant Nature
- Drain Punch
- Rage Fist
- Protect
- Bulk Up

Maushold @ Chople Berry
Ability: Friend Guard
Level: 50
EVs: 32 HP / 20 Def / 14 SpD
Bold Nature
- Beat Up
- Follow Me
- Feint
- Protect

Abomasnow @ Abomasite
Ability: Snow Warning
Level: 50
EVs: 32 HP / 32 SpA / 2 Spe
Quiet Nature
- Blizzard
- Energy Ball
- Earth Power
- Protect

Oranguru @ Mental Herb
Ability: Inner Focus
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Relaxed Nature
- Taunt
- Trick Room
- Instruct
- Psychic

Sableye @ Focus Sash
Ability: Prankster
Level: 50
EVs: 32 HP / 2 Atk / 20 Def / 12 SpD
Impish Nature
- Fake Out
- Quash
- Encore
- Disable

Araquanid @ Sitrus Berry
Ability: Water Bubble
Level: 50
EVs: 26 HP / 23 Atk / 17 SpD
Brave Nature
- Wide Guard
- Leech Life
- Liquidation
- Entrainment`,
    expectations: {
      teamIdentities: ["doubles MausApe", "secondary snow Trick Room"],
      criticalObservations: [
        "Maushold uses Beat Up to accelerate Rage Fist while Friend Guard and Follow Me protect Annihilape.",
        "Oranguru enables the slower Abomasnow and Araquanid mode.",
        "Sableye supplies immediate disruption and alternative speed manipulation through Quash.",
      ],
      forbiddenConclusions: [
        "Assuming Maushold is an offensive Population Bomb set.",
        "Reducing the entire roster to a snow team.",
        "Ignoring the independent Annihilape win condition.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-hall-of-walls",
    title: "The Hall of Walls",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/the-hall-of-walls",
      indexUrl: pokeFeedTeamsUrl,
      author: "tacticien",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Aggron @ Aggronite
Ability: Sturdy
Level: 50
EVs: 32 HP / 2 Atk / 32 SpD
Careful Nature
- Body Press
- Heavy Slam
- Iron Defense
- Protect

Dragalge @ Dragalgite
Ability: Adaptability
Level: 50
EVs: 32 HP / 32 Def / 2 SpA
Bold Nature
- Venoshock
- Toxic
- Flip Turn
- Protect

Goodra-Hisui @ Sitrus Berry
Ability: Gooey
Level: 50
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Muddy Water
- Flash Cannon
- Dragon Pulse
- Protect

Sableye @ Roseli Berry
Ability: Prankster
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Fake Out
- Will-O-Wisp
- Disable
- Encore

Milotic @ Zoom Lens
Ability: Competitive
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Muddy Water
- Coil
- Hypnosis
- Icy Wind

Grimmsnarl @ Light Clay
Ability: Prankster
Level: 50
EVs: 32 HP / 17 Def / 17 SpD
Careful Nature
- Fake Out
- Parting Shot
- Reflect
- Light Screen`,
    expectations: {
      teamIdentities: ["doubles screens balance", "bulky control"],
      criticalObservations: [
        "Screens, Intimidate-like attack reduction, burns, speed drops, and sleep compound the team's bulk.",
        "Mega Aggron and Mega Dragalge are alternative defensive-offensive anchors.",
        "The team wins through incremental board control rather than only passive survival.",
      ],
      forbiddenConclusions: [
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Calling the team nonfunctional merely because it lacks Tailwind or Trick Room.",
        "Treating every bulky Pokemon as a passive wall with no win condition.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-swampert-rain",
    title: "Mega Swampert Rain",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/frog-breaks-all-walls-for-bridge-in-rain",
      indexUrl: pokeFeedTeamsUrl,
      author: "jack33mcd",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes: "PokeFeed lists replica code 38NLSM9GSB.",
    },
    showdownText: `Pelipper @ Sitrus Berry
Ability: Drizzle
Level: 50
EVs: 18 Def / 16 SpA / 32 SpD
Calm Nature
- Hurricane
- Protect
- Tailwind
- Wide Guard

Swampert @ Swampertite
Ability: Torrent
Level: 50
EVs: 14 Atk / 32 Def / 20 Spe
Jolly Nature
- Earthquake
- Ice Punch
- Wave Crash
- Protect

Archaludon @ Leftovers
Ability: Stamina
Level: 50
EVs: 9 HP / 25 SpA / 32 SpD
Modest Nature
- Dragon Pulse
- Electro Shot
- Protect
- Flash Cannon

Sableye @ Light Clay
Ability: Prankster
Level: 50
EVs: 32 HP / 2 Def / 32 SpD
Relaxed Nature
- Light Screen
- Reflect
- Rain Dance
- Will-O-Wisp

Sneasler @ Focus Sash
Ability: Unburden
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Close Combat
- Dire Claw
- Protect
- Fake Out

Sinistcha @ Kasib Berry
Ability: Hospitality
Level: 50
EVs: 23 HP / 24 Def / 19 SpA
Relaxed Nature
- Life Dew
- Matcha Gotcha
- Shadow Ball
- Rage Powder`,
    expectations: {
      teamIdentities: ["doubles rain", "screens balance"],
      criticalObservations: [
        "Pelipper enables Mega Swampert and Electro Shot Archaludon, while Sableye can restore rain manually.",
        "Tailwind provides speed control in addition to Mega Swampert's rain interaction.",
        "Sinistcha and screens preserve the rain attackers long enough to exploit their board pressure.",
      ],
      forbiddenConclusions: [
        "Missing Mega Swampert as a primary rain beneficiary.",
        "Treating Rain Dance on Sableye as redundant without considering weather wars.",
        "Ignoring Wide Guard and Rage Powder as doubles-specific protection.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-tailwind-offense",
    title: "Tailwind Hyper Offense",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/tailwind-hyper-offense",
      indexUrl: pokeFeedTeamsUrl,
      author: "featherine",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes: "PokeFeed lists replica code J4NT0WBU1H.",
    },
    showdownText: `Metagross @ Metagrossite
Ability: Clear Body
Level: 50
EVs: 20 HP / 32 Atk / 14 Spe
Adamant Nature
- Psychic Fangs
- Iron Head
- Stomping Tantrum
- Protect

Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 32 Atk / 2 Def / 32 Spe
Adamant Nature
- Rock Slide
- Earthquake
- Swords Dance
- Protect

Talonflame @ Sharp Beak
Ability: Gale Wings
Level: 50
EVs: 32 Atk / 2 Def / 32 Spe
Jolly Nature
- Dual Wingbeat
- Swords Dance
- Protect
- Tailwind

Milotic @ Leftovers
Ability: Competitive
Level: 50
EVs: 16 HP / 32 Def / 18 SpA
Bold Nature
- Scald
- Icy Wind
- Recover
- Protect

Sinistcha @ Focus Sash
Ability: Hospitality
Level: 50
EVs: 22 Def / 24 SpA / 20 SpD
Calm Nature
- Imprison
- Trick Room
- Rage Powder
- Matcha Gotcha

Sneasler @ Shuca Berry
Ability: Poison Touch
Level: 50
EVs: 32 Atk / 32 Spe
Adamant Nature
- Fake Out
- Protect
- Close Combat
- Coaching`,
    expectations: {
      teamIdentities: ["doubles Tailwind offense", "anti-Trick Room utility"],
      criticalObservations: [
        "Talonflame supplies Tailwind while Sinistcha's Imprison plus Trick Room denies opposing Trick Room.",
        "The fast and moderately fast attackers do not indicate a friendly Trick Room mode.",
        "Sneasler's Coaching can accelerate physical win conditions such as Metagross and Garchomp.",
      ],
      forbiddenConclusions: [
        "Calling this a Trick Room team because Sinistcha knows Trick Room.",
        "Recommending slow Trick Room sweepers to complete the team.",
        "Ignoring the distinction between setting Trick Room and imprisoning it.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-pokefeed-light-snow",
    title: "Light Snow",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "published",
      name: "PokeFeed Regulation M-B teams",
      url: "https://pokefeed.app/teams/light-snow",
      indexUrl: pokeFeedTeamsUrl,
      author: "Aetherwind",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes: "PokeFeed lists replica code V1FU8TV3C2.",
    },
    showdownText: `Raichu @ Raichunite Y
Ability: Lightning Rod
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Grass Knot
- Zap Cannon
- Focus Blast
- Fake Out

Meganium @ Meganiumite
Ability: Overgrow
Level: 50
EVs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Weather Ball
- Dazzling Gleam
- Solar Beam
- Protect

Talonflame @ Sharp Beak
Ability: Gale Wings
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Dual Wingbeat
- Flare Blitz
- Protect
- Tailwind

Ninetales-Alola @ Light Clay
Ability: Snow Warning
Level: 50
EVs: 2 Def / 32 SpA / 32 SpD
Calm Nature
- Blizzard
- Aurora Veil
- Protect
- Moonblast

Goodra-Hisui @ Life Orb
Ability: Sap Sipper
Level: 50
EVs: 32 HP / 2 Def / 32 SpA
Modest Nature
- Blizzard
- Flash Cannon
- Draco Meteor
- Protect

Basculegion @ Choice Scarf
Ability: Adaptability
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Wave Crash
- Last Respects
- Aqua Jet
- Psychic Fangs`,
    expectations: {
      teamIdentities: ["doubles snow screens", "Tailwind offense"],
      criticalObservations: [
        "Alolan Ninetales enables Aurora Veil and shared Blizzard accuracy.",
        "Talonflame and Choice Scarf Basculegion preserve a fast mode without Slush Rush.",
        "Mega Raichu Y and Mega Meganium are alternative Mega selections.",
      ],
      forbiddenConclusions: [
        "Calling the team incomplete because it lacks a Slush Rush Pokemon.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Ignoring Aurora Veil as the primary reason to maintain snow.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-boundary-self-weather",
    title: "Boundary: Self-Contained Weather Setters",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "constructed",
      name: "PokePilot archetype-boundary case",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes:
        "Constructed from legal published fixture sets to test weather archetype-forcing and weather replacement.",
    },
    showdownText: `Charizard @ Charizardite Y
Ability: Blaze
Level: 50
EVs: 14 HP / 18 Def / 10 SpA / 24 Spe
Modest Nature
- Heat Wave
- Weather Ball
- Solar Beam
- Protect

Tyranitar @ Sitrus Berry
Ability: Sand Stream
Level: 50
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Rock Slide
- Knock Off
- Low Kick
- Protect

Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect

Milotic @ Leftovers
Ability: Competitive
Level: 50
EVs: 16 HP / 32 Def / 18 SpA
Bold Nature
- Scald
- Icy Wind
- Recover
- Protect

Sneasler @ Focus Sash
Ability: Poison Touch
Level: 50
EVs: 32 Atk / 32 Spe
Adamant Nature
- Fake Out
- Protect
- Close Combat
- Coaching

Sinistcha @ Kasib Berry
Ability: Hospitality
Level: 50
EVs: 23 HP / 24 Def / 19 SpA
Relaxed Nature
- Life Dew
- Matcha Gotcha
- Shadow Ball
- Rage Powder`,
    expectations: {
      teamIdentities: ["doubles flexible balance", "self-contained weather modes"],
      criticalObservations: [
        "Sun and sand improve their setters and selected attacks but the team has no dedicated weather-speed beneficiary.",
        "Icy Wind, Fake Out, Coaching, recovery, and redirection support flexible board states outside either weather.",
        "Weather replacement should be evaluated as a sequencing constraint, not proof that the team needs Chlorophyll or Sand Rush.",
      ],
      forbiddenConclusions: [
        "Demanding a Chlorophyll or Sand Rush attacker to complete the team.",
        "Calling the roster a dedicated sun team or dedicated sand team.",
        "Claiming both weather effects can be active simultaneously.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "doubles-boundary-perish-trap",
    title: "Boundary: Mega Gengar Perish Trap",
    regulation: "M-B",
    battleFormat: "doubles",
    source: {
      origin: "constructed",
      name: "Official M-B overview archetype case",
      url: officialDoublesOverviewUrl,
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes:
        "Constructed from the official overview's Mega Gengar, Politoed, Incineroar, and Sinistcha Perish Trap core.",
    },
    showdownText: `Gengar @ Gengarite
Ability: Cursed Body
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Perish Song
- Shadow Ball
- Disable
- Protect

Politoed @ Sitrus Berry
Ability: Drizzle
Level: 50
EVs: 32 HP / 16 Def / 18 SpD
Calm Nature
- Perish Song
- Icy Wind
- Helping Hand
- Protect

Incineroar @ Safety Goggles
Ability: Intimidate
Level: 50
EVs: 32 HP / 16 Def / 18 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Knock Off

Sinistcha @ Focus Sash
Ability: Hospitality
Level: 50
EVs: 23 HP / 24 Def / 19 SpA
Relaxed Nature
- Life Dew
- Matcha Gotcha
- Rage Powder
- Protect

Kingambit @ Black Glasses
Ability: Defiant
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect

Sneasler @ Shuca Berry
Ability: Poison Touch
Level: 50
EVs: 32 Atk / 32 Spe
Adamant Nature
- Fake Out
- Close Combat
- Dire Claw
- Protect`,
    expectations: {
      teamIdentities: ["doubles Perish Trap", "Mega Gengar control"],
      criticalObservations: [
        "Mega Gengar's Shadow Tag and two Perish Song users define the primary control plan.",
        "Fake Out, Parting Shot, redirection, healing, speed drops, and Protect help stall Perish turns.",
        "Kingambit and Sneasler provide direct-damage alternatives when trapping is unfavorable.",
      ],
      forbiddenConclusions: [
        "Calling the team rain offense solely because Politoed has Drizzle.",
        "Missing the interaction between Shadow Tag and Perish Song.",
        "Assuming every game must be won through Perish Song.",
      ],
    },
  },
] satisfies AiTeamFixture[];
