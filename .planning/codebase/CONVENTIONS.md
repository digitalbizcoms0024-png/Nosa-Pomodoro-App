# Coding Conventions

**Analysis Date:** 2026-02-06

## Naming Patterns

**Files:**
- Single file application: `index.html` contains all HTML, CSS, and JavaScript
- Service worker: `sw.js` (all lowercase, no hyphens)
- Config files: `manifest.json` (all lowercase)
- No separate module files; monolithic structure

**Functions:**
- camelCase for all function names: `loadSettings()`, `updateTimerDisplay()`, `saveStats()`
- Action-verb prefix pattern: `load*`, `save*`, `update*`, `get*`, `calculate*`, `format*`, `play*`, `send*`, `show*`, `create*`, `toggle*`, `delete*`, `sync*`, `pull*`
- Getter/utility functions: `getDurationForMode()`, `getModeName()`, `getThemeColor()`, `getWeekData()`, `getAudioCtx()`
- Nested functions within IIFE are also camelCase
- Single-letter helper constants are acceptable: `$` for querySelector alias, `d` for date, `i` for iteration

**Variables:**
- camelCase: `state`, `timeRemaining`, `totalTime`, `endTime`, `settings`, `DEFAULTS`
- Boolean flags use is/has prefix: `isRunning`, `isCurrent`, `isFirstOfDay`, `userMenuOpen`
- DOM element references: camelCase with `El` suffix: `todayMinutesEl`, `timeDisplay`, `progressRing`, `settingsDialog`
- Constants in UPPERCASE: `CIRCUMFERENCE`, `STORAGE_KEYS`, `CONFETTI_COLORS`, `CACHE_NAME`, `DEFAULTS`
- State object keys are lowercase: `state.mode`, `state.status`, `state.settings`

**Types/Objects:**
- Plain JavaScript objects, no class definitions
- State object structure defined once near top: `const state = { mode, status, timeRemaining, ... }`
- Settings object uses DEFAULTS pattern: `const DEFAULTS = { focusDuration, breakDuration, ... }`
- Stats object structure: `{ totalPomodoros, dailyCounts, dailyMinutes, bestStreak }`
- User object from Firebase with properties: `displayName`, `photoURL`, `email`, `uid`

## Code Style

**Formatting:**
- No build tools or linters configured
- Indentation: 2 spaces (observed throughout)
- Line length: No strict limit observed; some lines exceed 100 characters
- Semicolons: Always present at statement ends
- Quotes: Single quotes for strings (`'use strict'`, `'focus'`, `'running'`)
- Brace style: Opening brace on same line (1TBS style): `if (condition) { ... }`

**Spacing:**
- Space after keywords: `if (condition)`, `while (true)`, `for (let i = 0; i < n; i++)`
- No space inside parentheses: `getDurationForMode(state.mode)` not `getDurationForMode( state.mode )`
- Single space around operators: `const x = y + z;`, `if (a > b)`
- No space before function call parentheses: `getElementById()` not `getElementById ()`

**Linting:**
- No ESLint, Prettier, or similar tools configured
- No `.eslintrc` or `.prettierrc` files present
- Conventions are followed implicitly and consistently by developer

## Import Organization

**Not Applicable:**
- No module system used (no `import`/`require`)
- Single IIFE wraps all JavaScript: `(() => { 'use strict'; ... })()`
- External scripts loaded via `<script>` tags in HTML: Firebase SDK, service worker registration

**Script Loading Order:**
1. Firebase SDK scripts (app, auth, firestore): `<script src="https://www.gstatic.com/firebasejs/...">`
2. Firebase configuration and initialization
3. Main application IIFE in second `<script>` tag

**Path Aliases:**
- DOM shortcut: `const $ = (s) => document.querySelector(s);` used throughout for element selection
- No other path aliases used

## Error Handling

**Patterns:**
- Empty `catch` blocks swallow errors silently: `try { ... } catch {}`
  - Used for: localStorage parsing, service worker registration, Firebase operations, notification API calls, audio context errors
  - Example: `try { const raw = localStorage.getItem(STORAGE_KEYS.settings); ... } catch {}`
- Conditional checks prevent errors before they occur:
  - `if (!title || state.tasks.length >= 10) return;` — early return on invalid input
  - `if (state.status === 'running') return;` — guard clauses in timer functions
  - `if (!state.user) return;` — Firebase operations only if user exists
- Fallback values with `||` operator: `state.stats.dailyCounts[today] || 0`, `data.photoURL || ''`
- Defensive checks with `?.` pattern not used; instead explicit checks: `if (user)` before accessing properties

**Firebase Error Handling:**
- All Firebase async operations wrapped in try-catch: `syncStatsToFirestore()`, `pullStatsFromFirestore()`, `updateFirestoreOnComplete()`, `loadLeaderboard()`
- Errors silently ignored with empty catch blocks
- No user-facing error messages for failed Firebase operations

**DOM Error Handling:**
- Image load errors: `img.onerror = function() { this.style.display = 'none'; };` in `createLeaderboardRow()`
- No validation errors thrown; invalid input simply ignored

## Logging

**Framework:** `console` only (no logging library)

**Patterns:**
- No explicit logging statements found in production code
- Debug logging not used
- Errors silently fail rather than logging

**Accessibility Logging:**
- Uses semantic HTML attributes for screen readers: `aria-label`, `aria-selected`, `aria-hidden`, `aria-live`, `role`
- Not logging-based but DOM attribute-based

## Comments

**When to Comment:**
- Sparse commenting; code is generally self-documenting
- Comments used for section headers and organizational clarity:
  - `// --- Constants ---`
  - `// --- DOM refs ---`
  - `// --- Timer Engine ---`
  - `// --- Storage ---`
  - `// --- Tasks ---`
  - `// --- Helpers ---`

**Complex Logic Comments:**
- Algorithm explanation: `// Check today first` before streak calculation (line 1826)
- Non-obvious behavior: `// Respect reduced motion preference` before accessing matchMedia (line 1880)
- State management notes: `// Track fresh sign-ins vs page refreshes` (line 2227)
- Data merging logic: `// Merge local into cloud` (line 2243)

**No JSDoc/TSDoc:**
- No function documentation blocks used
- No parameter or return type documentation
- Pure vanilla JavaScript without type system

## Function Design

**Size:**
- Functions range from 2-50 lines, most 10-30 lines
- Utility functions are concise: `formatTime()` is 4 lines, `getThemeColor()` is 5 lines
- Complex functions broken into multiple shorter functions: timer logic split into `start()`, `pause()`, `reset()`, `complete()`, `tick()`
- Render functions are larger (20-40 lines): `renderTasks()`, `updateWeeklyChart()`, `createLeaderboardRow()`

**Parameters:**
- Functions take 0-2 parameters (rarely more)
- Most state comes from `state` global object, not parameters
- Event handlers accept single `event` parameter, often unused: `addEventListener('click', () => { ... })`
- Single parameter functions: `saveTasks(id)`, `toggleTask(id)`, `deleteTask(id)`, `switchMode(newMode)`
- No default parameters used
- No destructuring of parameters

**Return Values:**
- Many functions return nothing (imperative/side-effect focused): `saveSettings()`, `updateTimerDisplay()`, `addTask()`
- Utility functions return computed values: `formatTime()` returns string, `getWeekData()` returns array
- Async functions return Promise implicitly: `syncStatsToFirestore()`, `pullStatsFromFirestore()`
- Event handlers return nothing

**Imperative vs Functional:**
- Predominately imperative: direct DOM manipulation, state mutations, side effects
- Functional patterns: `.map()`, `.filter()`, `.reduce()`, `.forEach()` used for data transformations
- No pure functions; most functions interact with global `state` or DOM

## Module Design

**Exports:**
- No module exports; everything scoped within IIFE
- Service worker (`sw.js`) has no exports; operates as standalone event listener
- Single `init()` function called at IIFE end to bootstrap application

**Barrel Files:**
- Not applicable; no module system

**Code Organization within IIFE:**
1. Constants and DOM references at top
2. Default settings and state object
3. Storage functions (load/save)
4. Task management functions
5. Helper/utility functions
6. Audio and celebration functions
7. Notification and auth functions
8. UI update functions
9. Timer engine (start, pause, reset, complete, tick)
10. Event listeners
11. Init function

**State Management:**
- Single centralized `state` object:
  ```javascript
  const state = {
    mode: 'focus',
    status: 'idle',
    timeRemaining: 0,
    totalTime: 0,
    endTime: 0,
    intervalId: null,
    completedInCycle: 0,
    settings: { ...DEFAULTS },
    stats: { totalPomodoros: 0, dailyCounts: {}, dailyMinutes: {}, bestStreak: 0 },
    user: null,
    userMenuOpen: false,
    tasks: []
  };
  ```
- All updates directly mutate `state`: `state.mode = 'focus'`, `state.settings.focusDuration = 25`
- Persistence via localStorage and Firestore

**Naming Sections:**
- Sections delimited with comments: `// --- Section Name ---`
- Clear visual separation for code navigation

---

*Convention analysis: 2026-02-06*
