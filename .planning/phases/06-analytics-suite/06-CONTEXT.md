# Phase 6: Analytics Suite - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Premium users gain actionable productivity insights from their accumulated session data — project analytics, productivity score, weekly summaries, focus forecast, and yearly report. This is the retention driver: features that make premium worth keeping month after month.

All analytics require session-level data from Phase 4. Project analytics requires the Projects feature from Phase 4. All analytics are premium-gated via Phase 3's requirePremium() framework.

</domain>

<decisions>
## Implementation Decisions

### Visualization style
- Chart library: use a lightweight library loaded from CDN (e.g., Chart.js or uPlot) — not pure CSS/SVG
- Chart type selection: Claude's discretion based on data type (donut vs bar vs line)
- Charts must be theme-aware — use colors from the active theme (Ocean, Forest, etc.), each theme needs chart color tokens via CSS custom properties
- Trend visualization approach: Claude's discretion (line chart, bar chart, or sparkline — pick what fits)

### Productivity score
- Multi-factor score (0-100): factors in total focus time + consistency (streaks, daily goals) + session quality (longer sessions score higher)
- Display as circular gauge with color gradient (red→yellow→green), prominent like a fitness tracker
- Comparison: self-comparison always shown ("Up 12 from last week") PLUS optional percentile ranking against other users ("Better than 73% of users") — uses aggregate Firestore data
- Motivating tone for labels: "Crushing it!" (90+), "On fire" (70+), "Building momentum" (50+), etc. — encouraging, not judgmental

### Focus Forecast
- Prediction model: day-of-week patterns weighted by recency (predict Monday based on past Mondays, but recent weeks count more)
- History window: 4 weeks of data — responsive to habit changes
- Confidence display: Claude's discretion (range or single number + confidence label)
- Insufficient data handling: Claude's discretion on threshold and approach (show with disclaimer vs hide until enough data)

### Report layout
- Single analytics dialog with tabs: Overview, Projects, Forecast, Yearly — everything in one place
- Weekly summary compares this week vs last week AND vs 4-week average — shows both for fuller context, with arrows showing up/down changes
- "Best focus hours" shows hour-of-day visualization PLUS actionable text recommendation ("You focus best between 9-11am")
- Yearly heatmap style: Claude's discretion (GitHub-style grid vs calendar grid)

### Claude's Discretion
- Chart type selection for project allocation and trends
- Heatmap style for yearly report
- Confidence display format for forecast
- Insufficient data threshold and UX for forecast
- Exact spacing, typography, and layout within the tabbed dialog
- Chart color palette per theme (must use CSS custom properties)
- Percentile calculation approach (requires Cloud Function or client-side aggregation)

</decisions>

<specifics>
## Specific Ideas

- Productivity score gauge should feel like a fitness tracker — prominent, visually satisfying
- Labels should be motivating/encouraging, not clinical — "Crushing it!" not "Excellent"
- Best focus hours insight should be actionable — tell the user WHEN to schedule focus time
- Weekly comparison with both last week and 4-week average gives context (one bad week doesn't feel catastrophic)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-analytics-suite*
*Context gathered: 2026-02-08*
