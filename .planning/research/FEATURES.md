# Feature Landscape: Premium Monetization Features

**Domain:** Pomodoro timer PWA with freemium subscription model
**Researched:** 2026-02-07
**Competitive reference:** Pomofocus ($3/mo, $18/yr, $54 lifetime), Focus To-Do ($2.99/3mo), Forest ($3.99 one-time), Toggl Track ($9-18/user/mo)
**Target pricing:** $2/month, $15/year, $47 lifetime with 7-day free trial

## Existing Free Tier (Already Built)

For context, these features exist and must remain free. They establish the baseline users already have:

| Feature | Status |
|---------|--------|
| Focus/Break/Long Break timer with configurable durations | Shipped |
| SVG progress ring animation | Shipped |
| Task list (max 10 tasks, flat list) | Shipped |
| Stats (daily/weekly sessions, minutes, streaks) | Shipped |
| Firebase Auth with Google Sign-In | Shipped |
| Firestore leaderboard with cross-device sync | Shipped |
| Light/dark theme | Shipped |
| PWA offline support | Shipped |
| Desktop notifications | Shipped |
| Keyboard shortcuts | Shipped |
| Background audio (SomaFM, 2 categories: Ambient, Focus Beats) | Shipped |
| Volume ducking during chimes | Shipped |

---

## Premium Feature Analysis (11 Features)

### 1. Projects (Project-Based Task Organization)

**Category:** Table Stakes for premium tier
**Complexity:** Medium
**Value justification:** HIGH -- this is the single most common premium feature across all pomodoro apps. Pomofocus gates projects behind premium. Focus To-Do gates unlimited projects behind premium.

**How competitors do it:**
- Pomofocus: Flat project list. Tasks assigned to a project. Time tracked per project. Free tier gets 0 projects (tasks are unorganized). Premium unlocks unlimited.
- Focus To-Do: Hierarchical projects with sub-tasks. Free tier allows a few projects, premium unlocks unlimited.
- Toggl Track: Projects with client and task tags. Full project analytics.

**What to build:**
- Project CRUD (create, rename, delete, color-code)
- Assign tasks to projects (optional -- unassigned tasks still work)
- Lift the 10-task limit for premium (e.g., unlimited or 50 per project)
- Project selector in timer view (active project for current session)
- Time automatically attributed to active project when session completes

**Existing dependencies:**
- Tasks system already exists (`state.tasks: [{ id, title, completed }]`)
- Needs new `projectId` field on tasks
- Needs new Firestore collection or subcollection for projects
- Needs new `activeProject` in state

**Recommendation:** Build this FIRST. It is the foundation for Project Analytics, Smart Insights, and Focus Forecast. Without projects, analytics have nothing meaningful to segment by. This is also the feature most likely to make a user say "I need premium" because it directly enhances the workflow they already use (tasks).

**Confidence:** HIGH -- verified across Pomofocus, Focus To-Do, Toggl Track.

---

### 2. Yearly Productivity Report

**Category:** Table Stakes for premium analytics
**Complexity:** Medium
**Value justification:** MEDIUM -- expected in premium tier but rarely the reason someone subscribes. Acts as a retention feature (users want to see their year-end data, so they stay subscribed).

**How competitors do it:**
- Pomofocus: Free tier shows weekly/monthly views. Premium unlocks yearly view. Data shown as focus hours per year.
- Focus To-Do: Recently added year dimension to reports with Gantt charts and tendency charts across day/week/month/year.
- Rize.io: Detailed annual reports with focus time breakdowns.

**What to build:**
- Year-at-a-glance heatmap (GitHub-style contribution graph of focus sessions)
- Yearly totals: hours focused, sessions completed, best streak, most productive day of week, most productive time of day
- Month-over-month comparison within the year
- "Spotify Wrapped"-style summary card (shareable -- doubles as marketing)

**Existing dependencies:**
- `state.stats.dailyCounts` and `state.stats.dailyMinutes` already store date-keyed data
- Firestore `users/{uid}` already has `dailyCounts` and `dailyMinutes` maps
- Data already exists if user has been using the app -- this is purely a presentation feature
- No new data collection needed

**Recommendation:** Build this in the analytics phase alongside Smart Insights and Project Analytics. The data already exists; this is a rendering exercise. The "Wrapped"-style shareable card is a genuine differentiator and free marketing vector.

**Confidence:** HIGH -- verified data structures support this.

---

### 3. CSV + PDF Export

**Category:** Table Stakes for premium data features
**Complexity:** Low-Medium
**Value justification:** LOW-MEDIUM -- niche but expected. Users who want it REALLY want it. Mostly power users and freelancers tracking billable time.

**How competitors do it:**
- Pomofocus: CSV download of focus history in premium.
- Toggl Track: CSV, PDF, and Excel export of time entries.
- Most timer apps: CSV is common; PDF is less common but valued by freelancers.

**What to build:**
- CSV export: Date, project, duration, task name, session type. One row per completed session.
- PDF export: Formatted summary report (weekly or monthly) with charts rendered as static images.
- Date range selector for export scope.

**Implementation approach:**
- CSV: Pure vanilla JS. Build string, create Blob, trigger download. Zero dependencies needed.
- PDF: Use jsPDF (client-side, ~280KB). No server needed. Can render text, tables, and basic charts directly in browser. Well-maintained library (co-maintained by yWorks). Works with vanilla JS, no framework needed.
- Alternative for PDF: html2pdf.js wraps jsPDF + html2canvas to convert rendered HTML to PDF.

**Existing dependencies:**
- Requires session-level data (currently only daily aggregates stored). Need to store individual session records: `{ date, startTime, duration, projectId, taskId }`.
- This is a data model change that should happen early.

**Recommendation:** CSV is trivial -- build it alongside the data model change. PDF is a nice-to-have that can come later. The key dependency is storing session-level records, which Projects also needs. Build the data model first, export features second.

**Confidence:** HIGH for CSV, MEDIUM for PDF (jsPDF is well-documented but generating attractive PDFs client-side takes iteration).

---

### 4. Todoist Import

**Category:** Differentiator (few timer apps do this well)
**Complexity:** Medium-High
**Value justification:** MEDIUM -- appeals to a specific power-user segment but that segment is vocal and loyal. Pomofocus has this as a premium feature.

**How competitors do it:**
- Pomofocus: Load tasks from Todoist account. Premium feature.
- Integration is typically one-way: pull tasks FROM Todoist INTO the timer app.

**Technical reality check:**
- Todoist provides REST API v2 with JavaScript SDK (`@doist/todoist-api-typescript`)
- API supports CORS for authenticated requests (`Access-Control-Allow-Origin: *`)
- PROBLEM: OAuth flow requires a backend to securely exchange the authorization code for a token (client secret must stay secret). The initial redirect works client-side, but the token exchange POST requires the client_secret parameter.
- SOLUTION: Firebase Cloud Function as a thin OAuth proxy. User authenticates via Todoist redirect, auth code sent to Cloud Function, function exchanges for token, stores encrypted token in Firestore.
- Rate limit: 1000 requests per user per 15 minutes (generous).

**What to build:**
- "Connect Todoist" button in settings
- OAuth flow: redirect to Todoist -> callback to Cloud Function -> token stored
- Import active tasks from Todoist into the task list
- Optional: sync task completion back to Todoist (bidirectional sync is significantly more complex)
- Map Todoist projects to app projects (if Projects feature is built first)

**Existing dependencies:**
- Firebase Cloud Functions (already planned for Stripe webhooks)
- Projects feature (to map Todoist projects)
- Firestore (to store OAuth tokens securely)

**Recommendation:** Build this AFTER Projects and AFTER Cloud Functions are deployed for Stripe. The Cloud Function infrastructure needed for Stripe webhooks is the same infrastructure needed for the Todoist OAuth proxy. Reuse it. Start with one-way import only. Do NOT attempt bidirectional sync in v2.0.

**Confidence:** MEDIUM -- Todoist API docs confirm CORS support for API calls, but OAuth token exchange requires backend. Cloud Functions solve this.

---

### 5. Webhook Triggers After Focus Sessions

**Category:** Differentiator (unique at this price point)
**Complexity:** Medium
**Value justification:** HIGH for power users -- connects the timer to their broader workflow. Pomofocus has this as premium. It enables Zapier/IFTTT integrations without the app needing to build each integration.

**How competitors do it:**
- Pomofocus: Webhook integration to connect to Zapier, IFTTT, etc. Fires on session completion.
- Typical payload: `{ event: "session_complete", duration: 25, project: "Work", task: "Write report", timestamp: "..." }`

**What to build:**
- Settings field: Webhook URL (user pastes their Zapier/IFTTT/custom webhook URL)
- On focus session complete: POST JSON payload to the configured URL
- Payload: timestamp, duration, mode, project name, task name, daily total
- Optional: Test webhook button (sends sample payload)
- Optional: Multiple webhook URLs (defer this -- one is enough for v2.0)

**Technical considerations:**
- Client-side fetch POST will work for most webhook receivers (Zapier, IFTTT, Make.com all accept CORS)
- Some receivers may not set CORS headers -- use `mode: 'no-cors'` as fallback (fire-and-forget, no response reading)
- Alternative: Route through Cloud Function to avoid CORS entirely (adds latency but guarantees delivery)
- Recommendation: Try client-side first, fall back to Cloud Function proxy if needed

**Existing dependencies:**
- Hooks into `complete()` function (session completion handler)
- Projects feature (to include project name in payload)
- Premium gating (only fire for premium users)

**Recommendation:** Build this in the integrations phase alongside Todoist. It is surprisingly simple (one fetch POST call) but provides outsized value. The "Test webhook" button is essential -- users need to verify their Zapier connection works.

**Confidence:** HIGH -- standard HTTP POST pattern. Pomofocus validates the approach.

---

### 6. No Ads Ever

**Category:** Table Stakes for any paid tier
**Complexity:** None (zero development work)
**Value justification:** LOW as a standalone feature, HIGH as a trust signal. This is a promise, not a feature. It says "we respect your attention."

**How competitors do it:**
- Pomofocus: "No Ads" listed as a premium benefit. Free tier shows ads.
- Forest: No ads in paid version.
- Pattern: Apps that show ads in free tier list "no ads" as premium benefit. Apps that never show ads use it as a retention message.

**What to build:**
- Nothing technical. This is a marketing/positioning feature.
- Decision required: Will the free tier show ads? If yes, "no ads" is a real premium benefit. If no, it is a promise ("we will never add ads").
- At $2/month pricing, ads in the free tier could actually hurt conversion (users leave before converting).

**Recommendation:** Do NOT add ads to the free tier. Instead, position "No Ads Ever" as a guarantee/trust signal on the pricing page. The real revenue comes from subscriptions, not ads. Adding ads to a focus/productivity app undermines the core value proposition. List it on the premium page but spend zero engineering time.

**Confidence:** HIGH -- industry-standard positioning.

---

### 7. Smart Insights (Best Focus Times, Productivity Score)

**Category:** Differentiator
**Complexity:** Medium
**Value justification:** HIGH -- this is "intelligence about your habits" which is genuinely hard for users to calculate themselves. Rize.io, Focus (Apple), and Reclaim.ai all validate that users want insights about their focus patterns.

**How competitors do it:**
- Rize.io: Analyzes shifts in productivity, focus time, and work hours to highlight patterns.
- Focus (Apple): On-device intelligence for "Productivity Insights" -- a motivating summary of recent focus activity.
- Reclaim.ai: Tracks pomodoros, breaks, and streaks to reveal productivity rhythm.
- Focus Keeper: Logs sessions with charts to identify focus patterns and optimize daily schedule.

**What to build:**
- **Best Focus Time:** Analyze `dailyMinutes` by hour-of-day to identify when the user is most productive. Requires storing session timestamps (not just daily totals).
- **Productivity Score:** Weighted composite of: sessions completed vs goal (consistency), streak length (habit), trend direction (improving or declining). Score 0-100.
- **Weekly Summary:** "You focused X hours this week, Y% more than last week. Your best focus window is 9-11am on Tuesdays."
- **Day-of-week patterns:** Heatmap or bar chart of focus minutes per day of week.

**Data model change required:**
- Current data: `dailyCounts["2026-02-07"]` and `dailyMinutes["2026-02-07"]` (daily aggregates only)
- Needed: Session-level records with timestamps: `{ startedAt, duration, dayOfWeek, hourOfDay, projectId }`
- This is the SAME data model change needed for CSV Export and Project Analytics

**Recommendation:** Build the session-level data model FIRST (it is a dependency for features 3, 7, 8, and 9). Then build Smart Insights as the showcase analytics feature -- it is the most visible and "wow-factor" analytics feature that justifies premium.

**Confidence:** MEDIUM -- the analytics logic is straightforward (averages, trends, comparisons), but presenting it in a compelling, non-overwhelming way is a UX challenge.

---

### 8. Focus Forecast (Predict Output Based on History)

**Category:** Differentiator (very few apps do this)
**Complexity:** Medium
**Value justification:** MEDIUM -- novel concept but unproven market demand. No major competitor offers this exact feature. It could be a genuine differentiator or a feature nobody uses.

**How competitors do it:**
- No direct competitor equivalent found. This appears to be a novel feature concept.
- Reclaim.ai does predictive scheduling (scheduling focus blocks), but that is calendar-based, not timer-based.
- Focus Up (iOS) has "AI insights" but details are sparse.

**What to build:**
- Based on past N weeks of data, project next week's likely output
- Simple algorithm: weighted moving average of recent weeks (more recent = higher weight)
- Display: "Based on your patterns, you are likely to complete ~X focus sessions next week (~Y hours)"
- Bonus: Show confidence range ("12-16 sessions, most likely 14")
- Bonus: Factor in day-of-week patterns (e.g., user works less on weekends)

**Implementation approach:**
- No AI/ML needed. Simple statistics:
  - Last 4 weeks of data
  - Weighted average (week -1 gets 40%, -2 gets 30%, -3 gets 20%, -4 gets 10%)
  - Day-of-week multiplier (if user consistently does 0 sessions on Sunday, forecast should reflect that)
- This is ~50-80 lines of JS logic

**Existing dependencies:**
- Session-level data with timestamps (same dependency as Smart Insights)
- Minimum 2 weeks of data before forecast is meaningful
- Need to show "Not enough data yet" state gracefully

**Recommendation:** Build this ALONGSIDE Smart Insights since they share the same data model and analytics infrastructure. Keep the algorithm simple -- a weighted moving average is sufficient and explainable. Do NOT over-engineer with ML. The value is in surfacing a prediction, not in prediction accuracy.

**Confidence:** LOW-MEDIUM -- novel feature with no competitive validation. Keep scope minimal.

---

### 9. Project Analytics (Time Per Project, Trends)

**Category:** Table Stakes (if Projects feature exists)
**Complexity:** Medium
**Value justification:** HIGH -- once users have projects, they immediately want to know "how much time did I spend on X?" This is the natural upsell from the Projects feature. Focus To-Do and Toggl Track both provide project-level analytics.

**How competitors do it:**
- Focus To-Do: Distribution of project time with trend charts across day/week/month. Gantt charts of focus time.
- Toggl Track: In-depth reports and analytics showing where time goes across projects, clients, and tasks.
- Pomofocus: Track how much time spent on each project (premium).

**What to build:**
- Time per project (total and per period: day/week/month)
- Project comparison chart (bar chart or pie chart)
- Trend over time per project (line chart)
- "Top project this week" highlight
- Filter by date range

**Implementation approach:**
- Pure client-side rendering using SVG or Canvas for charts
- Data sourced from session-level records filtered by projectId
- No charting library needed -- SVG bar/pie charts are simple to build in vanilla JS (the app already does SVG with the progress ring)

**Existing dependencies:**
- Projects feature (hard dependency -- cannot exist without projects)
- Session-level data model (same as Smart Insights, Export)
- The stats dialog UI pattern already exists and can be extended

**Recommendation:** Build this immediately after Projects. It is the "payoff" that makes Projects feel worth paying for. Projects alone is organization; Projects + Analytics is intelligence. Ship them together or in rapid succession.

**Confidence:** HIGH -- well-validated by competitors, straightforward implementation.

---

### 10. Automation Rules (If-This-Then-That)

**Category:** Anti-feature (in current form)
**Complexity:** HIGH
**Value justification:** LOW for the effort required. This is a feature that sounds exciting but is engineering-heavy and rarely used.

**How competitors do it:**
- Be Focused (macOS): Integration with Apple Shortcuts to automate workflow.
- Focused Work (iOS): In-app Shortcuts Automation that triggers actions as session progresses.
- Windows Clock: Links with Spotify and Microsoft To Do.
- Pattern: Native platform integrations (Apple Shortcuts, Android Intents) rather than custom rule engines.

**Why this is an anti-feature:**
- Building a custom rule engine ("if session completes, then do X") is a significant undertaking:
  - Trigger system (what events can trigger rules)
  - Condition system (what conditions can be checked)
  - Action system (what actions can be performed)
  - Rule storage, editing UI, error handling
  - This is essentially building a mini IFTTT inside a timer app
- The effort is disproportionate to the value. Users who want automation already have Zapier/IFTTT. The Webhook feature (Feature 5) gives them the hook they need.
- A custom rule engine creates a maintenance burden and surface area for bugs.

**What to build instead:**
- The Webhook feature (Feature 5) IS the automation feature. It delegates the rule logic to platforms built for it (Zapier, IFTTT, Make.com).
- If you must offer something: provide 2-3 hardcoded "automations" that are really just settings toggles:
  - "Auto-switch to break mode after focus" (already exists: auto-start setting)
  - "Auto-start timer when app opens" (simple setting)
  - "Auto-play audio when session starts" (simple setting)
- These feel like "automations" to the user but are trivially implemented as boolean settings.

**Recommendation:** DESCOPE the custom rule engine entirely. Replace with: (a) Webhook triggers for external automation, (b) 2-3 "smart behavior" toggles that feel like automations. This saves potentially weeks of engineering time and delivers the same user value.

**Confidence:** HIGH that descoping is correct. Building a rule engine for a timer app is over-engineering.

---

### 11. Custom Themes + Focus Sounds

**Category:** Table Stakes for premium personalization
**Complexity:** Low-Medium
**Value justification:** MEDIUM -- personalization is a proven premium driver. Forest charges for tree packs. Flocus offers customizable themes. Focus To-Do gates fresh themes behind premium.

**How competitors do it:**
- Forest: Premium ticking sounds (10 options). Premium tree/theme packs.
- Flocus: Customizable themes and layered ambient sounds.
- Focus To-Do: Various fresh themes gated behind premium. 10 timer sounds, customizable per session type.
- Lofi Bear: Premium unlocks additional sound categories.
- Focus Waves: YouTube-based background audio per session mode.

**What to build:**

**Custom Themes (Low complexity):**
- 4-6 premium color themes beyond the existing light/dark + focus/break scheme
- Implementation: Additional CSS custom property sets. Premium themes are defined in CSS but applied only when premium is active.
- Example themes: Ocean (blue tones), Forest (deep green), Sunset (warm orange), Midnight (deep purple), Monochrome (grayscale)
- No new architecture needed -- the `data-theme` attribute system already supports this. Just add more `html[data-theme="ocean"]` selectors.

**Custom Focus Sounds (Medium complexity):**
- Current state: 2 categories (Ambient, Focus Beats) with SomaFM streams. Hardcoded in `AUDIO_STATIONS` object.
- Premium approach: Add 2-4 more categories (Lofi, Classical, Nature, Deep Focus)
- SomaFM has channels that could work: Groove Salad (downtempo), Fluid (instrumental hip-hop), cliqhop (IDM), Lush (female vocals)
- Alternative: Curate free streaming URLs from other sources (must be HTTPS, CORS-enabled)
- Also add: Timer alert sound customization (5-6 different chime sounds, selectable in settings). Currently uses Web Audio API for the chime -- just need different oscillator patterns or short audio buffers.

**Existing dependencies:**
- Theme system already exists (CSS custom properties + `data-theme`)
- Audio system already exists (`AUDIO_STATIONS`, category switching, volume controls)
- Extending both systems is straightforward

**Recommendation:** Build custom themes first (very low effort, high visibility). Build additional sound categories second. Timer sound customization is a nice polish item for last. These are "feel premium" features -- they make the upgrade tangible immediately.

**Confidence:** HIGH -- well-understood patterns, minimal risk.

---

## Feature Categorization Summary

### Table Stakes (Must have for premium to feel complete)

| Feature | Complexity | Why Essential |
|---------|-----------|---------------|
| 1. Projects | Medium | Foundation for all analytics; most common premium feature in space |
| 2. Yearly Report | Medium | Expected at this price point; retention driver |
| 3. CSV Export | Low | Power users expect data portability |
| 6. No Ads Ever | None | Trust signal, zero engineering |
| 9. Project Analytics | Medium | Natural extension of Projects; expected by anyone who pays |
| 11. Custom Themes + Sounds | Low-Med | Immediate visible upgrade; personalization drives retention |

### Differentiators (Competitive advantage)

| Feature | Complexity | Why Differentiating |
|---------|-----------|---------------------|
| 5. Webhook Triggers | Medium | Few timer apps at $2/mo offer this; enables entire automation ecosystem |
| 7. Smart Insights | Medium | "Intelligence about your habits" -- hard for users to calculate themselves |
| 8. Focus Forecast | Medium | Novel feature; no direct competitor equivalent |

### Conditional (Build only if infrastructure supports it)

| Feature | Complexity | Condition |
|---------|-----------|-----------|
| 4. Todoist Import | Med-High | Only after Cloud Functions are live for Stripe |
| 3. PDF Export | Medium | Only after session-level data model is established |

### Anti-Features (Do NOT Build)

| Anti-Feature | Why Avoid | What To Do Instead |
|--------------|-----------|-------------------|
| 10. Custom automation rule engine | Weeks of engineering, low usage, Zapier/IFTTT already do this | Webhook triggers (Feature 5) + 2-3 "smart behavior" toggles |
| Bidirectional Todoist sync | Complex conflict resolution, flaky UX | One-way import only |
| AI-powered insights | Buzzword; simple statistics are sufficient and explainable | Weighted averages, trend calculations |
| Charting library dependency | Adds bundle size to a zero-dependency app | Hand-rolled SVG charts (app already does SVG) |
| Per-session mood tracking | Scope creep; surveys interrupt flow | Infer patterns from data, not surveys |
| Team/collaboration features | Different product entirely; complexity explosion | Stay focused on individual productivity |
| Spotify/Apple Music integration | Requires OAuth, premium accounts, API costs, DRM issues | SomaFM and curated free streams |
| Complex notification system | Push notification spam reduces trust | Keep existing simple notification on completion |

---

## Feature Dependencies (Build Order)

```
Layer 0: Infrastructure (no premium features depend on other premium features)
├── Stripe Integration + Cloud Functions
├── Feature gating framework
└── Premium status verification

Layer 1: Data Foundation
├── Session-level data model change
│   (needed by: Export, Smart Insights, Focus Forecast, Project Analytics)
└── Projects feature
    (needed by: Project Analytics, Todoist mapping, Webhook payload)

Layer 2: Core Premium Features
├── Project Analytics (needs: Projects + session data)
├── Custom Themes (needs: premium gating only)
├── Custom Sounds (needs: premium gating only)
├── CSV Export (needs: session data)
└── Webhook Triggers (needs: premium gating + session completion hook)

Layer 3: Analytics Suite
├── Smart Insights (needs: session data with timestamps)
├── Focus Forecast (needs: 2+ weeks of session data)
└── Yearly Report (needs: session data + project data for full richness)

Layer 4: Integrations
├── Todoist Import (needs: Cloud Functions + Projects)
└── PDF Export (needs: session data + jsPDF dependency)
```

---

## Which Features Justify Premium Alone?

Ranked by "would a user pay $2/month for this single feature?":

1. **Projects + Project Analytics** (together) -- YES. Organization + visibility into time spent is the core value. This is what Pomofocus sells.
2. **Smart Insights** -- MAYBE. Compelling but not urgent. Users like knowing their best focus time, but it does not change their daily workflow.
3. **Custom Themes + Sounds** -- MAYBE for casual users. Personalization drives emotional attachment. Low-cost to build, decent conversion driver.
4. **CSV Export** -- YES for freelancers/consultants who bill by hour. Niche but strongly valued.
5. **Webhook Triggers** -- YES for power users. The "I can connect this to everything" feeling is premium.
6. **Yearly Report** -- NO alone, but strong retention feature. Users want to see their year-end data.
7. **Focus Forecast** -- NO alone. Novel but unproven.
8. **Todoist Import** -- NO alone, but removes friction for a specific audience.

**Bottom line:** Projects + Analytics is the anchor feature. Everything else is supporting cast.

---

## MVP Premium Recommendation

For the initial premium launch, prioritize features that:
1. Are immediately visible (user feels the upgrade)
2. Have low risk (well-understood patterns)
3. Create the data foundation for future features

**Premium MVP (launch with these):**
1. Projects (organization -- the anchor)
2. Project Analytics (payoff for projects)
3. Custom Themes (instant visual upgrade)
4. Custom Sounds (immediate audio upgrade)
5. CSV Export (data portability)
6. No Ads Ever (trust signal)

**Phase 2 Premium (add these post-launch):**
7. Smart Insights
8. Yearly Report
9. Webhook Triggers

**Phase 3 Premium (add if traction justifies):**
10. Focus Forecast
11. Todoist Import
12. PDF Export

**Descoped entirely:**
- Custom automation rule engine (replaced by Webhooks + smart toggles)

---

## Critical Data Model Decision

The single most important technical decision for premium features is **introducing session-level data records**. Currently the app stores daily aggregates only:

```
Current: { dailyCounts: { "2026-02-07": 5 }, dailyMinutes: { "2026-02-07": 125 } }
Needed:  sessions: [{ id, startedAt, duration, projectId, taskId, hourOfDay, dayOfWeek }]
```

This change unlocks: CSV Export, Smart Insights, Focus Forecast, Project Analytics, Webhook payloads, and Yearly Report detail.

**Build this data model change as part of Layer 1**, before any analytics features. Retroactive data is impossible -- the sooner session records are stored, the richer the analytics become.

---

## Sources

- [Pomofocus Premium Features](https://pomofocus.io/) -- Projects, yearly reports, CSV, webhooks, Todoist, no ads
- [Focus To-Do App Store](https://apps.apple.com/us/app/focus-to-do-pomodoro-tasks/id1258530160) -- Project analytics, themes, sounds
- [Toggl Track Blog](https://toggl.com/blog/best-work-timers) -- Time tracking analytics patterns
- [Rize.io](https://rize.io/) -- Productivity insights and analytics design
- [Reclaim.ai Pomodoro Guide](https://reclaim.ai/blog/best-pomodoro-timer-apps) -- Feature comparison landscape
- [Todoist Developer API](https://developer.todoist.com/guides/) -- REST API v2, CORS support, OAuth flow
- [jsPDF GitHub](https://github.com/parallax/jsPDF) -- Client-side PDF generation
- [SomaFM Channels](https://somafm.com/listen/) -- Available streaming categories
- [Focus Up: AI Focus Timer](https://apps.apple.com/us/app/focus-up-ai-focus-timer/id6739946418) -- AI insights in timer apps
- [Focused Work App](https://focusedwork.app/) -- In-app automation via Shortcuts
- [Zapier Pomodoro Guide](https://zapier.com/blog/best-pomodoro-apps/) -- Integration patterns
- [IFTTT Webhooks](https://ifttt.com/maker_webhooks) -- Webhook integration for automation

**Confidence notes:**
- Features 1, 2, 3, 5, 6, 9, 11: HIGH confidence (verified across multiple competitors)
- Feature 4 (Todoist): MEDIUM confidence (OAuth backend requirement verified via API docs; CORS confirmed for API calls)
- Feature 7 (Smart Insights): MEDIUM confidence (competitors validate demand; implementation is standard statistics)
- Feature 8 (Focus Forecast): LOW-MEDIUM confidence (novel feature; no competitive validation)
- Feature 10 (Automation Rules): HIGH confidence that descoping is correct
