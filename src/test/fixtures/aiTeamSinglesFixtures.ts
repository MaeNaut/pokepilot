import type { AiTeamFixture } from "./aiTeamFixtureTypes";
import { AI_TEAM_FIXTURE_RETRIEVED_AT } from "./aiTeamFixtureTypes";

const singlesIndexUrl =
  "https://tox.hatenablog.com/entry/2026/07/10/BattleBattle_Stadium_Singles_blog_%E2%80%94_Season_3_Top-15_Team_Listing_%28Regulation_M-B%3B_Season_M-3%29";

export const aiTeamSinglesFixtures = [
  {
    schemaVersion: 1,
    id: "singles-m3-01-gengar-starmie",
    title: "M-3 #1 Gengar and Mega Starmie",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/baa4e130eab18c3d",
      indexUrl: singlesIndexUrl,
      author: "kacr",
      placement: "Season M-3 #1",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Gengar-Mega @ Gengarite
Ability: Shadow Tag
Level: 50
EVs: 18 HP / 13 SpA / 3 SpD / 32 Spe
Timid Nature
- Protect
- Perish Song
- Shadow Ball
- Destiny Bond

Bellibolt @ Leftovers
Ability: Electromorphosis
Level: 50
EVs: 31 HP / 4 Def / 28 SpD / 3 Spe
Calm Nature
- Volt Switch
- Toxic
- Slack Off
- Soak

Whimsicott @ Focus Sash
Ability: Prankster
Level: 50
EVs: 2 Def / 32 SpA / 32 Spe
Modest Nature
- Moonblast
- Tailwind
- Encore
- Endeavor

Samurott-Hisui @ Black Glasses
Ability: Sharpness
Level: 50
EVs: 20 HP / 32 Atk / 2 SpD / 12 Spe
Adamant Nature
- Ceaseless Edge
- Sucker Punch
- Aqua Cutter
- Sacred Sword

Corviknight @ Sitrus Berry
Ability: Pressure
Level: 50
EVs: 32 HP / 1 Atk / 30 Def / 2 SpD / 1 Spe
Impish Nature
- Roost
- Iron Head
- Bulk Up
- U-turn

Starmie-Mega @ Starminite
Ability: Huge Power
Level: 50
EVs: 8 HP / 32 Atk / 1 Def / 25 Spe
Jolly Nature
- Aqua Jet
- Flip Turn
- Liquidation
- Ice Spinner`,
    expectations: {
      teamIdentities: ["singles balance", "dual-Mega selection pressure"],
      criticalObservations: [
        "Mega Gengar supplies trapping and Perish Song utility while Mega Starmie supplies immediate physical pressure.",
        "Samurott-Hisui adds entry-hazard pressure through Ceaseless Edge.",
        "The six Pokemon form multiple three-Pokemon selections rather than one mandatory lineup.",
      ],
      forbiddenConclusions: [
        "Treating Tailwind as doubles-wide speed support.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Calling this a dedicated Perish Trap team solely because Gengar carries Perish Song.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-02-sand-dual-mega",
    title: "M-3 #2 Hippowdon Dual Mega Balance",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/910c21845b6eb018",
      indexUrl: singlesIndexUrl,
      author: "Morgan",
      placement: "Season M-3 #2 and #21",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Hippowdon @ Sitrus Berry
Ability: Sand Stream
Level: 50
EVs: 32 HP / 22 Def / 10 SpD / 2 Spe
Impish Nature
- Earthquake
- Slack Off
- Whirlwind
- Yawn

Dragonite-Mega @ Dragoninite
Ability: Multiscale
Level: 50
EVs: 9 HP / 1 Def / 24 SpA / 32 Spe
Modest Nature
- Draco Meteor
- Air Slash
- Flamethrower
- Roost

Archaludon @ Choice Scarf
Ability: Sturdy
Level: 50
EVs: 1 Def / 32 SpA / 1 SpD / 32 Spe
Timid Nature
- Draco Meteor
- Flash Cannon
- Dark Pulse
- Thunderbolt

Mimikyu @ Life Orb
Ability: Disguise
Level: 50
EVs: 29 HP / 26 Atk / 11 Def
Adamant Nature
- Swords Dance
- Shadow Claw
- Shadow Sneak
- Play Rough

Metagross-Mega @ Metagrossite
Ability: Tough Claws
Level: 50
EVs: 10 HP / 25 Atk / 8 SpA / 23 Spe
Adamant Nature
- Psychic Fangs
- Hammer Arm
- Bullet Punch
- Grass Knot

Primarina @ Leftovers
Ability: Torrent
Level: 50
EVs: 32 HP / 29 Def / 4 SpA / 1 SpD
Quiet Nature
- Sparkling Aria
- Moonblast
- Aqua Jet
- Encore`,
    expectations: {
      teamIdentities: ["singles bulky offense", "dual-Mega selection pressure"],
      criticalObservations: [
        "Hippowdon's sand is primarily self-contained chip and defensive support; no Sand Rush beneficiary is present.",
        "Choice Scarf Archaludon is the explicit speed-control option.",
        "Dragonite and Metagross offer distinct Mega matchups and should be discussed as alternatives.",
      ],
      forbiddenConclusions: [
        "Calling the roster an incomplete sand offense because it lacks a Sand Rush sweeper.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Applying doubles spread-move or partner-synergy assumptions.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-03-delphox-floette",
    title: "M-3 #3 Mega Delphox and Mega Floette",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/1033c7f3912d0c71",
      indexUrl: singlesIndexUrl,
      author: "mono",
      placement: "Season M-3 #3",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Rotom-Wash @ Choice Scarf
Ability: Levitate
Level: 50
EVs: 6 HP / 32 SpA / 28 Spe
Timid Nature
- Hydro Pump
- Volt Switch
- Thunderbolt
- Trick

Mimikyu @ Life Orb
Ability: Disguise
Level: 50
EVs: 1 HP / 32 Atk / 1 Def / 32 Spe
Adamant Nature
- Play Rough
- Shadow Claw
- Shadow Sneak
- Swords Dance

Garchomp @ Sitrus Berry
Ability: Rough Skin
Level: 50
EVs: 32 HP / 30 Def / 4 Spe
Impish Nature
- Earthquake
- Dragon Tail
- Stealth Rock
- Spikes

Delphox-Mega @ Delphoxite
Ability: Levitate
Level: 50
EVs: 5 HP / 32 SpA / 29 Spe
Modest Nature
- Flamethrower
- Psychic
- Shadow Ball
- Dazzling Gleam

Floette-Mega (F) @ Floettite
Ability: Fairy Aura
Level: 50
EVs: 6 Def / 28 SpA / 32 Spe
Timid Nature
- Moonblast
- Light of Ruin
- Draining Kiss
- Calm Mind

Scizor @ Metal Coat
Ability: Technician
Level: 50
EVs: 32 HP / 2 Atk / 32 Def
Impish Nature
- U-turn
- Bullet Punch
- Knock Off
- Roost`,
    expectations: {
      teamIdentities: ["singles hazard balance", "mixed offense"],
      criticalObservations: [
        "Garchomp provides both Stealth Rock and Spikes, making hazard pressure a central structural feature.",
        "Rotom-Wash provides speed control and disruption through Choice Scarf and Trick.",
        "Mega Delphox and Mega Floette are matchup-dependent alternatives rather than simultaneous win conditions.",
      ],
      forbiddenConclusions: [
        "Describing Fairy Aura as an ally-wide doubles plan.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Ignoring the physical priority supplied by Mimikyu and Scizor.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-06-metagross-gyarados",
    title: "M-3 #6 Metagross and Gyarados",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/089227b7a689282c",
      indexUrl: singlesIndexUrl,
      author: "bannbee",
      placement: "Season M-3 #6",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Metagross @ Metagrossite
Ability: Clear Body
Level: 50
EVs: 32 HP / 11 Def / 23 Spe
Impish Nature
- Psychic Fangs
- Iron Defense
- Body Press
- Bullet Punch

Hippowdon @ Sitrus Berry
Ability: Sand Stream
Level: 50
EVs: 32 HP / 6 Def / 28 SpD
Careful Nature
- Earthquake
- Yawn
- Whirlwind
- Stealth Rock

Primarina @ Leftovers
Ability: Torrent
Level: 50
EVs: 32 HP / 20 Def / 14 Spe
Modest Nature
- Sparkling Aria
- Moonblast
- Encore
- Aqua Jet

Meowscarada @ Life Orb
Ability: Overgrow
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Knock Off
- Flower Trick
- Taunt
- Sucker Punch

Gyarados @ Gyaradosite
Ability: Intimidate
Level: 50
EVs: 1 HP / 32 Atk / 1 Def / 32 Spe
Adamant Nature
- Crunch
- Ice Fang
- Power Whip
- Dragon Dance

Kingambit @ Lum Berry
Ability: Supreme Overlord
Level: 50
EVs: 8 HP / 32 Atk / 2 Def / 24 Spe
Adamant Nature
- Kowtow Cleave
- Iron Head
- Sucker Punch
- Swords Dance`,
    expectations: {
      teamIdentities: ["singles physical offense", "hazard-supported setup"],
      criticalObservations: [
        "Hippowdon supports setup opportunities with Stealth Rock, Yawn, and phazing rather than enabling a Sand Rush core.",
        "Mega Metagross is a defensive setup route while Mega Gyarados is a Dragon Dance route.",
        "Primarina is the principal special attacker on an otherwise physically weighted roster.",
      ],
      forbiddenConclusions: [
        "Calling this dedicated sand offense.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Treating Intimidate as active after Gyarados Mega Evolves without noting the timing.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-08-lucario-screens",
    title: "M-3 #8 Mega Lucario Screens",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/4f689d20073fb236",
      indexUrl: singlesIndexUrl,
      author: "sakku",
      placement: "Season M-3 #8",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Hippowdon @ Sitrus Berry
Ability: Sand Stream
Level: 50
EVs: 32 HP / 2 Def / 32 SpD
Relaxed Nature
- Earthquake
- Stealth Rock
- Yawn
- Whirlwind

Lucario-Mega @ Lucarionite
Ability: Adaptability
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Close Combat
- Meteor Mash
- Extreme Speed
- Swords Dance

Dragonite @ Life Orb
Ability: Multiscale
Level: 50
EVs: 1 HP / 32 Atk / 1 SpD / 32 Spe
Jolly Nature
- Dragon Dance
- Outrage
- Earthquake
- Extreme Speed

Ninetales-Alola @ Light Clay
Ability: Snow Warning
Level: 50
EVs: 11 HP / 10 Def / 32 SpA / 13 Spe
Timid Nature
- Blizzard
- Freeze-Dry
- Aurora Veil
- Pain Split

Rotom-Wash @ Leftovers
Ability: Levitate
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Bold Nature
- Hydro Pump
- Volt Switch
- Will-O-Wisp
- Light Screen

Basculegion (M) @ Choice Scarf
Ability: Adaptability
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Wave Crash
- Last Respects
- Aqua Jet
- Flip Turn`,
    expectations: {
      teamIdentities: ["singles screens offense", "physical setup offense"],
      criticalObservations: [
        "Aurora Veil and Light Screen create setup windows for Mega Lucario and Dragonite.",
        "Choice Scarf Basculegion is an independent speed-control and cleanup option.",
        "Snow primarily enables Aurora Veil; the team is not built around Slush Rush.",
      ],
      forbiddenConclusions: [
        "Calling the roster a dedicated snow offense.",
        "Demanding a Slush Rush ace because Snow Warning is present.",
        "Applying doubles partner or spread-move logic.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-09-lopunny-starmie",
    title: "M-3 #9 Mega Lopunny and Mega Starmie",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/117f6cbd9b0997c1",
      indexUrl: singlesIndexUrl,
      author: "Gekiseiko",
      placement: "Season M-3 #9",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Hippowdon @ Leftovers
Ability: Sand Stream
Level: 50
EVs: 32 HP / 18 Def / 16 SpD
Impish Nature
- Earthquake
- Yawn
- Slack Off
- Protect

Lopunny-Mega @ Lopunnite
Ability: Scrappy
Level: 50
EVs: 1 HP / 32 Atk / 1 Def / 32 Spe
Adamant Nature
- Fake Out
- Close Combat
- Triple Axel
- Mach Punch

Aegislash @ Spell Tag
Ability: Stance Change
Level: 50
EVs: 32 HP / 2 Atk / 32 SpA
Quiet Nature
- Shadow Ball
- Shadow Sneak
- King's Shield
- Sacred Sword

Glimmora @ Focus Sash
Ability: Toxic Debris
Level: 50
EVs: 1 HP / 1 Def / 32 SpA / 32 Spe
Timid Nature
- Sludge Wave
- Mud Shot
- Energy Ball
- Stealth Rock

Starmie-Mega @ Starminite
Ability: Huge Power
Level: 50
EVs: 32 Atk / 1 Def / 1 SpD / 32 Spe
Adamant Nature
- Flip Turn
- Aqua Jet
- Liquidation
- Zen Headbutt

Meowscarada @ Choice Scarf
Ability: Protean
Level: 50
EVs: 32 Atk / 2 Def / 32 Spe
Jolly Nature
- Flower Trick
- Triple Axel
- U-turn
- Foul Play`,
    expectations: {
      teamIdentities: ["singles offense", "hazard-supported pivoting"],
      criticalObservations: [
        "Mega Lopunny and Mega Starmie are alternative high-tempo attackers.",
        "Glimmora provides Stealth Rock while Meowscarada and Starmie maintain momentum.",
        "Aegislash supplies mixed damage and defensive tempo in a mostly fast roster.",
      ],
      forbiddenConclusions: [
        "Calling the team dedicated sand offense.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Treating Fake Out as doubles-only partner support.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-10-floette-baton-pass",
    title: "M-3 #10 Mega Floette Baton Pass",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/9474df8990a2c087",
      indexUrl: singlesIndexUrl,
      author: "cloyster",
      placement: "Season M-3 #10",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
    },
    showdownText: `Hippowdon @ Sitrus Berry
Ability: Sand Stream
Level: 50
EVs: 32 HP / 4 Def / 28 SpD / 2 Spe
Careful Nature
- Earthquake
- Stealth Rock
- Yawn
- Whirlwind

Archaludon @ Chesto Berry
Ability: Stamina
Level: 50
EVs: 32 HP / 21 Def / 9 SpA / 3 SpD / 1 Spe
Bold Nature
- Dragon Pulse
- Flash Cannon
- Dark Pulse
- Rest

Floette-Mega (F) @ Floettite
Ability: Fairy Aura
Level: 50
EVs: 32 HP / 32 Def / 1 SpA / 1 Spe
Bold Nature
- Baton Pass
- Calm Mind
- Moonblast
- Synthesis

Gyarados @ Leftovers
Ability: Intimidate
Level: 50
EVs: 31 HP / 11 Atk / 21 Def / 1 SpD / 2 Spe
Adamant Nature
- Waterfall
- Temper Flare
- Dragon Tail
- Power Whip

Aegislash @ Spell Tag
Ability: Stance Change
Level: 50
EVs: 24 HP / 30 Atk / 12 Def
Brave Nature
- Poltergeist
- Shadow Ball
- King's Shield
- Shadow Sneak

Garchomp @ Lum Berry
Ability: Rough Skin
Level: 50
EVs: 8 HP / 20 Atk / 16 Def / 22 Spe
Adamant Nature
- Scale Shot
- Poison Jab
- Earthquake
- Swords Dance`,
    expectations: {
      teamIdentities: ["singles bulky setup", "Baton Pass support"],
      criticalObservations: [
        "Mega Floette can pass Calm Mind boosts, so recipient compatibility matters more than raw type coverage alone.",
        "Hippowdon and Gyarados create phazing and status pressure around the setup plan.",
        "Garchomp remains an independent physical win condition.",
      ],
      forbiddenConclusions: [
        "Describing Fairy Aura as ally-wide doubles support.",
        "Calling the team dedicated sand offense.",
        "Assuming Baton Pass is the only viable route to victory.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-m3-11-starmie-floette",
    title: "M-3 #11 Mega Starmie and Mega Floette",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "published",
      name: "Season M-3 Top-15 Team Listing",
      url: "https://pokepast.es/2a025d84b30958da",
      indexUrl: singlesIndexUrl,
      author: "Maki",
      placement: "Season M-3 #11",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes: "The source notes one unused Stat Point on Aegislash.",
    },
    showdownText: `Archaludon @ Sitrus Berry
Ability: Stamina
Level: 50
EVs: 32 HP / 31 SpD / 3 Spe
Bold Nature
- Iron Head
- Dragon Tail
- Thunder Wave
- Stealth Rock

Aegislash @ Spell Tag
Ability: Stance Change
Level: 50
EVs: 10 HP / 32 Atk / 23 Spe
Adamant Nature
- Poltergeist
- Shadow Sneak
- Sacred Sword
- Swords Dance

Hippowdon @ Leftovers
Ability: Sand Stream
Level: 50
EVs: 32 HP / 15 Def / 18 SpD / 1 Spe
Impish Nature
- Earthquake
- Protect
- Yawn
- Slack Off

Starmie-Mega @ Starminite
Ability: Huge Power
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Aqua Jet
- Liquidation
- Zen Headbutt
- Flip Turn

Meowscarada @ Choice Scarf
Ability: Protean
Level: 50
EVs: 4 HP / 32 Atk / 2 Def / 1 SpD / 27 Spe
Adamant Nature
- Flower Trick
- Knock Off
- U-turn
- Triple Axel

Floette-Mega (F) @ Floettite
Ability: Fairy Aura
Level: 50
EVs: 6 HP / 7 Def / 32 SpA / 21 Spe
Timid Nature
- Moonblast
- Draining Kiss
- Light of Ruin
- Calm Mind`,
    expectations: {
      teamIdentities: ["singles balance", "dual-Mega selection pressure"],
      criticalObservations: [
        "Archaludon combines Stealth Rock, Thunder Wave, and phazing to support either Mega route.",
        "Mega Starmie pressures physically while Mega Floette pressures specially.",
        "Choice Scarf Meowscarada supplies speed control and pivoting.",
      ],
      forbiddenConclusions: [
        "Calling the roster dedicated sand offense.",
        "Claiming both Mega Evolutions can be activated in the same battle.",
        "Treating the unused Stat Point as an illegal set.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-boundary-incidental-sun",
    title: "Boundary: Self-Contained Sun Without a Weather Core",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "constructed",
      name: "PokePilot archetype-boundary case",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes:
        "Constructed from legal published fixture sets to test weather archetype-forcing.",
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

Garchomp @ Lum Berry
Ability: Rough Skin
Level: 50
EVs: 32 HP / 30 Def / 4 Spe
Impish Nature
- Earthquake
- Dragon Tail
- Stealth Rock
- Spikes

Mimikyu @ Life Orb
Ability: Disguise
Level: 50
EVs: 1 HP / 32 Atk / 1 Def / 32 Spe
Adamant Nature
- Play Rough
- Shadow Claw
- Shadow Sneak
- Swords Dance

Bellibolt @ Leftovers
Ability: Electromorphosis
Level: 50
EVs: 31 HP / 4 Def / 28 SpD / 3 Spe
Calm Nature
- Volt Switch
- Toxic
- Slack Off
- Soak

Corviknight @ Sitrus Berry
Ability: Pressure
Level: 50
EVs: 32 HP / 1 Atk / 30 Def / 2 SpD / 1 Spe
Impish Nature
- Roost
- Iron Head
- Bulk Up
- U-turn

Starmie-Mega @ Starminite
Ability: Huge Power
Level: 50
EVs: 8 HP / 32 Atk / 1 Def / 25 Spe
Jolly Nature
- Aqua Jet
- Flip Turn
- Liquidation
- Ice Spinner`,
    expectations: {
      teamIdentities: ["singles balance", "self-contained Mega Charizard Y mode"],
      criticalObservations: [
        "Sun improves Mega Charizard Y itself, but no Chlorophyll or other dedicated sun dependency is present.",
        "The team retains independent physical routes through Mimikyu and Mega Starmie.",
        "Hazards and pivots support flexible three-Pokemon selections.",
      ],
      forbiddenConclusions: [
        "Calling the team incomplete because it lacks a dedicated sun abuser.",
        "Recommending Chlorophyll solely because Mega Charizard Y sets sun.",
        "Claiming Mega Charizard Y and Mega Starmie can both activate in one battle.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "singles-boundary-imprison-trick-room",
    title: "Boundary: Imprison Trick Room Denial",
    regulation: "M-B",
    battleFormat: "singles",
    source: {
      origin: "constructed",
      name: "PokePilot archetype-boundary case",
      retrievedAt: AI_TEAM_FIXTURE_RETRIEVED_AT,
      notes:
        "Constructed from legal published fixture sets to test anti-Trick Room recognition.",
    },
    showdownText: `Lucario-Mega @ Lucarionite
Ability: Adaptability
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Close Combat
- Meteor Mash
- Extreme Speed
- Swords Dance

Dragonite @ Life Orb
Ability: Multiscale
Level: 50
EVs: 1 HP / 32 Atk / 1 SpD / 32 Spe
Jolly Nature
- Dragon Dance
- Outrage
- Earthquake
- Extreme Speed

Ninetales-Alola @ Light Clay
Ability: Snow Warning
Level: 50
EVs: 11 HP / 10 Def / 32 SpA / 13 Spe
Timid Nature
- Blizzard
- Freeze-Dry
- Aurora Veil
- Pain Split

Rotom-Wash @ Leftovers
Ability: Levitate
Level: 50
EVs: 32 HP / 14 Def / 20 SpD
Bold Nature
- Hydro Pump
- Volt Switch
- Will-O-Wisp
- Light Screen

Meowscarada @ Choice Scarf
Ability: Protean
Level: 50
EVs: 32 Atk / 2 Def / 32 Spe
Jolly Nature
- Flower Trick
- Triple Axel
- U-turn
- Foul Play

Farigiraf @ Focus Sash
Ability: Armor Tail
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Imprison
- Trick Room
- Twin Beam
- Thunderbolt`,
    expectations: {
      teamIdentities: ["singles screens offense", "anti-Trick Room utility"],
      criticalObservations: [
        "Farigiraf's Imprison plus Trick Room is denial technology on an otherwise fast team.",
        "The roster has no slow Trick Room beneficiary and should operate outside Trick Room.",
        "Aurora Veil and Light Screen support physical setup attackers.",
      ],
      forbiddenConclusions: [
        "Calling this a Trick Room team because one Pokemon knows Trick Room.",
        "Recommending additional slow Trick Room sweepers to complete the concept.",
        "Treating Armor Tail as ally protection outside its actual Singles implications.",
      ],
    },
  },
] satisfies AiTeamFixture[];
