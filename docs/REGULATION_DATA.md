# Regulation M-C data

The active legality snapshot is `showdown-regulation-mc.json`. Battle data is
generated as `showdown-battle-mc.json`, merging the Showdown base move table with
the Champions move overrides. Run `npm run data:showdown` to regenerate both.
The current upstream `champions` mod represents M-C; verify this at the next
regulation change before running the generator.

Pokemon battle data requires Showdown, while PokeAPI is an optional image source
with a four-second request timeout. Missing artwork falls back to Showdown.
Korean descriptions use the generated PokeAPI catalog and local overrides;
missing descriptions show English with a Korean notice.

Smogon usage remains the historical M-B source until M-C monthly statistics are
available. It must not be interpreted as measured M-C usage.

Prompt version 90 and Pokemon cache v23 separate the updated data from old cache
entries. Saved teams reload Pokemon data by ID, preserving configured builds.

## QA on 2026-09-09

M-C search keeps fixed forms separate: both Indeedee genders (stats, abilities,
and moves differ), both Toxtricity forms (Plus/Minus and signature moves differ),
and Green/Yellow Squawkabilly as mechanical representatives. Blue matches Green's
Guts group; White matches Yellow's Sheer Force group, so their future usage entries
fold into those representatives. Hidden colors remain loadable for saved teams and
imports, but are excluded from search and recommendation duplicates. Only in-battle
states such as Aegislash, Palafin, and Morpeko use the post-selection form control.

- Legal form count: 314 (M-B) to 349 (M-C), including all six added Mega forms.
- All 35 added entries load through the production loader with PokeAPI offline.
- All 35 have a working PokeAPI default sprite and official artwork after ID
  normalization. Champions-specific icons are missing for 34; only Pawmot has one.
- Korean names and descriptions now use PokeAPI first, Showdown Korean text as a
  fallback, and concise local overrides when both sources are missing. M-C has
  complete selectable-name and description coverage. Fairy Feather, Eelevate,
  and Fire Mane now come from upstream data instead of duplicate name overrides.
- Corrected PokeAPI aliases for apostrophes, Indeedee genders, Squawkabilly colors,
  and Toxtricity's default form. Exact form learnsets now take precedence over the
  base species, preventing male/female move leakage.
- Old regulation payloads are rejected even if their structural schema matches.
- A representative six-Pokemon team and all six newly available Mega forms were
  imported, exported, and validated in the live Pokemon Showdown teambuilder for
  `[Champions] VGC 2026 Reg M-C`. All 35 M-C additions also pass an automated
  canonical Showdown-name round trip.
- Team builder, calculator, search, share-image previews, team analysis, and
  Pokemon analysis were exercised with the new forms. Search keeps Mega forms
  behind the base species' Mega controls and exposes fixed, mechanically distinct
  forms as separate choices.
- Share images use full names for fixed forms and compact form labels for battle
  states. Rotom-Wash, Persian-Alola, Basculegion-F, Aegislash-Shield,
  Palafin-Zero, and Morpeko-Full-Belly were checked alongside the six newly
  separated M-C form choices; every team and individual artwork loaded.
- Remaining blocker: Aura Guard is present in Showdown but is not implemented by
  the installed damage engine. Its contact damage reduction needs implementation
  and damage-roll tests before claiming full M-C calculation support.
- Chrome controller failed to start; VS Code browser was available. Rillaboom
  selection was exercised there, including the missing Champions icon fallback.
- Final automated verification: 630 tests pass, lint passes, production build
  passes. Paid AI quality evaluations were not run.
