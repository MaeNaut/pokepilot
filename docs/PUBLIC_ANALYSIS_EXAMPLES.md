# Public analysis examples

## Purpose and boundaries

The existing Kabamanda URLs now introduce the actual PokePilot AI service before
visitors register a personal key. Keep these URLs and language alternates stable.
This is useful public product documentation, not a guarantee of AdSense approval.

- `/help/kabamanda-ko.html` and `/help/kabamanda-en.html` are complete static pages.
- Four scopes: Pokemon, team, open-slot recommendation, sample optimization.
- Pokemon analysis selects Hippowdon (slot 0); sample analysis selects Mega
  Salamence (slot 1). Every scope leaves Primarina's slot 5 empty. Recommendation
  asks for an addition; team low and medium use the same five-member input.
- `kabamanda-five-team.txt` is the analysis input. The original six legal M-C
  builds in `kabamanda-team.txt` remain as a clearly labeled reference appendix.
- The overview includes the actual TeamShareCard rendered at 960px/2x in both
  languages, with an empty sixth slot, and links to the starting Game8 roster:
  https://game8.jp/pokemon-champions/779319 (checked October 4, 2026).
- Two sample scenarios use the same roster: the original Adamant Attack/Speed
  Salamence (keep current) and a disclosed Hardy/zero-investment variant (change
  recommended). Teammates, item and moves are unchanged in that variant.
- Authored build notes and reproducible damage checks remain in a collapsed
  appendix, explicitly separate from model-generated text.
- Viewing images/transcripts never triggers API calls or changes the user's team.

## Recorded run

Generated October 4, 2026 US Eastern time, GPT 6 Luna, prompt v92,
Standard tier, using the existing evaluation key. No production/user key was used.
Twelve calls: four low scopes, a medium team comparison, and a low sample-change
scenario, separately for ko/en. All public records now have scenarioVersion 3.
No retries or cherry-picking. Language outputs are independent, not translations.
Total estimated model cost: USD 0.02395265 for this twelve-call run. Prior runs
remain privately archived; this figure excludes those superseded runs.

`public/help/analysis-examples/*.json` records public results, measured execution,
generation timestamp, prompt version and SHA-256 of the request. Low/medium team
inputs have the same hash within each language; language pairs are not identical.
Screenshots use the existing `CopilotAnalysisResult`/model control and app CSS,
replaying recorded responses at 520 CSS px / 2x resolution. Navigation and analysis
start controls are omitted. These are result-area captures, not a fabricated chat
or a screenshot of a user's account. No output prose was manually improved.

For article readability, complete 1040px-wide result captures are displayed as
90%-column previews (max 680px; 96% on mobile) below the explanation, at their
natural aspect ratio. Only clipped previews have a bottom shadow/fade; it
disappears when expanded, when the image fits without clipping, and in print.
The initial view shows the top 520px (420px on mobile), preserving the panel
header. A localized, keyboard-accessible button expands the complete image in
normal document flow without an inner scrollbar or resizing. Collapsing from
below returns to the preview. Without JavaScript and in print, images remain
fully visible. Selecting a preview opens a native dialog with fit/original-size controls,
Escape/close support and focus restoration without losing the reading position.
Without JavaScript, the image anchors still open the original files. Superseded
cropped assets were removed. Static full-text transcripts are unchanged. The
low/medium comparison uses verbatim recommendation reasons on selection/Mega
choice, with links to the same image viewer. Tests verify those quotes against
recorded JSON.

Application review/repair is preserved. The English sample-change result recorded
`content-repaired` and has a short generic introductory sentence; remaining
calls had no automatic warnings. A warning-free result is not proof of accuracy.
Private raw outputs and frozen requests are in ignored `.tmp/public-examples`;
the public files contain no keys, account details or provider response IDs.

## Comparison and quality review

| Language | Effort | Model time | Tokens | Estimated USD |
| --- | --- | ---: | ---: | ---: |
| ko | low | 13.469 s | 13,895 | 0.001832145 |
| ko | medium | 35.871 s | 16,931 | 0.003602225 |
| en | low | 9.713 s | 13,160 | 0.001259550 |
| en | medium | 39.433 s | 17,135 | 0.003247050 |

Time excludes browser preparation, team save and text animation. Cost uses
`createLunaStandardUsage`, including actual cache usage, not a billing receipt.
Do not promote single-run times/costs as guarantees or use them as an accuracy
benchmark. Medium offered more explicit separate Mega lineup branches. English
low suggested two Mega candidates in one trio without explaining the non-Mega
role. Both languages' team results missed the
sand/Focus Sash interaction. The public comparison explicitly discloses these
limitations. Fixing AI prompts is a separate task, not hidden by rewriting output.
The new Korean Pokemon result also incorrectly describes HP/SpD investment as
physically biased. The article explicitly distinguishes its Defense-boosting
Impish nature from the actual HP 32 / Def 2 / SpD 32 investment. Output remains
verbatim; this is a model-content issue, not a screenshot or stat-label issue.

The original full-roster recommendation returned no candidate, and the original
Hippowdon sample used mixed bulk (Impish with HP/SpD investment). These were not
rendering errors, but poor introductory demonstrations. On October 4, four new
evaluation calls replaced only the recommendation/sample records and screenshots
in both languages. Old outputs remain privately archived, not overwritten in the
evaluation evidence. Additional estimated cost: USD 0.008855455.

The current version-3 open-slot examples rank Primarina first. Korean alternatives
are Gyarados and Wash Rotom; English alternatives are Wash Rotom and Gholdengo.
The original Salamence still receives a keep-current result. The untrained
variant receives an actual usage-standard Adamant Attack/Speed recommendation,
with Apply sample / Save to bench actions. Do not imply either is universally
optimal. All captures and static transcripts were refreshed together, including
the low/medium comparison. `inputSummary` exposes roster, selected slot, natures
and investments without publishing credentials or private request metadata.

## Maintenance

- Preserve timestamps and input hashes when changing surrounding prose.
- If inputs, prompts or UI materially change, regenerate deliberately with an
  evaluation key, review both languages, and capture the genuine components.
- Never generate new calls during page rendering or production builds.
- Keep static transcripts equal to recorded public text; do not silently fix
  hallucinations inside the sample. Add reviewer commentary outside it instead.
- `src/publicTeamExample.test.ts` checks legality, original calculator figures,
  local assets, full-text parity, positive usage and matched comparison hashes.
- Run public HTTP verification and browser checks after a fresh Cloudflare build.

## Verification completed locally

- All 1,182 tests across 154 files passed; lint and Cloudflare build passed.
  The existing large-bundle warning remains unchanged.
- Public routing verifier passed 31 real HTTP responses against a fresh local
  Wrangler instance on port 5201. No production deployment was performed.
- Chromium tested 1440px ko/light and en/dark, 390px ko/light, 360px en/dark,
  and 768px ko/dark. All four displayed captures per page loaded; no horizontal
  overflow or page errors. Transcripts and the build appendix opened normally.
- With JavaScript disabled at 390px, full transcripts still opened. A scoped
  no-script CSS fallback keeps the mobile contents list in document flow instead
  of covering the article. Real Safari testing remains unperformed.
- Compact-layout follow-up: 23 targeted article/help tests and the same browser
  matrix passed. No additional model calls were made.
- Full-preview follow-up: 23 targeted tests passed; image-viewer checks at 360,
  768 and 1440px in both languages verified fit, zoom, comparison links, Escape,
  close-button operation, restored focus and unchanged scroll position.
- Inline-expansion follow-up: 25 targeted tests and the Cloudflare build passed.
  Chromium at 360/768/1440px in both languages verified full-width previews,
  unchanged image scale after expansion, collapse positioning, dialog access
  and no horizontal overflow. Short images do not need an expansion button.
- Five-member follow-up: 25 targeted tests and Cloudflare build passed. Chromium
  verified five analysis previews per language at 360/768/1440px, unchanged scale
  on expansion, bottom shade only while clipped, dialog access and no overflow.
  Team-image capture verified five members, one empty slot and loaded artwork.
