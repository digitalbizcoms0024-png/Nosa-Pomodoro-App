# Phase 3: Payment Infrastructure & Feature Gating - Research

**Researched:** 2026-02-07
**Domain:** Stripe payment integration, Firebase Cloud Functions v2, subscription management
**Confidence:** HIGH

## Summary

Phase 3 establishes the monetization foundation by integrating Stripe Checkout for 3 pricing tiers (monthly $2, yearly $15, lifetime $47), implementing webhook-driven subscription sync to Firestore, and gating premium features with server-side verification. The standard approach uses Stripe-hosted Checkout (zero payment UI to build), Firebase Cloud Functions v2 for webhook handling and protected APIs, and client-side caching with server-side truth.

**Key architectural decisions:**
- Stripe Checkout redirect mode eliminates all payment UI development
- Firebase Cloud Functions v2 handles webhooks and protected API endpoints with CORS configured for GitHub Pages
- Firestore stores subscription status at `users/{uid}/subscription` synced via webhooks
- Feature gating uses client-side cache + server-side verification pattern
- Lifetime payments use `mode: 'payment'` (one-time) vs `mode: 'subscription'` (recurring)

**Primary recommendation:** Use Stripe's official Node.js SDK with Firebase Admin SDK for token verification. Implement webhook signature validation immediately (security critical). Handle subscription status transitions defensively with idempotency checks. Deploy webhook endpoint first, then test locally with Stripe CLI before implementing checkout flow.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^17.x | Stripe API client for Node.js | Official SDK with TypeScript support, handles webhook signatures, API retries |
| firebase-admin | ^12.x | Firebase Admin SDK for server-side operations | Token verification, Firestore writes from Cloud Functions |
| firebase-functions | ^6.x | Cloud Functions v2 runtime | Managed serverless, built-in CORS, integrates with Firebase Auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cors | ^2.8.5 | Express middleware for CORS | Only if custom CORS logic needed (Functions v2 has built-in CORS) |
| dotenv | ^16.x | Environment variable management | Local development only (Functions uses .env.yaml) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout | Stripe Elements | Elements requires building payment UI; Checkout is hosted and PCI-compliant out-of-box |
| Cloud Functions v2 | Cloud Functions v1 | v1 lacks built-in CORS, slower cold starts, no concurrency support |
| Firebase Admin SDK | Direct REST API calls | Admin SDK handles auth, retries, and error cases; REST requires manual handling |

**Installation:**
```bash
# In functions directory
cd functions
npm install stripe firebase-admin firebase-functions
```

## Architecture Patterns

### Recommended Project Structure
```
functions/
├── src/
│   ├── stripe/
│   │   ├── webhooks.ts           # Webhook handler (onRequest)
│   │   ├── checkout.ts           # Create checkout session (onCall)
│   │   ├── portal.ts             # Create portal session (onCall)
│   │   └── verify-subscription.ts # Protected API to check status (onCall)
│   ├── utils/
│   │   ├── auth.ts               # Firebase Auth token verification
│   │   └── stripe-helpers.ts     # Shared Stripe utilities
│   └── index.ts                  # Export all functions
├── .env.yaml                     # Secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
└── package.json
```

### Pattern 1: Stripe Checkout Session Creation (Server-Side)
**What:** Cloud Function creates Checkout session and returns URL to client
**When to use:** User clicks "Upgrade to Premium" or selects pricing tier
**Example:**
```typescript
// Source: https://docs.stripe.com/checkout/quickstart
import { onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createCheckoutSession = onCall(async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new Error('Unauthenticated');
  }

  const { priceId, mode } = request.data; // 'subscription' or 'payment' (lifetime)

  const session = await stripe.checkout.sessions.create({
    mode: mode, // 'subscription' or 'payment'
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://pomodorotimer.vip/?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://pomodorotimer.vip/pricing',
    customer_email: request.auth.token.email,
    client_reference_id: request.auth.uid, // Link to Firebase user
    subscription_data: mode === 'subscription' ? {
      trial_period_days: 7,
      metadata: { firebaseUid: request.auth.uid }
    } : undefined,
  });

  return { url: session.url };
});
```

### Pattern 2: Webhook Handler with Signature Verification
**What:** Receive Stripe events, verify signatures, sync to Firestore
**When to use:** All subscription lifecycle events (created, updated, deleted, payment events)
**Example:**
```typescript
// Source: https://docs.stripe.com/webhooks
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const stripeWebhook = onRequest(
  { cors: ['https://pomodorotimer.vip'] },
  async (req, res) => {
    const sig = req.headers['stripe-signature']!;

    let event: Stripe.Event;
    try {
      // CRITICAL: Use req.rawBody, not req.body (body is JSON parsed)
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send('Webhook Error');
    }

    // Return 200 IMMEDIATELY to prevent Stripe retries
    res.status(200).send('Received');

    // Process asynchronously
    await handleWebhookEvent(event);
  }
);

async function handleWebhookEvent(event: Stripe.Event) {
  const db = getFirestore();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.client_reference_id!;

      if (session.mode === 'subscription') {
        // Subscription created, but may still be trialing
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await db.doc(`users/${uid}/subscription`).set({
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0].price.id,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Lifetime payment (mode: 'payment')
        await db.doc(`users/${uid}/subscription`).set({
          status: 'lifetime',
          paymentIntentId: session.payment_intent,
          updatedAt: new Date().toISOString(),
        });
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const uid = subscription.metadata.firebaseUid;

      if (!uid) {
        console.error('No firebaseUid in subscription metadata');
        return;
      }

      await db.doc(`users/${uid}/subscription`).set({
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const uid = subscription.metadata.firebaseUid;

      // Subscription status will be 'past_due' - grace period active
      await db.doc(`users/${uid}/subscription`).set({
        status: subscription.status,
        lastPaymentError: invoice.status_transitions.finalized_at,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      break;
    }
  }
}
```

### Pattern 3: Customer Portal Session Creation
**What:** Generate Stripe Customer Portal URL for subscription management
**When to use:** User clicks "Manage Subscription" in app settings
**Example:**
```typescript
// Source: https://docs.stripe.com/customer-management/integrate-customer-portal
import { onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createPortalSession = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('Unauthenticated');
  }

  // Retrieve customer ID from Firestore (stored during checkout)
  const db = getFirestore();
  const subDoc = await db.doc(`users/${request.auth.uid}/subscription`).get();
  const customerId = subDoc.data()?.customerId;

  if (!customerId) {
    throw new Error('No active subscription');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'https://pomodorotimer.vip/settings',
  });

  return { url: session.url };
});
```

### Pattern 4: Feature Gating with Server-Side Verification
**What:** Client checks cached status, server verifies truth
**When to use:** User attempts to access premium feature
**Example:**
```typescript
// Client-side (index.html)
async function checkPremiumAccess(featureName) {
  // 1. Check cached status (fast, optimistic)
  const cachedStatus = localStorage.getItem('subscriptionStatus');
  if (cachedStatus === 'active' || cachedStatus === 'trialing' || cachedStatus === 'lifetime') {
    return true; // Optimistic unlock
  }

  // 2. Verify server-side (slow, authoritative)
  const idToken = await firebase.auth().currentUser.getIdToken();
  const verifySubscription = firebase.functions().httpsCallable('verifySubscription');
  const result = await verifySubscription({ feature: featureName });

  if (result.data.hasAccess) {
    localStorage.setItem('subscriptionStatus', result.data.status);
    return true;
  } else {
    showUpgradePrompt();
    return false;
  }
}

// Server-side (Cloud Function)
export const verifySubscription = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('Unauthenticated');
  }

  const db = getFirestore();
  const subDoc = await db.doc(`users/${request.auth.uid}/subscription`).get();
  const subscription = subDoc.data();

  const hasAccess = subscription &&
    ['active', 'trialing', 'past_due', 'lifetime'].includes(subscription.status);

  return {
    hasAccess,
    status: subscription?.status || 'none',
    gracePeriod: subscription?.status === 'past_due',
  };
});
```

### Pattern 5: CORS Configuration for GitHub Pages
**What:** Configure Cloud Functions to accept requests from custom domain
**When to use:** All onRequest functions called from GitHub Pages
**Example:**
```typescript
// Source: https://firebase.google.com/docs/functions/http-events
import { onRequest } from 'firebase-functions/v2/https';

export const stripeWebhook = onRequest({
  cors: ['https://pomodorotimer.vip'], // Allow only your domain
  timeoutSeconds: 30,
}, async (req, res) => {
  // Handler code
});

// Or for callable functions (onCall handles CORS automatically)
import { onCall } from 'firebase-functions/v2/https';

export const createCheckoutSession = onCall(async (request) => {
  // No CORS config needed - onCall handles it
});
```

### Anti-Patterns to Avoid

- **Don't verify subscription status only client-side:** User can modify localStorage/cookies; always verify server-side for premium features
- **Don't use `req.body` for webhook signature verification:** Stripe requires raw body buffer; use `req.rawBody` in Cloud Functions
- **Don't block webhook response on async processing:** Return 200 immediately to prevent Stripe retries, then process asynchronously
- **Don't store Stripe API keys client-side:** All Stripe operations must happen server-side (Cloud Functions)
- **Don't skip idempotency checks:** Webhooks can be sent multiple times; log processed event IDs to prevent duplicate actions

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment UI & card validation | Custom payment form | Stripe Checkout (redirect mode) | PCI compliance, 3D Secure, fraud detection, mobile optimization all handled |
| Subscription management UI | Custom billing dashboard | Stripe Customer Portal | Cancel, upgrade, payment method updates built-in; auto-updates when Stripe adds features |
| Webhook signature validation | Manual HMAC comparison | `stripe.webhooks.constructEvent()` | Handles timing attacks, version validation, constant-time comparison |
| Payment retry logic | Custom cron jobs to retry cards | Stripe Smart Retries | ML-powered retry timing, automatic recovery emails, dunning management |
| Subscription state machine | Custom status tracking | Stripe subscription statuses | Handles trials, grace periods, proration, upgrades/downgrades automatically |
| Tax calculation | Manual tax rules | Stripe Tax | 50+ country tax rules, automatic remittance, audit trails |

**Key insight:** Stripe's hosted solutions (Checkout, Portal) auto-update when new features/regulations launch. Custom implementations require ongoing maintenance for SCA compliance, tax law changes, and new payment methods.

## Common Pitfalls

### Pitfall 1: Webhook Race Conditions
**What goes wrong:** Webhook events arrive out of order (e.g., `subscription.updated` before `subscription.created`), causing status sync to be inconsistent
**Why it happens:** Webhooks are sent in parallel; network timing determines order, not event creation time
**How to avoid:**
- Use Firestore merge writes (`{ merge: true }`) to avoid overwriting newer data with older events
- Store `updatedAt` timestamp and compare before writing
- Alternatively, fetch current state from Stripe API in webhook handler instead of trusting event order
**Warning signs:** Users report premium features unlocking/locking randomly; Firestore shows status flip-flopping

### Pitfall 2: Using `req.body` Instead of `req.rawBody` for Webhooks
**What goes wrong:** Webhook signature verification fails with "No signatures found matching the expected signature" error
**Why it happens:** `stripe.webhooks.constructEvent()` requires raw Buffer body, but Cloud Functions parses `req.body` into JSON object
**How to avoid:** Always use `req.rawBody` for webhook signature verification in Firebase Cloud Functions
**Warning signs:** All webhook requests fail signature validation; Stripe dashboard shows webhook endpoint timing out

### Pitfall 3: Blocking Webhook Response on Async Operations
**What goes wrong:** Webhook handler takes >10s to respond, Stripe retries webhook, causing duplicate processing
**Why it happens:** Firestore writes, Stripe API calls, or email sends block the HTTP response
**How to avoid:** Return `res.status(200).send('Received')` immediately after signature verification, then process event asynchronously
**Warning signs:** Duplicate subscription records in Firestore; Stripe dashboard shows high retry rate for webhooks

### Pitfall 4: Not Handling `past_due` Status as Premium Access
**What goes wrong:** User's card declines, subscription goes `past_due`, app immediately locks premium features
**Why it happens:** Developer treats `past_due` as "unpaid" instead of grace period
**How to avoid:** Grant premium access for `active`, `trialing`, AND `past_due` statuses; Stripe retries payment automatically
**Warning signs:** Users complain about losing access immediately when payment fails; high churn during temporary card issues

### Pitfall 5: Forgetting to Store Customer ID During Checkout
**What goes wrong:** Cannot create Customer Portal session because customer ID is unknown
**Why it happens:** `checkout.session.completed` event contains customer ID, but developer only stores subscription ID
**How to avoid:** Store `session.customer` in Firestore during `checkout.session.completed` webhook
**Warning signs:** "Manage Subscription" button fails; error logs show "No customer ID found"

### Pitfall 6: Treating Lifetime Payments as Subscriptions
**What goes wrong:** Webhook handler expects `subscription` object for lifetime payment, crashes when it's null
**Why it happens:** Lifetime payments use `mode: 'payment'` (one-time) not `mode: 'subscription'`
**How to avoid:** Check `session.mode` in `checkout.session.completed` webhook; store `status: 'lifetime'` for payment mode
**Warning signs:** Lifetime purchases don't unlock premium; webhook errors for payment-mode checkouts

### Pitfall 7: Cold Start Timeout for Webhook Handler
**What goes wrong:** First webhook after cold start takes >10s, Stripe times out and retries
**Why it happens:** Cloud Functions imports Stripe SDK and Admin SDK on cold start (heavy dependencies)
**How to avoid:**
- Set `minInstances: 1` in function config to keep warm instance (costs ~$5/mo)
- Or handle retries idempotently by logging event IDs
**Warning signs:** Webhook fails randomly after periods of no activity; duplicate events processed

## Code Examples

### Complete Webhook Handler with Idempotency
```typescript
// Source: Verified pattern from https://docs.stripe.com/webhooks and Firebase best practices
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const db = getFirestore();

export const stripeWebhook = onRequest({
  cors: ['https://pomodorotimer.vip'],
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('No signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody!,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Check idempotency (prevent duplicate processing)
  const eventDoc = db.doc(`stripe_events/${event.id}`);
  const eventExists = await eventDoc.get();

  if (eventExists.exists) {
    console.log(`Event ${event.id} already processed, skipping`);
    return res.status(200).send('Already processed');
  }

  // Mark as processed immediately
  await eventDoc.set({
    processed: true,
    type: event.type,
    createdAt: new Date(event.created * 1000).toISOString(),
  });

  // Return success to Stripe immediately
  res.status(200).send('Received');

  // Process async
  try {
    await processWebhookEvent(event);
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);
    // Don't throw - already responded to Stripe
  }
});

async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const uid = session.client_reference_id;
  if (!uid) {
    console.error('No client_reference_id in session');
    return;
  }

  const subscriptionData: any = {
    customerId: session.customer,
    updatedAt: new Date().toISOString(),
  };

  if (session.mode === 'subscription') {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    subscriptionData.subscriptionId = subscription.id;
    subscriptionData.status = subscription.status;
    subscriptionData.priceId = subscription.items.data[0].price.id;
    subscriptionData.currentPeriodEnd = subscription.current_period_end;
    subscriptionData.cancelAtPeriodEnd = subscription.cancel_at_period_end;
  } else {
    // Lifetime payment
    subscriptionData.status = 'lifetime';
    subscriptionData.paymentIntentId = session.payment_intent;
  }

  await db.doc(`users/${uid}/subscription`).set(subscriptionData, { merge: true });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const uid = subscription.metadata.firebaseUid;
  if (!uid) return;

  await db.doc(`users/${uid}/subscription`).set({
    status: subscription.status,
    priceId: subscription.items.data[0].price.id,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const uid = subscription.metadata.firebaseUid;
  if (!uid) return;

  await db.doc(`users/${uid}/subscription`).set({
    status: 'canceled',
    canceledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const uid = subscription.metadata.firebaseUid;
  if (!uid) return;

  // Subscription status is now 'past_due' - retain access during grace period
  await db.doc(`users/${uid}/subscription`).set({
    status: subscription.status, // 'past_due'
    lastPaymentError: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
```

### Client-Side Integration (Vanilla JS)
```javascript
// Source: Integration pattern for vanilla JS + Firebase
// In index.html <script> block

async function initPremiumFeatures() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  // Load cached status
  const cachedStatus = localStorage.getItem('subscriptionStatus');
  updateUIForStatus(cachedStatus || 'none');

  // Fetch fresh status from Firestore
  firebase.firestore()
    .doc(`users/${user.uid}/subscription`)
    .onSnapshot((doc) => {
      const subscription = doc.data();
      const status = subscription?.status || 'none';
      localStorage.setItem('subscriptionStatus', status);
      updateUIForStatus(status);
    });
}

function updateUIForStatus(status) {
  const isPremium = ['active', 'trialing', 'past_due', 'lifetime'].includes(status);

  // Show/hide premium features
  document.querySelectorAll('.premium-feature').forEach(el => {
    el.classList.toggle('locked', !isPremium);
  });

  // Update subscription badge
  const badge = document.getElementById('subscription-badge');
  if (isPremium) {
    badge.textContent = status === 'lifetime' ? 'Lifetime' : 'Premium';
    badge.classList.add('premium');
  } else {
    badge.textContent = 'Free';
    badge.classList.remove('premium');
  }
}

async function handleUpgradeClick(priceId, mode) {
  const createCheckoutSession = firebase.functions().httpsCallable('createCheckoutSession');

  try {
    const result = await createCheckoutSession({ priceId, mode });
    window.location.href = result.data.url; // Redirect to Stripe Checkout
  } catch (error) {
    console.error('Checkout failed:', error);
    alert('Failed to start checkout. Please try again.');
  }
}

async function handleManageSubscription() {
  const createPortalSession = firebase.functions().httpsCallable('createPortalSession');

  try {
    const result = await createPortalSession();
    window.location.href = result.data.url; // Redirect to Stripe Portal
  } catch (error) {
    console.error('Portal failed:', error);
    alert('Failed to open subscription management. Please try again.');
  }
}

// Handle return from Stripe Checkout
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
if (sessionId) {
  // Checkout successful - show confirmation
  showNotification('Payment successful! Premium features unlocking...');
  // Webhook will update Firestore, which triggers onSnapshot above
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe Charges API | Payment Intents API | 2019 | Required for SCA compliance in EU; supports 3D Secure authentication |
| Custom payment forms | Stripe Checkout (hosted) | 2020 (major update) | No PCI compliance burden; auto-updates for new payment methods |
| Manual webhook validation | `stripe.webhooks.constructEvent()` | Always recommended | Prevents timing attacks; official method in all SDKs |
| Cloud Functions v1 | Cloud Functions v2 | 2022 | Built-in CORS, concurrency, better cold starts, Cloud Run infrastructure |
| `onRequest` with custom CORS | `onCall` for client calls | 2019 | `onCall` handles auth/CORS automatically; use `onRequest` only for webhooks |
| Polling Stripe API for status | Webhook-driven updates | Always | Webhooks are real-time and free; polling costs API quota and has latency |

**Deprecated/outdated:**
- **Stripe Charges API**: Replaced by Payment Intents API for all new integrations (required for Strong Customer Authentication)
- **Cloud Functions v1**: v2 is production-ready and recommended for all new projects
- **`stripe.charges.create()`**: Use `stripe.paymentIntents.create()` or Checkout Sessions instead
- **Storing card details**: Use Stripe.js or Checkout; never store card numbers in your database

## Open Questions

1. **Firebase Blaze plan upgrade timing**
   - What we know: Cloud Functions requires Blaze plan; Spark plan won't deploy functions
   - What's unclear: If user hasn't upgraded Firebase project yet
   - Recommendation: Check Firebase project billing tier before starting; upgrade during Phase 3 planning if needed

2. **CORS preflight for callable functions**
   - What we know: `onCall` handles CORS automatically for Firebase SDK clients
   - What's unclear: If vanilla JS Firebase SDK triggers preflight correctly from GitHub Pages
   - Recommendation: Test early in Phase 3; fallback to `onRequest` with manual CORS if issues arise

3. **Stripe webhook endpoint URL stability**
   - What we know: Cloud Functions URLs change with region/function name
   - What's unclear: If webhook URL needs updating when re-deploying functions
   - Recommendation: Use production Stripe webhook only after function URL is stable; test with Stripe CLI first

4. **Trial period behavior with lifetime pricing**
   - What we know: Trials make sense for subscriptions, not one-time payments
   - What's unclear: If lifetime tier should have trial or immediate charge
   - Recommendation: No trial for lifetime (users expect immediate access); only subscriptions get 7-day trial

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout Quickstart](https://docs.stripe.com/checkout/quickstart) - Official implementation guide
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks) - Signature verification and event handling
- [Stripe Customer Portal Integration](https://docs.stripe.com/customer-management/integrate-customer-portal) - Portal session creation
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - Critical events and status definitions
- [Stripe Subscription Lifecycle](https://docs.stripe.com/billing/subscriptions/overview) - Trial periods, payment retries, grace periods
- [Firebase Cloud Functions HTTP Events](https://firebase.google.com/docs/functions/http-events) - onRequest vs onCall patterns
- [Firebase Pricing](https://firebase.google.com/pricing) - Blaze plan requirements and free tier limits

### Secondary (MEDIUM confidence)
- [Stripe Webhooks with Firebase Cloud Functions (2025)](https://aronschueler.de/blog/2025/03/17/implementing-stripe-subscriptions-with-firebase-cloud-functions-and-firestore/) - Recent implementation example
- [Working with Stripe Webhooks & Firebase Cloud Functions](https://medium.com/@GaryHarrower/working-with-stripe-webhooks-firebase-cloud-functions-5366c206c6c) - rawBody requirement for webhooks
- [Firebase Cloud Functions v2 CORS](https://javascript.plainenglish.io/custom-cors-options-with-firebase-cloud-functions-v2-and-express-js-9eab03cc1976) - CORS configuration patterns
- [Stripe Webhook Race Conditions](https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/) - Webhook ordering issues and solutions
- [Firebase Auth Token Verification](https://fireship.io/lessons/secure-firebase-cloud-functions/) - verifyIdToken pattern in Cloud Functions

### Tertiary (LOW confidence - WebSearch only, flagged for validation)
- Community discussions on Stripe billing webhook patterns
- Stack Overflow examples for Firebase + Stripe integration (verify against official docs during implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Stripe and Firebase SDKs are well-documented and stable
- Architecture: HIGH - Patterns verified against official Stripe/Firebase documentation
- Pitfalls: HIGH - Common issues documented in Stripe docs and community with verified solutions
- CORS setup: MEDIUM - Functions v2 CORS for GitHub Pages needs validation during Phase 3
- Cost estimation: MEDIUM - Based on Firebase pricing docs but actual costs depend on traffic

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - Stripe API is stable; Firebase platform is mature)

**Critical action items for planning:**
1. Verify Firebase project is on Blaze plan before creating PLAN.md
2. Set up Stripe test account and obtain test API keys for development
3. Create Stripe products/prices in test mode for 3 tiers before implementation
4. Plan webhook endpoint deployment first (foundation for all other features)
5. Test CORS setup early with callable functions from GitHub Pages
