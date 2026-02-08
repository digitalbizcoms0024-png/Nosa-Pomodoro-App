---
phase: 06-analytics-suite
plan: 03
subsystem: analytics
tags: [analytics, visualization, projects, forecast, charts, predictions]

dependency_graph:
  requires:
    - "06-01: Chart.js integration and base infrastructure"
    - "06-02: Overview tab (productivity score, weekly summary, focus hours)"
    - "state.projects: project name lookup"
  provides:
    - "renderProjectsTab(): project time allocation donut chart + weekly trends"
    - "renderForecastTab(): day-of-week prediction model with confidence display"
    - "calculateForecast(): weighted prediction algorithm"
  affects:
    - "renderAnalyticsTab(): routes 'projects' and 'forecast' tabs"

tech_stack:
  added:
    - "Chart.js doughnut chart type for project allocation"
    - "Chart.js line chart type for weekly trends"
    - "Exponential weighted average prediction model"
  patterns:
    - "Donut chart with percentage tooltips and bottom legend"
    - "Multi-dataset line chart (top 5 projects only)"
    - "Insufficient data handling with encouraging messages"
    - "Confidence scoring based on data point count"
    - "Today highlighting in forecast visualization"

key_files:
  created: []
  modified:
    - path: "index.html"
      changes: "Added renderProjectsTab(), calculateForecast(), renderForecastTab(), analytics CSS"
    - path: "sw.js"
      changes: "Bumped cache version to v51"

decisions:
  - id: "forecast-weights"
    choice: "Exponential weights [0.4, 0.3, 0.2, 0.1] with most recent week weighted highest"
    rationale: "Recent patterns are better predictors of future behavior than older patterns"
    alternatives: ["Equal weights", "Linear decay"]
  - id: "forecast-confidence"
    choice: "HIGH (20+), MEDIUM (10-19), LOW (<10) data points"
    rationale: "Gives users clear expectation of prediction reliability"
    alternatives: ["Percentage-based confidence", "No confidence display"]
  - id: "forecast-minimum"
    choice: "7+ unique days required to show forecast"
    rationale: "Need coverage across week to predict day-of-week patterns"
    alternatives: ["3+ days", "Show any data available"]
  - id: "project-trend-limit"
    choice: "Top 5 projects only for trend chart"
    rationale: "More than 5 lines becomes visually cluttered"
    alternatives: ["All projects", "Top 3"]
  - id: "color-palette"
    choice: "8 colors: chart tokens + 4 vibrant colors (#e056fd, #7ed6df, #ffbe76, #badc58)"
    rationale: "Provides visual variety for multiple projects while staying theme-aware"
    alternatives: ["Only theme tokens", "Random colors"]

metrics:
  duration_minutes: 4
  completed_date: "2026-02-08"
  tasks_completed: 2/2
  commits: 2
  files_changed: 2
  lines_added: 531
  lines_removed: 1
---

# Phase 6 Plan 3: Projects and Forecast Tabs Summary

**One-liner:** Projects tab with donut chart and weekly trends, Forecast tab with weighted day-of-week prediction model and confidence scoring

## Overview

Added two analytics tabs completing the core visualization suite: Projects tab shows WHERE time goes (allocation donut) and HOW it changes (weekly trends), while Forecast tab predicts next week's output using weighted day-of-week patterns from the past 4 weeks.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Projects tab — donut and trend charts | 209ca7a | index.html |
| 2 | Forecast tab — prediction model | f72f12c | index.html, sw.js |

## Implementation Details

### Projects Tab

**Donut Chart:**
- Aggregates total time per project from last 4 weeks
- 8-color palette: theme tokens + vibrant colors
- Tooltips show minutes + percentage
- Bottom legend with point style
- Empty state for no sessions

**Weekly Trend Chart:**
- Groups sessions by week + project
- Shows top 5 projects only (avoid clutter)
- Line chart with tension 0.3, pointRadius 4
- X-axis: week labels (M/D format)
- Y-axis: minutes with grid

### Forecast Tab

**Prediction Model (calculateForecast):**
- Groups sessions by day-of-week and week index
- Applies exponential weights: [0.4, 0.3, 0.2, 0.1] (most recent = highest)
- Week 0 (most recent) = 40% weight
- Week 3 (oldest) = 10% weight
- Returns weighted average per day-of-week

**Confidence Scoring:**
- HIGH: 20+ data points
- MEDIUM: 10-19 data points
- LOW: <10 data points
- Based on total non-zero week-day combinations

**Visualization:**
- Bar chart with 7 days (starting from today)
- Today highlighted in primary color
- Confidence badge (color-coded)
- Day-by-day breakdown list
- Forecast note explaining methodology

**Insufficient Data Handling:**
- Requires 7+ unique days to show forecast
- Encouraging message with emoji
- Tells user how many more days needed
- No broken chart, graceful degradation

### CSS Additions

- `.analytics-subtitle`: secondary text for chart descriptions
- `.analytics-empty`: centered empty state
- `.project-chart-container`: spacing for project charts
- `.forecast-header`: flex header with title + badge
- `.confidence-badge`: color-coded confidence levels
- `.forecast-chart-container`: forecast chart wrapper
- `.forecast-details`: breakdown list container
- `.forecast-today`: emphasis on today
- `.forecast-insufficient`: empty state layout
- `.forecast-encourage`: motivating message box

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

### Projects Tab
- ✅ Donut chart renders with project time allocation
- ✅ Tooltips show minutes and percentages
- ✅ Weekly trend line chart shows top 5 projects
- ✅ Empty state displays for no sessions
- ✅ Theme-aware colors applied correctly

### Forecast Tab
- ✅ Bar chart displays 7 days starting from today
- ✅ Confidence badge shows HIGH/MEDIUM/LOW correctly
- ✅ Today highlighted in primary color
- ✅ Insufficient data shows encouraging message
- ✅ Day-by-day breakdown list renders
- ✅ Forecast note explains methodology

### Service Worker
- ✅ Cache version bumped to v51

## Success Criteria

- [x] Projects tab: donut chart + weekly trend line chart
- [x] Forecast tab: 7-day bar chart with weighted predictions + confidence badge
- [x] Insufficient data handling for forecast (7 unique days minimum)
- [x] sw.js cache version bumped

All success criteria met.

## Self-Check

Verifying implementation claims:

### File Existence Check
```bash
[ -f "/Users/user/Documents/Projects/pomodoro/index.html" ] && echo "FOUND: index.html" || echo "MISSING: index.html"
[ -f "/Users/user/Documents/Projects/pomodoro/sw.js" ] && echo "FOUND: sw.js" || echo "MISSING: sw.js"
```

### Commit Hash Verification
```bash
git log --oneline --all | grep -q "209ca7a" && echo "FOUND: 209ca7a" || echo "MISSING: 209ca7a"
git log --oneline --all | grep -q "f72f12c" && echo "FOUND: f72f12c" || echo "MISSING: f72f12c"
```

### Function Existence Check
```bash
grep -q "function renderProjectsTab" /Users/user/Documents/Projects/pomodoro/index.html && echo "FOUND: renderProjectsTab" || echo "MISSING: renderProjectsTab"
grep -q "function calculateForecast" /Users/user/Documents/Projects/pomodoro/index.html && echo "FOUND: calculateForecast" || echo "MISSING: calculateForecast"
grep -q "function renderForecastTab" /Users/user/Documents/Projects/pomodoro/index.html && echo "FOUND: renderForecastTab" || echo "MISSING: renderForecastTab"
```

Running self-check...

**Results:**
- ✅ FOUND: index.html
- ✅ FOUND: sw.js
- ✅ FOUND: 209ca7a
- ✅ FOUND: f72f12c
- ✅ FOUND: renderProjectsTab
- ✅ FOUND: calculateForecast
- ✅ FOUND: renderForecastTab

## Self-Check: PASSED

All files exist, commits are in history, and functions are implemented as specified.

## Next Phase Readiness

**Ready for:** 06-04 (Yearly Heatmap)

**Dependencies satisfied:**
- Chart.js infrastructure in place
- Analytics dialog and tab system working
- Session data fetching utilities available

**No blockers.**
