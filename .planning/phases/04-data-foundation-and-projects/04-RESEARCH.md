# Phase 4: Data Foundation & Projects - Research

**Researched:** 2026-02-07
**Domain:** Firestore data modeling, vanilla JS project management UI, session tracking
**Confidence:** HIGH

## Summary

Phase 4 establishes the data foundation for all analytics and export features by recording granular session-level data alongside existing aggregate stats, and introduces premium project management capabilities. This research covers three critical domains:

1. **Firestore data modeling** for time-series session events (collections structure, indexing, avoiding hot spots)
2. **Data migration patterns** ensuring session data coexists with existing daily aggregates without breaking changes
3. **Vanilla JavaScript UI patterns** for project management (dialogs, dropdowns, filtering)

**Key architectural decision:** Use a root-level `sessions` subcollection under each user document (`users/{uid}/sessions/{sessionId}`) for session events, enabling efficient per-user queries while keeping aggregate stats in the parent `users/{uid}` document. This approach avoids cross-collection query limitations and maintains clean data separation.

**Primary recommendation:** Record session data on timer completion using batch writes for atomicity, store projects as an array field in the user document (lightweight, max 100 projects realistic), and use HTML `<dialog>` elements with native form validation for project creation/editing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase Firestore | 10.14.1 (compat) | NoSQL database with offline support | Already integrated, real-time sync built-in |
| Vanilla HTML/CSS/JS | ES6+ | Single-file app architecture | Project constraint, no build tools |
| `<dialog>` element | Native HTML | Modal UI for project forms | Native, accessible, no dependencies |
| `crypto.randomUUID()` | Native Web API | Session/project ID generation | Native, cryptographically secure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Firebase Batch Writes | Built-in | Atomic multi-document operations | Session creation + stats update together |
| Firestore FieldValue | Built-in | Server timestamps, atomic increments | Accurate serverTimestamp for sessions |
| LocalStorage | Native | Optimistic state caching | Feature flags, subscription status |
| `performance.now()` | Native | High-precision timing | Session duration tracking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Root `/sessions` collection | Subcollections per user | Root enables cross-user analytics but Phase 4 doesn't need it; subcollections better for per-user scoping |
| UUID v4 | UUID v7 (sortable) | v7 adds timestamp-based sorting but adds complexity; v4 sufficient for session IDs |
| Separate projects collection | Embedded array in user doc | Separate collection scales beyond 100 projects but adds query complexity; array simpler for expected scale |

**Installation:**
No new packages required. All functionality uses existing Firebase SDK and native browser APIs.

## Architecture Patterns

### Recommended Project Structure (within index.html)

Since this is a single-file app, organize code sections:

```javascript
// State (existing + additions)
const state = {
  // ... existing fields ...
  tasks: [], // ADD: projectId field to each task
  projects: [], // NEW: [{ id, name, createdAt }]
  activeProjectId: null, // NEW: selected before session starts
};
```

### Pattern 1: Firestore Data Model

**What:** Hierarchical document structure for users, sessions, and projects

**Structure:**
```
/users/{uid}
  - displayName, photoURL, totalSessions, totalMinutes, bestStreak
  - dailyCounts: { "2026-02-07": 5, ... }
  - dailyMinutes: { "2026-02-07": 125, ... }
  - projects: [{ id, name, createdAt }]  // Embedded array
  - updatedAt: serverTimestamp

  /sessions/{sessionId}  ← Subcollection
    - startedAt: serverTimestamp
    - duration: 25 (minutes)
    - projectId: "proj_xyz" | null
    - taskId: "1234567890" | null
    - hourOfDay: 14 (0-23)
    - dayOfWeek: 5 (0=Sunday, 6=Saturday)
    - createdAt: serverTimestamp
```

**Why this structure:**
- **Subcollections for sessions:** Keeps user document size under control (1 MiB limit), unlimited sessions
- **Embedded projects array:** Lightweight, no separate collection needed for expected scale (realistic max: 100 projects)
- **Aggregate stats in parent:** Daily counts/minutes stay in user doc for leaderboard queries
- **Session-level queries:** `users/{uid}/sessions` can be efficiently queried with `.where('projectId', '==', ...)` and `.orderBy('startedAt', 'desc')`

**Source:** Based on [Firebase Structure Data Guide](https://firebase.google.com/docs/firestore/manage-data/structure-data) - subcollections ideal for data that expands over time and doesn't need cross-user queries.

### Pattern 2: Session Recording on Timer Completion

**What:** Atomic write of session data + aggregate stats update

**When to use:** Every time a focus session completes (in existing `updateFirestoreOnComplete()` function)

**Implementation pattern:**
```javascript
async function recordSession() {
  if (!state.user || state.mode !== 'focus') return;

  const uid = state.user.uid;
  const today = todayKey(); // e.g., "2026-02-07"
  const now = new Date();

  // Session document
  const sessionId = crypto.randomUUID();
  const sessionRef = fbDb.collection('users').doc(uid).collection('sessions').doc(sessionId);

  const sessionData = {
    startedAt: firebase.firestore.FieldValue.serverTimestamp(),
    duration: state.settings.focusDuration,
    projectId: state.activeProjectId || null,
    taskId: state.currentTaskId || null, // NEW: track which task
    hourOfDay: now.getHours(), // 0-23
    dayOfWeek: now.getDay(), // 0=Sunday
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  // User aggregate update (existing pattern)
  const userRef = fbDb.collection('users').doc(uid);

  // Use batch for atomicity
  const batch = fbDb.batch();
  batch.set(sessionRef, sessionData);
  batch.set(userRef, {
    dailyCounts: { [today]: firebase.firestore.FieldValue.increment(1) },
    dailyMinutes: { [today]: firebase.firestore.FieldValue.increment(state.settings.focusDuration) },
    totalSessions: firebase.firestore.FieldValue.increment(1),
    totalMinutes: firebase.firestore.FieldValue.increment(state.settings.focusDuration),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await batch.commit();
}
```

**Why batch writes:** Firestore batch writes are atomic - either both session record and stats update succeed, or neither do. Prevents data inconsistency if network fails mid-operation. ([Source](https://firebase.google.com/docs/firestore/manage-data/transactions))

### Pattern 3: Project Management UI (Dialog-Based)

**What:** Use native `<dialog>` element for project CRUD operations

**HTML structure:**
```html
<dialog id="projectDialog">
  <form method="dialog">
    <h2>Create Project</h2>
    <label>
      Project Name
      <input type="text" name="projectName" required minlength="1" maxlength="50" autocomplete="off">
    </label>
    <div class="dialog-actions">
      <button type="button" class="secondary" onclick="this.closest('dialog').close()">Cancel</button>
      <button type="submit">Create</button>
    </div>
  </form>
</dialog>
```

**JavaScript pattern:**
```javascript
// Show dialog
function showCreateProjectDialog() {
  if (!requirePremium('Projects')) return;
  projectDialog.querySelector('h2').textContent = 'Create Project';
  projectDialog.querySelector('form').reset();
  projectDialog.showModal(); // showModal() provides backdrop + focus trap
}

// Handle form submission
projectDialog.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const name = formData.get('projectName').trim();

  createProject(name);
  projectDialog.close();
});

function createProject(name) {
  if (state.projects.length >= 100) {
    alert('Maximum 100 projects');
    return;
  }

  state.projects.push({
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
  });

  saveProjectsToFirestore();
  renderProjectDropdown();
}
```

**Why `<dialog>`:** Native, accessible (focus management, ESC key, backdrop click), no dependencies. Form `method="dialog"` provides free form handling. ([Source](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog))

### Pattern 4: Project Dropdown + Task Filtering

**What:** Dropdown to select active project, filter task list by selected project

**HTML:**
```html
<div class="project-selector">
  <label>Active Project</label>
  <select id="projectSelect">
    <option value="">No Project</option>
    <!-- Populated dynamically -->
  </select>
</div>
```

**JavaScript:**
```javascript
function renderProjectDropdown() {
  projectSelect.innerHTML = '<option value="">No Project</option>';

  state.projects
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      option.selected = project.id === state.activeProjectId;
      projectSelect.appendChild(option);
    });
}

projectSelect.addEventListener('change', (e) => {
  state.activeProjectId = e.target.value || null;
  renderTasks(); // Re-render with filter
});

function renderTasks() {
  // Filter tasks by active project
  let tasksToShow = state.tasks;

  if (state.activeProjectId) {
    tasksToShow = state.tasks.filter(t => t.projectId === state.activeProjectId);
  }

  // ... existing render logic with filtered tasks
}
```

**State management:** Use simple `state.activeProjectId` variable. No Proxy needed for this scale - direct assignment + manual `renderTasks()` call is sufficient. ([Source](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) - 2026 trends show vanilla JS state management works well for focused apps)

### Anti-Patterns to Avoid

- **Don't use monotonically increasing IDs as document keys:** Sequential IDs cause Firestore hot spots (500 writes/sec limit). Use `crypto.randomUUID()` instead. ([Source](https://firebase.google.com/docs/firestore/understand-reads-writes-scale))
- **Don't store projects as separate collection unless scale demands:** Array in user doc is simpler, faster (1 read instead of separate query), and sufficient for realistic scale.
- **Don't mix `Date.now()` and `serverTimestamp`:** Use `serverTimestamp` for authoritative timestamps in Firestore (immune to client clock skew), `Date.now()` only for UI-local operations. ([Source](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now))
- **Don't skip batch writes:** Individual writes for session + stats can leave inconsistent data if one fails. Always use batch/transaction for related writes.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique session IDs | `Date.now() + Math.random()` concatenation | `crypto.randomUUID()` | Native, cryptographically secure, collision-resistant, UUID v4 standard |
| Session duration tracking | `Date.now()` at start/end | `performance.now()` for elapsed time | Monotonic (immune to clock changes), microsecond precision, designed for performance measurement |
| Project dropdown state | Custom Proxy-based reactive system | Direct state variable + manual render | Over-engineered for this scale; simple works |
| Server timestamps | Client `new Date()` | `firebase.firestore.FieldValue.serverTimestamp()` | Immune to client clock skew, consistent across users |
| Atomic multi-doc writes | Sequential `setDoc()` calls | Firestore batch writes | Atomicity guarantee, prevents partial failures |

**Key insight:** Modern browsers provide robust native APIs (crypto, performance, dialog) that eliminate need for custom solutions. Use them.

## Common Pitfalls

### Pitfall 1: Firestore Hot Spots with Timestamp-Based Document IDs

**What goes wrong:** Using session start timestamp as document ID (e.g., `/sessions/1738972800000`) creates sequential writes that hit 500 writes/sec limit and cause slow queries.

**Why it happens:** Firestore shards data by document ID range. Sequential IDs concentrate writes in one shard, creating a "hot spot" where a single tablet receives too much traffic.

**How to avoid:** Use random UUIDs for document IDs (`crypto.randomUUID()`), store timestamp as a field, not the ID.

**Warning signs:**
- Write latency spikes during high-traffic periods
- Error messages about "deadline exceeded" or "too much contention"
- Dashboard shows uneven load distribution

**Source:** [Firestore Best Practices - Avoid Hot Spots](https://firebase.google.com/docs/firestore/understand-reads-writes-scale), [Sharded Timestamps Solution](https://firebase.google.com/docs/firestore/solutions/shard-timestamp)

### Pitfall 2: Breaking Existing Daily Stats During Migration

**What goes wrong:** Adding session recording logic overwrites or clears existing `dailyCounts` and `dailyMinutes` fields, losing user history.

**Why it happens:** Using `setDoc()` without `{ merge: true }` replaces entire document. Or not reading existing aggregates before incrementing.

**How to avoid:**
- Always use `{ merge: true }` when updating user documents
- Use `FieldValue.increment()` for counters (atomic, no read-modify-write race)
- Test migration with existing user data before deploying

**Warning signs:**
- User stats reset to zero after first session post-deployment
- Leaderboard rankings change unexpectedly
- Users report lost history

**Verification step:** Before deployment, test with a user account that has existing `dailyCounts` data, complete a session, verify counts increment correctly.

### Pitfall 3: Forgetting Feature Gate on Project UI

**What goes wrong:** Free users see project creation UI, hit paywall on click. Confusing UX, feels like bait-and-switch.

**Why it happens:** Adding UI without wrapping in `isPremium()` checks or `data-premium` attributes.

**How to avoid:**
- Wrap project management UI in `if (isPremium())` conditionals
- Use `requirePremium('Projects')` at action points (create, edit, filter)
- Hide/disable UI elements for free users with visual indication

**Example:**
```javascript
function showCreateProjectDialog() {
  if (!requirePremium('Projects')) return; // Shows upgrade prompt
  projectDialog.showModal();
}
```

**Warning signs:** Free users complain about "locked features appearing clickable."

### Pitfall 4: Document Size Limit with Embedded Projects Array

**What goes wrong:** Storing 1000+ projects as embedded array hits 1 MiB document size limit, causing write failures.

**Why it happens:** Each project object (id, name, metadata) is ~100-200 bytes. 5000+ projects can exceed limit.

**How to avoid:**
- For Phase 4, embedded array is fine (realistic max: 100 projects)
- Add UI limit (e.g., 100 projects max) with clear error message
- If future phase needs more, migrate to separate `projects` subcollection

**Warning signs:**
- Write errors mentioning "document too large"
- Users with 50+ projects reporting slow saves

**Current scale:** 100 projects × ~150 bytes = 15 KB, well under 1 MiB limit. Safe for Phase 4.

**Source:** [Firestore Document Size Limits](https://firebase.google.com/docs/firestore/storage-size)

### Pitfall 5: Using `Date.now()` for Authoritative Timestamps

**What goes wrong:** Session timestamps differ across users due to clock skew, breaking time-based queries and analytics.

**Why it happens:** Client clocks can be wrong (timezone issues, manual changes, drift).

**How to avoid:** Use `firebase.firestore.FieldValue.serverTimestamp()` for all authoritative timestamps in Firestore. Use `Date.now()` only for UI-local operations (e.g., displaying "time remaining").

**Example:**
```javascript
// GOOD
sessionData.startedAt = firebase.firestore.FieldValue.serverTimestamp();

// BAD
sessionData.startedAt = Date.now();
```

**Warning signs:** Analytics show sessions "from the future" or "10 years ago."

### Pitfall 6: Query Without Composite Index

**What goes wrong:** Querying sessions by `projectId` + ordering by `startedAt` fails with "index required" error.

**Why it happens:** Firestore requires composite index for queries with multiple filters or ordering on different fields.

**How to avoid:**
- Let Firestore create indexes automatically (error message includes link)
- Or pre-define in `firestore.indexes.json`

**Example query requiring index:**
```javascript
// Requires composite index: (projectId, startedAt DESC)
const sessions = await fbDb.collection('users').doc(uid).collection('sessions')
  .where('projectId', '==', 'proj_123')
  .orderBy('startedAt', 'desc')
  .limit(50)
  .get();
```

**How to fix:** Click the link in the error message to auto-create index in Firebase Console.

**Source:** [Firestore Composite Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview)

## Code Examples

Verified patterns from official sources and research:

### Recording Session Data (Complete Pattern)

```javascript
// Call this at the end of updateFirestoreOnComplete()
async function recordSessionData() {
  if (!state.user || state.mode !== 'focus') return;

  const uid = state.user.uid;
  const today = todayKey();
  const now = new Date();

  try {
    // Generate session ID
    const sessionId = crypto.randomUUID();
    const sessionRef = fbDb.collection('users').doc(uid)
      .collection('sessions').doc(sessionId);

    // Session document data
    const sessionData = {
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      duration: state.settings.focusDuration, // minutes
      projectId: state.activeProjectId || null,
      taskId: state.currentTaskId || null,
      hourOfDay: now.getHours(), // 0-23
      dayOfWeek: now.getDay(), // 0=Sunday, 6=Saturday
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // User document update (aggregates)
    const userRef = fbDb.collection('users').doc(uid);
    const userUpdate = {
      dailyCounts: {
        [today]: firebase.firestore.FieldValue.increment(1)
      },
      dailyMinutes: {
        [today]: firebase.firestore.FieldValue.increment(state.settings.focusDuration)
      },
      totalSessions: firebase.firestore.FieldValue.increment(1),
      totalMinutes: firebase.firestore.FieldValue.increment(state.settings.focusDuration),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Atomic batch write
    const batch = fbDb.batch();
    batch.set(sessionRef, sessionData);
    batch.set(userRef, userUpdate, { merge: true });

    await batch.commit();
  } catch (error) {
    console.error('Failed to record session:', error);
    // Silent fail - don't break user flow
  }
}
```

**Source:** [Firestore Batch Writes Documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)

### Project Management Functions

```javascript
// Load projects from Firestore on auth
async function loadProjects() {
  if (!state.user) return;

  try {
    const doc = await fbDb.collection('users').doc(state.user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      state.projects = data.projects || [];
      renderProjectDropdown();
    }
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}

// Save projects to Firestore
async function saveProjects() {
  if (!state.user) return;

  try {
    await fbDb.collection('users').doc(state.user.uid).set({
      projects: state.projects,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Failed to save projects:', error);
  }
}

// Create project (premium only)
function createProject(name) {
  if (!requirePremium('Projects')) return;

  if (state.projects.length >= 100) {
    alert('Maximum 100 projects. Delete unused projects first.');
    return;
  }

  const project = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: Date.now(),
  };

  state.projects.push(project);
  saveProjects();
  renderProjectDropdown();
}

// Delete project
function deleteProject(projectId) {
  if (!requirePremium('Projects')) return;

  // Unassign from tasks
  state.tasks.forEach(task => {
    if (task.projectId === projectId) {
      task.projectId = null;
    }
  });

  // Remove project
  state.projects = state.projects.filter(p => p.id !== projectId);

  // Clear active selection if deleted
  if (state.activeProjectId === projectId) {
    state.activeProjectId = null;
  }

  saveProjects();
  saveTasks();
  renderProjectDropdown();
  renderTasks();
}

// Rename project
function renameProject(projectId, newName) {
  if (!requirePremium('Projects')) return;

  const project = state.projects.find(p => p.id === projectId);
  if (project) {
    project.name = newName.trim();
    saveProjects();
    renderProjectDropdown();
  }
}
```

### Task-to-Project Assignment

```javascript
// Update addTask() to support project assignment
function addTask() {
  const title = taskInput.value.trim();
  if (!title || state.tasks.length >= 10) return;

  state.tasks.push({
    id: Date.now().toString(),
    title,
    completed: false,
    projectId: state.activeProjectId || null, // NEW: assign to active project
  });
  saveTasks();
  taskInput.value = '';
  renderTasks();
}

// Allow reassigning task to different project
function assignTaskToProject(taskId, projectId) {
  if (!requirePremium('Projects')) return;

  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.projectId = projectId;
    saveTasks();
    renderTasks();
  }
}

// Render tasks with project filter
function renderTasks() {
  let tasksToShow = state.tasks;

  // Filter by active project if premium user has one selected
  if (isPremium() && state.activeProjectId) {
    tasksToShow = state.tasks.filter(t => t.projectId === state.activeProjectId);
  }

  // ... existing render logic with filtered tasks
  taskCount.textContent = tasksToShow.filter(t => !t.completed).length;

  // Show "Filtered by: Project Name" indicator if filtering
  if (state.activeProjectId) {
    const project = state.projects.find(p => p.id === state.activeProjectId);
    // Display filter indicator in UI
  }
}
```

### Query Sessions by Project (Future Analytics)

```javascript
// Example for Phase 6 analytics - demonstrates how to query session data
async function getSessionsForProject(projectId, limit = 50) {
  if (!state.user) return [];

  try {
    const snapshot = await fbDb.collection('users')
      .doc(state.user.uid)
      .collection('sessions')
      .where('projectId', '==', projectId)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // If this fails with "index required", click the link in error message
    console.error('Query failed:', error);
    return [];
  }
}

// Calculate total time for a project
async function getProjectTotalMinutes(projectId) {
  const sessions = await getSessionsForProject(projectId, 999);
  return sessions.reduce((sum, s) => sum + s.duration, 0);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jQuery for UI state | Vanilla JS with native APIs | ~2020-2023 | Simpler, faster, no dependencies |
| `Date.now()` for unique IDs | `crypto.randomUUID()` | 2022+ (Web Crypto API stable) | Cryptographically secure, collision-resistant |
| Custom timestamp generation | `FieldValue.serverTimestamp()` | Firestore best practice | Immune to client clock skew |
| Manual form validation | Native HTML5 validation + JS | 2020+ | Less code, better accessibility |
| Custom modal libraries | `<dialog>` element | 2022+ (Chrome 37+, Firefox 98+, Safari 15.4+) | Native, accessible, no dependencies |
| UUID v4 standard | UUID v7 (sortable) emerging | 2024+ | Combines sortability + randomness, but v4 still fine for most uses |
| Framework-heavy SPAs | Vanilla JS for focused apps | 2024-2026 trend | AI can scaffold vanilla patterns; frameworks overkill for single-page apps |

**Deprecated/outdated:**
- **jQuery:** Not needed in 2026; native APIs (querySelector, fetch, classList) cover all use cases
- **Moment.js for timestamps:** Deprecated; use native `Date` or `Intl.DateTimeFormat`
- **Custom UUID generators:** Use native `crypto.randomUUID()` instead
- **IndexedDB direct manipulation:** Firestore handles offline caching automatically

**Source:** Web search results show [2026 vanilla JS trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) emphasize native APIs and minimal dependencies.

## Open Questions

Things that couldn't be fully resolved:

1. **Firestore offline persistence with session writes**
   - What we know: Firestore SDK caches writes locally when offline, syncs on reconnect
   - What's unclear: How session subcollection writes behave with enablePersistence() - do they cache reliably?
   - Recommendation: Test offline behavior explicitly - complete session while offline, verify it syncs on reconnect

2. **Maximum realistic project count**
   - What we know: 100 projects × 150 bytes = 15 KB (safe), 1000 projects = 150 KB (still safe)
   - What's unclear: At what point does UI performance degrade with dropdown rendering?
   - Recommendation: Start with 100 project limit, monitor performance. If users hit limit, migrate to separate collection in future phase.

3. **Composite index auto-creation timing**
   - What we know: Firestore auto-creates indexes from error links, takes 5-10 minutes
   - What's unclear: Can indexes be pre-defined in `firestore.indexes.json` without Firebase CLI?
   - Recommendation: Let first query fail with helpful error, user clicks link to create index. Document this in deployment notes.

4. **Handling deleted projects in historical session data**
   - What we know: Session records reference `projectId`, projects are deletable
   - What's unclear: Should analytics show "Deleted Project" for orphaned sessions, or hide them?
   - Recommendation: Keep session data immutable (historical record). Analytics should show "Deleted Project" label for orphaned sessions.

## Sources

### Primary (HIGH confidence)
- [Firebase Firestore Structure Data](https://firebase.google.com/docs/firestore/manage-data/structure-data) - Subcollections vs root collections guidance
- [Firestore Best Practices - Understand Reads/Writes at Scale](https://firebase.google.com/docs/firestore/understand-reads-writes-scale) - Hot spot avoidance, write limits
- [Firestore Batch Writes and Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) - Atomic operations
- [Firestore Storage Size Calculations](https://firebase.google.com/docs/firestore/storage-size) - Document size limits (1 MiB)
- [Firestore Composite Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview) - Multi-field query indexing
- [MDN: `<dialog>` Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) - Native modal implementation
- [MDN: crypto.randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) - UUID generation
- [MDN: performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) - High-precision timing
- [MDN: Date.now()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now) - Timestamp generation

### Secondary (MEDIUM confidence)
- [State Management in Vanilla JS: 2026 Trends - Medium](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) - Modern vanilla JS patterns
- [Firestore Query Performance Best Practices](https://estuary.dev/blog/firestore-query-best-practices/) - Query optimization guidance
- [Firestore Limitations & Workarounds](https://estuary.dev/blog/firestore-limitations/) - Document size, query limits
- [Firestore Schema Migration - DEV Community](https://dev.to/swimmingkiim/how-to-migrate-firestore-schema-1801) - Additive field changes, backward compatibility
- [UUID Generator Complete Guide - DEV Community](https://dev.to/hardik_b2d8f0bca/uuid-generator-the-complete-guide-to-universally-unique-identifiers-566d) - UUID versions comparison
- [Client-Side Form Validation - MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation) - HTML5 validation patterns

### Tertiary (LOW confidence)
- [Local-First with Cloud Sync using Firestore - Captain Codeman](https://www.captaincodeman.com/local-first-with-cloud-sync-using-firestore-and-svelte-5-runes) - Offline-first patterns (Svelte-specific)
- [Firestore Batches vs. Transactions - Medium](https://medium.com/@talhatlc/firestore-batches-vs-transactions-when-and-how-to-use-them-49a83e8a7c42) - When to use each

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All tools already integrated or native APIs
- Architecture (Firestore data model): **HIGH** - Official Firebase documentation, verified patterns
- Architecture (UI patterns): **HIGH** - Native HTML APIs, no experimental features
- Session recording pattern: **HIGH** - Batch writes are documented, tested approach
- Project management pattern: **MEDIUM** - Embedded array approach is simple but scale limits unverified in production
- Pitfalls: **HIGH** - Based on official documentation and common Firestore gotchas

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - Firebase and vanilla JS patterns are stable)

**Research notes:**
- No experimental features used - all patterns rely on stable, well-documented APIs
- Firestore subcollections approach is standard practice for time-series data
- Native browser APIs (`<dialog>`, `crypto.randomUUID()`) have excellent browser support in 2026
- Vanilla JS patterns align with 2026 trend away from frameworks for focused apps
- Data migration approach is additive-only (no breaking changes to existing schema)
