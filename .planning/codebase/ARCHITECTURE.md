# Architecture

**Analysis Date:** 2026-02-06

## Pattern Overview

**Overall:** Single-Page Application (SPA) with Monolithic State Management

**Key Characteristics:**
- All code lives in a single HTML file with embedded CSS and JavaScript
- Centralized state object manages all application state
- Immediate-mode UI updates via direct DOM manipulation
- Vanilla JavaScript (no frameworks)
- Service worker for offline caching and PWA features
- Firebase integration for authentication and leaderboard persistence

## Layers

**Presentation Layer (UI):**
- Purpose: HTML structure, CSS styling, DOM manipulation, visual feedback
- Location: `index.html` (lines 1-1550)
- Contains: HTML markup, CSS custom properties for theming, inline SVG icons
- Depends on: State layer for data to render
- Used by: User interactions trigger DOM event listeners

**State Layer (Logic):**
- Purpose: Manage application state, business logic, timer calculations
- Location: `index.html` (lines 1578-2733, within `<script>` tag)
- Contains: State object, all functions (timer, storage, stats, auth)
- Depends on: Storage layer, Firebase SDK
- Used by: Presentation layer reads state; Presentation triggers state mutations via event handlers

**Storage Layer (Data Persistence):**
- Purpose: Load/save application data to localStorage
- Location: `index.html` (lines 1682-1724)
- Contains: Functions: `loadSettings()`, `saveSettings()`, `loadStats()`, `saveStats()`, `loadTheme()`, `saveTheme()`, `loadTasks()`, `saveTasks()`
- Depends on: Browser localStorage API
- Used by: State layer during init and after mutations

**External Services Layer:**
- Purpose: Interact with Firebase Auth and Firestore
- Location: `index.html` (lines 1560-1577 Firebase init; auth functions ~2150-2330)
- Contains: Firebase authentication, Firestore queries for leaderboard
- Depends on: Firebase SDK loaded from CDN
- Used by: State layer for user authentication, stats sync, leaderboard data

**Service Worker:**
- Purpose: Offline caching, PWA capabilities
- Location: `sw.js`
- Contains: Cache management, network-first strategy
- Depends on: Cache API
- Used by: Browser for offline access, app installation

## Data Flow

**Application Startup:**

1. HTML loads, including Firebase SDK from CDN
2. `init()` is called at end of script (line 2733)
3. Load all localStorage data: settings, stats, tasks, theme
4. Initialize state with loaded data and defaults
5. Call `updateAll()` to render initial UI
6. Register service worker for offline support
7. Set up event listeners for user interactions

**Timer Execution (Start → Complete):**

1. User clicks Start button → `start()` called
2. `start()` sets `state.status = 'running'`, calculates `state.endTime`
3. Start `setInterval(tick, 250)` to check time remaining
4. Each `tick()`: calculate elapsed time, update progress ring, update display
5. When `state.timeRemaining <= 0`: call `complete()`
6. `complete()`: update stats, save to localStorage, play notification, switch mode
7. If `autoStart` enabled: automatically call `start()` for next mode

**User Interaction → State → Render:**

1. User clicks button/input (e.g., Start, mode tab, settings)
2. Event listener calls handler function (e.g., `start()`, `toggleTask()`)
3. Handler mutates `state` object properties
4. Handler calls `saveSettings()` or `saveStats()` if data persisted
5. Handler calls `updateAll()` or specific render functions
6. Render functions update DOM based on current state

**Theme Switching:**

1. User clicks theme toggle button
2. `themeToggle.addEventListener` triggers theme change
3. Determines new theme, updates `root.dataset.theme`
4. Calls `saveTheme()` to persist
5. CSS custom properties automatically re-evaluate via cascade

**Mode Switching:**

1. User clicks mode tab or timer completes
2. `switchMode(newMode)` called
3. Updates `state.mode`, recalculates `state.totalTime`, `state.timeRemaining`
4. Calls `updateModeIndicator()` to update DOM and CSS `data-mode`
5. CSS colors update via custom properties bound to `data-mode` and `data-theme`

**Stats Update & Firestore Sync:**

1. Focus session completes
2. `complete()` increments daily/total stats in `state.stats`
3. `saveStats()` persists to localStorage
4. If user authenticated: `updateFirestoreOnComplete()` writes to Firestore
5. `loadLeaderboard()` fetches top users from Firestore and renders

## State Management

**Central State Object** (`state`, line 1666):
```
{
  mode: 'focus' | 'break' | 'longbreak',
  status: 'idle' | 'running' | 'paused',
  timeRemaining: number (seconds),
  totalTime: number (seconds),
  endTime: number (timestamp when timer should finish),
  intervalId: number | null (setInterval ID),
  completedInCycle: number (sessions before long break),
  settings: { focusDuration, breakDuration, longBreakDuration, ... },
  stats: { totalPomodoros, dailyCounts, dailyMinutes, bestStreak },
  user: Firebase user object | null,
  userMenuOpen: boolean,
  tasks: [{ id, title, completed }]
}
```

**Storage Keys** (line 1584-1589):
- `pomodoro-settings` → localStorage
- `pomodoro-stats` → localStorage
- `pomodoro-theme` → localStorage
- `pomodoro-tasks` → localStorage

## Key Abstractions

**Timer Model:**
- Purpose: Encapsulate timer state and calculations
- State properties: `mode`, `status`, `timeRemaining`, `totalTime`, `endTime`, `intervalId`
- Functions: `start()`, `pause()`, `reset()`, `complete()`, `tick()`, `switchMode()`
- Pattern: Direct state mutation + interval-based polling

**Stats Model:**
- Purpose: Track pomodoro completion data for insights
- State properties: `stats.totalPomodoros`, `stats.dailyCounts[dateKey]`, `stats.dailyMinutes[dateKey]`, `stats.bestStreak`
- Functions: `updateStats()`, `updateBestStreak()`, `updateTodayProgress()`, `updateWeeklyChart()`, `calculateStreak()`
- Pattern: Date-keyed maps for daily aggregation

**Task Model:**
- Purpose: Lightweight task list for focus sessions
- State array: `tasks: [{ id: string, title: string, completed: boolean }]`
- Functions: `addTask()`, `toggleTask()`, `deleteTask()`, `renderTasks()`
- Pattern: In-memory array, persisted to localStorage

**Authentication Model:**
- Purpose: Google Sign-In integration with Firestore sync
- Firebase APIs: `fbAuth.onAuthStateChanged()`, `fbDb.collection('users').doc(uid).set()`
- Functions: `signInWithGoogle()`, `updateFirestoreOnComplete()`, `loadLeaderboard()`, `pullStatsFromFirestore()`
- Pattern: Firebase listeners for reactive auth state changes

**Theme Model:**
- Purpose: Light/dark mode with per-mode color schemes
- Mechanism: CSS custom properties + `data-theme` and `data-mode` HTML attributes
- Functions: `loadTheme()`, `saveTheme()`, `getThemeColor()`, `updateThemeIcons()`
- CSS selectors: `html[data-theme="light"][data-mode="focus"]` etc.

## Entry Points

**HTML Document:**
- Location: `index.html`
- Triggers: Browser loads the page
- Responsibilities: Define UI structure, load Firebase SDK, embed all CSS/JS, provide manifest link

**Main Script IIFE:**
- Location: `index.html` lines 1578-2734
- Triggers: Executed when HTML parsing reaches closing `</script>` tag
- Responsibilities: Initialize state, load persistent data, setup event listeners, call `init()` at end

**`init()` Function:**
- Location: `index.html` lines 2710-2731
- Triggers: Called at end of IIFE (line 2733)
- Responsibilities: Load settings/stats/tasks, set initial theme, initialize timer state, call `updateAll()`, register service worker

**Event Listeners:**
- Timer controls: `startBtn`, `pauseBtn`, `resetBtn` → `start()`, `pause()`, `reset()`
- Mode tabs: `.mode-tab` → mode switch
- Settings dialog: `settingsBtn`, `settingsForm` → settings save
- Theme toggle: `themeToggle` → theme swap
- Tasks: `addTaskBtn`, `taskList` → task CRUD
- Auth: `signInBtn`, Firebase auth listener

**Service Worker:**
- Location: `sw.js`
- Triggers: Browser requests, page load
- Responsibilities: Cache assets, serve offline, handle network failures

## Error Handling

**Strategy:** Silent failures with graceful degradation

**Patterns:**
- Try-catch in storage functions (lines 1683, 1694, 1716) - silently ignore parse errors
- Firebase operations in try-catch or `.catch(() => {})` - don't break app if Firestore unavailable
- Service worker registration wrapped in `.catch(() => {})` (line 2728) - silent fail if unavailable
- Visibility change listener (line 2541) - catch up on tab switch, prevents timer drift
- `Math.max(0, remaining)` - prevent negative time values

## Cross-Cutting Concerns

**Logging:**
- No formal logging - relies on browser console errors during development
- Document title updated with timer display for visibility: `updateDocumentTitle()`

**Validation:**
- Input fields have `min`, `max`, `maxlength` HTML attributes
- Task input limited to 10 tasks max (line 1728)
- Timer durations bounded by input ranges (1-120 min focus, 1-30 min break)

**Authentication:**
- Firebase auth listener (line 2692) automatically syncs on sign-in/sign-out
- User menu hidden by default, shown only after sign-in
- Stats/leaderboard visible only when authenticated

**Notifications:**
- `sendNotification()` function uses Notification API (lines ~2250+)
- Permission requested on first timer start
- Sent on pomodoro completion and break end

**Keyboard Shortcuts:**
- Space: Start/Pause (line 2630)
- R: Reset (line 2635)
- Esc: Close dialogs (line 2640)
- Enter in task input: Add task

**Persistence:**
- All user data in localStorage under `pomodoro-*` keys
- Firebase Firestore used for authenticated user stats (optional)
- Service worker caches static assets for offline access

---

*Architecture analysis: 2026-02-06*
