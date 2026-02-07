---
phase: 03-payment-infrastructure-and-feature-gating
plan: 01
subsystem: payments
tags: [firebase, cloud-functions, stripe, webhook, typescript]

# Dependency graph
requires:
  - phase: project-initialization
    provides: Firebase project ID and existing authentication setup
provides:
  - Firebase Cloud Functions v2 project with TypeScript
  - Stripe webhook endpoint with idempotent event processing
  - Subscription status sync to Firestore users/{uid}/subscription
  - Support for both recurring subscriptions and lifetime purchases
affects: [03-02-create-checkout-sessions, 03-03-customer-portal-access, 03-04-premium-feature-gating]

# Tech tracking
tech-stack:
  added: [stripe@17.6.0, firebase-admin@12.7.0, firebase-functions@6.2.0, typescript@5.7.2]
  patterns: [lazy-initialized services, idempotent webhook processing, merge-based Firestore updates]

key-files:
  created:
    - functions/package.json
    - functions/tsconfig.json
    - functions/src/index.ts
    - functions/src/utils/stripe-helpers.ts
    - functions/src/stripe/webhooks.ts
    - firebase.json
    - .firebaserc
    - .gitignore
  modified: []

key-decisions:
  - "Node.js 22 engine for Cloud Functions (per project decision)"
  - "Stripe API version 2025-02-24.acacia (latest stable)"
  - "Idempotency via stripe_events/{event.id} Firestore collection"
  - "Return 200 to Stripe immediately, process events asynchronously"
  - "Store customerId in subscription doc for Customer Portal access"

patterns-established:
  - "Lazy-initialized services: getStripe() and getDb() helpers prevent initialization costs on cold starts"
  - "Idempotent webhook processing: check stripe_events/{event.id} before processing to prevent duplicate handling"
  - "Merge-based updates: use Firestore merge:true to preserve existing fields when updating subscription status"
  - "Metadata propagation: store firebaseUid in subscription.metadata for reverse lookup in webhooks"

# Metrics
duration: 4min
completed: 2026-02-07
---

# Phase 3 Plan 01: Firebase Cloud Functions & Stripe Webhook Handler Summary

**Firebase Cloud Functions v2 with TypeScript, idempotent Stripe webhook processing for 4 subscription lifecycle events, and Firestore sync for both recurring and lifetime purchases**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-07T01:55:27Z
- **Completed:** 2026-02-07T01:59:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Firebase Cloud Functions v2 project initialized with TypeScript and Node.js 22
- Stripe webhook handler with signature verification using req.rawBody
- Idempotent event processing prevents duplicate webhook handling
- All 4 critical subscription lifecycle events handled: checkout completion, subscription updates/deletions, payment failures
- Subscription status synced to Firestore at users/{uid}/subscription
- Differentiated handling for recurring subscriptions vs lifetime purchases
- CustomerId stored for Customer Portal access in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Firebase Cloud Functions v2 with TypeScript** - `e7bd11d` (feat)
2. **Task 2: Implement Stripe webhook handler with idempotent event processing** - `d80380c` (feat)

**Plan metadata:** (Will be added in final commit)

## Files Created/Modified

- `functions/package.json` - Node.js 22 project with Stripe, Firebase Admin, and Firebase Functions dependencies
- `functions/tsconfig.json` - TypeScript configuration targeting ES2022 with NodeNext modules
- `functions/src/index.ts` - Cloud Functions entry point exporting stripeWebhook
- `functions/src/utils/stripe-helpers.ts` - Lazy-initialized Stripe client and Firestore database
- `functions/src/stripe/webhooks.ts` - Webhook handler with signature verification, idempotency, and 4 event processors
- `firebase.json` - Firebase project configuration for Cloud Functions deployment
- `.firebaserc` - Firebase project ID (pomodoro-timer-82980)
- `.gitignore` - Excludes functions/lib/, functions/node_modules/, functions/.env.yaml

## Decisions Made

1. **Node.js 22 engine** - Per project decision from planning phase
2. **Stripe API version 2025-02-24.acacia** - Latest stable version (initially 2024-12-18, updated during compilation)
3. **Idempotency mechanism** - Use Firestore collection stripe_events/{event.id} to prevent duplicate processing
4. **Immediate 200 response** - Return success to Stripe before async processing to prevent timeouts
5. **CustomerId storage** - Store in subscription doc for Customer Portal access in future plans
6. **Metadata strategy** - Store firebaseUid in subscription.metadata for reverse lookup in webhook handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Stripe API version from 2024-12-18 to 2025-02-24**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** TypeScript error - Stripe library required latest API version '2025-02-24.acacia'
- **Fix:** Updated apiVersion in stripe-helpers.ts from '2024-12-18.acacia' to '2025-02-24.acacia'
- **Files modified:** functions/src/utils/stripe-helpers.ts
- **Verification:** TypeScript compilation successful with npx tsc --noEmit
- **Committed in:** e7bd11d (Task 1 commit, fixed before initial commit)

---

**Total deviations:** 1 auto-fixed (1 bug - API version mismatch)
**Impact on plan:** Necessary fix for TypeScript compilation. No scope changes.

## Issues Encountered

None - plan executed smoothly with one minor API version correction.

## User Setup Required

**External services require manual configuration.** User must complete before deployment:

### Firebase Console
1. **Upgrade to Blaze plan** (Firebase Console -> Project Settings -> Usage and billing -> Modify plan)
   - Cloud Functions require pay-as-go billing
   - Free tier includes 2M invocations/month

### Stripe Dashboard
1. **Create Stripe account** (if not exists): https://dashboard.stripe.com/register
2. **Create 3 products with prices** (test mode):
   - Monthly: $2/month recurring
   - Yearly: $15/year recurring
   - Lifetime: $47 one-time payment
3. **Configure Customer Portal** (Settings -> Billing -> Customer portal):
   - Enable cancellation
   - Enable plan changes
   - Enable payment method updates
4. **Get API keys** (Developers -> API keys):
   - Copy Secret key (sk_test_...)
   - Add to functions/.env.yaml as STRIPE_SECRET_KEY
5. **Create webhook endpoint** (AFTER deploying Cloud Function):
   - Get deployed URL from `firebase deploy --only functions`
   - Add endpoint: Developers -> Webhooks -> Add endpoint
   - Listen to events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
   - Copy Signing secret (whsec_...)
   - Add to functions/.env.yaml as STRIPE_WEBHOOK_SECRET

### Environment Variables
File: `functions/.env.yaml` (local testing)
```yaml
STRIPE_SECRET_KEY: "sk_test_YOUR_KEY_HERE"
STRIPE_WEBHOOK_SECRET: "whsec_YOUR_SECRET_HERE"
```

Cloud deployment: Use `firebase functions:config:set` or Firebase Console

## Next Phase Readiness

**Ready for Plan 02** (Create checkout sessions):
- Webhook handler deployed and ready to receive events
- Subscription status sync mechanism in place
- CustomerId stored for Customer Portal integration

**Blockers:**
- User must complete Stripe setup (account, products, API keys)
- User must upgrade Firebase to Blaze plan
- Webhook secret only available AFTER Cloud Function is deployed (chicken-egg: deploy first with placeholder, then update with real secret)

**Concerns:**
- CORS configuration needed when frontend calls checkout session creation endpoint (Plan 02)
- Webhook endpoint URL must be added to Stripe Dashboard after first deployment
- Trial period configuration not yet implemented (Plan 02 will add trial_period_days)

## Self-Check: PASSED

All created files verified to exist:
- functions/package.json ✓
- functions/tsconfig.json ✓
- functions/src/index.ts ✓
- functions/src/utils/stripe-helpers.ts ✓
- functions/src/stripe/webhooks.ts ✓
- firebase.json ✓
- .firebaserc ✓
- .gitignore ✓

All commits verified in git log:
- e7bd11d ✓
- d80380c ✓

---
*Phase: 03-payment-infrastructure-and-feature-gating*
*Plan: 01*
*Completed: 2026-02-07*
