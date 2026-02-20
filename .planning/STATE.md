# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** A seamless upgrade path from free to premium that feels valuable -- users should hit the trial wall wanting to pay, not feeling nickeled.
**Current focus:** v2.0 Monetization -- COMPLETE (all 7 phases done, ready for production deployment)

## Current Position

Phase: 7 of 7 (Integrations) -- COMPLETE
Plan: 2 of 2 complete (human-verify approved)
Status: Complete
Last activity: 2026-02-20 -- Approved 07-02-PLAN.md human-verify checkpoint (Webhooks + PDF Export verified by user)

Progress: [##########] 100% (7/7 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 3.5 min
- Total execution time: 0.87 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-streaming-audio-and-categories | 2/2 | 5 min | 2.5 min |
| 02-polish-and-integration | 1/1 | 2 min | 2.0 min |
| 03-payment-infrastructure-and-feature-gating | 3/3 | 10 min | 3.3 min |
| 04-data-foundation-and-projects | 2/2 | 10 min | 5.0 min |
| 05-premium-personalization-export | 2/2 | 11 min | 5.5 min |
| 06-analytics-suite | 4/4 | 11 min | 2.8 min |
| 07-integrations | 2/3 | 20 min | 10 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent decisions affecting current work:
- Firebase Cloud Functions v2 (Node.js 22) for backend -- unified ecosystem
- Stripe Checkout redirect mode -- zero payment UI to build
- 3 pricing tiers ($2/mo, $15/yr, $47 lifetime) with 7-day trial
- addEventListener inside IIFE instead of inline onclick handlers (scoping)
- <dialog> elements for pricing page and upgrade prompt modals
- Session startedAt uses state.sessionStartTime (captured when timer starts), not serverTimestamp()
- FieldValue.increment() for atomic counter updates instead of read-modify-write
- Session records in subcollection: users/{uid}/sessions/{sessionId}
- Custom dropdown instead of native <select> for consistent dark theme styling
- requirePremium() guard on all project CRUD functions
- Maximum 100 projects cap
- Inline script in <head> for flash prevention on theme load (05-01)
- 7 total themes (2 free + 5 premium) as permanent set (05-01)
- SomaFM streams for premium audio categories (05-01)
- Web Audio API synthesis for chimes instead of MP3 files (05-02)
- Default CSV export date range to current month (05-02)
- UTF-8 BOM prefix for Excel CSV compatibility (05-02)
- Dynamic dialog creation pattern for temporary prompts (quick-001)
- Category label changes: Classical → Orchestral, Nature → Soundscapes (quick-001)
- Chart.js from CDN for analytics charting (06-01)
- Chart color CSS custom properties per theme for theme-aware charts (06-01)
- Chart instance management pattern: chartInstances object with destroy-before-create (06-01)
- Chart tokens in [data-mode="focus"] blocks only (always in scope) (06-01)
- Productivity score formula: 40% time + 30% consistency + 30% quality (06-02)
- Score color coding: green (70+), yellow (50-69), red (0-49) (06-02)
- Motivating score labels with positive tone (no negative messaging) (06-02)
- Dual weekly comparison: vs-last-week AND vs-4-week-avg (06-02)
- Best focus hours: 2-hour sliding window analysis with recommendations (06-02)
- Forecast exponential weights: [0.4, 0.3, 0.2, 0.1] with most recent week weighted highest (06-03)
- Forecast confidence scoring: HIGH (20+), MEDIUM (10-19), LOW (<10) data points (06-03)
- Top 5 projects only for trend chart (avoid visual clutter) (06-03)
- 7+ unique days required to show forecast (need week coverage) (06-03)
- GitHub-style heatmap (52-53 weeks x 7 days) hand-rolled without library (06-04)
- CSS color-mix() for heatmap intensity gradient (25%, 50%, 75%, 100% of --primary) (06-04)
- Percentile ranking based on last 7 days (not all-time) to keep rankings fresh (06-04)
- Scheduled Cloud Function runs daily at 3am UTC for percentile calculation (06-04)
- Only active users (totalMinutes > 0) included in percentile ranking (06-04)
- Sync window.open() before await in connectTodoist() to avoid popup blocker — critical for cross-browser OAuth popup (07-01)
- CSRF state stored in Firestore todoistOAuthStates collection with 10-min TTL and one-time deletion (07-01)
- Native fetch() used in all Cloud Functions — no npm dependencies added (07-01)
- Todoist API v1 endpoint (https://api.todoist.com/api/v1/tasks) for task import (07-01)
- Token cleared from Firestore on 401 response from Todoist — forces reconnect flow (07-01)
- All Todoist features (connect, import) gated behind requirePremium() (07-01)
- fire-and-forget webhook with .catch(() => {}) after batch.commit() — session completion must never be delayed (07-02)
- no-cors fetch mode for webhook — external endpoints like Zapier/webhook.site won't allow CORS (07-02)
- HTTPS-only webhook URL validation — reject http:// for security (07-02)
- jsPDF 3.0.3 from cdnjs CDN — consistent with existing Chart.js CDN pattern (07-02)
- PDF data fetches annual + weekly sessions in parallel with Promise.all() — reuses existing fetchSessions() (07-02)

### Pending Todos

None.

### Blockers/Concerns

- Firebase Cloud Functions requires Blaze (pay-as-you-go) plan -- user needs to upgrade Firebase project (REQUIRED BEFORE DEPLOYMENT)
- Stripe account needed with API keys configured (REQUIRED BEFORE DEPLOYMENT)
- Stripe products need to be created for 3 pricing tiers -- priceIds required for frontend
- Webhook secret only available AFTER Cloud Function is deployed (chicken-egg: deploy with placeholder, then update)
- Webhook endpoint URL must be added to Stripe Dashboard after first deployment
- Frontend STRIPE_PRICES config has placeholder values -- must replace with real price IDs
- CSV export requires Firestore composite index on sessions.startedAt (one-time setup via provided link)
- Todoist OAuth credentials (TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET, TODOIST_REDIRECT_URI) must be configured before Cloud Functions deployment

## Session Continuity

Last session: 2026-02-20
Stopped at: 07-02 human-verify checkpoint approved — all 7 phases complete
Resume file: N/A — project planning complete
Next action: Production deployment (configure Stripe, Firebase Blaze, Todoist OAuth credentials — see blockers)

## Quick Tasks

| ID | Description | Status | Summary |
|----|-------------|--------|---------|
| quick-001 | Fix UAT gaps: audio streams, pricing tiers, stats icon | Complete | .planning/quick/001-fix-uat-gaps-audio-streams-monthly-plan/001-SUMMARY.md |
