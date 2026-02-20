# Phase 7: Integrations - Research

**Researched:** 2026-02-20
**Domain:** OAuth 2.0 (Todoist), outbound webhooks, client-side PDF generation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTG-01 | Premium user can import tasks from Todoist via one-way OAuth import | Todoist API v1 `data:read` scope + Cloud Function OAuth proxy pattern |
| INTG-02 | Premium user can configure a webhook URL that fires JSON payload on focus session completion | Client-side `fetch` POST in `recordSessionData()` after session commit |
| INTG-03 | Premium user can test webhook with a sample payload | Same client-side fetch with hardcoded test payload |
| EXPT-02 | Premium user can export productivity report as PDF | jsPDF 3.0.3 via CDN, client-side generation from existing analytics data |
</phase_requirements>

---

## Summary

Phase 7 has four requirements spanning three distinct technical domains: Todoist OAuth task import (INTG-01), outbound user-configurable webhooks (INTG-02/INTG-03), and client-side PDF report export (EXPT-02). All four are achievable with the existing stack. The most complex is INTG-01 (Todoist OAuth), which requires a new Cloud Function to handle the OAuth callback and token exchange because the `client_secret` cannot be exposed in the browser. INTG-02/INTG-03 are pure client-side: store a webhook URL in Firestore user settings, fire it from existing `recordSessionData()` on session completion. EXPT-02 uses jsPDF from CDN — same loading pattern as Chart.js — to generate a report from data already computed by the analytics functions.

The project's "out of scope" decisions in REQUIREMENTS.md resolve two key questions upfront: no server-side PDF generation (client-side jsPDF is correct) and no bidirectional Todoist sync (one-way import only, confirmed). The token storage for Todoist must be server-side (Firestore, written by Cloud Function) because the Todoist `client_secret` cannot appear in the browser.

**Primary recommendation:** Implement in three self-contained plans: (1) Todoist OAuth + import UI, (2) Webhook configuration + firing, (3) PDF export. Each plan is independently deployable with no blocking dependencies between them.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsPDF | 3.0.3 (cdnjs) | Client-side PDF generation | Zero server cost, browser-native, project decision confirms client-side approach |
| Todoist API v1 | current | Task data source | New unified API replacing REST v2, `data:read` scope covers task import |
| Firebase Cloud Functions v2 | existing (Node 22) | Todoist OAuth proxy (token exchange) | `client_secret` must stay server-side; project already has CF v2 infra |
| Node.js built-in `fetch` | Node 22 global | Outbound HTTP from Cloud Function | No dependency needed; Node 22 has global fetch |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jspdf-autotable | 3.5.x (cdnjs) | Table generation in PDFs | Only needed if PDF report includes tabular session data; skip if text-only layout |
| crypto.randomUUID() | browser built-in | CSRF state parameter for Todoist OAuth | Already used in app for session IDs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF client-side | Server-side PDF (Puppeteer/wkhtmltopdf) | Explicitly out of scope per REQUIREMENTS.md — adds server cost and complexity |
| Custom OAuth redirect in app | Todoist personal token input | Simpler but worse UX; OAuth provides seamless connect flow |
| Cloud Function outbound webhook proxy | Client-side direct fetch to webhook URL | Client-side is correct — user controls the endpoint, no server needed |

**Installation (Cloud Functions only):**
```bash
# No new npm dependencies needed for Cloud Functions
# jsPDF loaded via CDN script tag in index.html (same pattern as Chart.js)
```

---

## Architecture Patterns

### Recommended Structure for New Code

```
functions/src/
├── todoist/
│   ├── oauth-init.ts       # onCall: returns Todoist authorize URL
│   ├── oauth-callback.ts   # onRequest: handles redirect, exchanges code, stores token
│   └── import-tasks.ts     # onCall: fetches tasks from Todoist API, returns to client
index.html additions:
├── Todoist connect UI (settings section, "Connect Todoist" button)
├── Todoist import dialog (task list with checkboxes, import button)
├── Webhook settings UI (URL input, save, test button)
├── PDF export trigger button in analytics dialog
└── jsPDF CDN script tag
```

### Pattern 1: Todoist OAuth via Cloud Function Proxy

**What:** Browser initiates OAuth, Cloud Function handles the redirect and token exchange (keeping `client_secret` off the client), stores token in Firestore.

**When to use:** Any OAuth flow where `client_secret` must be protected.

**Flow:**
```
1. Client calls oauthInit CF → gets authorize URL with state param
2. Client opens popup/redirect to Todoist authorize URL
3. Todoist redirects to oauthCallback CF URL (registered as redirect URI)
4. oauthCallback CF validates state, exchanges code for token, stores in Firestore
5. Client polls/receives signal that token is ready, proceeds to import
```

**Redirect URI registration:** Must be the Cloud Function HTTP trigger URL (`https://{region}-{project}.cloudfunctions.net/todoistOauthCallback`). Registered once in Todoist App Management Console.

**State parameter:** Generate with `crypto.randomUUID()`, store in Firestore temporarily, validate on callback to prevent CSRF.

```typescript
// Source: Todoist Developer Guides + Firebase Functions v2 pattern
// functions/src/todoist/oauth-init.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const todoistOauthInit = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const state = crypto.randomUUID();
  const uid = request.auth.uid;

  // Store state for validation on callback
  await getFirestore().collection('todoistOAuthStates').doc(state).set({
    uid,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min TTL
  });

  const params = new URLSearchParams({
    client_id: process.env.TODOIST_CLIENT_ID!,
    scope: 'data:read',
    state,
  });

  return { url: `https://api.todoist.com/oauth/authorize?${params}` };
});
```

```typescript
// functions/src/todoist/oauth-callback.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const todoistOauthCallback = onRequest(async (req, res) => {
  const { code, state } = req.query as { code: string; state: string };

  // Validate state (CSRF protection)
  const stateDoc = await getFirestore().collection('todoistOAuthStates').doc(state).get();
  if (!stateDoc.exists) {
    res.redirect('https://pomodorotimer.vip/?todoist=error&reason=invalid_state');
    return;
  }

  const { uid, expiresAt } = stateDoc.data()!;
  await stateDoc.ref.delete(); // One-time use

  if (new Date() > expiresAt.toDate()) {
    res.redirect('https://pomodorotimer.vip/?todoist=error&reason=expired');
    return;
  }

  // Exchange code for token (server-side: client_secret is safe here)
  const tokenRes = await fetch('https://api.todoist.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TODOIST_CLIENT_ID!,
      client_secret: process.env.TODOIST_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.TODOIST_REDIRECT_URI!,
    }),
  });

  const { access_token } = await tokenRes.json() as { access_token: string };

  // Store token in Firestore (encrypted at rest by default in Firestore)
  await getFirestore().collection('users').doc(uid).set(
    { todoistToken: access_token, todoistConnectedAt: new Date() },
    { merge: true }
  );

  // Close popup / redirect back to app
  res.redirect('https://pomodorotimer.vip/?todoist=success');
});
```

```typescript
// functions/src/todoist/import-tasks.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const importTodoistTasks = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const uid = request.auth.uid;
  const userDoc = await getFirestore().collection('users').doc(uid).get();
  const token = userDoc.data()?.todoistToken;

  if (!token) throw new HttpsError('failed-precondition', 'Todoist not connected');

  const res = await fetch('https://api.todoist.com/api/v1/tasks', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new HttpsError('internal', 'Failed to fetch Todoist tasks');

  const tasks = await res.json();
  // Return task list to client for user selection before import
  return { tasks: tasks.map((t: any) => ({ id: t.id, content: t.content })) };
});
```

### Pattern 2: Outbound Webhook on Session Completion

**What:** After `recordSessionData()` commits to Firestore, fire a client-side `fetch` POST to the user's configured webhook URL. Store the URL in Firestore user settings. No Cloud Function needed — user owns the endpoint.

**When to use:** User-configured outbound notification triggers.

**Key decisions:**
- Fire from client (not Cloud Function) — simpler, no server cost, user controls the URL
- Silent failure — never block session completion on webhook failure
- Store webhook URL in `users/{uid}` document under `webhookUrl` field

```javascript
// In recordSessionData(), after batch.commit():
async function fireWebhook(sessionData) {
  if (!state.user) return;
  try {
    const userDoc = await fbDb.collection('users').doc(state.user.uid).get();
    const webhookUrl = userDoc.data()?.webhookUrl;
    if (!webhookUrl) return;

    const payload = {
      event: 'session.completed',
      timestamp: new Date().toISOString(),
      session: {
        startedAt: sessionData.startedAt.toISOString(),
        duration: sessionData.duration,
        projectId: sessionData.projectId,
        taskId: sessionData.taskId,
      },
      user: { uid: state.user.uid },
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000), // 5-second timeout
    });
  } catch {
    // Silent failure — never interrupt session flow
  }
}
```

**Test webhook (INTG-03):** Identical to `fireWebhook()` but with a hardcoded sample payload, triggered by a "Send Test" button in settings. No Cloud Function required.

### Pattern 3: Client-Side PDF Generation with jsPDF

**What:** Load jsPDF via CDN script tag (same pattern as Chart.js already used), generate PDF from analytics data already computed by existing `renderYearlyTab()`, `renderOverviewTab()`, etc.

**When to use:** Export productivity report as downloadable file.

**CDN loading:**
```html
<!-- Add to index.html alongside Chart.js CDN tag -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js"></script>
```

**Access in vanilla JS:**
```javascript
const { jsPDF } = window.jspdf;
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
```

**Core jsPDF API (verified against documentation):**
```javascript
// Text
doc.setFontSize(20);
doc.setFont('helvetica', 'bold');
doc.text('Productivity Report', 20, 30);

// Line
doc.setDrawColor(200, 200, 200);
doc.line(20, 35, 190, 35);

// New page
doc.addPage();

// Save (triggers browser download)
doc.save('productivity-report.pdf');

// Get page dimensions
const pageWidth = doc.internal.pageSize.getWidth(); // 210mm for A4
const pageHeight = doc.internal.pageSize.getHeight(); // 297mm for A4
```

**Report content (what to include):** Pull from existing analytics data functions:
- Annual summary stats (totalHours, totalSessions, activeDays, longestStreak) — from `renderYearlyTab()` data
- Weekly summary (current vs previous week) — from `renderOverviewTab()` data
- Productivity score — from existing score calculation
- Best focus hours — from existing hour analysis
- Top projects by time — from `renderProjectsTab()` data

**Heatmap in PDF:** jsPDF cannot render SVG/HTML DOM. For the heatmap, either draw rectangles programmatically using `doc.rect()` or describe it in text ("Most active: Tuesdays, March-May"). The programmatic approach is more impressive but significantly more complex. Recommend text summary for v1.

### Anti-Patterns to Avoid

- **Opening popup for Todoist OAuth from inside a `setTimeout`/`async` context:** Browsers block popups unless triggered directly by user gesture. Use `window.open()` in the click handler synchronously, then navigate the opened window.
- **Storing Todoist `access_token` in localStorage or client-side state:** Token must stay server-side (Firestore only). Client never sees the raw token.
- **Blocking session completion on webhook failure:** Wrap `fireWebhook()` in try/catch with timeout; never await it in the critical path.
- **Importing all Todoist tasks without user confirmation:** Show a selection dialog with task list before committing import to the app's task array.
- **jsPDF with `html()` method for capturing analytics DOM:** The `html()` method requires `html2canvas` (additional 300KB dependency). For this project, programmatic PDF construction is preferred to maintain the zero-dependency ethos.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token exchange | Custom auth code | Cloud Function proxy pattern (established) | `client_secret` exposure risk in browser |
| PDF generation | Canvas drawing loop | jsPDF 3.0.3 from CDN | Handles fonts, pagination, coordinate system |
| CSRF protection in OAuth | Custom nonce scheme | `crypto.randomUUID()` stored in Firestore | Already used in project; standard PKCE alternative |
| HTTP timeout for webhooks | Manual AbortController + setTimeout | `AbortSignal.timeout(5000)` | Built-in to modern browsers and Node 22 |

**Key insight:** The webhook feature (INTG-02/03) is deceptively simple — no Cloud Function needed. The complexity is all in INTG-01 (Todoist OAuth). Don't over-engineer INTG-02 by routing through a Cloud Function.

---

## Common Pitfalls

### Pitfall 1: Todoist Redirect URI Mismatch

**What goes wrong:** OAuth callback fails with "redirect_uri mismatch" error.

**Why it happens:** The `redirect_uri` in the token exchange POST must exactly match the one registered in the Todoist App Management Console (including protocol, domain, path, no trailing slash).

**How to avoid:** Set `TODOIST_REDIRECT_URI` as a Cloud Function environment variable; use the same value in `oauth-init` (for the authorize URL) and `oauth-callback` (for token exchange). Register this exact URL in the Todoist developer console.

**Warning signs:** OAuth callback returns error query parameter instead of `code`.

### Pitfall 2: Popup Blocked by Browser

**What goes wrong:** `window.open()` returns `null` when the Todoist OAuth popup is opened.

**Why it happens:** Browsers block popups not triggered by a direct user gesture. If `window.open()` is called inside an `async` function after an `await`, the browser no longer considers it a direct user gesture.

**How to avoid:** Open the popup synchronously in the click handler, then navigate it to the Todoist URL once received from the Cloud Function:

```javascript
// CORRECT: Open popup synchronously, navigate after CF call resolves
async function connectTodoist() {
  const popup = window.open('', 'todoist_oauth', 'width=600,height=700'); // synchronous
  const { url } = await fbFunctions.httpsCallable('todoistOauthInit')();
  popup.location.href = url; // navigate after await
}
```

**Warning signs:** `window.open()` returns `null`; popup blocked notification in browser.

### Pitfall 3: Todoist API v1 vs REST v2

**What goes wrong:** Using the old REST v2 base URL `https://api.todoist.com/rest/v2/tasks`.

**Why it happens:** Most search results and tutorials reference REST v2. The new unified API v1 launched in 2025.

**How to avoid:** Use `https://api.todoist.com/api/v1/tasks`. REST v2 remains operational during the migration period (until Q4 2025) but v1 is the current standard.

**Warning signs:** Using the `/rest/v2/` URL path.

### Pitfall 4: jsPDF Version Confusion

**What goes wrong:** Loading jsPDF 2.5.1 (still widely referenced in tutorials) instead of 3.0.3 (latest stable on cdnjs).

**Why it happens:** CDNs and tutorials lag behind releases. Most examples reference 2.5.1.

**How to avoid:** Use `https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js`. The API is largely compatible, but 2.5.1 has known security vulnerabilities fixed in 3.x and 4.x.

**Warning signs:** Using `2.5.1` in the CDN URL.

### Pitfall 5: Webhook CORS Issues

**What goes wrong:** Browser blocks the outbound webhook `fetch` due to CORS policy.

**Why it happens:** The user's webhook endpoint (e.g., a Make.com or Zapier webhook) may not include CORS headers in the response, causing the browser to report an error — even though the POST actually arrived.

**How to avoid:** Use `mode: 'no-cors'` for outbound webhooks. The response body is opaque, but the POST is delivered. The "Test Webhook" should show success/failure based on network reachability, not response body.

```javascript
await fetch(webhookUrl, {
  method: 'POST',
  mode: 'no-cors', // Required for cross-origin webhook endpoints
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

**Warning signs:** Console shows CORS error but webhook endpoint logs show the POST was received.

### Pitfall 6: Todoist Token Not Persisted After Import

**What goes wrong:** Token is only in Firestore but client code doesn't know whether Todoist is connected.

**Why it happens:** Token is written server-side; client doesn't automatically know it's there.

**How to avoid:** After a successful OAuth callback (detected via `?todoist=success` URL param on redirect back to app), re-fetch user doc from Firestore to check `todoistConnectedAt`. Cache connected state in app `state` object. Or use `onSnapshot` on user doc to reactively update UI.

---

## Code Examples

### Environment Variables for Cloud Functions (firebase functions:config or Secret Manager)

```bash
# Set via Firebase CLI (Secret Manager preferred for production)
firebase functions:secrets:set TODOIST_CLIENT_ID
firebase functions:secrets:set TODOIST_CLIENT_SECRET
firebase functions:secrets:set TODOIST_REDIRECT_URI
```

```typescript
// Access in Cloud Function (v2 secrets pattern)
import { defineSecret } from 'firebase-functions/params';
const TODOIST_CLIENT_ID = defineSecret('TODOIST_CLIENT_ID');
const TODOIST_CLIENT_SECRET = defineSecret('TODOIST_CLIENT_SECRET');

export const todoistOauthCallback = onRequest(
  { secrets: [TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET] },
  async (req, res) => {
    const clientId = TODOIST_CLIENT_ID.value();
    // ...
  }
);
```

### Webhook Settings UI Pattern (consistent with existing settings dialogs)

```javascript
// Save webhook URL to Firestore user document
async function saveWebhookUrl(url) {
  if (!state.user) return;
  await fbDb.collection('users').doc(state.user.uid).set(
    { webhookUrl: url || null },
    { merge: true }
  );
  state.webhookUrl = url; // Cache in state
}

// Load webhook URL on auth state change
async function loadUserIntegrationSettings() {
  if (!state.user) return;
  const doc = await fbDb.collection('users').doc(state.user.uid).get();
  state.webhookUrl = doc.data()?.webhookUrl || null;
  state.todoistConnected = !!doc.data()?.todoistToken;
}
```

### jsPDF Report Generation Skeleton

```javascript
// Source: jsPDF 3.0.3 docs (artskydj.github.io/jsPDF/docs)
async function exportProductivityReport() {
  if (!requirePremium('PDF Export')) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20; // current Y position cursor

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Productivity Report', 20, y);
  y += 8;

  // Subtitle (date range)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 20, y);
  y += 12;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Section: Annual Summary
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Annual Summary', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  // ... add stats rows ...

  // Save
  doc.save(`productivity-report-${new Date().getFullYear()}.pdf`);
}
```

### Todoist Task Import UI Pattern

```javascript
// Show import dialog with task checkboxes before committing
async function openTodoistImportDialog() {
  if (!requirePremium('Todoist Import')) return;

  const importFn = fbFunctions.httpsCallable('importTodoistTasks');
  try {
    const result = await importFn();
    const tasks = result.data.tasks;
    // Render tasks as checkboxes in a <dialog>
    // On confirm: push selected tasks into state.tasks and save
  } catch (err) {
    // Handle: Todoist not connected → show connect button
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Todoist REST v2 (`/rest/v2/`) | Todoist API v1 (`/api/v1/`) | 2025 | New unified API; REST v2 deprecated with Q4 2025 sunset |
| jsPDF 2.5.1 | jsPDF 3.0.3 (cdnjs) / 4.2.0 (GitHub) | Jan-Feb 2025 | Security fixes; 4.x not yet on cdnjs; 3.0.3 is latest on cdnjs |
| `node-fetch` in Cloud Functions | Native `fetch` global (Node 18+) | Node 18 | No npm dependency for outbound HTTP |
| `firebase-functions/v1` | `firebase-functions/v2/https` | 2023 | Already used in this project; consistent |

**Deprecated/outdated:**
- jsPDF 2.5.1: has known security vulnerabilities (PDF injection, XSS via addJS); use 3.0.3 minimum
- Todoist REST v2 base URL: functional until Q4 2025 but deprecated; use v1
- `node-fetch` npm package in Cloud Functions: unnecessary on Node 18+; global `fetch` is available

---

## Open Questions

1. **jsPDF 4.x vs 3.0.3 — which to use?**
   - What we know: jsPDF 4.2.0 is the GitHub latest (Feb 2025). cdnjs only has 3.0.3. Both CDN builds are UMD-compatible.
   - What's unclear: Is 4.x available on a reliable CDN without unpkg? Are there API changes from 3.x to 4.x?
   - Recommendation: Use 3.0.3 from cdnjs (stable, verified CDN). 4.x security fixes are for server-side path traversal (Node.js builds) — not relevant to browser usage.

2. **Todoist OAuth: popup or full-page redirect?**
   - What we know: Both patterns work. Popup (`window.open`) keeps user in the app. Full redirect sends user away and back.
   - What's unclear: User preference, mobile behavior.
   - Recommendation: Popup pattern. More seamless UX. Consistent with how other integrations work (Stripe uses redirect; this should differ for variety). Handle mobile fallback by detecting if popup is blocked.

3. **Webhook payload: include task name or just task ID?**
   - What we know: `recordSessionData()` stores `taskId` (internal app ID). Task names are in local state.
   - What's unclear: Should webhook payload include the task content string for the receiving endpoint's convenience?
   - Recommendation: Include task content if available from `state.tasks`. Receivers should not need to re-query the app.

4. **Todoist token refresh: does Todoist issue long-lived tokens?**
   - What we know: Todoist OAuth issues access tokens. The docs do not mention refresh tokens or token expiry.
   - What's unclear: Do Todoist tokens expire? Is there a refresh flow?
   - Recommendation: Todoist tokens are documented as long-lived (no refresh token in their OAuth v2 flow). Implement disconnect/reconnect UI as the fallback if the token becomes invalid (HTTP 401 from Todoist API → prompt reconnect).

---

## Sources

### Primary (HIGH confidence)

- Todoist Developer Guides — OAuth flow, scopes (`data:read`), token exchange endpoints
  - https://developer.todoist.com/guides/
- Todoist API v1 Reference — Base URL, task endpoints, task object fields
  - https://developer.todoist.com/api/v1/
- jsPDF GitHub Releases — Version 3.0.3 (cdnjs latest), 4.2.0 (GitHub latest), security changes
  - https://github.com/parallax/jsPDF/releases
- cdnjs jsPDF — Confirmed 3.0.3 as latest stable CDN version with UMD URL
  - https://cdnjs.com/libraries/jspdf
- Firebase Cloud Functions v2 (existing project) — `onCall`, `onRequest`, secrets pattern
  - Already used in `functions/src/stripe/checkout.ts`

### Secondary (MEDIUM confidence)

- Rollout.io Todoist OAuth guide — Server-side token exchange flow, state parameter CSRF protection
  - https://rollout.com/integration-guides/todoist/how-to-build-a-public-todoist-integration-building-the-auth-flow
- Firebase Cloud Function as OAuth redirect endpoint pattern — GitHub Gist
  - https://gist.github.com/talk2MeGooseman/ff6e13629b48ef2ac603341c33d56f8c
- webhooks.fyi HMAC security guidance — Outbound webhook security patterns
  - https://webhooks.fyi/security/hmac

### Tertiary (LOW confidence)

- jsPDF 4.x API stability relative to 3.x — Not verified against changelog; assumed compatible based on patch note language

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CDN URLs verified, API endpoints confirmed from official docs
- Architecture: HIGH — Based on existing project patterns (Cloud Functions v2 already in use, `crypto.randomUUID()` already used, CDN script loading already done for Chart.js)
- Pitfalls: HIGH for OAuth/popup/CORS (common, well-documented), MEDIUM for Todoist token expiry (docs silent on this)

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (Todoist API stable; jsPDF CDN version may update)
