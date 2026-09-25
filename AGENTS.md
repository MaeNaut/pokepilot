# PokePilot - Codex Guidance

## Communication

- Respond in Korean by default unless the user asks for English.
- Keep explanations practical, concise, and implementation-oriented.
- Prefer building small working slices over large speculative plans.

## Project Goal

PokePilot is an unofficial AI-assisted team-building web app for Pokemon-style turn-based battles.

The live app uses React / TypeScript and Cloudflare Workers / D1.

## IP / Branding Safety

- Treat this as an unofficial fan-made tool.
- Do not present the project as official or affiliated with Nintendo, Game Freak, Creatures, or The Pokemon Company.
- Avoid official logos and copied official UI branding. Pokemon artwork and sprites
  used by this unofficial portfolio tool must come through documented third-party
  sources, retain clear attribution, and be reviewed again before any commercial release.
- Prefer original product UI, original share-card layouts, and data-driven displays.
- It is okay to use descriptive references to Pokemon-style team building, but avoid making the product look like an official Pokemon product.

## Engineering Preferences

- Prefer TypeScript for new app code.
- Favor readable code over clever abstractions.
- Keep changes scoped to the requested behavior.
- Use environment variables for API keys and never commit secrets.
- Treat Cloudflare Workers/D1 as the active production path. Legacy Netlify and
  Vercel deployment implementations are available in Git history.
- Add comments only where they clarify non-obvious logic.

## Efficient Context and Verification

- Start with `git status --short` and targeted `rg` searches. Read relevant file
  sections before entire files; do not load every project document at startup.
- Batch independent reads and searches. Keep dependent steps sequential.
- Bound tool output. For long test, build, evaluation, or deployment logs, retain
  the full log locally and return the exit status, summary, and relevant failures.
  Do not dump generated catalogs, full evaluation JSON, or repeated page snapshots.
- Use focused browser queries and screenshots of the relevant state. Expand to
  full-page inspection when layout or navigation verification requires it.
- Run focused tests while editing, then the required broader checks before delivery.
  Repeat passing checks only after relevant changes or new evidence of a problem.
- Read existing evaluation summaries before opening individual cases. Preserve
  original evidence; reducing output must not hide failures or skip verification.
- At major task boundaries, update the relevant project document with decisions,
  verification, and remaining work. Use a short handoff for a new conversation
  instead of copying the full chat. Do not interrupt an active task just to reset context.

## What To Avoid

- Do not build a full competitive simulator first.
- Do not expand the existing account system into social, collaborative, or
  unbounded-storage features without a concrete product need and privacy review.
- Do not train a custom ML model for the MVP.
- Do not assume source attribution grants commercial rights to Pokemon assets;
  reassess or replace them before monetizing the project.
- Do not let AI output remain plain chat text only; convert it into useful UI.
