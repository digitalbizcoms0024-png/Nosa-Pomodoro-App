---
phase: 03-payment-infrastructure-and-feature-gating
plan: 03
subsystem: frontend-payments
tags: [pricing-ui, feature-gating, stripe-checkout, subscription, dialog, css-grid]

# Dependency graph
requires:
  - phase: 03-01
    provides: Stripe webhook handler and Firestore subscription sync
  - phase: 03-02
    provides: Callable Cloud Functions for checkout, portal, and verification
provides:
  - Pricing page with 4-tier comparison (Free/Monthly/Yearly/Lifetime)
  - Upgrade prompt modal for gated premium features
  - Real-time subscription state management via Firestore onSnapshot
  - Feature gating functions (isPremium, requirePremium)
  - Checkout/portal integration via Firebase callable functions
affects: [04-data-foundation-and-projects]

# Tech tracking
tech-stack:
  added: [firebase-functions-compat.js SDK]
  patterns: [addEventListener inside IIFE, dialog element for modals, CSS grid pricing layout]

key-files:
  created: []
  modified:
    - index.html
    - sw.js

key-decisions:
  - "Use addEventListener inside IIFE instead of inline onclick handlers (scoping issue)"
  - "Use <dialog> element with .showModal()/.close() for pricing page and upgrade prompt"
  - "4-tier pricing grid: Free + 3 paid tiers with CSS grid (responsive)"
  - "Subscription status cached in localStorage for fast optimistic checks"
  - "updatePremiumUI() called from init() and on Firestore subscription changes"

patterns-established:
  - "All premium UI event listeners registered inside IIFE closure via addEventListener"
  - "Dialog backdrop click dismissal pattern: if (e.target === e.currentTarget) close()"
  - "Escape key handler priority: pricing-page > upgrade-prompt > settings"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 3 Plan 03: Client-side Pricing UI & Feature Gating Summary

**Complete frontend payment UI with 4-tier pricing page, upgrade prompt modal, real-time subscription state management, and feature gating system connecting users to the Stripe payment infrastructure.**

## Performance

- **Duration:** ~5 min (including bugfix iterations)
- **Completed:** 2026-02-07
- **Tasks:** 2 auto + 1 checkpoint (human-verified)
- **Files modified:** 2 (index.html, sw.js)

## Accomplishments
- Pricing page dialog with 4-tier grid (Free/$2 mo/$15 yr/$47 lifetime) and "No Ads Ever" guarantee (MKTG-01)
- Upgrade prompt modal with feature name substitution for gated features
- Firebase Functions SDK integration with callable function wrappers (checkout, portal)
- Real-time Firestore subscription listener with localStorage caching
- Feature gating via isPremium() and requirePremium() functions
- Premium badge and upgrade button toggling based on subscription status
- Checkout return URL handling (success/canceled query params)
- Responsive CSS grid layout working in light/dark themes

## Task Commits

1. **Task 1: Firebase Functions SDK and subscription state management** - `d8939b1` (feat)
2. **Task 2: Pricing page UI and upgrade prompt modal** - `c5ceda6` (feat)
3. **Bugfix: Make upgrade button visible on page load** - `519daff` (fix)
4. **Bugfix: Replace inline onclick with addEventListener (IIFE scoping)** - `16aa2ed` (fix)

## Files Modified

- `index.html` - Added Firebase Functions SDK script, subscription state management, pricing page dialog, upgrade prompt dialog, CSS grid layout, feature gating functions, premium UI event listeners
- `sw.js` - Bumped CACHE_NAME from v36 to v39 (across tasks)

## Decisions Made

1. **addEventListener over inline onclick** - The app wraps all JS in an IIFE, so inline onclick handlers can't access closure-scoped functions. All event listeners registered inside the IIFE.
2. **`<dialog>` for modals** - Used native `<dialog>` elements with `.showModal()`/`.close()` matching existing app patterns (settings, stats dialogs)
3. **4-tier pricing grid** - Includes Free tier for comparison, making the value proposition clearer
4. **Escape key priority** - Pricing page closes first, then upgrade prompt, then settings dialog

## Deviations from Plan

1. **Inline onclick handlers didn't work** - Plan specified onclick attributes, but IIFE scoping required switching to addEventListener. Fixed in commit `16aa2ed`.
2. **Upgrade button initially hidden** - Button had `display:none` inline style with no init-time call to show it. Fixed in commit `519daff`.

## Issues Encountered

1. **IIFE scoping vs inline handlers** - Root cause: entire app JS is inside `(() => { 'use strict'; ... })()`. Functions defined inside are not in global scope. Inline `onclick="fn()"` silently fails. Solution: Remove all inline onclick, use addEventListener inside the IIFE.
2. **Upgrade button visibility** - `updatePremiumUI()` only ran when Firestore listener fired (requires sign-in). Added call in `init()` so button shows immediately.

## User Setup Required

**All backend infrastructure from Plans 01-02 must be deployed before payment flow works end-to-end.**

### Frontend Configuration
- Replace `STRIPE_PRICES` placeholder values in index.html with real Stripe price IDs
- Price IDs obtained after creating products in Stripe Dashboard

### Full Deployment Checklist (Plans 01-03)
1. Upgrade Firebase to Blaze plan
2. Create Stripe account, get API keys
3. Create 3 Stripe products (Monthly $2, Yearly $15, Lifetime $47)
4. Copy price IDs into `STRIPE_PRICES` config in index.html
5. Set environment variables: `firebase functions:secrets:set STRIPE_SECRET_KEY`
6. Deploy: `cd functions && npm run deploy`
7. Copy webhook function URL to Stripe Dashboard webhook endpoints
8. Set webhook secret: `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`
9. Redeploy functions with webhook secret

## Self-Check: PASSED

All verification criteria met:
- Pricing page renders with 4 tiers and correct pricing
- "No Ads Ever" guarantee visible (MKTG-01)
- Upgrade button opens pricing page (human-verified)
- Close button, Escape key, and backdrop click all dismiss dialogs
- Feature gating functions (isPremium, requirePremium) present
- Subscription listener with Firestore onSnapshot present
- Checkout/portal callable function wrappers present
- Service worker cache version bumped

---
*Phase: 03-payment-infrastructure-and-feature-gating*
*Plan: 03*
*Completed: 2026-02-07*
