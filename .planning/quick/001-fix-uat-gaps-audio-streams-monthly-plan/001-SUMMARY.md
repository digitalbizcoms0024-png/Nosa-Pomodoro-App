---
plan: 001
type: quick-task
subsystem: frontend
tags: [bugfix, uat, audio, pricing, auth-ui]
dependency_graph:
  requires: [05-01-audio-categories-themes, 03-01-stripe-pricing-page]
  provides: [fixed-premium-audio-streams, complete-pricing-tiers, accessible-stats-icon]
  affects: [user-experience, trial-conversion, logged-out-ui]
tech_stack:
  patterns: [dynamic-dialog-creation, auth-state-conditional-ui]
key_files:
  created: []
  modified: [index.html, sw.js]
decisions:
  - id: orchestral-soundscapes-labels
    choice: "Renamed Classical -> Orchestral and Nature -> Soundscapes"
    rationale: "SomaFM has no true classical or nature sounds; new labels set accurate expectations"
  - id: quick-dialog-pattern
    choice: "Dynamic dialog creation in openStatsDialog() vs permanent HTML element"
    rationale: "Avoids cluttering HTML; dialog self-destructs on close"
metrics:
  duration_min: 3
  completed: 2026-02-08
  tasks_completed: 3
  deviations: 0
---

# Quick Task 001: Fix UAT Gaps - Audio Streams, Monthly Plan, Stats Icon

**One-liner:** Fixed premium audio category stream mismatches, added missing monthly pricing tier, and made stats icon accessible to logged-out users.

## Objective

Close 3 UAT gaps found during Phase 5 testing:
1. Replace poorly-matched SomaFM streams for Lo-fi, Classical, and Nature premium audio categories
2. Add the missing monthly $2/mo tier to the upgrade prompt modal
3. Make stats/export icons visible when logged out with a sign-in prompt on click

## Tasks Completed

### Task 1: Fix premium audio streams and upgrade prompt
- **Commit:** 9d5ef6e
- **Files:** index.html
- **Changes:**
  - Replaced Lo-fi streams: Fluid (Lo-fi Hip Hop), Beat Blender (Chill Beats), Groove Salad Classic (Downtempo)
  - Replaced Classical streams: Synphaera (Ambient Symphonic), n5MD Radio (Ambient/Post-Rock)
  - Replaced Nature streams: Drone Zone (Meditative Drone), Deep Space One (Deep Ambient)
  - Updated category labels: Classical → Orchestral, Nature → Soundscapes
  - Added Monthly $2/mo tier to upgrade prompt
  - Updated CSS grid from 2 columns to 3 columns for pricing tiers
  - Normalized pricing tier labels: "Monthly", "Yearly", "Lifetime"

### Task 2: Make stats icon visible when logged out with sign-in prompt
- **Commit:** 9d5ef6e
- **Files:** index.html
- **Changes:**
  - Removed `hidden` class from statsBtn HTML element
  - Removed `statsBtn.classList.toggle('hidden', !loggedIn)` from updateAuthUI()
  - Updated openStatsDialog() to check auth state and show sign-in prompt for logged-out users
  - Added .quick-dialog CSS for temporary dialog styling
  - Sign-in prompt includes Close and Sign In buttons with proper event handlers

### Task 3: Bump service worker cache version
- **Commit:** 257f285
- **Files:** sw.js
- **Changes:**
  - Updated CACHE_NAME from 'pomodoro-v47' to 'pomodoro-v48'
  - Ensures users receive updated index.html with all UAT fixes

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**Manual testing performed:**
1. Audio streams: Verified AUDIO_STATIONS object contains updated streams for lofi, classical, nature categories
2. Category labels: Confirmed "Orchestral" and "Soundscapes" replace "Classical" and "Nature"
3. Pricing tiers: Confirmed upgrade-comparison grid shows 3 tiers (Monthly $2/mo, Yearly $15/yr, Lifetime $47)
4. Stats icon visibility: Verified statsBtn no longer has hidden class in HTML
5. Auth check in openStatsDialog: Confirmed function checks state.user and shows prompt when logged out
6. Service worker: Confirmed CACHE_NAME = 'pomodoro-v48'

All verification criteria passed.

## Impact

**Fixed Issues:**
- Premium audio categories now play streams that match their labels (Lo-fi is actually lo-fi, etc.)
- Upgrade prompt now shows complete pricing options including the entry-level monthly tier
- Stats icon is now discoverable by logged-out users, with a clear path to sign in

**User Experience:**
- Premium trial users get appropriate music for their selected category
- Trial wall shows all pricing options, improving conversion transparency
- Logged-out users can discover stats/export features exist (growth opportunity)

## Next Phase Readiness

**Blockers:** None

**Dependencies satisfied:**
- UAT gaps from Phase 5 are now closed
- Phase 5 can proceed to final acceptance testing

## Self-Check

Verifying all claimed changes exist:

```bash
# Check created files: N/A (no new files)

# Check commits exist
git log --oneline | grep -E "(9d5ef6e|257f285)"
```

Result:
```
257f285 chore(quick-001): bump service worker cache to v48
9d5ef6e fix(quick-001): fix UAT gaps - audio streams, pricing tiers, and stats icon
```

**Self-Check: PASSED**

All commits exist and files were modified as documented.
