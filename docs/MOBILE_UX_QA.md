# Mobile UX QA - September 26, 2026

## Scope

Local develop build at `http://127.0.0.1:5199`, Chrome viewport overrides.
This is responsive-layout and interaction QA, not a real-device Safari or
Android certification. No paid AI requests or production account mutations.

## Findings and fixes

- Help overlapped the battle-format control at phone widths. Reserve space for
  both Help and Profile. The approved pen.dev option A uses one 56px header row
  up to 760px. Team-name disclosure groups rename, save, new team and import;
  the team list, workspace toggle, format, Help and Profile remain visible.
  Visible controls retain compact proportions: 34px mode toggle and 36px round
  profile. Invisible vertical hit-area extensions preserve 44px targets. Help
  and battle format are unframed; the menu input uses 16px text.
- Remove the body minimum width on phones so a desktop scrollbar at a 320px
  viewport does not force horizontal overflow. Long team names use ellipsis.
- Mobile Pokemon headings reserve a vertical type badge column. Mega buttons
  use the catalog's actual Mega Stone sprites (with text fallback), retaining
  accessible form names and pressed state. Names and form buttons share a row;
  unusually long names can wrap within the remaining name space.
- At 844x390, Save touched the centered workspace toggle. Bound the team region
  to the left half of the landscape header with a gap before the toggle.
- Help home/profile controls and the mobile contents trigger were only 32px.
  Increase these and contents links to 44px, keeping the menu an overlay and
  constraining its height to the viewport.
- On coarse pointers, account-menu buttons have at least 44px height and the
  key input uses 16px text to reduce unintended input zoom on mobile browsers.

## Browser checks

- Option A follow-up: header geometry at 320, 360, 390, 430, 760 and 1280px
  showed no overlapping controls or document horizontal overflow.
- Verified the team-name menu, rename, Escape dismissal and Showdown import
  entry; confirmed Calculator retains the same one-row header.
- `npm run check:cloudflare` passed (874 tests, lint, build, Worker dry-run).

- Inspected 320x640 and 390x844 app screenshots; no document horizontal overflow.
- Additional header geometry checks at 430x932, 768x1024, 844x390, and 1920x1080.
  Responsive transitions require settling before interpreting geometry; a
  transient wide-screen overlap disappeared after the layout settled.
- Selected a Pokemon through the phone selection dialog; usage sample loaded.
  Edited Attack investment and confirmed the value carried into Calculator.
- Switched Calculator pages and opened/closed the mobile PokePilot panel.
  Inspected the upward model menu and its descriptions at 320px.
- Completed all four tutorial steps; login/key requirement and Help link present.
- Changed Korean/English through account settings, then restored Korean.
- At 360x740, opened Help contents without moving the main heading, navigated
  to Analysis, confirmed current-section text and menu closure, then followed
  the key setup guide. Both documents fit the viewport horizontally.

## Still requires real-device / authenticated QA

- iOS Safari and Android Chrome: on-screen keyboard, address-bar resizing,
  safe-area insets, touch swipes/vertical scroll, and numeric input behavior.
- Full VoiceOver/TalkBack pass and touch-only focus behavior. Viewport overrides
  do not simulate a mobile screen reader or coarse pointer by themselves.
- Google login, key registration/deletion, account synchronization, and paid
  analysis confirmation on an isolated Worker QA version. Plain Vite does not
  provide the real account endpoints; its settings menu is not proof of login UX.
- No production deployment is part of this pass.
