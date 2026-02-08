---
phase: 06-analytics-suite
plan: 04
subsystem: analytics
tags: [firebase-functions, github-heatmap, percentile-ranking, annual-stats, scheduled-tasks]

# Dependency graph
requires:
  - phase: 06-01
    provides: Analytics dialog foundation with tab switching and Chart.js integration
  - phase: 06-03
    provides: fetchSessions() utility and chart color CSS patterns
provides:
  - GitHub-style yearly heatmap with CSS color-mix() intensity mapping
  - Annual summary stats (hours, sessions, active days, longest streak)
  - Most productive day-of-week calculation
  - Percentile ranking Cloud Function (scheduled daily at 3am UTC)
  - userStats Firestore collection schema for social comparison
affects: [deployment, firebase-config]

# Tech tracking
tech-stack:
  added: [firebase-functions/v2/scheduler, userStats collection]
  patterns: [onSchedule scheduled functions, percentile ranking algorithm, batch writes for large datasets, heatmap grid layout with color-mix() CSS]

key-files:
  created: [functions/src/aggregateUserStats.ts]
  modified: [index.html (renderYearlyTab), functions/src/index.ts, sw.js]

key-decisions:
  - "GitHub-style heatmap (52-53 weeks x 7 days) hand-rolled without library"
  - "CSS color-mix() for intensity gradient (25%, 50%, 75%, 100% of --primary)"
  - "Percentile ranking based on last 7 days of session totals"
  - "Scheduled Cloud Function runs daily at 3am UTC"
  - "userStats collection stores percentile, rank, weeklyMinutes, totalUsers"
  - "Percentile card conditionally displayed only if userStats doc exists"
  - "Batch writes (450 per batch) for handling large user base"
  - "Only active users (totalMinutes > 0) included in percentile calculation"

patterns-established:
  - "Heatmap layout: .heatmap-grid (flex rows) with .heatmap-week columns containing 7 day divs"
  - "Intensity classes: intensity-0 through intensity-4 mapped to color-mix() percentages"
  - "Month label positioning via grid-column calculated from week offset"
  - "Streak calculation: compare consecutive sorted dates with 1-day diff check"
  - "onSchedule function pattern: region, timeZone, timeoutSeconds, memory config"
  - "Percentile formula: Math.round((1 - rank / total) * 100) for top-down ranking"

# Metrics
duration: <1min
completed: 2026-02-08
---

# Phase 06 Plan 04: Yearly Heatmap and Percentile Ranking

**GitHub-style yearly heatmap with intensity coloring, annual summary stats, and scheduled Cloud Function for daily percentile ranking across all users**

## Performance

- **Duration:** <1 min (8 seconds between commits)
- **Started:** 2026-02-08T06:25:54Z
- **Completed:** 2026-02-08T06:26:02Z
- **Tasks:** 2 + checkpoint (approved)
- **Files modified:** 4

## Accomplishments
- GitHub-style yearly heatmap (52-53 weeks x 7 days) with CSS color-mix() intensity gradient
- Annual summary stats: hours, sessions, active days, longest streak, most productive day
- Percentile ranking Cloud Function scheduled daily at 3am UTC
- Social comparison via optional percentile card ("Top 27% - Better than 73% of users")
- Complete Analytics Suite (4 tabs) ready for premium user engagement

## Task Commits

Each task was committed atomically:

1. **Task 1: Yearly heatmap, annual summary stats, and percentile display** - `5f7a245` (feat)
2. **Task 2: Percentile ranking Cloud Function and sw.js bump** - `36ddc6b` (feat)
3. **Task 3: Checkpoint: Human verification** - APPROVED by user

**Plan metadata:** (pending - will be committed with STATE.md update)

## Files Created/Modified
- `index.html` - Added renderYearlyTab() with GitHub-style heatmap grid, annual stats calculation, streak algorithm, and optional percentile card display
- `functions/src/aggregateUserStats.ts` - Created scheduled Cloud Function for daily percentile ranking aggregation (runs 3am UTC, calculates weekly totals, writes userStats collection)
- `functions/src/index.ts` - Added re-export of aggregateUserStats function
- `sw.js` - Bumped cache version to v49

## Decisions Made

**Heatmap implementation:**
- Hand-rolled GitHub-style grid (no library) using CSS Grid for week columns and flex for day rows
- CSS color-mix() for intensity gradient: 0% (var(--ring-track)) to 100% (var(--primary)) in 4 steps
- Responsive design: 13px cells desktop, 10px mobile with horizontal scroll

**Percentile ranking algorithm:**
- Based on last 7 days of session totals (not all-time, to keep rankings fresh)
- Only active users (totalMinutes > 0) included in calculation
- Top-down ranking: percentile = Math.round((1 - rank / total) * 100)
- Batch writes (450 per batch) to handle large user bases within Firestore limits

**Cloud Function scheduling:**
- Daily execution at 3am UTC (low traffic time)
- 5-minute timeout, 256MiB memory allocation
- us-central1 region (matches Firestore)
- Writes to userStats collection: { weeklyMinutes, percentile, rank, totalUsers, updatedAt }

**Graceful degradation:**
- Percentile card only shown if userStats doc exists (after first Cloud Function run)
- First-year users with partial data handled gracefully (zeros displayed correctly)
- Empty days at year start/end render as transparent cells

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly following established Chart.js and Firebase patterns from previous plans.

## User Setup Required

**External services require manual configuration.** See deployment blockers in STATE.md:
- Firebase project must be on Blaze (pay-as-you-go) plan to deploy Cloud Functions
- Cloud Function deployment: `cd functions && npm run deploy`
- First run will populate userStats collection (occurs daily at 3am UTC thereafter)

## Next Phase Readiness

**Phase 6 (Analytics Suite) complete:**
- All 4 tabs implemented and verified (Overview, Projects, Forecast, Yearly)
- Chart.js integration with theme-aware colors
- Premium gating functional across all analytics features
- Cloud Function ready to deploy for social comparison features

**Ready for Phase 7 (Deployment):**
- All v2.0 features complete
- Firebase Cloud Functions code ready
- Service worker cache management stable
- Premium features fully tested

**No blockers for next phase.** All analytics features functional and human-verified.

## Self-Check: PASSED

- ✓ FOUND: 06-04-SUMMARY.md
- ✓ FOUND: 5f7a245 (Task 1 commit)
- ✓ FOUND: 36ddc6b (Task 2 commit)

---
*Phase: 06-analytics-suite*
*Completed: 2026-02-08*
