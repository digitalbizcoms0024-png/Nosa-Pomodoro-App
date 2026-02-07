# Domain Pitfalls: Stripe Monetization + Feature Gating

**Domain:** Adding Stripe payments and premium feature gating to an existing free vanilla JS PWA
**Researched:** 2026-02-07
**Stack context:** Vanilla JS single-file app, Firebase Auth + Firestore, Firebase Cloud Functions, Stripe Checkout, GitHub Pages

---

## Critical Pitfalls

Mistakes that cause security breaches, lost revenue, or require rewrites.

### Pitfall 1: Client-Side Feature Gating as Security Boundary

**What goes wrong:** Premium features are gated with client-side JavaScript checks (e.g., `if (user.isPremium) { showFeature() }`). Any user can open DevTools, modify the variable, or intercept network requests to bypass the paywall. In a single-file vanilla JS app with no build step, the entire application logic is trivially readable and modifiable.

**Why it happens:** The app is a vanilla JS single-file PWA with no server-side rendering. All logic lives in the client. Developers naturally reach for `if/else` checks in the UI code. It feels like it "works" during testing.

**Consequences:** Any technically literate user gets all premium features for free. If discovered and shared (e.g., a blog post or Reddit thread), it undermines the entire monetization model. Pentest research confirms this is a top finding in freemium web app audits.

**Prevention:**
- **Accept the tradeoff for this app type.** For a $2/mo pomodoro timer, perfect server-side enforcement of every feature is overkill. The threat model is "casual bypass," not "determined attacker."
- **Use Firebase custom claims** set by Cloud Functions (server-side) after webhook confirmation. The client reads `auth.currentUser.getIdTokenResult()` to check `claims.premium === true`. This is harder to forge than a Firestore field.
- **Gate high-value features server-side** where possible: cloud sync, cross-device data, stats export should require valid tokens with premium claims verified by Firestore security rules.
- **Client-side gating is fine for UI/UX features** (themes, sounds, timer presets) where the "cost" of bypass is negligible. Don't over-engineer what doesn't need it.
- **Firestore security rules** should check `request.auth.token.premium == true` for premium data paths.

**Detection:** Search your codebase for premium checks that only exist in client JS with no server validation. If removing a single `if` statement unlocks the feature, it is client-only gated.

**Severity:** CRITICAL for revenue-sensitive features, MODERATE for cosmetic features.
**Phase:** Must be designed in the architecture phase. Retrofitting server-side gating is painful.

**Confidence:** HIGH -- based on official Firebase custom claims documentation and established security principles.

---

### Pitfall 2: Webhook Signature Verification Fails on Firebase Cloud Functions

**What goes wrong:** Stripe webhook signature verification (`stripe.webhooks.constructEvent()`) fails with "Webhook signature verification failed" errors in production, even though the correct webhook secret is configured.

**Why it happens:** Firebase Cloud Functions (and Express.js middleware) automatically parse the request body as JSON. Stripe's signature verification requires the **raw, unparsed request body** to compute the HMAC. Using `req.body` (parsed JSON) instead of `req.rawBody` (raw buffer) causes the signature to never match because the string representation differs from the original bytes.

**Consequences:** All webhooks silently fail. No subscription state ever reaches your database. Users pay but don't get premium access. You may not notice for days if you don't have alerting, because Stripe shows "delivered" (HTTP 200 if you're not checking signatures) or retries quietly.

**Prevention:**
- **Always use `req.rawBody`** (not `req.body`) when calling `stripe.webhooks.constructEvent()` in Firebase Cloud Functions.
- **Bypass Express JSON middleware** for the webhook endpoint. If using Express in your Cloud Function, exclude the webhook route from `express.json()` middleware.
- **Test signature verification explicitly** in your integration tests before deploying.
- **Use the Stripe CLI** (`stripe listen --forward-to`) during local development to test real webhook payloads against your function.

**Detection:** Webhook handler returns 400 errors. Stripe Dashboard shows webhook delivery failures. Users report paying but not getting premium access.

**Severity:** CRITICAL -- completely breaks the payment flow.
**Phase:** Must be correct from the first webhook implementation. No partial credit here.

**Confidence:** HIGH -- this is an extremely well-documented Firebase + Stripe integration gotcha, confirmed across multiple sources including the stripe-node GitHub issues.

---

### Pitfall 3: Stripe/Firestore Subscription State Desynchronization

**What goes wrong:** The subscription status in Firestore diverges from the actual status in Stripe. Users who canceled still have premium access, or users who renewed lose access.

**Why it happens:** Multiple causes:
1. **Missed webhooks:** Network blips, Cloud Function cold starts causing timeouts, or deployment gaps mean events are lost.
2. **Out-of-order events:** Stripe does NOT guarantee event ordering. You might receive `customer.subscription.updated` before `customer.subscription.created`, or a `deleted` event before the latest `updated` event.
3. **No reconciliation mechanism:** The system only updates state via webhooks with no fallback to verify truth.
4. **Lifetime purchases treated as subscriptions:** One-time payments (`checkout.session.completed` with `mode: 'payment'`) use different webhook flows than subscriptions (`mode: 'subscription'`). Mixing them up means lifetime purchases never get properly recorded.

**Consequences:** Revenue leakage (free access for canceled users) or support burden (paying users locked out). Both erode trust.

**Prevention:**
- **Design state updates to be idempotent and order-independent.** When processing a webhook, fetch the current subscription from the Stripe API (`stripe.subscriptions.retrieve()`) to get the authoritative state, rather than relying solely on the event payload. This makes event ordering irrelevant.
- **Store the Stripe event ID** in a `processed_events` collection with a unique constraint. Check before processing to prevent duplicate handling.
- **Implement a reconciliation Cloud Function** that runs daily (scheduled), fetches active subscriptions from Stripe API, and corrects any Firestore drift.
- **Handle lifetime purchases separately.** They emit `checkout.session.completed` with `mode: 'payment'`, not subscription events. Write a distinct code path for this.
- **Return 200 immediately** from webhook handlers, then process asynchronously. Stripe times out if your handler takes too long (especially during cold starts).
- **Use Stripe's "Selection required" event awareness.** Some events only fire if you explicitly listen for them -- a webhook endpoint set to "all events" does NOT receive them.

**Detection:** Set up a weekly audit: query Firestore premium users, cross-reference with Stripe active subscriptions. Any mismatch = desync.

**Severity:** CRITICAL -- silent revenue loss or user-facing access errors.
**Phase:** Core webhook handling phase. The idempotency and reconciliation patterns must be baked in from the start.

**Confidence:** HIGH -- based on Stripe official documentation on webhook ordering, plus multiple community post-mortems.

---

### Pitfall 4: Stripe Secret Key Exposed in Client-Side Code

**What goes wrong:** The Stripe **secret** API key (`sk_live_...`) ends up in client-side JavaScript, exposed to anyone who views source.

**Why it happens:** In a vanilla JS single-file app with no build step, there is no `.env` file or build-time injection. Developers copy code examples that use the secret key, paste it into `index.html`, and forget it is now public. The app has no server component yet (adding Cloud Functions is new), so there is no established pattern for "server-side secrets."

**Consequences:** Attackers can query all customer data (names, emails, addresses, payment details), issue refunds, create charges, and modify your Stripe account. This is a full account compromise.

**Prevention:**
- **NEVER put `sk_live_` or `sk_test_` keys in `index.html` or any client-served file.** Period.
- **Only the publishable key (`pk_live_...`)** belongs in client-side code. It is designed to be public.
- **All Stripe secret key operations** happen in Firebase Cloud Functions. The secret key is stored via `firebase functions:config:set stripe.secret="sk_live_..."` or in Secret Manager.
- **Add `sk_live` and `sk_test` to `.gitignore` patterns** and consider a pre-commit hook that greps for secret key patterns.
- **Stripe's go-live checklist** explicitly warns about this.

**Detection:** Search your codebase for `sk_live` or `sk_test`. If found outside of Cloud Functions config, you have a problem. Stripe also has a secret scanning integration with GitHub that will alert you.

**Severity:** CRITICAL -- full account and customer data compromise.
**Phase:** First moment you write any Stripe integration code. Establish the pattern immediately.

**Confidence:** HIGH -- based on Stripe official documentation and multiple real-world incident reports.

---

### Pitfall 5: Test Mode / Live Mode Key Confusion

**What goes wrong:** The app ships with test mode keys, or test webhook secrets are used in production (or vice versa). Payments appear to work in development but fail in production, or production webhooks silently fail because the signature secret is from test mode.

**Why it happens:** Stripe maintains completely separate object universes for test and live mode. Products, prices, customers, and webhook signing secrets created in test mode do not exist in live mode. Developers often:
1. Build everything in test mode.
2. Switch to live keys but forget to recreate products/prices in live mode.
3. Use the test webhook signing secret in production Cloud Functions config.
4. Forget that Stripe Dashboard settings changes in test mode also affect live mode.

**Consequences:** Checkout sessions fail (price ID doesn't exist in live mode). Webhook signature verification fails (wrong signing secret). Customers see errors at the moment they are trying to give you money.

**Prevention:**
- **Create a go-live checklist** that includes: recreate all products/prices in live mode, update all environment variables, configure a live webhook endpoint, test with a real $0.50 charge.
- **Use separate Firebase environments** (or at minimum, separate config keys) for dev/staging (test keys) and production (live keys).
- **Store price IDs in config, not hardcoded.** This way switching environments only requires changing config values.
- **After deploying live, make a real purchase** with your own card and verify the full flow: checkout -> webhook -> Firestore update -> premium access granted.
- **Configure separate webhook endpoints** in Stripe for test and live modes with their respective signing secrets.

**Detection:** Checkout redirects to Stripe but shows "Invalid price" or similar errors. Webhook logs show signature failures despite correct-looking code.

**Severity:** CRITICAL -- blocks all revenue at launch.
**Phase:** Deployment/go-live phase. Must have a formal switchover process.

**Confidence:** HIGH -- based on Stripe official go-live checklist and common production debugging reports.

---

## Moderate Pitfalls

Mistakes that cause degraded UX, support burden, or technical debt.

### Pitfall 6: Firebase Custom Claims Token Refresh Delay

**What goes wrong:** After a successful purchase, the Cloud Function sets custom claims (`admin.auth().setCustomClaims(uid, { premium: true })`), but the user's client still shows free-tier access. They just paid and see no change.

**Why it happens:** Firebase custom claims are embedded in the ID token, which is cached client-side and only refreshes every ~1 hour by default. Setting claims server-side does NOT push them to the client in real-time. The user must call `getIdToken(true)` to force a refresh.

**Prevention:**
- **After successful checkout redirect**, force a token refresh: `await firebase.auth().currentUser.getIdToken(true)`.
- **In the checkout success callback**, also write a flag to Firestore (e.g., `users/{uid}/subscription.status = 'active'`) that the client can observe in real-time via `onSnapshot()`. Use custom claims as the security boundary (Firestore rules) but Firestore data as the real-time UI signal.
- **Show an intermediate "Activating your subscription..." state** with a spinner while the token refreshes.

**Detection:** Users report paying but seeing no change. Refreshing the page fixes it. This is confusing and erodes trust in the purchase.

**Severity:** MODERATE -- does not lose money, but creates a terrible first impression of the premium experience.
**Phase:** Checkout flow implementation.

**Confidence:** HIGH -- based on official Firebase custom claims documentation stating token refresh behavior explicitly.

---

### Pitfall 7: No Dunning / Grace Period Strategy

**What goes wrong:** A subscriber's card expires or has insufficient funds. The system immediately revokes premium access on the first `invoice.payment_failed` event. The user opens the app, finds features gone, and is confused/angry rather than prompted to update their payment method.

**Why it happens:** The webhook handler naively maps any payment failure to "revoke access." No grace period, no in-app messaging, no distinction between "first retry" and "final failure."

**Consequences:** Involuntary churn. The user intended to pay but had a card issue. Instead of a helpful nudge, they see features disappear and may never come back.

**Prevention:**
- **Configure Stripe Smart Retries** in the Billing settings. Stripe will automatically retry at optimal times over a configurable window (default: 8 retries over ~4 weeks).
- **Map subscription statuses correctly:**
  - `active` = full access
  - `past_due` = grace period (keep access, show in-app banner: "Payment failed, please update your card")
  - `canceled` / `unpaid` = revoke access
- **Link to the Stripe Customer Portal** from the in-app banner so users can update payment info with zero friction.
- **Send dunning emails** via Stripe's built-in email system (configurable in Dashboard > Settings > Billing > Subscriptions and emails). Don't build your own.
- **For a $2/mo app**, keep the grace period generous (14-21 days). The cost of losing a subscriber far exceeds the cost of ~2 weeks of unpaid access.

**Detection:** Track involuntary churn rate. If it's above 5-8% of subscribers monthly, dunning needs attention.

**Severity:** MODERATE -- revenue loss from involuntary churn.
**Phase:** Webhook handling phase, specifically the subscription status mapping logic.

**Confidence:** HIGH -- based on Stripe official dunning documentation and billing best practices.

---

### Pitfall 8: Cold Start Webhook Timeouts

**What goes wrong:** A Stripe webhook arrives at a Firebase Cloud Function that hasn't been invoked recently. The cold start takes 3-8 seconds to initialize the Node.js runtime, load the Stripe SDK, and establish connections. Combined with actual processing time, the function exceeds Stripe's timeout threshold. Stripe marks it as failed and retries.

**Why it happens:** Firebase Cloud Functions (Gen 1) have well-documented cold starts. The Stripe SDK itself adds ~500ms of initialization. Firestore connection adds more. If the function has many dependencies, cold start can exceed 5 seconds. Stripe expects a response "quickly" -- while they don't publish an exact timeout, community reports indicate ~20 seconds before "Timed out."

**Consequences:** Webhook delivery appears flaky. Events are retried (Stripe retries up to 3 days), creating duplicate processing if idempotency is not handled. In extreme cases, state updates are significantly delayed.

**Prevention:**
- **Return 200 immediately, process later.** Acknowledge the webhook receipt first, then do the database work. In Firebase Cloud Functions, you can still do async work after sending the response (the function stays alive briefly). Alternatively, write the raw event to a Firestore "events" collection and have a separate function process it.
- **Use Firebase Cloud Functions Gen 2** (based on Cloud Run) which offers better cold start characteristics and the `minInstances: 1` option to keep one instance warm.
- **Minimize dependencies** in the webhook function. Only import what you need (stripe, firebase-admin). Don't bundle your entire app.
- **Set higher memory allocation** (512MB+). Firebase allocates CPU proportionally to memory; higher memory = faster cold starts.
- **Implement idempotency** (Pitfall 3) so retried events from timeouts don't cause duplicate state changes.

**Detection:** Check Stripe Dashboard > Developers > Webhooks > Event delivery attempts. Look for "Timed out" status on first attempts followed by successful retries.

**Severity:** MODERATE -- Stripe's retry mechanism compensates, but it adds latency and requires idempotency.
**Phase:** Cloud Functions setup phase. Architecture the function for fast response from day one.

**Confidence:** MEDIUM -- cold start times vary by region, runtime version, and dependency count. The mitigation strategies are well-established.

---

### Pitfall 9: Trial Abuse via Multiple Accounts

**What goes wrong:** Users create multiple Firebase Auth accounts (different emails) to repeatedly get 7-day free trials, never paying.

**Why it happens:** Firebase Auth makes account creation trivial. Email/password signup has no friction. Each new account gets a fresh trial. There is no device fingerprinting or payment method requirement to start a trial.

**Consequences:** A segment of power users never converts. If the app's value proposition is strong enough to abuse trials for, it is strong enough to pay for -- but only if abuse is inconvenient enough.

**Prevention:**
- **Require a payment method upfront** for the trial (Stripe Checkout supports this natively with `subscription_data.trial_period_days`). This is the single most effective anti-abuse measure. The card is not charged during the trial but validates the user is real.
- **Use Stripe Radar** to block disposable email domains and prepaid cards if card-required trials are in place.
- **Don't over-invest in anti-abuse for v1.** For a $2/mo pomodoro timer, the fraction of users who will create multiple accounts to avoid paying is small. The engineering cost of sophisticated fingerprinting exceeds the revenue loss. Requiring a card at trial start handles 90% of abuse.
- **Track trial starts per Stripe customer.** Use Stripe's built-in `trial_settings` to prevent a customer from getting another trial if they've had one before.

**Detection:** Monitor trial-to-paid conversion rate. If it's unusually low (below 2-3%), investigate abuse patterns.

**Severity:** MODERATE -- revenue opportunity cost, but manageable with card-required trials.
**Phase:** Trial and checkout flow implementation.

**Confidence:** HIGH -- based on Stripe official trial documentation and abuse prevention guidance.

---

### Pitfall 10: Lifetime Purchase Treated as Subscription

**What goes wrong:** The $47 lifetime purchase uses Stripe Checkout in `mode: 'payment'` (one-time), but the webhook handler only processes subscription events. Lifetime buyers pay but never get premium access.

**Why it happens:** The codebase has three pricing tiers ($2/mo, $15/yr, $47 lifetime). Monthly and annual are subscriptions (`mode: 'subscription'`), but lifetime is a one-time payment (`mode: 'payment'`). These emit different webhook events:
- Subscriptions: `customer.subscription.created`, `invoice.paid`, etc.
- One-time: `checkout.session.completed` with `mode: 'payment'`

Developers build the subscription flow first, test it, ship it, and forget that lifetime needs a separate code path.

**Consequences:** Your highest-value customers (willing to pay $47 upfront) get the worst experience. They pay and get nothing.

**Prevention:**
- **Handle `checkout.session.completed` for ALL modes.** Check `session.mode` to branch logic:
  - `'subscription'` -> subscription was created, handled by subscription webhooks
  - `'payment'` -> one-time purchase, grant lifetime access immediately
- **For lifetime, set a permanent flag** in Firestore (`subscriptionType: 'lifetime'`, `premiumUntil: null` meaning "forever") and set custom claims.
- **Lifetime has no renewal, no dunning, no cancellation.** It is a fundamentally different state. Model it explicitly, don't try to shoehorn it into subscription logic.
- **Write separate test cases** for each pricing tier (monthly, annual, lifetime) in your integration tests.

**Detection:** If you have 0 lifetime premium users in Firestore but lifetime purchases in Stripe, this is the bug.

**Severity:** MODERATE -- affects a subset of customers but they are your highest-value ones.
**Phase:** Checkout and webhook handling phase. Must design the data model to accommodate all three tiers.

**Confidence:** HIGH -- based on Stripe Checkout documentation on payment modes.

---

### Pitfall 11: Refund Doesn't Revoke Access

**What goes wrong:** A customer requests a refund (via Stripe Dashboard, support email, or dispute). The refund is processed in Stripe, but the app still shows them as premium because the webhook handler doesn't listen for refund events.

**Why it happens:** Refunds are a separate event flow (`charge.refunded`, `charge.dispute.created`) from subscription cancellation. Many implementations only handle `customer.subscription.deleted` for access revocation but forget that refunds can happen independently.

**Consequences:** Refunded users retain premium access indefinitely. If you issue partial refunds, the logic gets even murkier.

**Prevention:**
- **Listen for `charge.refunded` and `charge.dispute.created` events.** On full refund, revoke access and cancel the subscription if one exists.
- **For disputes/chargebacks**, immediately revoke access and cancel the subscription. Disputes are adversarial -- the customer is claiming they didn't authorize the charge.
- **For partial refunds**, decide policy upfront: do partial refunds revoke access? For a simple app, probably not, but document the decision.
- **Log all refund events** for audit trails.

**Detection:** Cross-reference Stripe refunds with Firestore premium status. Any refunded customer who still has premium = bug.

**Severity:** MODERATE -- revenue leakage on edge cases.
**Phase:** Webhook handling phase, after core subscription flow works.

**Confidence:** HIGH -- based on Stripe refund documentation and webhook event types.

---

## Minor Pitfalls

Mistakes that cause annoyance or small amounts of technical debt.

### Pitfall 12: Pricing Page That Alienates Free Users

**What goes wrong:** Existing free users feel "nickel-and-dimed" when premium features appear. Features they previously had access to (or expected to get) are now paywalled. The transition from "free app" to "freemium app" feels like a bait-and-switch.

**Prevention:**
- **Never gate existing features.** Only gate NEW features as premium. The 11 premium features should be additions, not subtractions.
- **Be transparent about what stays free.** Show a clear free vs premium comparison.
- **Introduce premium with value, not restriction.** Frame it as "unlock more" not "pay to keep."
- **The pricing page should be a celebration of value**, not a wall of restrictions. Show what premium adds, don't emphasize what free lacks.

**Severity:** MINOR from a technical perspective, CRITICAL from a user retention perspective.
**Phase:** UI/pricing page design.

**Confidence:** MEDIUM -- UX advice from multiple SaaS conversion guides, but specific impact varies by audience.

---

### Pitfall 13: Service Worker Caches Stale Premium State

**What goes wrong:** The service worker caches the HTML/JS with the old "free" state. After purchasing premium, the cached version still shows free features. Hard refresh or cache clear is needed.

**Why it happens:** The app is a single-file PWA with aggressive service worker caching. Subscription state changes don't trigger SW cache invalidation.

**Prevention:**
- **Never cache subscription state in the service worker.** Subscription status should always be fetched fresh from Firebase Auth (custom claims) or Firestore on app load.
- **Bump the SW cache version** when deploying monetization changes so the new UI code (premium feature checks, upgrade buttons) propagates.
- **Use a "network-first" strategy** for the main index.html so users always get the latest version.

**Severity:** MINOR -- confusing but resolves on next cache refresh.
**Phase:** Service worker update during monetization deployment.

**Confidence:** HIGH -- follows directly from the existing SW caching architecture documented in CLAUDE.md.

---

### Pitfall 14: No Loading State During Checkout Redirect

**What goes wrong:** User clicks "Subscribe" and the app calls a Cloud Function to create a Checkout Session, then redirects to Stripe. During the 2-5 seconds of Cloud Function cold start + API call, the button appears broken. User clicks again, creating duplicate sessions.

**Prevention:**
- **Immediately disable the button and show a spinner** on click.
- **Debounce the checkout function** to prevent double-invocation.
- **Set a reasonable timeout** (10 seconds) and show an error if the session creation fails.
- **Stripe Checkout handles duplicate sessions gracefully** (each is independent), but the UX is confusing.

**Severity:** MINOR -- no data loss, just poor UX.
**Phase:** Checkout flow UI implementation.

**Confidence:** HIGH -- standard UX pattern.

---

### Pitfall 15: Forgetting to Handle Checkout Abandonment

**What goes wrong:** User clicks "Subscribe," gets redirected to Stripe Checkout, but closes the tab or navigates away without completing payment. The app has no way to know the user intended to subscribe but didn't complete.

**Prevention:**
- **Set `success_url` and `cancel_url`** in the Checkout Session. The cancel URL should return to the pricing page with a gentle "Ready when you are" message, not an error.
- **Don't grant any access based on session creation.** Only grant access after the webhook confirms payment.
- **Checkout Sessions expire after 24 hours** by default. No cleanup needed on your side.
- **Optionally track abandoned checkouts** (listen for `checkout.session.expired` webhook) for re-engagement emails later, but this is a v2 optimization.

**Severity:** MINOR -- no technical issue, just a missed re-engagement opportunity.
**Phase:** Checkout flow implementation.

**Confidence:** HIGH -- based on Stripe Checkout documentation on session lifecycle.

---

## Integration Pitfalls Specific to This App

Issues arising from the specific architecture of a vanilla JS single-file PWA adding Cloud Functions.

### Pitfall 16: 3,400+ Line Single File Becomes Unmanageable

**What goes wrong:** Adding monetization logic (premium checks, upgrade modals, pricing UI, subscription management, Stripe.js loading) to an already 3,449-line `index.html` pushes it past the point of maintainability. Merge conflicts, find-and-replace errors, and "where does this code live?" questions multiply.

**Prevention:**
- **Keep monetization JavaScript in a separate file** (e.g., `premium.js`) loaded via `<script src>`. This is consistent with the existing `sw.js` pattern. No build tools needed.
- **Use a clear naming convention** for premium-related DOM elements (`data-premium`, `.premium-*`).
- **The Cloud Functions code already lives separately** (in `/functions/`). Keep client-side premium logic equally isolated.

**Severity:** MODERATE -- impacts development velocity and bug risk, not user experience directly.
**Phase:** Architecture decision before writing any client-side monetization code.

**Confidence:** HIGH -- follows from the documented 3,449-line file size.

---

### Pitfall 17: GitHub Pages Cannot Host Cloud Functions

**What goes wrong:** Developer tries to add server-side logic to the GitHub Pages deployment and realizes it is a static file host only. The Stripe webhook endpoint, Checkout Session creation, and Customer Portal session creation all require a server.

**Why it happens:** The existing app is hosted on GitHub Pages. Adding Firebase Cloud Functions means the backend lives on a completely different domain (e.g., `us-central1-projectname.cloudfunctions.net`). CORS issues, mixed-domain cookies, and architectural confusion follow.

**Prevention:**
- **Accept the split architecture.** GitHub Pages serves the static PWA. Firebase Cloud Functions serve the API endpoints. This is fine and normal.
- **Configure CORS properly** on Cloud Functions to accept requests from `pomodorotimer.vip`.
- **Use Firebase Hosting** as an alternative to GitHub Pages if you want a single domain. Firebase Hosting can proxy to Cloud Functions under the same domain (e.g., `pomodorotimer.vip/api/*` -> Cloud Function). This eliminates CORS entirely.
- **If staying on GitHub Pages**, all API calls from the client use `fetch()` to the Cloud Functions URL with proper CORS headers.

**Severity:** MODERATE -- architectural decision that affects the entire integration.
**Phase:** Infrastructure/architecture phase. Decide hosting strategy before building.

**Confidence:** HIGH -- based on the documented hosting setup (GitHub Pages + CNAME).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Architecture & Data Model | Client-side gating bypass (#1), Single-file bloat (#16) | Critical/Moderate | Design server-side checks, separate premium code |
| Infrastructure Setup | GitHub Pages + Cloud Functions split (#17), Secret key exposure (#4) | Moderate/Critical | Decide hosting, establish secret management |
| Cloud Functions + Webhooks | Signature verification (#2), Raw body bug (#2), Cold start timeouts (#8) | Critical/Moderate | Use `req.rawBody`, return 200 fast, Gen 2 functions |
| Subscription State Management | State desync (#3), Event ordering (#3), Idempotency (#3) | Critical | Fetch authoritative state from Stripe API, deduplicate events |
| Checkout Flow | Test/live key confusion (#5), Lifetime vs subscription (#10), Abandoned checkout (#15) | Critical/Moderate/Minor | Go-live checklist, separate code paths, handle cancel URL |
| Trial Implementation | Trial abuse (#9), No-card trials (#9) | Moderate | Require card upfront, use Stripe Radar |
| Dunning & Failures | No grace period (#7), Refund not revoking (#11) | Moderate | Map `past_due` to grace, handle refund events |
| Premium UX | Token refresh delay (#6), SW stale cache (#13), Loading states (#14) | Moderate/Minor | Force token refresh, bump SW, show spinners |
| Pricing Page | Free user alienation (#12) | Minor (tech) / Critical (retention) | Never gate existing features, frame as additive |
| Go-Live | Test/live confusion (#5) | Critical | Formal checklist, real purchase test |

---

## Sources

- [Stripe Webhook Best Practices](https://docs.stripe.com/webhooks) -- HIGH confidence
- [Stripe Go-Live Checklist](https://docs.stripe.com/get-started/checklist/go-live) -- HIGH confidence
- [Stripe Trial Periods Documentation](https://docs.stripe.com/billing/subscriptions/trials) -- HIGH confidence
- [Stripe Customer Abuse Prevention](https://docs.stripe.com/disputes/prevention/abuse) -- HIGH confidence
- [Stripe Dunning and Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) -- HIGH confidence
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) -- HIGH confidence
- [Stripe Refund Documentation](https://docs.stripe.com/refunds) -- HIGH confidence
- [Stripe API Key Best Practices](https://docs.stripe.com/keys-best-practices) -- HIGH confidence
- [Stripe Process Undelivered Events](https://docs.stripe.com/webhooks/process-undelivered-events) -- HIGH confidence
- [Firebase Custom Claims Documentation](https://firebase.google.com/docs/auth/admin/custom-claims) -- HIGH confidence
- [Firebase Cloud Functions Cold Starts Analysis](https://www.javacodegeeks.com/2025/04/comprehensive-analysis-of-firebase-functions-cold-starts.html) -- MEDIUM confidence
- [Stripe + Firebase Integration Guide (2025)](https://aronschueler.de/blog/2025/03/17/implementing-stripe-subscriptions-with-firebase-cloud-functions-and-firestore/) -- MEDIUM confidence
- [OnSecurity: Bypassing Freemium via Client-Side Controls](https://www.onsecurity.io/blog/pentest-findings-bypassing-freemium-through-client-side-security-controls/) -- MEDIUM confidence
- [Stripe Webhook Signature in Firebase (stripe-node #1043)](https://github.com/stripe/stripe-node/issues/1043) -- HIGH confidence
- [Stigg: Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) -- MEDIUM confidence
- [Hookdeck: Webhook Idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) -- MEDIUM confidence
