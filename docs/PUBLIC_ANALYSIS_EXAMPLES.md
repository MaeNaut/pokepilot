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
- `kabamanda-five-team.txt` is the analysis input and journal download. The
  original six-member `kabamanda-team.txt` remains available as a separate asset.
- The overview includes the actual TeamShareCard rendered at 960px/2x in both
  languages, with an empty sixth slot, and links to the starting Game8 roster:
  https://game8.jp/pokemon-champions/779319 (checked October 4, 2026).
- Two sample scenarios use the same roster: the original Adamant Attack/Speed
  Salamence (keep current) and a disclosed Hardy/zero-investment variant (change
  recommended). Teammates, item and moves are unchanged in that variant.
- The journal uses short scope descriptions and expandable result screenshots.
  Duplicate full-text dropdowns, review notes and the long build/calculation
  appendix were removed in the October 4 readability pass. Source attribution,
  sample input differences and a brief selected-response disclosure remain.
- Viewing examples never triggers API calls or changes the user's team.

Readability verification: 23 article/help tests passed. Browser checks passed
at 360, 390, 768 and 1440px across Korean/English and light/dark themes, with
five loaded result images, working expansion and no horizontal overflow or
page errors. Images remain available with JavaScript disabled. Raw records and
result screenshots were not changed by the editorial pass.

Capture correction: Korean Hippowdon now renders `Stat Points` as `노력치`
through the app's display-only terminology mapping; the recorded JSON, numeric
values and strategy remain unchanged. The English recommendation capture was
retaken after all three candidate sprites loaded. Capture checks must wait for
an actual visible, decoded image in every candidate sprite slot, not merely
for images already present in the DOM (the Pokemon fetch is asynchronous).
Abort rather than publish if any panel image is missing or hidden.

## Journal voice

Locale alignment audit: all six results per language were compared with the
journal explanations. Common setup/role descriptions can agree, but authored
copy is not a translation contract. Each showcase now records its own result
ID in `data-source` next to the matching screenshot. Preserve these differences:

- Korean team low/medium: Hippowdon + Salamence + Archaludon, or Hippowdon +
  Lucario Z + Meowscarada in both outputs.
- English team low/medium now both pair either Mega with Hippowdon and
  Meowscarada. The revision-5 low result replaced the earlier Archaludon
  lineups and misleading sand/Focus Sash wording. The comparison describes
  the actual details each selected response adds, not presumed higher quality.
- Korean keep-current optimization recommends only `set-current`. English
  also recommends `usage-spread-2` at low priority: final HP +1, Defense -1,
  unchanged Attack/Speed/moves. These are final stats, not a new EV conversion.
- Both open-slot recommendations rank Primarina, Gyarados and Rotom Wash;
  English copy now includes the tradeoffs emphasized by its own response.
- Pokemon and untrained optimization explanations already match their local
  results; no artificial differences or new model calls were introduced.

The October 4 writing pass adapts team-report conventions rather than presenting
each scope as a feature description. Korean headings follow team introduction,
individual role, selection/game plan, the open slot and set adjustments. English
uses core, game plan, lineup and set naturally instead of translating Korean
`sample` literally. Keep polite Korean `-입니다/-했습니다` prose, short paragraphs,
concrete Pokemon/move names and reasons for choices. Do not invent ladder results,
battle experience or authorship of the source roster. The analysis screenshots,
recorded quotes and original response files are not editorial prose to rewrite.

Style references inspected (not sources for this team's battle claims):

- [Korean original: M-4 Gardevoir/Maushold report](https://gall.dcinside.com/mgallery/board/view/?id=pkmchampions&no=319806):
  roles, reasons for changing sets, matchup-specific selections; personal but
  concrete explanations rather than lists of feature promises.
- [Korean community translation: M-4 rank 147](https://enter.dcinside.com/mgallery/board/view/?id=pkmchampions&no=318894):
  compact set details followed by adoption reasons and selection frequency.
  This is a translated report, not an independent Korean original.
- [Smogon: Take Me To Your Leader](https://www.smogon.com/forums/threads/take-me-to-your-leader-salamence-bo-ft-banded-samurott-and-maushold-peak-rank-6.3732125/):
  starting core, changes to address weaknesses, and each member's contribution.
- [Smogon: Salamence's Slaughterhouse](https://www.smogon.com/forums/threads/salamences-slaughterhouse.3593449/):
  direct first-person building rationale and short role explanations.
- [Reddit VGC: Hartford team report](https://www.reddit.com/r/VGC/comments/13obw3z):
  conversational set choices and tradeoffs tied to a specific game plan.

These are representative Korean and English-language community samples, not an
exhaustive survey or a claim about the nationality of every English author.
Borrow only structural conventions; do not copy authors' sentences or transfer
their format-specific battle advice to M-C Singles.

## Current Publication Revisions 4 and 5

The English team-low record alone is now publication revision 5. One additional
evaluation-key call reused the frozen v93 input (15.810 s, 14,237 tokens,
estimated USD 0.002204). It correctly explains that end-of-turn sand damage
removes Focus Sash's full-HP condition without requiring earlier damage. The
previous result and new raw response remain in ignored
`.tmp/public-examples-v4/team-retry-1791138255246/`. No model prose was edited.
Its genuine UI capture, authored explanation, comparison quote and metrics were
refreshed together. These are selected responses, not an accuracy benchmark.

Full-result dropdowns remain removed. Visually hidden static equivalents now
make the seven displayed/linked analysis results per language available to
screen readers without adding visible article copy. Run
`node scripts/sync-analysis-example-text.mjs` after changing public records or
captures; it synchronizes accessible text, quotes, metrics and image dimensions.
It never calls a model. Language switching preserves the active article section.
Follow-up verification: 31 article/help tests passed. Chromium checked the
360/390/768/1440px layout matrix, loaded images and expansion without page
errors or horizontal overflow. At 390/1440px, language navigation retained the
comparison section and the browser accessibility tree included the hidden
result text, also with JavaScript disabled. Cloudflare build passed with the
existing bundle-size warning. A real screen-reader/Safari session was not run.

Updated October 4 after the prompt-v93 quality follow-up. All 12 public JSON
records, result captures, static transcripts, metrics and comparison excerpts
now use prompt v93. The input scenario remains version 3 (five members); the
separate `publicationRevision: 4` tracks this refresh. Team source, roster images,
URLs, layout and expand/zoom behavior are unchanged.

Fourteen evaluation-key calls were made for this refresh (12 conditions and two
English optimization retries), costing an estimated USD 0.02809418. Rejected
responses remain in `.tmp/public-examples-v4/raw/`. The Korean recommendation
and team-low records reuse reviewed v93 results from the preceding quality run;
their costs are not counted again in that new-call total. Korean recommendation
rejected a Fighting-immunity-as-resistance statement; Korean team-low rejected
ambiguous weather-owner timing. The English optimization retries replaced a
Singles spread-role claim and a reversed HP/Defense allocation explanation.
No AI response prose was manually rewritten.

These are reviewed, selected product examples, not first-try success-rate or
accuracy samples. Both public pages explicitly disclose this selection. Raw
requests and responses are private; previous public JSON/PNGs are archived in
`.tmp/public-examples-v4/previous-public/` and remain recoverable from Git.

| Language | Effort | Model time | Tokens | Estimated USD |
| --- | --- | ---: | ---: | ---: |
| ko | low | 13.461 s | 14,512 | 0.001524360 |
| ko | medium | 52.297 s | 18,386 | 0.004123300 |
| en | low | 14.546 s | 14,336 | 0.001591560 |
| en | medium | 49.159 s | 18,096 | 0.003471560 |

Within each language, low and medium have identical request hashes and prompt
versions. The comparison commentary was rewritten to match these actual outputs,
not to claim that medium is always superior. Korean low still omits the Focus
Sash cost of its Meowscarada selection; the comparison explicitly flags this.
English commentary clarifies that sand alone can remove full HP and persists
after the setter leaves. The obsolete Hippowdon investment correction is removed
because the new Pokemon response describes its investment correctly.

Verification: 25 article/help tests passed, including transcript/record agreement,
same-input comparisons, publication metadata and actual PNG dimensions. Chromium
checked 1440px ko/light and en/dark, 390px ko/light, 360px en/dark and 768px ko/dark:
all five previews loaded, with no horizontal overflow or page errors. No-JS
transcripts also worked. Capture width remains 1040px (520 CSS px at 2x).
Real Safari QA and production deployment were not performed for this refresh.

## Historical v92 Run (Superseded)

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

## Historical v92 Comparison and Quality Review

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
