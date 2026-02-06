# External Integrations

**Analysis Date:** 2026-02-06

## APIs & External Services

**Firebase Authentication:**
- Service: Firebase Authentication (Google Cloud)
- What it's used for: User login/signup, session management
  - SDK: `firebase-auth-compat.js` (v10.14.1)
  - Auth method: Email/password or social sign-in (configured in Firebase Console)
  - Code location: `index.html` lines 2693+ (fbAuth.onAuthStateChanged)

**Firebase Cloud Messaging:**
- Service: Firebase Cloud Messaging (optional setup in Firebase Console)
- What it's used for: Push notifications for timer events
  - measurementId: G-G14JMRPL39

## Data Storage

**Databases:**
- **Firestore (Cloud Firestore):**
  - Provider: Google Cloud / Firebase
  - Purpose: Persistent user data sync across devices/tabs
  - Collection structure:
    - `users/{uid}` - Document per user containing:
      - `sessionCount` - Total pomodoro sessions completed
      - `totalMinutes` - Total focus minutes logged
      - `dailyGoal` - User's daily goal target
      - `dailyGoalUnit` - Goal unit ('minutes', 'hours', 'pomodoros')
      - `completedToday` - Sessions/minutes completed today
      - `leaderboardName` - Display name for leaderboard
      - `stats` - Historical statistics object
  - Client: Firebase Firestore Compat SDK (v10.14.1)
  - Initialization: Line 1575 (`const fbDb = firebase.firestore()`)
  - Persistence: Enabled for offline support (line 1576: `fbDb.enablePersistence()`)

**Local Storage:**
- Browser localStorage for offline-first caching:
  - `pomodoro-settings` - App configuration (focus/break/long-break durations, autoStart, soundEnabled, dailyGoal, unit)
  - `pomodoro-stats` - Session and minute counts
  - `pomodoro-theme` - Current theme preference (light/dark)
  - `pomodoro-tasks` - Task list data
- Location: `index.html` lines 1684-1723

**File Storage:**
- None - all data is in-app (localStorage) or Firestore, no file upload capability

**Caching:**
- Service Worker cache for offline support
  - Cache name: `pomodoro-v{VERSION}` (currently v33)
  - Cached assets: index.html, manifest.json, root path
  - Strategy: Cache-first with network fallback
  - Location: `sw.js` lines 1-24

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Implementation: Email/password sign-in (primary)
  - Optional social providers configurable in Firebase Console
  - UID-based user identification for Firestore document keys
  - Auth state listener: `fbAuth.onAuthStateChanged()` at line 2693

**Protected Operations:**
- Stats sync to Firestore requires active Firebase session
- Unauthenticated users can use timer with localStorage-only data
- Data flows: `syncStatsToFirestore()` (line 2236), `pullStatsFromFirestore()` (line 2279)

## Monitoring & Observability

**Error Tracking:**
- None detected - Firebase errors caught but not reported to external service

**Logs:**
- Browser console only
- No external logging service integrated

**Analytics:**
- Firebase Analytics configured (measurementId: G-G14JMRPL39)
- Status: Configured but implementation not visible in code analysis

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (static site hosting)
- Custom domain: pomodorotimer.vip (via CNAME file)
- HTTPS enforced by GitHub Pages

**CI Pipeline:**
- None detected - manual deployment via git push to main branch
- No automated tests, linting, or build validation

**Deployment Process:**
- Push commits to `main` branch
- GitHub Pages automatically serves updated content
- Service worker cache version must be manually bumped in `sw.js` for client updates

## Environment Configuration

**Required environment setup:**
- Firebase project must be active and configured
- Firebase credentials are hardcoded in `index.html` (lines 1564-1572)

**Critical env vars / Config values:**
- `firebaseConfig.apiKey` - Public API key for Firebase
- `firebaseConfig.authDomain` - Firebase auth domain
- `firebaseConfig.projectId` - Firebase project ID
- `firebaseConfig.storageBucket` - Firebase storage bucket
- `firebaseConfig.messagingSenderId` - Firebase messaging sender ID
- `firebaseConfig.appId` - Firebase app ID
- `firebaseConfig.measurementId` - Google Analytics measurement ID

**Secrets location:**
- Currently: Hardcoded in `index.html` (NOT secure - API key is public)
- Best practice: Should use environment variables or backend proxy

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Firestore write operations on user session completion (line 2296: `updateFirestoreOnComplete()`)
- Automatic sync on auth state changes (line 2693+)
- Leaderboard queries to Firestore (line 2326: `loadLeaderboard()`)

## Rate Limiting & Quotas

**Firestore:**
- Free tier includes limited read/write/delete operations per day
- Leaderboard queries fetch all users sorted by sessionCount (line 2329) - could hit quota with many users
- Sync-on-tab operations may create unnecessary writes (line 1576 enables cross-tab sync)

## Network Requirements

**Online capabilities:**
- User authentication (Firebase)
- Stats/leaderboard sync
- Cross-tab data synchronization

**Offline capabilities:**
- Timer functionality (all local)
- Notifications (if permission granted)
- Settings/stats persistence via localStorage
- Task management (all local)

---

*Integration audit: 2026-02-06*
