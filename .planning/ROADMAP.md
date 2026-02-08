# Roadmap: Pomodoro Timer

## Milestones

- SHIPPED **v1.0 Background Audio** -- Phases 1-2 (shipped 2026-02-07)
- **v2.0 Monetization** -- Phases 3-7 (in progress)

## Phases

<details>
<summary>v1.0 Background Audio (Phases 1-2) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Streaming Audio & Categories (2/2 plans) -- completed 2026-02-06
- [x] Phase 2: Polish & Integration (1/1 plan) -- completed 2026-02-06

</details>

### v2.0 Monetization

**Milestone Goal:** Add Stripe-powered subscription payments with premium feature gating and 11 premium features, transforming the free PWA into a freemium product with 3 pricing tiers and a 7-day free trial.

- [x] **Phase 3: Payment Infrastructure & Feature Gating** - Working Stripe subscriptions, server-side gating, and pricing UI
- [x] **Phase 4: Data Foundation & Projects** - Session-level data model and project-based task organization
- [x] **Phase 5: Premium Personalization & Export** - Custom themes, sounds, and CSV data export
- [ ] **Phase 6: Analytics Suite** - Smart Insights, Focus Forecast, project analytics, and yearly report
- [ ] **Phase 7: Integrations** - Todoist import, webhook triggers, and PDF export

## Phase Details

### Phase 3: Payment Infrastructure & Feature Gating
**Goal**: Users can subscribe to premium, manage their subscription, and experience gated features -- the monetization foundation everything else depends on.
**Depends on**: Nothing (first v2.0 phase; builds on existing Firebase Auth/Firestore)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08, PAY-09, PAY-10, MKTG-01
**Success Criteria** (what must be TRUE):
  1. User can complete checkout for any of the 3 pricing tiers (monthly, yearly, lifetime) and land back in the app with premium status active
  2. User can access the Stripe Customer Portal to cancel, change plan, or update payment method
  3. Free user who taps a premium feature sees an upgrade prompt with pricing comparison, not a broken UI or error
  4. Subscription status persists across page reloads and devices -- verified server-side, not just client-cached
  5. User with an expired trial or failed payment loses access to premium features (grace period for past_due)
**Plans**: 3 plans
Plans:
  - [x] 03-01-PLAN.md — Firebase Cloud Functions setup + Stripe webhook handler
  - [x] 03-02-PLAN.md — Checkout, Portal, and subscription verification functions
  - [x] 03-03-PLAN.md — Client-side pricing UI, upgrade prompts, and feature gating

### Phase 4: Data Foundation & Projects
**Goal**: Users can organize work into projects with per-session data recording, establishing the data layer that powers all analytics and export features.
**Depends on**: Phase 3 (feature gating required to restrict Projects to premium users)
**Requirements**: DATA-01, DATA-02, DATA-03, PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05
**Success Criteria** (what must be TRUE):
  1. Every completed focus session records granular data (timestamp, duration, project, task, hour/day) that syncs to Firestore without breaking existing daily stats
  2. Premium user can create a project, assign tasks to it, and select it before starting a focus session
  3. Completed focus session time is attributed to the selected project and visible in the task/project list
  4. Premium user can filter their task list by project to see only relevant tasks
**Plans**: 2 plans
Plans:
  - [x] 04-01-PLAN.md — Session data recording layer + state extensions
  - [x] 04-02-PLAN.md — Project management UI, task integration, and filtering

### Phase 5: Premium Personalization & Export
**Goal**: Users get immediate visual and auditory customization plus data portability -- the "feel premium on day one" features.
**Depends on**: Phase 4 (CSV export requires session-level data model from Phase 4)
**Requirements**: PERS-01, PERS-02, PERS-03, EXPT-01
**Success Criteria** (what must be TRUE):
  1. Premium user can switch between 4-6 color themes beyond light/dark and the selection persists across sessions
  2. Premium user can browse and play 2-4 additional audio categories beyond Ambient and Focus Beats
  3. Premium user can choose from 5-6 timer alert chime sounds and hear the selected chime on timer completion
  4. Premium user can export their session history as a CSV file with a date range filter applied
**Plans**: 2 plans
Plans:
  - [x] 05-01-PLAN.md — Premium color themes, theme selector dialog, and premium audio categories
  - [x] 05-02-PLAN.md — Customizable timer chime sounds and CSV session export

### Phase 6: Analytics Suite
**Goal**: Users gain actionable productivity insights from their accumulated session data -- the features that make premium worth keeping month after month.
**Depends on**: Phase 4 (all analytics require session-level data; project analytics requires Projects)
**Requirements**: ANLY-01, ANLY-02, ANLY-03, ANLY-04, ANLY-05, ANLY-06
**Success Criteria** (what must be TRUE):
  1. Premium user can view time spent per project with trend visualization showing how allocation changes over time
  2. Premium user can see their best focus hours (hour-of-day analysis) and a composite productivity score (0-100)
  3. Premium user can view a weekly summary comparing current week to previous week with specific metrics
  4. Premium user can view a Focus Forecast predicting next week's output based on their history
  5. Premium user can view a yearly productivity report with heatmap and annual summary
**Plans**: 4 plans
Plans:
  - [ ] 06-01-PLAN.md — Chart.js integration, chart color CSS tokens, analytics dialog shell with tabs
  - [ ] 06-02-PLAN.md — Overview tab: productivity gauge, weekly summary, best focus hours
  - [ ] 06-03-PLAN.md — Projects tab (donut + trends) and Forecast tab (day-of-week predictions)
  - [ ] 06-04-PLAN.md — Yearly tab (heatmap + annual stats) and percentile Cloud Function

### Phase 7: Integrations
**Goal**: Power users can connect the app to their existing workflow tools -- Todoist for task import, webhooks for automation, and PDF for polished reports.
**Depends on**: Phase 3 (Cloud Functions for Todoist OAuth proxy), Phase 4 (session data for PDF export), Phase 6 (report data for PDF)
**Requirements**: INTG-01, INTG-02, INTG-03, EXPT-02
**Success Criteria** (what must be TRUE):
  1. Premium user can authenticate with Todoist and import tasks into the app as a one-way sync
  2. Premium user can configure a webhook URL and receive a JSON payload automatically after each completed focus session
  3. Premium user can send a test webhook payload to verify their endpoint works before relying on it
  4. Premium user can export a formatted productivity report as a downloadable PDF
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 3 -> 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Streaming Audio & Categories | v1.0 | 2/2 | Complete | 2026-02-06 |
| 2. Polish & Integration | v1.0 | 1/1 | Complete | 2026-02-06 |
| 3. Payment Infrastructure & Feature Gating | v2.0 | 3/3 | Complete | 2026-02-07 |
| 4. Data Foundation & Projects | v2.0 | 2/2 | Complete | 2026-02-07 |
| 5. Premium Personalization & Export | v2.0 | 2/2 | Complete | 2026-02-08 |
| 6. Analytics Suite | v2.0 | 0/4 | Not started | - |
| 7. Integrations | v2.0 | 0/TBD | Not started | - |
