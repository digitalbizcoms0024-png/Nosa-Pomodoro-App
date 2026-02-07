# Requirements: Pomodoro Timer v2.0 Monetization

**Defined:** 2026-02-07
**Core Value:** A seamless upgrade path from free to premium that feels valuable -- users should hit the trial wall wanting to pay, not feeling nickeled.

## v2.0 Requirements

### Payment Infrastructure

- [ ] **PAY-01**: User can subscribe to monthly plan ($2/month) via Stripe Checkout
- [ ] **PAY-02**: User can subscribe to yearly plan ($15/year) via Stripe Checkout
- [ ] **PAY-03**: User can purchase lifetime access ($47 one-time) via Stripe Checkout
- [ ] **PAY-04**: User gets 7-day free trial with card required upfront before first charge
- [ ] **PAY-05**: User can manage subscription (cancel, change plan, update payment) via Stripe Customer Portal
- [ ] **PAY-06**: Premium features are gated behind subscription status verified server-side
- [ ] **PAY-07**: Subscription status syncs from Stripe webhooks to Firestore in real-time
- [ ] **PAY-08**: User sees pricing page with clear free vs premium comparison
- [ ] **PAY-09**: User sees upgrade prompt when accessing a premium feature without subscription
- [ ] **PAY-10**: User retains premium access during grace period when payment fails (past_due status)

### Data Foundation

- [ ] **DATA-01**: App records session-level data (startedAt, duration, projectId, taskId, hourOfDay, dayOfWeek) for every completed focus session
- [ ] **DATA-02**: Session records sync to Firestore for authenticated users
- [ ] **DATA-03**: Session data coexists with existing daily aggregate stats (no breaking changes)

### Projects

- [ ] **PROJ-01**: Premium user can create, rename, and delete projects
- [ ] **PROJ-02**: Premium user can assign tasks to a project
- [ ] **PROJ-03**: Premium user can select active project before starting a focus session
- [ ] **PROJ-04**: Focus session time is attributed to the selected project
- [ ] **PROJ-05**: Premium user can view task list filtered by project

### Analytics

- [ ] **ANLY-01**: Premium user can view time spent per project with trend charts
- [ ] **ANLY-02**: Premium user can view best focus times (hour-of-day analysis)
- [ ] **ANLY-03**: Premium user can view productivity score (0-100, composite metric)
- [ ] **ANLY-04**: Premium user can view weekly summary ("X hours, Y% more than last week, best window is Z")
- [ ] **ANLY-05**: Premium user can view Focus Forecast (predicted next week's output based on weighted history)
- [ ] **ANLY-06**: Premium user can view yearly productivity report (heatmap, annual summary)

### Export

- [ ] **EXPT-01**: Premium user can export session data as CSV with date range filter
- [ ] **EXPT-02**: Premium user can export productivity report as PDF

### Personalization

- [ ] **PERS-01**: Premium user can choose from 4-6 premium color themes beyond light/dark
- [ ] **PERS-02**: Premium user can access 2-4 additional audio categories beyond Ambient and Focus Beats
- [ ] **PERS-03**: Premium user can customize timer alert sound (5-6 chime options)

### Integrations

- [ ] **INTG-01**: Premium user can import tasks from Todoist via one-way OAuth import
- [ ] **INTG-02**: Premium user can configure a webhook URL that fires JSON payload on focus session completion
- [ ] **INTG-03**: Premium user can test webhook with a sample payload

### Marketing

- [ ] **MKTG-01**: Premium pricing page includes "No Ads Ever" guarantee as a listed benefit

## Future Requirements

Deferred beyond v2.0. Tracked but not in current roadmap.

### Automation
- **AUTO-01**: User can configure if-this-then-that automation rules -- *Descoped: replaced by webhook triggers (INTG-02) + smart behavior toggles. Custom rule engine is high effort, low usage.*

### Advanced Integrations
- **AINT-01**: Bidirectional Todoist sync -- *Descoped: complex conflict resolution, one-way import sufficient for v2.0*
- **AINT-02**: Spotify/Apple Music integration -- *Descoped: requires OAuth, premium accounts, API costs, DRM*

### Social
- **SOCL-01**: Team/collaboration features -- *Descoped: different product scope entirely*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom automation rule engine | Weeks of engineering, low usage; Webhook triggers + smart toggles deliver same value |
| Bidirectional Todoist sync | Complex conflict resolution, flaky UX; one-way import sufficient |
| Spotify/Apple Music integration | OAuth, premium accounts, API costs, DRM issues |
| Team/collaboration features | Complexity explosion; stay focused on individual productivity |
| AI-powered insights | Buzzword; simple statistics are sufficient and explainable |
| Charting library dependency | SVG charts maintain zero-dependency constraint |
| Per-session mood tracking | Scope creep; infer patterns from data, not surveys |
| Server-side PDF generation | Over-engineered; client-side jsPDF sufficient and free to operate |
| Ads in free tier | Undermines focus/productivity value proposition; revenue from subscriptions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| PAY-05 | Phase 3 | Pending |
| PAY-06 | Phase 3 | Pending |
| PAY-07 | Phase 3 | Pending |
| PAY-08 | Phase 3 | Pending |
| PAY-09 | Phase 3 | Pending |
| PAY-10 | Phase 3 | Pending |
| MKTG-01 | Phase 3 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| PROJ-01 | Phase 4 | Pending |
| PROJ-02 | Phase 4 | Pending |
| PROJ-03 | Phase 4 | Pending |
| PROJ-04 | Phase 4 | Pending |
| PROJ-05 | Phase 4 | Pending |
| PERS-01 | Phase 5 | Pending |
| PERS-02 | Phase 5 | Pending |
| PERS-03 | Phase 5 | Pending |
| EXPT-01 | Phase 5 | Pending |
| ANLY-01 | Phase 6 | Pending |
| ANLY-02 | Phase 6 | Pending |
| ANLY-03 | Phase 6 | Pending |
| ANLY-04 | Phase 6 | Pending |
| ANLY-05 | Phase 6 | Pending |
| ANLY-06 | Phase 6 | Pending |
| INTG-01 | Phase 7 | Pending |
| INTG-02 | Phase 7 | Pending |
| INTG-03 | Phase 7 | Pending |
| EXPT-02 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-02-07*
*Last updated: 2026-02-07 after roadmap creation*
