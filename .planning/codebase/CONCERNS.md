# Codebase Concerns

**Analysis Date:** 2026-02-06

## Tech Debt

**Monolithic Single-File Architecture:**
- Issue: Entire application (2,737 lines) lives in `index.html` with HTML, CSS, and JavaScript mixed together
- Files: `index.html`
- Impact: Impossible to reuse components, test individual functions, or maintain code organization as feature count grows. High cognitive load for future modifications. No tree-shaking or code splitting possible.
- Fix approach: Extract JavaScript into separate modules (timer logic, UI rendering, state management, Firebase operations). Extract CSS into separate stylesheets organized by feature. This would support module bundling and tree-shaking if build tooling is added later.

**Silent Error Suppression in Critical Paths:**
- Issue: Multiple `catch () {}` blocks silently swallow errors without logging or handling them
- Files: `index.html` lines 1686, 1697, 1719, 1874, 1944, 2276, 2293, 2322, 2373; `sw.js` line 6
- Impact: Bugs in localStorage parsing, Firebase operations, Web Audio API, and Notification API fail silently. Makes debugging production issues nearly impossible. Users experience broken features with no error visibility.
- Fix approach: Replace empty catch blocks with console logging (`console.error('Context:', error)`) or proper error recovery. Implement error telemetry for Firebase operations since they're user-critical.

**Unvalidated Firebase Credentials in Client Code:**
- Issue: Firebase API key and project config are publicly exposed in HTML source code
- Files: `index.html` lines 1564-1572
- Impact: While Firebase uses other mechanisms (OAuth, Firestore security rules), the public API key is still sensitive and can be abused for DoS attacks or credential enumeration. Not suitable for production deployment at scale.
- Fix approach: Move Firebase config to a secure endpoint or environment variables loaded server-side. Consider using Firebase Local Emulator for development.

**No Input Validation on User-Generated Content:**
- Issue: Task titles are user-controlled but only partially escaped with `.replace(/</g, '&lt;')`
- Files: `index.html` line 1772
- Impact: Incomplete escaping could miss other HTML entities. Task input field has no max length validation, allowing arbitrary string sizes. Potential for XSS if escaping logic is incomplete or bypassed.
- Fix approach: Use `.textContent` instead of innerHTML for all user-generated content. Implement max-length validation on task input field. Add length limits to task title storage.

**Inconsistent Data Persistence Strategy:**
- Issue: Timer state is ephemeral (lost on page refresh), but stats/settings persist to localStorage. No conflict resolution between local and Firestore data when user is logged in.
- Files: `index.html` lines 1300-1400 (timer state), 1682-1702 (storage functions), 2687-2707 (auth)
- Impact: If user has two tabs open and completes a session in one tab, the other tab's in-memory stats are stale. When logging in, Firestore data overwrites local stats with potential loss of recent sessions. No optimistic updates or delta sync.
- Fix approach: Implement offline-first sync pattern. Maintain a local queue of stats changes. When connected to Firestore, merge changes with server data (using timestamps as tie-breaker). Implement real-time listener for multi-tab sync.

## Known Bugs

**Tab Visibility State Sync Issue:**
- Symptoms: When switching between browser tabs, the timer may display stale time or become desynchronized
- Files: `index.html` lines 2541-2545
- Trigger: Open two tabs of the app. Start timer in one tab. Switch to the other tab while timer is running. The second tab may show incorrect remaining time until next tick.
- Workaround: Simply switch back to the active tab and forward again to trigger a resync

**Service Worker Cache Version Not Updated:**
- Symptoms: Users may see stale cached content after app updates
- Files: `sw.js` line 1
- Trigger: Deploy app changes but forget to increment `CACHE_NAME` version number
- Workaround: Users must manually clear browser cache or hard-refresh (Ctrl+Shift+R)

**Leaderboard Query Performance:**
- Symptoms: Leaderboard takes several seconds to load; freezes UI while fetching
- Files: `index.html` lines 2326-2374
- Trigger: Click leaderboard button when many users exist in Firestore
- Current implementation: First query gets top 10, then if current user not in top 10, performs a WHERE query counting users with more minutes
- Workaround: Close and reopen leaderboard dialog

## Security Considerations

**Public Firebase Config Exposure:**
- Risk: API key visible in client code allows potential attackers to make requests to Firebase project. Though Firestore security rules restrict data access, the key itself can be abused for quota exhaustion or metadata enumeration.
- Files: `index.html` lines 1564-1572
- Current mitigation: Firebase security rules (not visible in this file) likely restrict writes/reads to authenticated users only
- Recommendations: Implement reverse proxy layer between app and Firebase that validates requests server-side. Use Firebase REST API with session tokens instead of public API key. Consider migrating to Backend API layer.

**localStorage Unencrypted:**
- Risk: User stats, settings, and task data stored in plaintext localStorage. On shared devices, other users can read personal productivity data and task lists.
- Files: `index.html` lines 1681-1724
- Current mitigation: None (browser sandbox provides only minimal protection)
- Recommendations: Implement optional password protection for localStorage. Consider IndexedDB with encryption for sensitive data. Warn users about shared device risks in settings.

**Image `onerror` Handler Vulnerability:**
- Risk: Avatar images loaded from external URLs without origin verification. Malicious image hosts could serve content that exploits browser vulnerabilities.
- Files: `index.html` line 2392
- Current mitigation: `referrerPolicy = 'no-referrer'` prevents some tracking but doesn't validate image source
- Recommendations: Whitelist Firebase Storage domain only. Use image proxying service with origin validation. Add Content-Security-Policy headers if deployed on own domain.

**Notification API Permission Persistence:**
- Risk: App requests notification permission on timer start without user context. Persistent permissions could be exploited to spam user's desktop with notifications from compromised account.
- Files: `index.html` lines 1942-1946
- Current mitigation: Browser requires user approval for notifications
- Recommendations: Show permission prompt only once at app setup. Provide clear notification frequency disclosure. Implement per-session notification toggle.

## Performance Bottlenecks

**2,737-Line JavaScript Monolith Loading Entirely on Startup:**
- Problem: Single `index.html` contains all CSS and JS. No lazy loading, no code splitting. All 88KB of HTML must be parsed and compiled before app is interactive.
- Files: `index.html`
- Cause: No build tooling or module system. Everything bundled together for "no dependencies" simplicity.
- Improvement path: For now, minimize by moving inline styles to external file. Later: implement module bundling if complexity grows. Consider lazy-loading Firebase SDK only when user clicks settings/auth.

**Leaderboard Query with Subsequent Where Clause:**
- Problem: Loading leaderboard makes two Firestore queries sequentially (top 10, then count bigger scores). With network latency, this adds 200-400ms delay per query.
- Files: `index.html` lines 2326-2374
- Cause: Architecture doesn't pre-compute user rank. Fetches top 10 first, then calculates current user rank separately.
- Improvement path: Pre-compute and store user rank in Firestore user document during stats update. Single query to fetch top 10 + current user rank. Alternatively, implement client-side pagination cursor.

**Tick Function Runs Every 250ms:**
- Problem: Timer tick happens 4x per second even though display updates only need 1Hz. Overkill UI updates cause unnecessary repaints.
- Files: `index.html` line 2454
- Cause: 250ms interval provides "smooth" time display but wastes CPU on 75% of ticks that don't change visible output.
- Improvement path: Adjust tick interval to 1000ms (once per second) or use `requestAnimationFrame` for progress ring animation instead of setInterval.

**Task List Renders Entire List on Every Change:**
- Problem: `renderTasks()` clears and rebuilds entire task list DOM even when adding/removing single task
- Files: `index.html` lines 1755-1790
- Cause: Using `innerHTML = ''` and rebuilding from scratch
- Improvement path: Use keyed updates (add/remove individual DOM nodes) instead of full re-render. For MVP with ≤10 tasks, not critical, but scales poorly.

## Fragile Areas

**Timer Synchronization with System Time:**
- Files: `index.html` lines 2428-2441, 2443-2456
- Why fragile: Timer uses `Date.now()` and `state.endTime` calculation. If system clock adjusts backward (NTP sync, manual change), timer breaks or jumps. If page stays open across daylight saving time change, timer offset is incorrect.
- Safe modification: Always recalculate remaining time from endTime on visible change. Detect clock skew and re-sync. Consider using `performance.now()` for elapsed time instead of absolute timestamps.
- Test coverage: No unit tests for timer logic. Edge cases like timezone changes, tab switch, or pause/resume not covered.

**Firebase Auth State Transitions:**
- Files: `index.html` lines 2687-2707
- Why fragile: Uses `onAuthStateChanged` callback which can fire multiple times during sign-in flow. Potential race conditions if stats push and pull happen simultaneously. No promise chain or atomic operations.
- Safe modification: Wrap auth flow in mutex or async queue to prevent concurrent updates. Make sign-in operation atomic (load stats → update if needed → save stats) using Firestore transactions.
- Test coverage: No tests for multi-tab sign-in or race conditions.

**CSS Grid Layout with Dynamic Dots:**
- Files: `index.html` (CSS and dots rendering in JS)
- Why fragile: Session dots are added/removed dynamically based on settings. If `longBreakInterval` changes mid-session, DOM is updated. CSS grid may not reflow correctly on some browsers if grid doesn't have explicit column count.
- Safe modification: Always regenerate entire dots container (clear and rebuild) instead of partial DOM updates. Set explicit CSS grid columns count.
- Test coverage: No visual regression tests for responsive layout changes.

## Scaling Limits

**Firestore Read/Write Rate Limits:**
- Current capacity: ~10 writes per second per user (Firebase free tier allows 20k writes per day total)
- Limit: If many users hit "complete focus session" simultaneously (e.g., 3pm worldwide), could exceed quota
- Scaling path: Implement batch writes. Use batch SDK to combine multiple user updates. Consider Firestore Cloud Functions for server-side aggregation instead of client writes.

**localStorage Size Limit (5-10MB per domain):**
- Current capacity: Stats/settings/tasks currently ~5KB, could grow to ~100KB per user
- Limit: If task list grows to 1000+ items or daily history extends for years, could hit quota
- Scaling path: Implement periodic cleanup (archive old stats >1 year). Use IndexedDB instead of localStorage for >1MB data. Implement data compression.

**Concurrent Users in Leaderboard:**
- Current capacity: Top 10 leaderboard loads quickly. Rank calculation uses WHERE query which scales O(n) where n = total users
- Limit: Above ~100k users, rank query becomes very slow. Above ~1M users, Firestore query costs become prohibitive.
- Scaling path: Pre-compute hourly rank snapshots. Store rank in user document. Implement approximate rank for large leaderboards.

## Dependencies at Risk

**Firebase SDK (Compat Version 10.14.1):**
- Risk: Using compat SDK which is legacy API. Google recommends modular SDK. Breaking changes possible in future versions.
- Impact: If Firebase drops compat SDK support, would require rewriting all Firebase code
- Migration plan: Upgrade to modular Firebase SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`). Implement dynamic imports to lazy-load Firebase only when needed.

**Service Worker Cache Strategy:**
- Risk: Cache-first strategy means updates won't be seen until cache version is bumped. If version bump is forgotten, users stay on old version indefinitely.
- Impact: Bug fixes and new features don't reach users automatically. Security fixes take too long to deploy.
- Migration plan: Implement skip-waiting and claim clients immediately (already done). Add auto-update check on app startup that validates cache version against server. Implement version mismatch notification to user.

## Missing Critical Features

**No Offline Data Sync:**
- Problem: If user goes offline, local changes to settings/stats are saved locally but never synced when connection returns
- Blocks: Reliable multi-device experience. Cross-device stats sync. Offline-first reliability.
- Workaround: User must manually re-enter session data if offline

**No Conflict Resolution for Multi-Tab Access:**
- Problem: If user has two tabs open and modifies settings in both, second tab's changes are lost
- Blocks: Reliable multi-tab experience. Settings sync across tabs.
- Workaround: Use only one tab at a time

**No Data Export/Backup:**
- Problem: User has no way to export their stats or task data
- Blocks: Data portability. User control. Backup before data loss.
- Workaround: Manual Firestore export via Firebase Console (requires admin access)

**No Time Zone Handling:**
- Problem: Daily stats are tracked by `todayKey()` which uses local timezone. If user travels across time zones, daily goal reset may be incorrect.
- Blocks: Accurate daily stats for travelers. Correct time zone handling for teams.
- Workaround: Manual stats reset or timezone awareness in data model

## Test Coverage Gaps

**Timer Logic - Untested:**
- What's not tested: Pause/resume calculations, completion edge cases (timezone boundaries), clock skew handling, tab switch sync
- Files: `index.html` lines 2428-2500
- Risk: Timer bugs (off-by-one errors, incorrect remaining time) go undetected until users report them. Fixes are risky without regression tests.
- Priority: High (core feature)

**Firebase Operations - Untested:**
- What's not tested: Auth sign-in flow, concurrent stats updates, leaderboard query behavior, Firestore persistence
- Files: `index.html` lines 2280-2407, 2687-2707
- Risk: Silent failures (empty catch blocks) hide real errors. Race conditions in auth flow unknown until multi-tab scenario occurs.
- Priority: High (user data critical)

**Task Management - Untested:**
- What's not tested: Task add/delete with concurrent modifications, localStorage corruption recovery, task list rendering with 100+ tasks
- Files: `index.html` lines 1715-1790
- Risk: Tasks silently lost if localStorage corrupted. UI crashes with large task lists. Concurrent modifications cause duplicates.
- Priority: Medium (feature works for small lists)

**Keyboard Shortcuts - Untested:**
- What's not tested: Shortcut behavior when dialogs open, with different input elements focused, with international keyboards
- Files: `index.html` lines 2628-2649
- Risk: Shortcuts trigger unexpectedly in wrong contexts. Space bar pause/resume conflicts with dialog buttons.
- Priority: Low (edge case, mostly works)

**Responsive Layout - Untested:**
- What's not tested: Layout on small screens, very large screens, orientation changes, tablet sizes
- Files: `index.html` (CSS media queries, dynamic session dots)
- Risk: Layout breaks on unexpected viewport sizes. Progress ring clips. Tasks list overflows.
- Priority: Medium (PWA expects responsive design)

---

*Concerns audit: 2026-02-06*
