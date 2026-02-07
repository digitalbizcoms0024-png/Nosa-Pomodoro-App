# Project Research Summary

**Project:** Pomodoro Timer v2.0 Monetization
**Domain:** Freemium SaaS subscription payments for vanilla JS PWA
**Researched:** 2026-02-07
**Confidence:** HIGH

## Executive Summary

This milestone transforms the Pomodoro Timer from a free PWA into a freemium product with Stripe-powered subscriptions ($2/mo, $15/yr, $47 lifetime) and a suite of premium features. The recommended approach is **Stripe Checkout Sessions** (redirect mode) with **Firebase Cloud Functions v2** as the backend -- this introduces the app's first server-side component while keeping the frontend vanilla JS with zero build tools. The architecture is well-documented by both Stripe and Firebase, with multiple production references validating the exact integration pattern. The client never touches payment data; it calls Cloud Functions that return Stripe-hosted URLs for checkout and subscription management.

The premium feature anchor is **Projects + Project Analytics** -- the single most common premium feature across competing pomodoro apps (Pomofocus, Focus To-Do, Toggl Track). All analytics features (Smart Insights, Focus Forecast, Yearly Report) and data export depend on a **session-level data model change** that replaces the current daily aggregates with individual session records. This data model change is the critical path dependency: without it, 6 of 11 premium features cannot be built. It must ship early so historical data begins accumulating immediately.

The primary risks are: (1) **webhook signature verification failure** using `req.body` instead of `req.rawBody` in Cloud Functions -- this silently breaks the entire payment flow, (2) **Stripe/Firestore state desynchronization** from missed or out-of-order webhooks, requiring idempotent handlers and a daily reconciliation job, and (3) the **split hosting architecture** (GitHub Pages for static + Firebase for functions) which requires proper CORS handling. All three have well-documented mitigations and HIGH-confidence prevention strategies.

## Key Findings

### Recommended Stack

The stack additions respect the existing zero-build-tool constraint. Server-side code lives in a new `functions/` directory with its own `package.json`; the frontend remains a single `index.html` file with CDN script tags.

**Core technologies:**
- **Stripe Checkout Sessions (redirect mode)**: Payment flow -- Stripe-hosted payment page handles subscriptions AND one-time lifetime purchases. Zero payment UI to build. PCI-compliant by default.
- **Stripe Customer Portal**: Subscription management -- Stripe-hosted page for cancellation, plan changes, billing updates. Zero management UI to build.
- **Firebase Cloud Functions v2 (Node.js 22)**: Backend for Stripe API calls, webhook handling, subscription status writes. Uses `defineSecret()` for key management.
- **stripe npm v20.3.x**: Server-side Stripe SDK for Checkout Session creation and webhook verification.
- **jsPDF 4.x (CDN, lazy-loaded)**: Client-side PDF export for premium productivity reports. Loaded only when user triggers export.
- **Native JS for CSV**: No library needed -- 20 lines of vanilla JS for CSV generation from clean data.

**What NOT to add:** Stripe Elements (custom payment UI unnecessary), Stripe Firebase Extension (doesn't handle mixed subscription + one-time), any frontend framework or build tool, PapaParse (CSV generation trivial), Puppeteer/server-side PDF (overkill), Express.js (Cloud Functions v2 handles HTTP natively).

### Expected Features

**Must have (table stakes for premium to feel worth $2/mo):**
- **Projects** -- Foundation for all analytics; most common premium feature in the space
- **Project Analytics** -- Time per project, trends; the payoff that makes Projects worth paying for
- **Custom Themes** -- 4-6 premium color themes; immediate visual upgrade, trivial to build
- **Custom Focus Sounds** -- 2-4 additional SomaFM categories + timer sound customization
- **CSV Export** -- Data portability; expected by power users and freelancers
- **Yearly Productivity Report** -- Year-at-a-glance heatmap, "Wrapped"-style summary; retention driver
- **No Ads Ever** -- Trust signal, zero engineering (marketing copy only)

**Should have (differentiators):**
- **Smart Insights** -- Best focus times, productivity score, weekly summary; highest "wow factor"
- **Webhook Triggers** -- Fire POST on session completion; enables Zapier/IFTTT ecosystem for power users
- **Focus Forecast** -- Predict next week's output from history; novel feature, no competitor equivalent

**Defer (v2+ or conditional):**
- **Todoist Import** -- Build only after Cloud Functions are live; one-way import only, no bidirectional sync
- **PDF Export** -- Build after session-level data model is established; lower priority than CSV

**Descoped entirely:**
- **Automation Rules Engine** -- Replaced by Webhook Triggers + 2-3 "smart behavior" toggles. Custom rule engine is weeks of engineering for low usage.
- **Bidirectional Todoist Sync** -- Complex conflict resolution, flaky UX. One-way import only.
- **Team/collaboration features** -- Different product entirely; complexity explosion.
- **Spotify/Apple Music integration** -- OAuth, premium accounts, API costs, DRM issues. Stay with SomaFM.

### Architecture Approach

The architecture introduces a server-side layer (Firebase Cloud Functions) to handle all Stripe operations. The client calls `onCall` functions to get redirect URLs, sends users to Stripe-hosted pages, and reads subscription status from Firestore. Webhooks use `onRequest` with `rawBody` for signature verification. Subscription status lives flat in `users/{uid}.subscription` (not a subcollection) for single-read efficiency. Feature gating is server-verified (Firestore rules block client writes to subscription fields) and client-cached (loaded on auth state change, refreshed on app focus).

**Major components:**
1. **Cloud Functions (4 functions)** -- `createCheckoutSession` (onCall), `createPortalSession` (onCall), `handleStripeWebhook` (onRequest), `checkSubscription` (onCall)
2. **Firestore schema extension** -- `stripeCustomerId` and `subscription` object on `users/{uid}`, with security rules preventing client writes
3. **Client-side feature gating** -- `isPremium()` helper, `requirePremium(featureName)` with upgrade prompt, subscription state loaded on auth change
4. **Session-level data model** -- New session records with timestamps (startedAt, duration, projectId, taskId, hourOfDay, dayOfWeek), replacing daily aggregates for analytics
5. **Premium UI** -- Pricing cards, upgrade prompts, "Manage Subscription" button, premium badges

### Critical Pitfalls (Top 5)

1. **Webhook rawBody signature failure** -- Use `req.rawBody` (NOT `req.body`) for `stripe.webhooks.constructEvent()`. Using parsed JSON silently breaks signature verification. Test explicitly before deploying.
2. **Stripe/Firestore state desynchronization** -- Make webhook handlers idempotent and order-independent. Fetch authoritative state from Stripe API on each event. Build a daily reconciliation Cloud Function. Store processed event IDs to prevent duplicates.
3. **Stripe secret key exposure** -- NEVER put `sk_live_` or `sk_test_` in client-side code. Only `pk_live_` goes in `index.html`. All secret key operations happen in Cloud Functions via `defineSecret()`. Add pre-commit hook to grep for secret key patterns.
4. **Test/live mode key confusion at launch** -- Products, prices, customers, and webhook secrets are completely separate between test and live mode. Create a formal go-live checklist: recreate products in live mode, update all config, configure live webhook endpoint, make a real purchase to verify.
5. **Lifetime purchase not handled in webhook** -- Lifetime uses `mode: 'payment'` (not subscription). Must check `session.mode` in `checkout.session.completed` handler and branch to a separate code path that sets permanent `status: 'lifetime'`.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Payment Infrastructure + Feature Gating
**Rationale:** Everything depends on this. Cannot build or test any premium feature without the ability to gate it. Cannot monetize without payment processing.
**Delivers:** Working Stripe integration (checkout, webhooks, portal), subscription status in Firestore, `isPremium()` gating framework, pricing UI, security rules.
**Features addressed:** Stripe Checkout (monthly/yearly/lifetime), 7-day trial with card required, Customer Portal, feature gating framework, "No Ads Ever" (marketing copy).
**Pitfalls to avoid:** #2 rawBody signature verification, #3 state desync (idempotent handlers), #4 secret key exposure, #5 test/live confusion, #10 lifetime code path, #17 split hosting CORS.
**Stack:** Firebase Cloud Functions v2 (Node.js 22), stripe npm v20.3.x, firebase-functions v7.x, firebase-admin v13.6.x, Stripe.js CDN, defineSecret() for secrets.

### Phase 2: Data Foundation + Projects
**Rationale:** The session-level data model is the critical dependency for 6 premium features. Projects is the anchor premium feature. Ship both together so session records accumulate from day one.
**Delivers:** Session-level data records (startedAt, duration, projectId, taskId, hourOfDay, dayOfWeek), Project CRUD, task-project assignment, project selector in timer view, time attribution per project.
**Features addressed:** Projects (Feature 1), session data model (foundation for Features 3, 7, 8, 9, and partial 2).
**Pitfalls to avoid:** #16 single-file bloat (consider `premium.js` for new client code), #1 ensure project data respects server-side gating.

### Phase 3: Premium Personalization + Export
**Rationale:** Quick wins that make the upgrade feel tangible immediately. Custom themes and sounds are low-complexity, high-visibility. CSV export leverages the new session data model. All three are independent features with no cross-dependencies.
**Delivers:** 4-6 premium color themes, 2-4 additional sound categories, timer sound customization, CSV export with date range selector.
**Features addressed:** Custom Themes + Sounds (Feature 11), CSV Export (Feature 3).
**Pitfalls to avoid:** #13 service worker caching stale premium state (bump cache version, network-first for index.html).

### Phase 4: Analytics Suite
**Rationale:** Requires 2+ weeks of accumulated session data to be meaningful. By this phase, early premium users have enough data for analytics to deliver value. Projects + session data from Phase 2 are prerequisites.
**Delivers:** Project Analytics (time per project, trends, comparisons), Smart Insights (best focus times, productivity score, weekly summary), Focus Forecast (weighted moving average predictions), Yearly Report (heatmap, "Wrapped"-style card).
**Features addressed:** Project Analytics (Feature 9), Smart Insights (Feature 7), Focus Forecast (Feature 8), Yearly Report (Feature 2).
**Pitfalls to avoid:** None critical -- pure client-side rendering from existing Firestore data. Keep charts as hand-rolled SVG to avoid adding a charting library dependency.

### Phase 5: Integrations
**Rationale:** Depends on Cloud Functions (from Phase 1) and Projects (from Phase 2). Todoist OAuth requires a backend proxy. Webhooks require session completion hooks. Both are power-user features that can wait for the core premium experience to be solid.
**Delivers:** Todoist one-way import with OAuth via Cloud Function proxy, Webhook triggers on session completion with test button, PDF export via jsPDF.
**Features addressed:** Todoist Import (Feature 4), Webhook Triggers (Feature 5), PDF Export (Feature 3 partial).
**Pitfalls to avoid:** Todoist OAuth token storage must be encrypted in Firestore; webhook CORS may need `mode: 'no-cors'` fallback for some receivers.

### Phase Ordering Rationale

- **Phase 1 first** because every other phase depends on payment infrastructure and the gating framework. You cannot test premium features without the ability to toggle premium status.
- **Phase 2 before Phase 3** because the session data model must be live as early as possible -- historical data cannot be retroactively generated. Every day without session records is lost analytics data.
- **Phase 3 before Phase 4** because themes/sounds/CSV are immediate-gratification features that make premium feel worth paying for on day one. Analytics require accumulated data and deliver value over time.
- **Phase 4 before Phase 5** because analytics are table-stakes premium features used by all premium users, while integrations (Todoist, webhooks) serve a power-user niche.
- **Phase 5 last** because it has the most external dependencies (Todoist API, third-party webhook receivers) and serves the smallest user segment.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Payment Infrastructure):** Needs phase research for Firestore security rules syntax for protecting subscription fields, CORS configuration for Cloud Functions called from GitHub Pages domain, and the exact Stripe Dashboard configuration steps for products/prices/portal/webhooks.
- **Phase 5 (Integrations):** Needs phase research for Todoist OAuth flow specifics (app registration, scopes, token exchange), jsPDF API for generating attractive tabular reports.

Phases with standard patterns (skip deep research):
- **Phase 2 (Data + Projects):** Standard Firestore CRUD, well-understood data modeling.
- **Phase 3 (Themes + Sounds + CSV):** CSS custom properties, SomaFM streams, Blob/download pattern -- all established patterns already used in the app.
- **Phase 4 (Analytics):** Client-side statistics and SVG chart rendering -- straightforward math and DOM manipulation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm as of 2026-02-07. Stripe Checkout + Firebase Cloud Functions is a well-documented integration path with official tutorials from both Stripe and Firebase. |
| Features | HIGH | Feature set validated against Pomofocus, Focus To-Do, Toggl Track, and 6+ other competitors. Projects + Analytics as the anchor is strongly supported. |
| Architecture | HIGH | Stripe Checkout redirect mode + onCall/onRequest Cloud Functions + Firestore subscription document is the canonical pattern for this stack. Multiple production references. |
| Pitfalls | HIGH | All critical pitfalls sourced from official Stripe/Firebase documentation. Webhook rawBody issue is the #1 documented Firebase+Stripe gotcha. |

**Overall confidence:** HIGH

### Gaps to Address

- **CORS for GitHub Pages + Cloud Functions:** The exact CORS setup for `onCall` vs `onRequest` functions when the client is on a different domain (pomodorotimer.vip vs cloudfunctions.net) needs validation. `onCall` handles CORS automatically; `onRequest` (webhook) does not need client CORS since it is Stripe server-to-server. Verify during Phase 1 implementation.
- **Todoist OAuth specifics:** App registration process, required scopes for task read access, token refresh flow, and rate limits need phase-specific research before Phase 5 implementation.
- **jsPDF report design:** Library capabilities confirmed, but generating an attractive, branded PDF report client-side will take iteration. Consider html2pdf.js as a fallback if jsPDF's direct API proves limiting.
- **Firebase Blaze plan billing monitoring:** The app must be on the Blaze plan for Cloud Functions. Estimated cost is $0-5/mo for low traffic, but billing alerts should be configured to prevent surprises.
- **Focus Forecast market validation:** Novel feature with no competitive precedent. Keep scope minimal (weighted moving average, ~50-80 lines of JS). If analytics show low engagement post-launch, deprioritize.
- **Version discrepancy in Architecture research:** ARCHITECTURE.md references older package versions (firebase-functions ^5.0.0, firebase-admin ^12.0.0, stripe ^17.0.0) while STACK.md has verified current versions (^7.0.x, ^13.6.x, ^20.3.x). Use STACK.md versions -- they were npm-verified on research date.

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout Sessions](https://docs.stripe.com/payments/checkout) -- Payment flow architecture, mixed mode support
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) -- Event handling, lifecycle management
- [Stripe Customer Portal](https://docs.stripe.com/customer-management) -- Self-service subscription management
- [Stripe Free Trials](https://docs.stripe.com/payments/checkout/free-trials) -- Trial configuration with card required
- [Stripe Webhook Signatures](https://docs.stripe.com/webhooks/signature) -- rawBody requirement, signature verification
- [Stripe Go-Live Checklist](https://docs.stripe.com/get-started/checklist/go-live) -- Test-to-live migration
- [Firebase Cloud Functions v2](https://firebase.google.com/docs/functions/get-started) -- Setup, secrets, deployment
- [Firebase + Stripe Tutorial](https://firebase.google.com/docs/tutorials/payments-stripe) -- Official integration guide
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims) -- Token-based feature gating
- [stripe npm](https://www.npmjs.com/package/stripe) -- v20.3.1 verified 2026-02-07
- [firebase-functions npm](https://www.npmjs.com/package/firebase-functions) -- v7.0.3 verified 2026-02-07

### Secondary (MEDIUM confidence)
- [Stripe + Firebase Implementation (Aron Schueler, 2025)](https://aronschueler.de/blog/2025/03/17/implementing-stripe-subscriptions-with-firebase-cloud-functions-and-firestore/) -- Real-world production reference
- [Pomofocus Premium Features](https://pomofocus.io/) -- Competitive feature validation
- [Focus To-Do App Store](https://apps.apple.com/us/app/focus-to-do-pomodoro-tasks/id1258530160) -- Competitor premium tiers
- [Reclaim.ai Pomodoro Guide](https://reclaim.ai/blog/best-pomodoro-timer-apps) -- Feature landscape comparison
- [OnSecurity: Bypassing Freemium](https://www.onsecurity.io/blog/pentest-findings-bypassing-freemium-through-client-side-security-controls/) -- Client-side gating risks
- [Stigg: Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) -- Production webhook patterns
- [jsPDF GitHub](https://github.com/parallax/jsPDF) -- v4.x client-side PDF generation

### Tertiary (LOW confidence)
- [Todoist Developer API](https://developer.todoist.com/guides/) -- OAuth flow needs phase-specific validation
- Focus Forecast feature concept -- Novel, no competitive validation available

---
*Research completed: 2026-02-07*
*Ready for roadmap: yes*
