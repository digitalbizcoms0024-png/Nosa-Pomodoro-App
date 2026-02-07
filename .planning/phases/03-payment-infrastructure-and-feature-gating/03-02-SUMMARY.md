---
phase: 03-payment-infrastructure-and-feature-gating
plan: 02
subsystem: payments
tags: [firebase, cloud-functions, stripe, checkout, typescript, onCall]

# Dependency graph
requires:
  - phase: 03-01
    provides: Stripe webhook handler and Firestore subscription sync
provides:
  - Three callable Cloud Functions for checkout, customer portal, and subscription verification
  - Support for 3 pricing tiers (monthly, yearly, lifetime) with differentiated trial logic
  - Server-side subscription status verification with grace period handling
affects: [03-03-frontend-payment-ui, 03-04-premium-feature-gating]

# Tech tracking
tech-stack:
  added: []
  patterns: [onCall Cloud Functions with authentication guards, structured API responses, tier-based trial logic]

key-files:
  created:
    - functions/src/stripe/checkout.ts
    - functions/src/stripe/portal.ts
    - functions/src/stripe/verify-subscription.ts
  modified:
    - functions/src/index.ts

key-decisions:
  - "7-day free trial only for subscription mode (monthly/yearly), not lifetime"
  - "Tier inference from status and priceId in verification response"
  - "All onCall functions reject unauthenticated requests with HttpsError"
  - "Portal requires existing customerId in Firestore (stored by webhook)"

patterns-established:
  - "Authentication guard pattern: if (!request.auth) throw HttpsError('unauthenticated', ...)"
  - "Validation pattern: explicit validation of input parameters with descriptive error messages"
  - "Structured responses: consistent return shape with hasAccess, status, tier, and metadata"

# Metrics
duration: 1min
completed: 2026-02-07
---

# Phase 3 Plan 02: Callable Cloud Functions for Payment Flow Summary

**Three onCall Cloud Functions (createCheckoutSession, createPortalSession, verifySubscription) enabling client-side checkout initiation, billing portal access, and server-side subscription verification with tier-based trial logic**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-07T02:03:04Z
- **Completed:** 2026-02-07T02:04:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Checkout session creation supporting both subscription (7-day trial) and payment (lifetime, no trial) modes
- Customer Portal session creation reading customerId from Firestore
- Server-side subscription verification with hasAccess boolean, tier info, and grace period flag
- All functions require authentication and reject unauthenticated requests
- Full TypeScript compilation to lib/ directory succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement checkout session and portal session Cloud Functions** - `e5ed24b` (feat)
2. **Task 2: Implement server-side subscription verification function** - `bc6b14d` (feat)

**Plan metadata:** (Will be added in final commit)

## Files Created/Modified

- `functions/src/stripe/checkout.ts` - Creates Stripe Checkout sessions with mode-specific config (trial vs no trial)
- `functions/src/stripe/portal.ts` - Creates Stripe Customer Portal sessions for subscription management
- `functions/src/stripe/verify-subscription.ts` - Reads Firestore subscription status and returns structured access response
- `functions/src/index.ts` - Exports all 4 Cloud Functions (webhook + 3 callable functions)

## Decisions Made

1. **7-day trial only for subscriptions** - Lifetime purchases (mode='payment') have no trial period, charge immediately
2. **Tier inference from priceId** - Verification function infers tier from status (lifetime) or priceId pattern (monthly/yearly)
3. **Authentication guard pattern** - All onCall functions use consistent `if (!request.auth)` guard pattern
4. **Portal requires customerId** - Portal function reads customerId from Firestore (stored by webhook in Plan 01)
5. **Grace period handling** - Verification returns gracePeriod=true for past_due status (payment failed but access maintained)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - plan executed smoothly with no compilation errors or blocking issues.

## User Setup Required

**External services require manual configuration.** User must complete before deployment:

### Environment Variables
Same as Plan 01 - see 03-01-SUMMARY.md for:
- STRIPE_SECRET_KEY (from Stripe Dashboard -> Developers -> API keys)
- STRIPE_WEBHOOK_SECRET (from Stripe Dashboard after webhook endpoint created)
- Firebase Blaze plan upgrade required

### Stripe Products
User must create 3 products in Stripe Dashboard (test mode):
1. **Monthly Premium** - $2/month recurring → Copy priceId (price_xxx)
2. **Yearly Premium** - $15/year recurring → Copy priceId (price_xxx)
3. **Lifetime Premium** - $47 one-time payment → Copy priceId (price_xxx)

Frontend will need these priceIds to call createCheckoutSession with correct tier.

## Next Phase Readiness

**Ready for Plan 03** (Frontend payment UI):
- Checkout session creation endpoint ready to receive priceId and mode
- Portal session creation endpoint ready for users with active subscriptions
- Verification endpoint ready for checking premium access status

**Blockers:**
- User must complete Stripe setup (products, priceIds) before frontend can call checkout
- Firebase Blaze plan upgrade still required before deployment

**Concerns:**
- CORS configuration will be needed when frontend calls these onCall functions (automatically handled by Firebase SDK)
- PriceIds need to be stored in frontend config (env vars or constants)
- Frontend needs to map tier selection to (priceId, mode) tuple for checkout call

## Self-Check: PASSED

All created files verified to exist:
- functions/src/stripe/checkout.ts ✓
- functions/src/stripe/portal.ts ✓
- functions/src/stripe/verify-subscription.ts ✓

All commits verified in git log:
- e5ed24b ✓
- bc6b14d ✓

All verification criteria met:
- TypeScript compilation succeeds ✓
- All 4 Cloud Functions exported from index.ts ✓
- Checkout handles both subscription and payment modes ✓
- 7-day trial only on subscription mode ✓
- Portal reads customerId from Firestore ✓
- Verification uses PREMIUM_STATUSES constant ✓

---
*Phase: 03-payment-infrastructure-and-feature-gating*
*Plan: 02*
*Completed: 2026-02-07*
