---
phase: 07-integrations
plan: 01
subsystem: api
tags: [todoist, oauth, firebase, cloud-functions, typescript]

# Dependency graph
requires:
  - phase: 03-payment-infrastructure-and-feature-gating
    provides: requirePremium() guard and premium user gating pattern
  - phase: 04-data-foundation-and-projects
    provides: Firestore users/{uid} document structure and Cloud Function patterns
provides:
  - Todoist OAuth 2.0 integration via three Cloud Functions (oauth-init, oauth-callback, import-tasks)
  - Client-side connect/disconnect/import UI in settings dialog
  - Firestore todoistOAuthStates/{state} collection for CSRF validation
  - Firestore users/{uid}.todoistToken storage for token persistence
affects: [future-integrations, webhook-triggers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sync window.open() before async call to avoid popup blocker on OAuth flows"
    - "CSRF state stored in Firestore with 10-min TTL and one-time deletion after use"
    - "defineSecret() for Cloud Function secrets (TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET)"
    - "Native fetch() for third-party API calls — no npm dependency"
    - "401 from Todoist API clears stored token and instructs client to reconnect"

key-files:
  created:
    - functions/src/todoist/oauth-init.ts
    - functions/src/todoist/oauth-callback.ts
    - functions/src/todoist/import-tasks.ts
  modified:
    - functions/src/index.ts
    - index.html
    - sw.js

key-decisions:
  - "Sync window.open() before await in connectTodoist() to avoid popup blocker — critical for cross-browser OAuth popup"
  - "CSRF state stored in Firestore todoistOAuthStates collection with 10-min TTL and one-time deletion"
  - "Native fetch() used in all Cloud Functions — no npm dependencies added"
  - "Todoist API v1 endpoint (https://api.todoist.com/api/v1/tasks) for task import"
  - "Task deduplication on import by checking existing task IDs before pushing"
  - "All Todoist features (connect, import) gated behind requirePremium()"

patterns-established:
  - "OAuth popup pattern: open popup sync, then set location.href after async URL fetch"
  - "OAuth CSRF pattern: Firestore state doc with TTL, one-time-use deletion after validation"
  - "Third-party token storage: users/{uid}.{service}Token + {service}ConnectedAt fields"

requirements-completed: [INTG-01]

# Metrics
duration: ~15min
completed: 2026-02-20
---

# Phase 07 Plan 01: Todoist OAuth Integration Summary

**Todoist OAuth 2.0 integration via three Firebase Cloud Functions with client-side connect/import UI gated behind premium**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-20T11:39:05Z
- **Completed:** 2026-02-20T10:52:07Z
- **Tasks:** 3 (2 auto + 1 human-verify, approved)
- **Files modified:** 6

## Accomplishments

- Three Cloud Functions: oauth-init (generates Todoist authorize URL with CSRF state), oauth-callback (validates state, exchanges code, stores token), import-tasks (fetches tasks via stored token)
- Client-side Integrations section in settings dialog with connect/disconnect/status display
- Todoist import dialog with checkbox task selection, deduplication, and import-to-task-list
- Secure OAuth popup pattern (sync window.open before async URL fetch) prevents popup blocker
- URL param handling for ?todoist=success and ?todoist=error post-redirect

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Todoist Cloud Functions (OAuth init, callback, import)** - `cda9d49` (feat)
2. **Task 2: Add Todoist connect UI and import dialog to client** - `3542835` (feat)
3. **Task 3: Verify Todoist integration end-to-end** - Approved by user (human-verify checkpoint)

## Files Created/Modified

- `functions/src/todoist/oauth-init.ts` - onCall: generates Todoist authorize URL with CSRF state in Firestore (10-min TTL)
- `functions/src/todoist/oauth-callback.ts` - onRequest: validates CSRF state, exchanges auth code for token, stores in Firestore users/{uid}
- `functions/src/todoist/import-tasks.ts` - onCall: fetches Todoist API v1 tasks using stored token, clears token on 401
- `functions/src/index.ts` - Re-exports all three Todoist Cloud Functions
- `index.html` - Integrations settings section, Todoist import dialog, connect/disconnect/import logic, URL param handling, task deduplication
- `sw.js` - Cache version bumped to v54

## Decisions Made

- Sync `window.open()` called before any `await` in `connectTodoist()` — required to avoid popup blocker in all browsers; popup location set after async Cloud Function call resolves
- CSRF state stored in `todoistOAuthStates/{state}` Firestore doc with 10-min TTL and deleted on use (one-time)
- Native `fetch()` used for all third-party HTTP calls — no new npm dependencies
- Todoist API v1 (`/api/v1/tasks`) used for task import (current stable endpoint)
- Token cleared from Firestore on 401 response from Todoist — forces reconnect flow
- Task deduplication on import: existing task IDs checked before appending to prevent duplicates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all Cloud Functions compiled cleanly via `tsc --noEmit`. OAuth popup pattern implemented as specified in plan.

## User Setup Required

**External services require manual configuration before deployment:**

- `TODOIST_CLIENT_ID` — from Todoist App Management Console (https://developer.todoist.com/appconsole.html) → Create App → Client ID
- `TODOIST_CLIENT_SECRET` — same console → Client Secret
- `TODOIST_REDIRECT_URI` — Set to Cloud Function URL: `https://{region}-{project}.cloudfunctions.net/todoistOauthCallback`; also register this exact URL as OAuth Redirect URL in the Todoist app settings

Deploy Cloud Functions, then add the redirect URI to the Todoist app configuration.

## Next Phase Readiness

- Todoist OAuth flow is complete and ready for deployment once credentials are configured
- Cloud Functions require Blaze plan (already flagged as blocker in STATE.md)
- Remaining Phase 7 plans: webhook triggers, PDF export

## Self-Check: PASSED

- FOUND: functions/src/todoist/oauth-init.ts
- FOUND: functions/src/todoist/oauth-callback.ts
- FOUND: functions/src/todoist/import-tasks.ts
- FOUND: .planning/phases/07-integrations/07-01-SUMMARY.md
- FOUND commit: cda9d49 (Task 1 — Cloud Functions)
- FOUND commit: 3542835 (Task 2 — Client UI)

---
*Phase: 07-integrations*
*Completed: 2026-02-20*
