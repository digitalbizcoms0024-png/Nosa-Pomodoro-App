---
phase: 06-analytics-suite
plan: 01
subsystem: analytics
tags: [analytics, chart.js, premium, foundation]
dependency_graph:
  requires: [premium-gating, firebase-sessions, theming-system]
  provides: [analytics-dialog, chart-infrastructure, chart-colors, session-data-utils]
  affects: [toolbar-ui]
tech_stack:
  added: [chart.js-cdn]
  patterns: [chart-instance-management, theme-aware-charts, premium-gating, tabbed-dialogs]
key_files:
  created: []
  modified: [index.html, sw.js]
decisions:
  - id: chart-library
    choice: Chart.js from CDN
    rationale: Industry-standard charting library, zero build step, global Chart object
    alternatives: [recharts (React-only), d3 (too low-level), plotly (heavy)]
  - id: chart-colors
    choice: CSS custom properties per theme
    rationale: Theme changes automatically propagate to charts via getChartColors()
    alternatives: [hardcoded colors (not theme-aware), JS color mapping (maintenance burden)]
  - id: memory-management
    choice: chartInstances object with destroy-before-create pattern
    rationale: Prevents memory leaks from re-rendering charts
    alternatives: [new Chart every time (memory leak), manual destroy tracking (error-prone)]
  - id: chart-tokens-in-focus
    choice: Chart color CSS tokens only in [data-mode="focus"] blocks
    rationale: Charts render during both focus and break, but focus tokens are always available
    alternatives: [duplicate in break blocks (redundant), separate chart themes (over-engineered)]
metrics:
  duration_seconds: 265
  completed_date: 2026-02-08
---

# Phase 6 Plan 1: Analytics Dialog Foundation

**One-liner:** Chart.js infrastructure with theme-aware colors, tabbed dialog shell (4 empty panels), session data fetching utilities, and memory-safe chart lifecycle management

## Overview

Established the foundation for the analytics suite by integrating Chart.js, creating theme-aware chart color tokens for all 7 themes, building a tabbed dialog with 4 empty panels (Overview, Projects, Forecast, Yearly), implementing session data fetching utilities, and setting up chart instance management to prevent memory leaks.

This plan provides the infrastructure that all future analytics tabs will build upon — no charts are rendered yet, but the plumbing is ready.

## Tasks Completed

| Task | Name                                                          | Commit  | Files Modified      |
| ---- | ------------------------------------------------------------- | ------- | ------------------- |
| 1    | Chart.js CDN, chart color CSS tokens, analytics dialog HTML   | c40ff21 | index.html          |
| 2    | Tab switching JS, chart management, data utilities, toolbar   | 312f309 | index.html, sw.js   |

## Implementation Details

### Chart.js Integration
- Added Chart.js CDN script (`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`) before Firebase scripts
- Chart object available globally with zero build configuration

### Theme-Aware Chart Colors
Added 6 chart color CSS custom properties to all 7 themes (light, dark, ocean, forest, sunset, lavender, charcoal):
- `--chart-primary`: Primary data series color (matches theme primary)
- `--chart-secondary`: Secondary data series color
- `--chart-accent`: Accent/highlight color
- `--chart-grid`: Grid line color (matches theme border)
- `--chart-text`: Chart label text color
- `--chart-success`: Success/positive indicator color

**Design decision:** Chart tokens added only to `[data-mode="focus"]` blocks. Charts are rendered from focus or break mode, and focus tokens are always in scope. This avoids redundant duplication in break mode blocks.

### Analytics Dialog HTML
4-tab dialog structure with:
- **Header:** Title + close button
- **Tab bar:** 4 buttons (Overview, Projects, Forecast, Yearly) with active state
- **Body:** 4 panels (only one visible at a time), each with loading placeholder
- **CSS:** 600px wide dialog, sticky tab bar, horizontal tab navigation with primary-color underline on active tab

### Chart Instance Management
Implemented memory-safe chart lifecycle:
```js
const chartInstances = {};

function renderChart(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy(); // Prevent memory leak
  }
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, config);
  return chartInstances[canvasId];
}
```

**Pattern:** All future chart renders MUST use `renderChart()` instead of `new Chart()` directly. This ensures old chart instances are destroyed before creating new ones.

### Session Data Utilities
- `getChartColors()`: Reads CSS custom properties and returns color object for Chart.js config
- `fetchSessions(startDate, endDate)`: Queries Firestore sessions subcollection with date range
- `getWeekBounds(weeksAgo)`: Calculates week start/end dates for week-based queries

### Tab Switching Logic
- `switchAnalyticsTab(tabName)`: Updates active tab button class and shows/hides corresponding panel
- Tab buttons wired to `switchAnalyticsTab()` via click listeners
- Panels use `display: block/none` for show/hide
- Lazy rendering hook: if panel has `.analytics-loading`, future tab implementations will replace with real content

### Toolbar Integration
Added Analytics button to toolbar (between Stats and Leaderboard):
- SVG icon: bar-chart with horizontal lines (distinct from Stats vertical bars)
- Premium-gated via `requirePremium('Analytics')` — free users see upgrade prompt
- Opens analytics dialog on click

### Dialog UX
- Close methods: X button, Escape key, backdrop click
- Escape key priority order updated (analytics before export dialog)

## Deviations from Plan

None — plan executed exactly as written.

## Verification

Verified:
1. Chart.js loads from CDN without errors (`typeof Chart !== 'undefined'` returns true)
2. Chart color CSS properties exist for all 7 themes (`getComputedStyle(document.documentElement).getPropertyValue('--chart-primary')` returns color)
3. Analytics dialog HTML exists in DOM (`document.getElementById('analyticsDialog')` is not null)
4. Analytics button visible in toolbar with bar-chart icon
5. Premium gating works (free users see upgrade prompt)
6. Dialog opens, tabs switch, panels show/hide correctly
7. Close via X button, Escape key, and backdrop click all work
8. Service worker cache bumped to v49

## Next Phase Readiness

**Overview Tab (Plan 06-02) ready to proceed:**
- Chart.js loaded
- Chart colors available via `getChartColors()`
- Session data utilities ready (`fetchSessions`, `getWeekBounds`)
- Chart instance management ready (`renderChart`)
- Analytics dialog shell ready with empty Overview panel

**Future tabs ready:**
- Projects tab (Plan 06-03): Will use same chart infrastructure
- Forecast tab (Plan 06-04): Will use same data utilities
- Yearly tab (Plan 06-05): Will use same chart colors and instance management

## Dependencies

**Inherited from previous phases:**
- Premium gating system (Phase 5): `requirePremium()` guards analytics access
- Firebase sessions subcollection (Phase 4): Source data for all analytics queries
- Theming system (Phase 5): 7 themes with chart color tokens

**Provides to next plans:**
- Analytics dialog foundation
- Chart.js infrastructure
- Theme-aware chart colors
- Session data fetching utilities
- Chart instance lifecycle management

## Known Issues

None. All functionality verified.

## Self-Check: PASSED

**Files created/modified:**
- ✓ index.html modified (Chart.js CDN, chart colors, analytics dialog HTML, analytics JS)
- ✓ sw.js modified (cache version bumped to v49)

**Commits exist:**
- ✓ c40ff21 (Task 1: Chart.js CDN, chart colors, analytics dialog HTML)
- ✓ 312f309 (Task 2: Analytics JS, tab switching, chart management, toolbar button)

**Key patterns verified:**
- ✓ Chart.js loaded from CDN
- ✓ All 7 themes have 6 chart color CSS tokens each
- ✓ Analytics dialog with 4 tab panels exists
- ✓ chartInstances object and renderChart function exist
- ✓ getChartColors, fetchSessions, getWeekBounds utility functions exist
- ✓ Premium gating applied to analytics button
- ✓ Tab switching logic implemented

All claims verified. Ready for Plan 06-02 (Overview Tab).
