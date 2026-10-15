# Prelaunch Onboarding QA - October 15, 2026

## Scope

- Product baseline: main `483c460`; the existing Cloudflare QA alias, isolated
  QA D1/Redis and ordinary Chrome. Plain Vite is not an authenticated QA site.
- Documentation changes only so far. Do not add an AI accuracy disclaimer to
  the results UI; the owner declined that change. Existing help caveats remain.
- Do not delete the owner's account, registered key, teams or history. Do not
  mint sessions, weaken authentication or treat an existing account as new.

## Completed

- 145 automated tests passed in 14 files: account authentication/storage,
  personal-key encryption/isolation/removal and routing, account preferences,
  history, header auth boundaries, confirmation and preflight estimates.
  Provider/auth boundary tests use mocks; this is not a new live-Google signup
  or a paid analysis run.
- QA public routing passed 37 actual HTTP checks, including help/canonical
  routes, redirects, missing pages and security headers.
- QA unsigned deployment check passed: analysis requires authentication,
  with expected headers and no unexpected session cookie. Authenticated and
  paid concurrency checks were explicitly skipped by that CLI.
- In the logged-out Chrome QA tab, help navigation succeeded and clicking
  Google sign-in reached Google's account chooser. No JavaScript dialog was
  present when inspected. The earlier owner-reported unresponsiveness was not
  reproduced during these checks; its cause remains undetermined.
- The owner signed in with the requested alternate Google account. The
  first-visit tutorial appeared, followed by the signed-in/no-key gate.
  All four analysis tabs and the panel footer were inside the inert locked
  content. The gate's key-guide link opened the English setup guide in a new
  tab. Account settings showed the key field and a disabled Save button while
  empty, with no registered-key removal control.
- The owner registered the evaluation key directly in the QA interface. The
  menu changed to Key registered / Remove key, removed the entry form and
  unlocked the analysis panel. Both low and medium were available in the model
  menu. No plaintext key was inspected.
- One live Luna low Pokemon analysis completed for a newly created disposable
  QA team, `QA onboarding - Oct 15`, containing Garchomp. The confirmation
  showed 5-15 seconds, 8,600-9,800 estimated total tokens and $0.0011-$0.0019.
  The result showed 14.9 seconds, 8,461 tokens and $0.0014 estimated cost.
  The actual token count was slightly below the estimate range; a single case
  does not establish calibration. No extra paid refresh was submitted.
- Analysis automatically saved the team. After a browser reload, the team,
  analysis and usage metadata restored after account hydration. Re-selecting
  its history entry and opening another ordinary Chrome tab both produced
  exactly the same panel text and metadata as the completed result. The saved
  team list contained the QA team. This checks same-browser restoration, not
  independent-device or clean-browser account synchronization.
- Updated Korean/English help and API-key guides passed local HTML checks for
  headings, estimate wording and fragment targets. `git diff --check` passed.
- Corrected personal-key documentation and the deployment checklist: prepare
  candidates, compute the local forecast, confirm, authenticate/save, submit
  that same snapshot. Document sample estimates, encoding approximation,
  heuristic output/time ranges, cache-write allowance/no assumed cache discount,
  cancellation and unavailable-estimate behavior. Historical evaluations remain
  historical rather than being relabeled as new measurements.
- Follow-up documentation audit aligned README, technical notes, account-auth
  storage descriptions, the migration record and active TODO with current code
  and observed QA. Removed stale current-behavior claims about rules-based
  fallback, server-only prompt construction and BYOK bypassing admission.
  Korean/English privacy copy now describes local estimates, saved result
  metadata, bounded history and Redis request/capacity protection. No new data
  collection or product behavior was introduced. Local checks passed for five
  HTML documents, eight Markdown documents' relative links and whitespace.

## Pending Live Coverage

- After signing out, the owner reported no response from login/help and
  refresh. Subsequent help/login checks worked and alternate-account sign-in
  succeeded. Reload after analysis also worked. The cause of the earlier
  unresponsiveness remains undetermined rather than a verified code fix.
- This live pass did not exercise paid Team/Find/Sample or medium calls,
  simultaneous edits/conflicts, independent-device restoration, registered-key
  deletion, provider errors or account deletion. Automated coverage is not a
  substitute for these live scenarios. No real key or account was removed.
- Real Safari/device and assistive-technology coverage remains separate from
  Chrome viewport or automated DOM tests.

No commit, push, QA upload or production deployment was performed for these
documentation changes.
