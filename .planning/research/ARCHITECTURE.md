# Architecture Research: Stripe Payments + Firebase Cloud Functions

**Domain:** SaaS subscription payments for vanilla JS PWA
**Researched:** 2026-02-07
**Confidence:** HIGH (Stripe docs, Firebase docs, multiple verified sources)

## System Overview

The architecture introduces a server-side layer (Firebase Cloud Functions) to an otherwise client-only app. The client never touches Stripe secrets or handles payment data directly. All payment logic runs server-side; the client only initiates flows and reads subscription status from Firestore.

```
+------------------+     +------------------------+     +-------------+
|   Client (PWA)   |     | Firebase Cloud Funcs   |     |   Stripe    |
|   index.html     |     | (Node.js, server-side) |     |   (hosted)  |
|                  |     |                        |     |             |
| - Calls onCall   |---->| - createCheckout       |---->| - Checkout  |
|   functions      |     | - createPortalSession  |     | - Billing   |
| - Reads Firestore|     | - handleWebhook        |     | - Webhooks  |
| - Feature gating |     | - verifySubscription   |     |             |
|   (client-side)  |     |                        |     |             |
+------------------+     +------------------------+     +-------------+
        |                          |                          |
        |       +------------------+                          |
        |       |                                             |
        v       v                                             |
  +-------------------+                                       |
  |    Firestore      |<---------- webhook writes ------------+
  |                   |
  | users/{uid}       |
  |   .subscription   |
  |   .stripeCustomer |
  |   .stats (exists) |
  +-------------------+
```

## Component Inventory

### New Components (Must Build)

| Component | Type | Purpose |
|-----------|------|---------|
| `functions/` directory | Cloud Functions project | All server-side code |
| `createCheckoutSession` | onCall function | Creates Stripe Checkout session for pricing tier |
| `createPortalSession` | onCall function | Creates Stripe Customer Portal session |
| `handleStripeWebhook` | onRequest function | Receives and processes Stripe webhook events |
| `checkSubscription` | onCall function | Server-verified subscription status check |
| Premium UI components | Client-side HTML/CSS/JS | Upgrade prompts, gating UI, manage subscription |
| Feature gating framework | Client-side JS | Checks subscription status, gates premium features |

### Modified Components (Existing)

| Component | Change |
|-----------|--------|
| `index.html` | Add premium UI, gating logic, Stripe Checkout redirect, subscription state |
| `state` object | Add `subscription` property with cached status |
| `fbAuth.onAuthStateChanged` | Load subscription status after auth |
| Firestore `users/{uid}` doc | Extended with `stripeCustomerId` and subscription fields |
| `sw.js` | Bump cache version |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| Firebase Auth flow | Sign-in stays the same; UID links to Stripe customer |
| Timer core logic | Timer is free; no gating needed |
| Stats/Leaderboard | Stats remain free; Firestore sync unchanged |
| Audio engine | Audio is free; unchanged |

---

## Stripe Checkout Flow

### Recommendation: Hosted (Redirect) Mode

Use Stripe-hosted Checkout (redirect mode), not embedded mode.

**Why redirect over embedded:**
- Simpler integration: no Stripe.js mount needed on client
- No PCI scope increase for embedding payment forms
- Stripe handles all payment UI, validation, 3D Secure
- Works perfectly with vanilla JS (no React/framework needed)
- User redirected to Stripe -> completes payment -> redirected back
- Stripe handles mobile responsiveness, accessibility, i18n

**Flow for subscription (monthly/yearly):**

```
1. User clicks "Upgrade" button on pricing UI
2. Client calls Firebase onCall function: createCheckoutSession({ priceId, tier })
3. Cloud Function:
   a. Verifies user is authenticated (automatic with onCall)
   b. Gets or creates Stripe Customer (linked to Firebase UID)
   c. Calls stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 7,    // 7-day free trial
          metadata: { firebaseUID: uid }
        },
        success_url: 'https://pomodorotimer.vip/?payment=success',
        cancel_url: 'https://pomodorotimer.vip/?payment=cancelled',
        metadata: { firebaseUID: uid, tier: tier }
      })
   d. Returns { url: session.url }
4. Client redirects: window.location.href = result.data.url
5. User completes payment on Stripe-hosted page
6. Stripe redirects to success_url
7. Meanwhile, Stripe fires webhook events -> Cloud Function processes them
```

**Flow for lifetime (one-time payment):**

```
Same as above but:
- mode: 'payment' (not 'subscription')
- No subscription_data or trial_period_days
- payment_intent_data: { metadata: { firebaseUID: uid, tier: 'lifetime' } }
- Webhook handles checkout.session.completed to grant lifetime access
```

### Trial Flow (7-Day Free Trial)

Two approaches available. Recommendation: **Stripe-managed trial with payment method required**.

**Option A: Trial with payment method upfront (RECOMMENDED)**
```
Checkout session with:
  mode: 'subscription'
  subscription_data: { trial_period_days: 7 }
  // payment_method_collection defaults to 'always'
```
- User enters card during checkout but is not charged for 7 days
- Subscription starts as `trialing`, auto-converts to `active` on day 8
- Higher conversion rate (card already on file)
- Stripe handles all trial-to-paid transition logic

**Option B: Trial without payment method**
```
Checkout session with:
  mode: 'subscription'
  subscription_data: { trial_period_days: 7 }
  payment_method_collection: 'if_required'
  trial_settings: { end_behavior: { missing_payment_method: 'cancel' } }
```
- Lower friction but lower conversion
- Must handle trial expiry -> prompt for payment method
- More complex client-side logic

**Recommendation:** Option A. The 7-day trial is short enough that requiring a card upfront is standard practice. Higher conversion, simpler code.

---

## Webhook Handling in Cloud Functions

### Implementation: onRequest (NOT onCall)

Webhooks must use `onRequest` because Stripe sends raw HTTP POST requests, not Firebase-formatted callable requests.

**Critical detail:** Stripe signature verification requires `request.rawBody` (the unparsed request body). Firebase Cloud Functions v2 provides this automatically on the request object.

### Webhook Function Structure

```javascript
// functions/src/webhooks.js
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const webhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

export const handleStripeWebhook = onRequest(
  { secrets: [stripeSecretKey, webhookSecret] },
  async (req, res) => {
    const stripe = new Stripe(stripeSecretKey.value());
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,  // MUST use rawBody, not req.body
        sig,
        webhookSecret.value()
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Process event...
    switch (event.type) { /* ... */ }

    res.status(200).json({ received: true });
  }
);
```

### Webhook Events to Handle

| Event | When | What To Do |
|-------|------|-----------|
| `checkout.session.completed` | Checkout finishes | Create/update subscription doc in Firestore. For lifetime: set `status: 'lifetime'` |
| `customer.subscription.created` | New subscription | Write subscription data to Firestore |
| `customer.subscription.updated` | Plan change, trial ends, renewal | Update status, tier, period end in Firestore |
| `customer.subscription.deleted` | Cancellation takes effect | Set status to `'canceled'` in Firestore |
| `invoice.paid` | Successful payment (renewal) | Confirm active status in Firestore |
| `invoice.payment_failed` | Payment fails | Set status to `'past_due'` in Firestore |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Optional: trigger email reminder (future feature) |

### Webhook Processing Logic

```
For each event:
1. Extract firebaseUID from metadata (subscription or session)
2. Look up users/{uid} in Firestore
3. Update subscription fields based on event type
4. For checkout.session.completed with mode=payment (lifetime):
   - Set subscription.status = 'lifetime'
   - Set subscription.tier = 'lifetime'
   - No expiry date needed
```

---

## Firestore Schema for Subscription Data

### Extended users/{uid} Document

```javascript
// Existing fields (unchanged)
{
  displayName: "John Doe",
  photoURL: "https://...",
  totalMinutes: 1250,
  totalSessions: 50,
  bestStreak: 7,
  dailyCounts: { "2026-02-07": 3, ... },
  dailyMinutes: { "2026-02-07": 75, ... },
  updatedAt: Timestamp,

  // NEW: Stripe customer link
  stripeCustomerId: "cus_abc123",

  // NEW: Subscription status (written by webhooks only)
  subscription: {
    status: "active",          // trialing | active | past_due | canceled | lifetime | free
    tier: "yearly",            // monthly | yearly | lifetime
    priceId: "price_abc123",   // Stripe price ID
    subscriptionId: "sub_xyz", // Stripe subscription ID (null for lifetime)
    currentPeriodEnd: Timestamp,  // When current period expires (null for lifetime)
    cancelAtPeriodEnd: false,  // User requested cancellation but still active
    trialEnd: Timestamp,       // When trial ends (null if not trialing)
    updatedAt: Timestamp       // Last webhook update
  }
}
```

### Why Flat in users/{uid} (Not a Subcollection)

- Single document read to get subscription status (fast, cheap)
- Client already reads `users/{uid}` for stats
- Subscription status is a single active record, not a collection of records
- Reduces Firestore reads (billing concern on Blaze plan)
- Simpler security rules

### Alternative Considered: Subcollection

```
users/{uid}/subscriptions/{subId}   // NOT RECOMMENDED
```
- Requires extra query to find active subscription
- More complex security rules
- Adds read cost
- Only useful if tracking subscription history (not needed for feature gating)

### Stripe Products/Prices (Pre-configured in Stripe Dashboard)

No need to sync products to Firestore. Prices are configured in Stripe Dashboard and price IDs are hardcoded in both client (for display) and Cloud Functions (for validation).

```javascript
// Hardcoded price configuration (client + functions shared)
const PRICING = {
  monthly: { priceId: 'price_monthly_xxx', amount: 200, label: '$2/mo' },
  yearly:  { priceId: 'price_yearly_xxx',  amount: 1500, label: '$15/yr' },
  lifetime:{ priceId: 'price_lifetime_xxx', amount: 4700, label: '$47 once' }
};
```

---

## Feature Gating Approach

### Architecture: Server-Verified, Client-Cached

```
1. Source of truth: Firestore users/{uid}.subscription (written by webhooks)
2. Client cache: state.subscription (loaded on auth, periodically refreshed)
3. Security: Firestore rules enforce read-only for subscription field
4. Enforcement: Client-side gating for UX, Firestore rules for data security
```

### Client-Side Gating Logic

```javascript
// In state object
const state = {
  // ... existing ...
  subscription: {
    status: 'free',       // loaded from Firestore
    tier: null,
    isPremium: false,     // computed: status is active/trialing/lifetime
    trialDaysLeft: null   // computed from trialEnd
  }
};

// Premium check helper
function isPremium() {
  const s = state.subscription.status;
  return s === 'active' || s === 'trialing' || s === 'lifetime';
}

// Feature gating
function requirePremium(featureName) {
  if (isPremium()) return true;
  showUpgradePrompt(featureName);
  return false;
}

// Usage in feature code
function openSmartInsights() {
  if (!requirePremium('Smart Insights')) return;
  // ... show insights ...
}
```

### Why NOT Custom Claims

Custom claims (via Firebase Auth tokens) are another option for feature gating, but they have drawbacks for this use case:

| Factor | Custom Claims | Firestore Document |
|--------|--------------|-------------------|
| Propagation delay | Requires token refresh (~1hr or forced) | Immediate on next read |
| Size limit | 1000 bytes max | No practical limit |
| Complexity | Requires Admin SDK to set | Webhook writes directly |
| Security rules | `request.auth.token.premium` | `get(/users/$(uid)).data.subscription.status` |
| Client read | Automatic in token | Requires Firestore read |

**Recommendation:** Use Firestore document for subscription status. Simpler, no propagation delay, and the client already reads this document. Custom claims add complexity without meaningful benefit for this app.

### Subscription Status Loading

```
On auth state change (user signs in):
1. Read users/{uid} from Firestore (already happens for stats)
2. Extract subscription field
3. Compute isPremium, trialDaysLeft
4. Cache in state.subscription
5. Update UI (show/hide premium features, badge, etc.)

On app focus (visibilitychange):
- Re-read subscription status (handles background cancellations, renewals)

On success_url return:
- Poll subscription status briefly (webhook may not have fired yet)
- Show "Processing payment..." for up to 5 seconds
- If still not updated, show success anyway (webhook will catch up)
```

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      // Users can read their own document
      allow read: if request.auth != null && request.auth.uid == uid;

      // Users can write stats fields but NOT subscription fields
      allow update: if request.auth != null && request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['subscription', 'stripeCustomerId']);

      // Allow create for new users (stats only)
      allow create: if request.auth != null && request.auth.uid == uid
        && !request.resource.data.keys().hasAny(['subscription', 'stripeCustomerId']);
    }
  }
}
```

Key rule: Users can never write `subscription` or `stripeCustomerId` fields from the client. Only Cloud Functions (using Admin SDK, which bypasses rules) can write these fields. This prevents subscription spoofing.

---

## Customer Portal for Subscription Management

Stripe Customer Portal is a Stripe-hosted page where users can:
- View subscription details
- Update payment method
- Cancel subscription
- Switch plans (upgrade/downgrade)
- View invoice history

### Implementation

```javascript
// Cloud Function: createPortalSession (onCall)
export const createPortalSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const userDoc = await getFirestore().collection('users').doc(uid).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;
    if (!stripeCustomerId) throw new HttpsError('not-found', 'No subscription found');

    const stripe = new Stripe(stripeSecretKey.value());
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: 'https://pomodorotimer.vip/'
    });

    return { url: session.url };
  }
);
```

### Portal Configuration (Stripe Dashboard)

Configure in Stripe Dashboard > Settings > Customer Portal:
- Allow customers to cancel subscriptions
- Show invoice history
- Allow payment method updates
- Do NOT allow plan switching (keep it simple; they can cancel and re-subscribe)
- Add cancellation reason collection (optional, good data)

---

## Cloud Functions Project Structure

```
pomodoro/
  index.html              (existing - client)
  sw.js                   (existing - service worker)
  manifest.json           (existing - PWA manifest)
  CNAME                   (existing - custom domain)
  firebase.json           (NEW - Firebase project config)
  .firebaserc             (NEW - Firebase project alias)
  functions/
    package.json          (NEW - Node.js dependencies)
    tsconfig.json         (NEW - if using TypeScript, recommended)
    src/
      index.ts            (NEW - exports all functions)
      checkout.ts         (NEW - createCheckoutSession)
      portal.ts           (NEW - createPortalSession)
      webhooks.ts         (NEW - handleStripeWebhook)
      verify.ts           (NEW - checkSubscription)
      stripe.ts           (NEW - Stripe client init, shared helpers)
      config.ts           (NEW - pricing config, constants)
```

### firebase.json

```json
{
  "functions": {
    "source": "functions",
    "codebase": "default",
    "runtime": "nodejs20"
  }
}
```

**Note:** The static site (index.html) continues to be hosted on GitHub Pages. Firebase is used ONLY for Cloud Functions (and the existing Firestore/Auth). Do NOT enable Firebase Hosting -- the custom domain stays on GitHub Pages.

### Secrets Management

Use `defineSecret()` (Firebase v2 parameter system backed by Google Cloud Secret Manager):

```bash
# Set secrets via Firebase CLI
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

**Do NOT use:**
- `functions.config()` -- deprecated, will be decommissioned March 2027
- `.env` files in functions directory -- secrets should not be in version control
- Hardcoded keys -- obviously

### Dependencies (functions/package.json)

```json
{
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "stripe": "^17.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "firebase-functions-test": "^3.0.0"
  }
}
```

---

## Complete Data Flow Diagrams

### Flow 1: New User Upgrades (Subscription with Trial)

```
User clicks "Start Free Trial" on pricing card
  |
  v
Client: const { data } = await createCheckoutSession({
  priceId: PRICING.monthly.priceId,
  tier: 'monthly'
})
  |
  v
Cloud Function: createCheckoutSession
  1. Verify auth (automatic with onCall)
  2. Get user email from Firebase Auth
  3. Check Firestore for existing stripeCustomerId
  4. If none: stripe.customers.create({ email, metadata: { firebaseUID } })
  5. Store stripeCustomerId in Firestore users/{uid}
  6. stripe.checkout.sessions.create({
       customer: stripeCustomerId,
       mode: 'subscription',
       line_items: [{ price: priceId, quantity: 1 }],
       subscription_data: { trial_period_days: 7, metadata: { firebaseUID } },
       success_url: 'https://pomodorotimer.vip/?payment=success',
       cancel_url: 'https://pomodorotimer.vip/?payment=cancelled'
     })
  7. Return { url: session.url }
  |
  v
Client: window.location.href = data.url  (redirects to Stripe)
  |
  v
User enters card details on Stripe Checkout page
  |
  v
Stripe: Creates subscription with status=trialing
  |
  v
Stripe fires webhooks (near-simultaneously):
  - checkout.session.completed
  - customer.subscription.created (status: trialing)
  |
  v
Cloud Function: handleStripeWebhook
  1. Verify signature with rawBody
  2. Extract firebaseUID from metadata
  3. Write to Firestore users/{uid}.subscription:
     { status: 'trialing', tier: 'monthly', trialEnd: <7 days>, ... }
  |
  v
Stripe redirects user to success_url
  |
  v
Client: Detects ?payment=success query param
  1. Show "Welcome to Premium!" toast
  2. Re-read Firestore users/{uid}
  3. Update state.subscription
  4. UI updates: premium features unlocked
```

### Flow 2: Trial Converts to Paid

```
Day 8: Stripe automatically charges the card
  |
  v
Stripe fires webhooks:
  - invoice.paid
  - customer.subscription.updated (status: active, trial_end: past)
  |
  v
Cloud Function: handleStripeWebhook
  1. Updates Firestore users/{uid}.subscription:
     { status: 'active', trialEnd: null, currentPeriodEnd: <next month> }
  |
  v
Next time client loads or checks:
  - Reads updated status from Firestore
  - User continues using premium features seamlessly
```

### Flow 3: Monthly Renewal

```
Billing date arrives
  |
  v
Stripe charges card automatically
  |
  v
Stripe fires: invoice.paid + customer.subscription.updated
  |
  v
Cloud Function updates Firestore:
  - currentPeriodEnd: <next billing date>
  - status: 'active' (confirmed)
```

### Flow 4: Payment Failure

```
Billing date: card declined
  |
  v
Stripe fires: invoice.payment_failed
  |
  v
Cloud Function updates Firestore:
  - status: 'past_due'
  |
  v
Stripe retries payment (smart retries, configurable)
  |
  v
If retries exhausted:
  Stripe fires: customer.subscription.deleted
  |
  v
  Cloud Function: status = 'canceled'
  |
  v
  Client: isPremium() returns false
  Premium features gated, upgrade prompt shown
```

### Flow 5: Lifetime Purchase

```
User clicks "Buy Lifetime" on pricing card
  |
  v
Cloud Function: createCheckoutSession
  - mode: 'payment' (NOT subscription)
  - line_items: [{ price: lifetime_price_id, quantity: 1 }]
  - NO subscription_data, NO trial
  - metadata: { firebaseUID, tier: 'lifetime' }
  |
  v
User pays on Stripe Checkout
  |
  v
Stripe fires: checkout.session.completed (mode: payment)
  |
  v
Cloud Function: handleStripeWebhook
  - Detects mode=payment with tier=lifetime in metadata
  - Writes to Firestore:
    { status: 'lifetime', tier: 'lifetime', currentPeriodEnd: null }
  |
  v
User has permanent premium access. No renewals, no expiry.
```

### Flow 6: User Cancels Subscription

```
User clicks "Manage Subscription" in settings
  |
  v
Client calls createPortalSession()
  |
  v
Cloud Function returns Stripe portal URL
  |
  v
User redirected to Stripe Customer Portal
  - Clicks "Cancel subscription"
  - Stripe sets cancel_at_period_end: true
  |
  v
Stripe fires: customer.subscription.updated
  |
  v
Cloud Function updates Firestore:
  - cancelAtPeriodEnd: true
  - status still 'active' (until period ends)
  |
  v
Client shows: "Your subscription will end on [date]"
  Premium features remain active until period end
  |
  v
Period ends: Stripe fires customer.subscription.deleted
  |
  v
Cloud Function: status = 'canceled'
  Client: isPremium() returns false
```

---

## Integration Points with Existing Firebase Auth

The existing `fbAuth.onAuthStateChanged` handler is the key integration point.

### Current Auth Flow (Unchanged)

```javascript
fbAuth.onAuthStateChanged(async (user) => {
  state.user = user;
  updateAuthUI();
  if (user) {
    if (isNewSignIn) {
      await syncStatsToFirestore();
      isNewSignIn = false;
    }
    await pullStatsFromFirestore();
    updateStats();
    loadLeaderboard();
  }
});
```

### Extended Auth Flow (New Lines in Bold Context)

```javascript
fbAuth.onAuthStateChanged(async (user) => {
  state.user = user;
  updateAuthUI();
  if (user) {
    if (isNewSignIn) {
      await syncStatsToFirestore();
      isNewSignIn = false;
    }
    await pullStatsFromFirestore();
    await loadSubscriptionStatus();  // NEW: load subscription from Firestore
    updateStats();
    loadLeaderboard();
    updatePremiumUI();               // NEW: show/hide premium features
  } else {
    resetSubscriptionState();        // NEW: clear subscription on sign-out
    updatePremiumUI();               // NEW: revert to free UI
  }
});
```

### Linking Firebase UID to Stripe Customer

The Firebase UID is the foreign key connecting everything:

```
Firebase Auth user.uid  --->  Firestore users/{uid}.stripeCustomerId  --->  Stripe Customer
                        --->  Stripe metadata.firebaseUID (on customer, subscription, session)
```

Both directions are linked:
- Cloud Functions look up Stripe customer by reading `stripeCustomerId` from Firestore
- Webhooks look up Firebase user by reading `firebaseUID` from Stripe metadata
- This bidirectional link is established during `createCheckoutSession` (first purchase)

---

## Security Model

### What Runs Server-Side (Cloud Functions)

| Operation | Why Server-Side |
|-----------|----------------|
| Stripe API calls (all) | Requires secret key; never expose to client |
| Checkout session creation | Validates pricing, sets metadata |
| Webhook processing | Signature verification requires webhook secret |
| Subscription status writes | Prevents client-side subscription spoofing |
| Customer portal session creation | Requires secret key |
| Stripe customer creation | Links to Firebase UID securely |

### What Runs Client-Side

| Operation | Security Note |
|-----------|--------------|
| Read subscription status from Firestore | Safe; Firestore rules enforce user can only read own doc |
| Feature gating (isPremium check) | UX only; determined by server-written Firestore data |
| Redirect to Stripe Checkout URL | URL is one-time use, scoped to session |
| Redirect to Customer Portal URL | URL is one-time use, scoped to customer |
| Display pricing information | Public information |

### Attack Vectors Addressed

| Attack | Prevention |
|--------|-----------|
| Client modifies subscription status in Firestore | Security rules block client writes to subscription field |
| Client calls Stripe API directly | Secret key only in Cloud Functions (defineSecret) |
| Webhook spoofing (fake events) | Signature verification with rawBody + webhook secret |
| User accesses another user's subscription | Security rules: `request.auth.uid == uid` |
| Replay attacks on webhooks | Stripe signature includes timestamp; verify freshness |

---

## Suggested Build Order

Based on dependency analysis:

### Phase 1: Payment Infrastructure (Foundation)

Build order within this phase:

1. **Firebase Cloud Functions project setup**
   - Initialize `functions/` directory
   - Configure `firebase.json` (functions only, no hosting)
   - Set up TypeScript, linting
   - Store Stripe secrets with `defineSecret`
   - Deploy a hello-world function to verify setup

2. **Stripe customer linking**
   - `createCheckoutSession` Cloud Function
   - Get-or-create Stripe customer with Firebase UID
   - Store `stripeCustomerId` in Firestore

3. **Webhook handler**
   - `handleStripeWebhook` function with signature verification
   - Handle core events: checkout.session.completed, subscription.created/updated/deleted, invoice.paid/failed
   - Write subscription status to Firestore

4. **Client-side subscription loading**
   - Extend state with subscription
   - Load subscription on auth state change
   - `isPremium()` helper function

5. **Feature gating framework**
   - `requirePremium(featureName)` function
   - Upgrade prompt modal
   - Pricing cards with Stripe Checkout redirect

6. **Customer portal integration**
   - `createPortalSession` Cloud Function
   - "Manage Subscription" button in settings
   - Configure portal in Stripe Dashboard

7. **Firestore security rules update**
   - Protect subscription and stripeCustomerId fields
   - Test with emulator

8. **End-to-end testing with Stripe test mode**
   - Test all flows: subscribe, trial, cancel, lifetime
   - Test webhook delivery
   - Test failure cases

### Phase 2+: Premium Features

Each premium feature built separately, gated by `requirePremium()`.

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stripe integration approach | Custom Cloud Functions | Full control over logic; extension is opinionated and harder to customize for lifetime deals |
| Checkout mode | Hosted (redirect) | Simplest for vanilla JS; no Stripe.js embed needed |
| Cloud Functions version | v2 (2nd gen) | Better secrets management, concurrency, configurable |
| Function type for client calls | onCall | Automatic auth verification, CORS handling, typed responses |
| Function type for webhooks | onRequest | Stripe sends raw HTTP POST; needs rawBody access |
| Subscription data location | Flat in users/{uid} | Single read, already-read document, simple rules |
| Feature gating enforcement | Firestore rules + client UI | Server-written status prevents spoofing; client reads for UX |
| Trial type | Card required upfront | Higher conversion; Stripe manages trial-to-paid transition |
| Lifetime implementation | Checkout mode=payment | One-time charge; status set to 'lifetime' permanently |
| Secrets management | defineSecret() | Modern v2 approach; backed by Cloud Secret Manager |
| Static hosting | Keep GitHub Pages | Cloud Functions deploy separately; no migration needed |

---

## Cost Implications (Firebase Blaze Plan)

The project must be on the Blaze (pay-as-you-go) plan for Cloud Functions. Key cost factors:

| Resource | Free Tier | Estimated Monthly Use | Cost |
|----------|-----------|----------------------|------|
| Cloud Function invocations | 2M/month | ~1,000 (low traffic) | $0 |
| Cloud Function compute | 400K GB-s | Minimal | $0 |
| Firestore reads | 50K/day | Within free tier | $0 |
| Firestore writes | 20K/day | Within free tier | $0 |
| Outbound networking | 5GB/month | Minimal | $0 |

**Expected cost for low-traffic app: effectively $0.** The free tier on Blaze plan is generous. Costs only become meaningful at scale (~10K+ daily active users).

---

## Sources

- [Stripe Checkout documentation](https://docs.stripe.com/payments/checkout)
- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [Stripe free trials](https://docs.stripe.com/payments/checkout/free-trials)
- [Firebase Cloud Functions getting started](https://firebase.google.com/docs/functions/get-started)
- [Firebase secrets management](https://firebase.google.com/docs/functions/config-env)
- [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase process payments with Stripe tutorial](https://firebase.google.com/docs/tutorials/payments-stripe)
- [Implementing Stripe Subscriptions with Firebase (2025)](https://aronschueler.de/blog/2025/03/17/implementing-stripe-subscriptions-with-firebase-cloud-functions-and-firestore/)
- [Firebase Stripe extension](https://extensions.dev/extensions/stripe/firestore-stripe-payments)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [Raw body for Stripe webhooks in Firebase](https://www.bitesite.ca/blog/raw-body-for-stripe-webhooks-using-firebase-cloud-functions)
- [Firebase Cloud Functions organize](https://firebase.google.com/docs/functions/organize-functions)
- [Firebase pricing](https://firebase.google.com/pricing)
