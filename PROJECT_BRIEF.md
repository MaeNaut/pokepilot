# PokePilot Project Brief

## One-Sentence Summary

PokePilot is an unofficial AI-assisted team-building tool for Pokemon-style turn-based battles that helps players understand team synergy, type coverage, weaknesses, and possible improvements through an interactive web UI.

## Why This Project Exists

The user is an RIT Game Design and Development undergraduate expected to graduate in Fall 2026 after completing one remaining co-op requirement. The user has strong interest in game development, gameplay systems, frontend development, and product-focused software. During the job search, many roles have asked for AI, TypeScript, API, database, deployment, or full-stack experience. This project is meant to fill that gap while staying connected to the user's genuine game interests.

## Portfolio Value

This project should be useful for several job-search lanes:

- Game development: shows game-system analysis, strategy, team composition, and player-facing tools.
- Frontend development: shows React, TypeScript, visualization, and polished UI.
- Full-stack / product software: shows API routes, structured data, persistence, and deployment.
- AI product roles: shows practical AI integration into a user-facing workflow.

## Product Concept

Users can build or describe a team, then PokePilot analyzes it and provides:

- type weaknesses and resistances
- offensive coverage
- role balance
- potential team gaps
- suggested replacements or additions
- AI-generated reasoning presented as structured cards or visual sections

## Current Production Scope

The public beta is live at [pokepilot.app](https://pokepilot.app). The shipped
product includes Regulation M-C data, a Team Builder, a damage Calculator,
PokePilot analysis and recommendations, bilingual UI, responsive layouts, and
Google sign-in. Signed-in users can synchronize saved teams, bounded analysis
history, and interface preferences through Cloudflare D1; Upstash Redis protects
shared AI operational state. These are deliberately bounded product features,
not a social platform or a full battle simulator.

## Target User

- Players who enjoy Pokemon-style turn-based battles.
- Casual players who want clearer team-building guidance.
- Strategy-minded players who want quick type and role analysis.
- Portfolio reviewers who should immediately understand the technical and product value.

## Public Disclaimer

This is an unofficial fan-made project and is not affiliated with Nintendo, Game Freak, Creatures, or The Pokemon Company.
