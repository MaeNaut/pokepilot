# GPT-6 Luna Comparison (2026-09-24)

Historical note: After this report was written, the user chose GPT-6 Luna low
as the new production default and personal-key-only access to medium. The
decision section below records the recommendation at evaluation time.

## Scope and Method

Compare GPT-6 Luna low and medium against the archived GPT-5.6 Luna low and
medium run. High was removed at the user's request after the initial run began.
Do not interpret its two completed records as a representative benchmark.

- Eight frozen fixtures, three repetitions per configuration: six Team, one
  Pokemon, and one Pokemon recommendation fixture, all in Korean.
- Request version 35, prompt version 91, core prompt version 6.
- Exactly the archived requests, verified by SHA-256, rather than rebuilding
  requests from potentially changed data.
- Standard service, 16,000 output-token cap, 180-second timeout, no retries,
  and three concurrent jobs. These are evaluation settings, not production
  defaults.
- Production remains GPT-5.6 Luna medium. Its 8,000-token output cap and
  60-second request timeout require separate validation before any migration.
- Existing fixture data only; no new collection of users' private teams.
- Seven completed low/medium records from the interrupted first run were
  reused with matching input fingerprints and settings. They were not billed
  again. The other 41 records were newly requested.

The archived and new runs happened on different dates. Latency and prompt-cache
warmth were not controlled across dates. This is a small regression suite, not
a population-wide accuracy measurement. It does not cover English, sample
recommendations, or end-to-end production timeout behavior.

## Artifacts

- Archived baseline: `artifacts/ai-evaluation/current-comparison-2026-09-20T05-11-55-006Z`
- Interrupted initial run: `artifacts/ai-evaluation/current-comparison-2026-09-25T01-04-10-880Z`
- Final low/medium run: `artifacts/ai-evaluation/current-comparison-2026-09-25T01-09-39-044Z`

The final directory contains the request manifest, numbered raw results, and
`generation-comparison.json`. Artifact files are local and ignored by Git.
Dates in artifact paths are UTC; the report date is local (America/New_York).

To run another paid comparison with the same frozen inputs:

```powershell
npx tsx scripts/compare-current-ai-models.ts artifacts/ai-evaluation/current-comparison-2026-09-20T05-11-55-006Z/manifest.json --luna6-low-medium --frozen-inputs
```

`--reuse-results=<directory>` can resume matching completed records without
calling the API again. This requires `--frozen-inputs` and matching prompt,
output cap, configuration, repetition, and request fingerprint.

## Results

All 48 requested low/medium records are complete as evaluation records (not
necessarily valid model answers). No transport/request errors occurred.
All four groups have usage metadata, including their output-cap failures.

| Model / effort | Strict pass | Median seconds | P95 seconds | Over 60s | Mean USD / attempt | Total USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 5.6 Luna low, archived | 16/24 | 14.25 | 17.90 | 1/24 | 0.005307 | 0.127372 |
| 5.6 Luna medium, archived | 21/24 | 22.04 | 33.06 | 0/24 | 0.005981 | 0.143540 |
| 6 Luna low | 21/24 | 15.37 | 22.10 | 0/24 | 0.001874 | 0.044968 |
| 6 Luna medium | 23/24 | 66.70 | 154.18 | 16/24 | 0.004382 | 0.105156 |

Means include unsuccessful attempts, not just usable answers. New low/medium
records together cost an estimated **USD 0.150124**. This includes the seven
reused records once, but excludes high and canceled in-flight requests. One
excluded high record has missing usage, so this is not an exact invoice total
for everything attempted during this task.

| Fixture (three repetitions each) | 5.6 low | 5.6 medium | 6 low | 6 medium |
| --- | ---: | ---: | ---: | ---: |
| Singles Gengar/Starmie | 3 | 2 | 3 | 3 |
| Tailwind / Trick Room | 2 | 3 | 3 | 3 |
| Staraptor / Charm | 3 | 3 | 3 | 3 |
| Floette / Delphox setup | 2 | 3 | 3 | 3 |
| Zoroark / Round | 0 | 1 | 1 | 2 |
| Froslass / Rain Dance | 2 | 3 | 2 | 3 |
| Hippowdon Pokemon analysis | 1 | 3 | 3 | 3 |
| Rain-team recommendation | 3 | 3 | 3 | 3 |

GPT-6 low failures: two missing private recommendation-evidence links in Round
repetitions 2 and 3, and the Froslass repetition 1 validator false positive
described below. GPT-6 medium's sole failure was Round repetition 3: 168.22
seconds, 16,000 output tokens reported as reasoning, no usable final output,
and `max_output_tokens`. Raising the cap already to 16,000 did not guarantee
an answer. The archived 5.6 low also had one output-cap failure.

### Token and Cost Changes

Each configuration received 350,625 input tokens in total. GPT-5.6 had 120,210
cached input tokens per configuration; GPT-6 had 111,149 cached input and
9,061 cache-write tokens per configuration.

| Model / effort | Output tokens (including reasoning) | Reasoning tokens |
| --- | ---: | ---: |
| 5.6 low | 65,737 | 6,102 |
| 5.6 medium | 79,211 | 33,991 |
| 6 low | 39,365 | 8,034 |
| 6 medium | 159,741 | 117,539 |

6 low cost 64.7% less than 5.6 low. 6 medium cost 26.7% less than 5.6 medium,
despite about 2.02x output tokens and 3.46x reasoning tokens. The cheaper unit
prices offset higher medium reasoning consumption. These are measured-suite
differences, not guaranteed per-user savings.

The Standard per-million prices used here are input/cached input/cache write/
output USD 0.10/0.01/0.125/0.50 for GPT-6 Luna inputs up to 272,000 tokens,
versus 0.20/0.02/0.25/1.20 for GPT-5.6 Luna. The adapter also tests the GPT-6
long-input boundary; no fixture crosses that boundary.

## Interpretation Rules

`complete` means the output passed the current schema and grounded-output
validator. It does not prove factual accuracy or recognition of the intended
strategy. Conversely, some validator failures are bookkeeping errors or false
positives rather than incorrect public advice. Do not turn the strict pass rate
into an AI accuracy percentage.

Costs use returned usage and the model-specific Standard rates. Reasoning
tokens are part of output tokens and are not charged a second time. Missing
usage is not free usage. Interrupted requests and excluded high calls are not
included in the four-configuration comparison total.

## Focused Manual Review

These observations concern individual responses, not exhaustive semantic
grading of every response:

- GPT-6 low, Round repetition 1: passed validation but prioritized Dragapult
  plus Gardevoir and omitted the Choice Scarf Hisuian Zoroark opening and
  Farigiraf Illusion bluff. A cleaner schema did not recover the full strategy.
- GPT-6 medium, Round repetition 1: recognized the Zoroark/Gardevoir opening
  and Imprison/Trick Room denial, but proposed a Sableye disguise instead of
  explaining the fixture's Farigiraf/Armor Tail bluff. That is a different
  tactical proposal, not evidence of complete intended-strategy recovery.
- GPT-6 low, Froslass repetition 1: rejected for supposedly claiming no Fire
  or Rock defense. The paragraph actually discusses Fire/Rock weaknesses and
  then the lack of Electric resistance. The validator checks every mentioned
  type against a paragraph-level negative claim, conflating these clauses.
  This is a confirmed validator false positive, not a model Fire/Rock error.
  The same answer still omitted the targeted anti-Charizard-Y weather play.
- GPT-6 medium, Froslass repetition 1: mentioned overriding opposing weather
  and supporting Basculegion, but did not spell out the faster Rain Dance after
  Drought sequence. It also misspelled Mega Dragonite in one recommendation
  and gave overly broad advice about Aurora Veil during rain; already active
  Aurora Veil is not removed by changing the weather.
- GPT-6 medium, Staraptor repetition 1: explicitly connected priority Charm
  to Contrary's Attack increase and Close Combat's reversed defensive drops.
  Low recognized Charm/Contrary but hedged the action order unnecessarily.
- GPT-6 low, Hippowdon repetition 1: passed validation but warned about
  Earthquake hitting allies and suggested waiting for another teammate to
  act, despite this being Singles. This is a material format error; acting
  earlier also would not prevent an ally taking Earthquake damage in Doubles.
  Medium's corresponding response did not introduce this error.
- GPT-6 low and medium, rain recommendation repetition 1: both recognized
  Sableye's existing Rain Dance and recommended Pelipper as complementary rain
  support, with real weaknesses rather than treating it as the only rain
  source. Medium also discussed overlapping redirection roles.
- Archived GPT-5.6 medium, Round repetition 1: assigned Choice Scarf to the
  wrong Pokemon and described an incorrect Trick Room speed ordering. The
  baseline also has real public-answer errors, not only validator failures.

The validator was deliberately not changed mid-comparison. Its paragraph-level
negative-defense matching needs a separate regression fix, followed by an
offline replay of both generations before claiming an adjusted pass rate.

## Decision and Next Checks

Keep production on 5.6 Luna medium for now. GPT-6 medium is the stronger next
candidate in this small suite, but not a drop-in replacement: its median was
3.03x slower and two-thirds of attempts exceeded the current 60-second request
timeout. This does not directly measure the failure rate under production's
different 8,000-token cap, but makes production-settings testing mandatory.

Do not replace it with GPT-6 low solely because low's strict pass count matches
archived 5.6 medium. The Singles/Doubles error demonstrates a meaningful gap
that the current validator does not catch.

Recommended order:

1. Fix the negative-defense validator false positive and replay saved outputs
   offline. Add a regression for Singles advice that assumes an active ally.
2. Review the remaining strategy omissions, especially Round/Illusion and the
   targeted weather override. Avoid writing fixture-specific answers into the
   production prompt.
3. Run GPT-6 medium with actual production output/time limits and a focused
   difficult-case suite before deciding whether async delivery, different
   limits, or a simpler private audit structure is needed.
4. Broaden to English and sample recommendations before a model rollout.

Verification: 22 adapter tests passed; TypeScript build and targeted ESLint
passed; `git diff --check` passed (line-ending warnings only). Offline replay
of both complete artifact sets produced no acceptance changes or Unicode
control differences. No production model switch, deployment, commit, or push
was performed as part of this evaluation.
