# Technology Stack: Stripe Monetization + Firebase Cloud Functions

**Project:** Pomodoro Timer v2.0 Monetization
**Researched:** 2026-02-07
**Overall Confidence:** HIGH (versions verified via npm/web search on research date)

## Context: What Already Exists

The app is a vanilla HTML/CSS/JS single-file PWA with:
- Firebase Auth (Google Sign-In) via compat SDK v10.14.1 (CDN)
- Firestore with `users/{uid}` collection (CDN)
- No build tools, no package.json, no node_modules
- GitHub Pages hosting (static files only)

This milestone introduces the **first backend component** (Firebase Cloud Functions) and the **first payment integration** (Stripe). The stack additions must respect the existing zero-build-tool frontend constraint while adding a proper Node.js backend.

---

## Recommended Stack

### Payment Processing (Client-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Stripe.js (via `<script>`) | Latest (auto-updates) | Secure payment element loading, redirect to Checkout | Stripe hosts this script at js.stripe.com; always loads latest. No version pinning needed or recommended. PCI compliance requires loading from Stripe's CDN, never self-hosting. |
| Stripe Checkout Sessions | N/A (API feature) | Full payment flow for subscriptions + one-time purchases | Stripe-hosted payment page. Zero custom payment UI to build. Handles card input, validation, 3D Secure, taxes, trials, receipts. Matches vanilla JS constraint perfectly -- just redirect. |
| Stripe Customer Portal | N/A (API feature) | Self-service subscription management (cancel, upgrade, billing) | Stripe-hosted portal. Configure in Dashboard, redirect users. Zero UI to build for plan management. |

**Integration approach: Stripe Checkout Sessions (NOT Elements, NOT Payment Links, NOT Pricing Table)**

Rationale for Stripe Checkout Sessions:
- **Why not Stripe Elements:** Requires building custom payment form UI. We are a vanilla JS single-file app -- building and maintaining a PCI-compliant payment form is high effort for zero benefit. Checkout is Stripe-hosted and handles everything.
- **Why not Payment Links:** No programmatic control. Cannot attach Firebase UID metadata, cannot customize trial behavior per user, cannot handle the lifetime (one-time) tier alongside subscriptions in a unified flow.
- **Why not Stripe Pricing Table embed:** Does NOT support one-time payments alongside subscriptions. Our $47 lifetime tier is a one-time charge (mode: "payment"), while monthly/yearly are subscriptions (mode: "subscription"). The embedded pricing table only supports subscription products. We need custom Checkout Session creation per tier.
- **Why Checkout Sessions:** Server-side session creation lets us attach `client_reference_id` (Firebase UID) and `metadata`, handle both subscription and one-time payment modes, configure trials per session, and redirect to Stripe's hosted page. The client just calls a Cloud Function and redirects -- perfect for vanilla JS.

### Payment Processing (Server-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` (Node.js SDK) | ^20.3.x | Stripe API calls from Cloud Functions | Official Stripe Node.js library. Creates Checkout Sessions, verifies webhooks, manages customers. v20.3.1 is current as of 2026-02-07. |
| `firebase-functions` | ^7.0.x | Cloud Functions v2 runtime | Official Firebase SDK for defining Cloud Functions. v7.0.3 current. Uses v2 API by default (2nd gen functions). |
| `firebase-admin` | ^13.6.x | Server-side Firebase access (Auth, Firestore) | Official Firebase Admin SDK. Reads/writes Firestore, verifies auth tokens. v13.6.1 current. |

### Cloud Functions Runtime

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Functions generation | **v2 (2nd gen)** | Default for firebase-functions v7.x. Built on Cloud Run. Better cold start performance (concurrent request handling), 1-hour HTTP timeout (vs 9 min in v1), better scaling. v1 is legacy. |
| Node.js runtime | **Node.js 22** | Supported at GA level for v2 functions. Node 18 is deprecated. Node 20 also supported but 22 is current LTS. |
| Region | **us-central1** | Default Firebase region. Matches Firestore location. Change only if Firestore is in another region. |

### PDF Generation (Client-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| jsPDF | 4.x (CDN) | Client-side PDF export for productivity reports | Load from CDN (jsDelivr or cdnjs). No server-side generation needed -- reports are generated from data already in the client. jsPDF is simpler than pdfmake for our use case (tabular stats reports, not complex document layouts). ~280KB from CDN. |

**Why client-side, not server-side PDF:**
- Report data (stats, session history) is already loaded in the browser from Firestore
- No need to spin up a Cloud Function with a headless browser or PDF library
- Avoids Cloud Function memory/timeout costs for document generation
- User triggers export, sees immediate download -- no round-trip to server
- Keeps the "premium export" feature simple and cheap to operate

**Why jsPDF over pdfmake:**
- jsPDF is ideal for structured reports with tables and text -- our export is session data, charts, and summary stats
- pdfmake has a more complex declarative API better suited for invoices/resumes with complex styling
- jsPDF has a smaller footprint and simpler API for vanilla JS usage
- jsPDF 4.x fixed a path traversal vulnerability present in older versions

### CSV Generation (Client-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| None (native JS) | N/A | CSV export of session/stats data | CSV generation is trivial -- just string concatenation with commas and newlines. No library needed. Use `Blob` + `URL.createObjectURL()` + `<a download>` pattern. Adding PapaParse (~50KB) for CSV *generation* is overkill when we control the data shape. |

**Why no PapaParse:**
- PapaParse excels at *parsing* CSVs (handling edge cases in messy input)
- We are *generating* CSVs from clean, known data structures
- 20 lines of vanilla JS replaces a 50KB library
- If we later add Todoist *import* (CSV parsing), we can reconsider PapaParse then

### Todoist Import

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Todoist REST API v2 | Current | Import tasks from Todoist | Simple REST API with OAuth. Cloud Function acts as proxy for OAuth token exchange. Client-side fetch for task retrieval after auth. No SDK needed -- standard fetch() calls. |

**Note:** Todoist import may also accept CSV/JSON file upload as an alternative to API integration. Evaluate during implementation whether direct API (requires OAuth app registration) or file-based import (simpler, no API key) is more appropriate.

---

## Server-Side Architecture: Cloud Functions

### Functions to Build

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `createCheckoutSession` | `onCall` | Client invocation | Creates Stripe Checkout Session for selected tier. Returns session URL for redirect. |
| `createPortalSession` | `onCall` | Client invocation | Creates Stripe Customer Portal session for subscription management. Returns portal URL. |
| `stripeWebhook` | `onRequest` | Stripe HTTP POST | Receives Stripe webhook events. Uses `request.rawBody` for signature verification. Updates Firestore subscription status. |
| `verifySubscription` | `onCall` | Client invocation | Returns current subscription status from Firestore. Client calls on app load to gate features. |

**Why `onCall` for client functions:**
- `onCall` automatically handles Firebase Auth token verification
- No need to manually extract and verify ID tokens
- Client uses `firebase.functions().httpsCallable('functionName')`
- Consistent with existing Firebase SDK usage pattern

**Why `onRequest` for webhook:**
- Stripe sends raw HTTP POSTs, not Firebase-authenticated calls
- `onRequest` exposes a plain HTTPS endpoint
- Must use `request.rawBody` (not `request.body`) for signature verification
- This is the ONLY function that needs `onRequest`

### Firestore Schema Extension

```
users/{uid}
  // Existing fields (unchanged)
  sessionCount, totalMinutes, dailyGoal, etc.

  // NEW: Subscription fields
  stripeCustomerId: string          // Stripe customer ID (cus_xxx)
  subscriptionStatus: string        // 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'lifetime'
  subscriptionTier: string          // 'monthly' | 'yearly' | 'lifetime' | null
  subscriptionId: string            // Stripe subscription ID (sub_xxx) or null for lifetime
  trialEnd: timestamp               // Trial expiry date (null if no trial)
  currentPeriodEnd: timestamp       // Subscription period end (null for lifetime)
  premiumSince: timestamp           // When they first became premium
  cancelAtPeriodEnd: boolean        // Whether subscription cancels at period end
```

### Environment Configuration

```bash
# Set Stripe secrets in Firebase Functions config (v2 uses Secret Manager)
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

**Critical:** Never put Stripe secret key in client-side code. The publishable key (`pk_xxx`) goes in `index.html`. The secret key (`sk_xxx`) stays in Cloud Functions only.

---

## Client-Side Integration Pattern

Since the app has no build tools, all new client-side code goes into `index.html`:

```html
<!-- Add after existing Firebase scripts -->
<script src="https://js.stripe.com/v3/"></script>

<!-- In the JavaScript section -->
<script>
  const stripe = Stripe('pk_live_xxx'); // Publishable key only
  const functions = firebase.functions();

  // Create checkout session via Cloud Function
  async function startCheckout(tier) {
    const createSession = functions.httpsCallable('createCheckoutSession');
    const { data } = await createSession({ tier }); // 'monthly', 'yearly', 'lifetime'
    window.location.href = data.url; // Redirect to Stripe Checkout
  }

  // Open customer portal
  async function openBillingPortal() {
    const createPortal = functions.httpsCallable('createPortalSession');
    const { data } = await createPortal();
    window.location.href = data.url;
  }
</script>
```

**Key principle:** The client never handles payment details. It calls Cloud Functions to get redirect URLs, then sends the user to Stripe-hosted pages. This is both PCI-compliant and trivially simple for vanilla JS.

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| Stripe Elements / Payment Element | Requires building custom payment UI. Checkout Sessions handles everything with zero UI work. |
| Stripe Firebase Extension | Opaque, hard to customize for mixed subscription + one-time payments. Custom Cloud Functions give full control over business logic (trial gating, lifetime tier handling, proration). |
| Firebase Emulator Suite | Nice for testing but not required. Test with Stripe test mode + deployed functions. Add emulator later if iteration speed becomes a bottleneck. |
| Any frontend framework (React, etc.) | Project constraint: vanilla JS only. |
| Any build tool (Vite, webpack, etc.) | Project constraint: no build tools. |
| PapaParse | Not needed for CSV generation. Reconsider only if adding CSV import with messy input. |
| Puppeteer / server-side PDF | Over-engineered for stats reports. Client-side jsPDF is sufficient and free to operate. |
| `cors` npm package | Firebase Cloud Functions v2 onCall handles CORS automatically. Only onRequest needs manual CORS, and the webhook endpoint doesn't need it (Stripe server-to-server). |
| Express.js | Cloud Functions v2 provides its own HTTP handling. No need for Express middleware layer. |

---

## Firebase Project Setup Requirements

### Blaze Plan Required

Firebase Cloud Functions require the **Blaze (pay-as-you-go)** plan. The free Spark plan does not support Cloud Functions or outbound network requests (needed for Stripe API calls).

**Cost estimate for low-traffic app:**
- Cloud Functions: First 2M invocations/month free, then $0.40/million
- Firestore: First 50K reads/day, 20K writes/day free
- Realistic cost for <1000 users: $0-5/month

### Firebase CLI Setup

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login and select project
firebase login
firebase use --add

# Initialize Cloud Functions
firebase init functions
# Select: JavaScript (not TypeScript -- keep it simple, match frontend language)
# Select: ESLint -- yes
# Select: Install dependencies -- yes
```

**Why JavaScript, not TypeScript for Cloud Functions:**
- Matches the vanilla JS frontend language
- No compilation step needed
- Simpler debugging (source === runtime code)
- TypeScript adds value for large teams; this is a solo/small project

### Project Structure After Setup

```
pomodoro/
  index.html              # Frontend (existing)
  sw.js                   # Service worker (existing)
  manifest.json           # PWA manifest (existing)
  CNAME                   # GitHub Pages domain (existing)
  functions/              # NEW: Cloud Functions directory
    package.json          # Node.js dependencies (stripe, firebase-functions, firebase-admin)
    index.js              # Cloud Function definitions
    .env                  # Local env vars (gitignored)
  firebase.json           # NEW: Firebase project config
  .firebaserc             # NEW: Firebase project alias
```

**Note:** `functions/` directory has its own `package.json` and `node_modules`. The root project remains dependency-free. `firebase.json` configures which services to deploy (functions only -- hosting stays on GitHub Pages).

---

## Installation

```bash
# In the project root
firebase init functions

# In the functions/ directory
cd functions
npm install stripe@^20.3.0 firebase-functions@^7.0.0 firebase-admin@^13.6.0
```

### Client-Side (add to index.html)

```html
<!-- Stripe.js -- load from Stripe's CDN (required for PCI compliance) -->
<script src="https://js.stripe.com/v3/"></script>

<!-- jsPDF -- load from CDN only when user triggers PDF export -->
<!-- Lazy-load: don't add to initial page load -->
<!-- https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.0.0/jspdf.umd.min.js -->
```

**Stripe.js loading strategy:** Load on every page (small, cached aggressively by Stripe). Required for fraud detection even before checkout.

**jsPDF loading strategy:** Lazy-load only when user clicks "Export PDF". No reason to load 280KB on every page visit. Use dynamic `<script>` injection.

---

## Stripe Product Configuration

### Products to Create in Stripe Dashboard

| Product | Price Type | Amount | Stripe Mode | Trial |
|---------|-----------|--------|-------------|-------|
| Pomodoro Pro Monthly | Recurring (monthly) | $2/month | `subscription` | 7-day |
| Pomodoro Pro Yearly | Recurring (yearly) | $15/year | `subscription` | 7-day |
| Pomodoro Pro Lifetime | One-time | $47 | `payment` | None |

**Critical design decision:** The lifetime tier uses `mode: 'payment'` (one-time charge), NOT a subscription. This means:
- Lifetime purchases go through `checkout.session.completed` webhook with `mode === 'payment'`
- Monthly/yearly go through `checkout.session.completed` with `mode === 'subscription'`, plus ongoing `invoice.paid` / `customer.subscription.updated` events
- The webhook handler must distinguish these flows
- Lifetime users get `subscriptionStatus: 'lifetime'` in Firestore (never expires)

### Webhook Events to Handle

| Event | When | Action |
|-------|------|--------|
| `checkout.session.completed` | Payment succeeds | Create/update user subscription in Firestore. For lifetime: set status to 'lifetime'. For subscription: set status to 'active' or 'trialing'. |
| `invoice.paid` | Recurring payment succeeds | Confirm subscription remains active. Update `currentPeriodEnd`. |
| `invoice.payment_failed` | Payment fails | Set status to 'past_due'. Optionally notify user. |
| `customer.subscription.updated` | Plan change, cancel scheduled | Update tier, `cancelAtPeriodEnd`. |
| `customer.subscription.deleted` | Subscription fully canceled | Set status to 'canceled'. Revoke premium access. |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Optional: notify user trial is ending. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Payment flow | Stripe Checkout Sessions | Stripe Elements | Elements requires custom payment UI; Checkout is hosted and zero-effort |
| Payment flow | Stripe Checkout Sessions | Stripe Payment Links | No programmatic control, can't attach Firebase UID metadata |
| Payment flow | Custom Cloud Functions | Stripe Firebase Extension | Extension doesn't handle mixed subscription + one-time cleanly; less control over business logic |
| Subscription mgmt | Stripe Customer Portal | Custom UI | Portal is free, hosted, handles upgrades/downgrades/cancellation. Building this ourselves is weeks of work for no benefit. |
| Functions generation | v2 (2nd gen) | v1 (1st gen) | v1 is legacy, worse cold starts, 9-min timeout, no concurrent requests. v1 functions.config() deprecated, decommissioned March 2027. |
| Node.js runtime | Node.js 22 | Node.js 20 | 22 is current LTS, supported at GA. 20 works but older. |
| PDF generation | jsPDF (client-side) | Puppeteer (server-side) | Server-side PDF requires Cloud Function with high memory, long timeout. Client-side is instant and free. |
| PDF generation | jsPDF | pdfmake | jsPDF simpler API for tabular data; pdfmake better for complex document layouts we don't need |
| CSV generation | Vanilla JS | PapaParse | We're generating CSV from clean data, not parsing messy input. 20 lines of JS vs 50KB library. |
| Functions language | JavaScript | TypeScript | JS matches frontend language, no compilation step, simpler for solo project |

---

## Sources

**Stripe:**
- [Stripe.js Reference](https://docs.stripe.com/js) - Client-side SDK docs
- [Stripe Checkout Sessions](https://docs.stripe.com/payments/checkout) - Hosted payment page
- [Stripe Subscriptions with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions) - Subscription-specific Checkout
- [Stripe Customer Portal](https://docs.stripe.com/customer-management) - Self-service subscription management
- [Stripe Free Trials](https://docs.stripe.com/payments/checkout/free-trials) - Trial configuration
- [Stripe Pricing Table Limitations](https://docs.stripe.com/payments/checkout/pricing-table) - Embeddable table (subscription-only)
- [Stripe Webhook Signatures](https://docs.stripe.com/webhooks/signature) - Webhook verification
- [stripe npm package](https://www.npmjs.com/package/stripe) - v20.3.1 (verified 2026-02-07)

**Firebase:**
- [Firebase Cloud Functions v2 vs v1](https://firebase.google.com/docs/functions/version-comparison) - Generation comparison
- [Firebase Functions Get Started](https://firebase.google.com/docs/functions/get-started) - Setup guide
- [firebase-functions npm](https://www.npmjs.com/package/firebase-functions) - v7.0.3 (verified 2026-02-07)
- [firebase-admin npm](https://www.npmjs.com/package/firebase-admin) - v13.6.1 (verified 2026-02-07)
- [Firebase + Stripe Tutorial](https://firebase.google.com/docs/tutorials/payments-stripe) - Official integration guide
- [Stripe Subscriptions with Firebase (Aron Schueler, 2025)](https://aronschueler.de/blog/2025/03/17/implementing-stripe-subscriptions-with-firebase-cloud-functions-and-firestore/) - Real-world implementation reference

**PDF/CSV:**
- [jsPDF GitHub](https://github.com/parallax/jsPDF) - v4.x (verified 2026-02-07)
- [jsPDF CDN (cdnjs)](https://cdnjs.com/libraries/jspdf) - CDN distribution

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Stripe Checkout approach | HIGH | Official Stripe docs confirm Checkout handles subscription + one-time in same integration. Verified mixed-mode support. |
| Firebase Cloud Functions v2 | HIGH | Official Firebase docs recommend v2 as default. firebase-functions v7.x uses v2 API. Version verified on npm. |
| Package versions | HIGH | All versions verified via npm search on 2026-02-07. |
| Stripe Pricing Table limitation | HIGH | Official docs describe it as "for subscriptions." Third-party sources confirm one-time payments not supported. |
| jsPDF for client-side PDF | MEDIUM | jsPDF 4.x verified current. Suitability for stats reports is based on library capabilities (tables, text, basic charts) but not tested against our specific report design. |
| Todoist integration approach | LOW | Todoist REST API v2 exists but OAuth flow details and task format need phase-specific research. |
| Webhook raw body in v2 functions | HIGH | Multiple sources confirm `request.rawBody` available in Firebase Cloud Functions for Stripe signature verification. |

---

*Stack research: 2026-02-07 for v2.0 Monetization milestone*
