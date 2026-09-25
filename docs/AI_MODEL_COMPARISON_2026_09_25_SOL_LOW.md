# GPT-6 Sol Low Comparison (2026-09-25)

## Method

GPT-6 Sol low was run against the eight frozen Korean requests from the
September 20 v35 comparison, three times each. The saved GPT-6 Luna low and
medium results used the same request hashes, prompt v91, Standard service,
16,000 output-token cap, 180-second timeout, no retries, and three concurrent
jobs. Six requests analyze teams, one a Pokemon, and one a Pokemon
recommendation. No sample recommendation or English request is included.

- Frozen input: `artifacts/ai-evaluation/current-comparison-2026-09-20T05-11-55-006Z/manifest.json`
- Luna baseline: `artifacts/ai-evaluation/current-comparison-2026-09-25T01-09-39-044Z`
- Sol low results: `artifacts/ai-evaluation/current-comparison-2026-09-25T04-11-10-522Z`

Only the evaluation credential was used. Artifacts are local and Git-ignored.
The Luna and Sol runs occurred at different times, so latency and cache warmth
are not controlled. The strict validator is a grounding/contract check, not an
accuracy score.

## Results

| Model / effort | Strict pass | Median seconds | P95 seconds | Over 60s | Mean USD / attempt | Total USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna low | 21/24 | 15.37 | 22.10 | 0/24 | 0.001874 | 0.044968 |
| GPT-6 Luna medium | 23/24 | 66.70 | 154.18 | 16/24 | 0.004382 | 0.105156 |
| GPT-6 Sol low | 24/24 | 24.34 | 36.07 | 0/24 | 0.036826 | 0.883812 |

Sol low cost 19.65x Luna low and 8.40x Luna medium on these requests. Its
median latency was 1.58x Luna low and 0.36x Luna medium. All Sol responses had
usage metadata; none hit the output cap or transport errors. The largest Sol
output was 2,453 tokens and the longest request took 41.48 seconds. These
observations do not establish reliability under production's 8,000-token and
60-second defaults, or under end-to-end Cloudflare time limits.

Sol used the published Standard short-context rates per million tokens:
USD 2 input, 0.20 cached input, 2.50 cache writes, and 10 output, including
reasoning tokens in output. Its 24 calls returned 37,810 output tokens,
including 4,283 reasoning tokens. Estimated cost is based on returned usage,
not an invoice reconciliation.

## Manual Review

- The three Staraptor answers connected allied Prankster Charm to Contrary
  Mega Staraptor and separated the alternative Mega Skarmory selection.
- The three Round answers correctly described Choice Scarf Hisuian Zoroark
  moving before Mega Gardevoir and the follow-up Pixilate Round. All three
  included an Illusion disguise plan and treated Imprison/Trick Room as
  disruption, not a default slow-team mode. Luna low passed this fixture 1/3
  and Luna medium 2/3 in the prior run.
- The Hippowdon answers treated Earthquake as a Singles move, avoiding the
  active-ally warning observed in a prior Luna low response. The rain
  recommendation answers accounted for existing Sableye Rain Dance before
  recommending Pelipper.
- All three Froslass answers mentioned Rain Dance, but none clearly explained
  the fixture's specific anti-sun play: using faster Froslass Rain Dance to
  overwrite Mega Charizard Y's Drought. They focused instead on the snow/rain
  trade-off. Strict acceptance missed this strategic omission.
- Some Pokemon and form names remain awkwardly localized, notably
  `Family Of Four` inside Korean prose. This is not a Sol-only issue and
  appears related to the supplied display-name data.

## Decision

Sol low is a promising **opt-in, personal-key-only** quality choice, not a
replacement for the inexpensive Luna default. Its perfect strict pass count
on this narrow suite and improved Round handling justify further testing, but
neither proves consistently better public advice. Before offering it broadly,
test unseen M-C teams, English, sample recommendations, and production limits;
show the user a model-specific cost estimate. Keep model identity in server-side
authorization, cache keys, analysis records, and metrics if implemented.

Reproduce this paid run with:

```powershell
npx tsx scripts/compare-current-ai-models.ts artifacts/ai-evaluation/current-comparison-2026-09-20T05-11-55-006Z/manifest.json --sol6-low --frozen-inputs
```

Verification: TypeScript node project passed; 25 focused adapter tests passed.
No production model change, deployment, commit, or push was performed.
