# Phase 5: Premium Personalization & Export - Research

**Researched:** 2026-02-08
**Domain:** CSS theming, audio management, CSV export, premium feature UX
**Confidence:** HIGH

## Summary

Phase 5 delivers the "feel premium on day one" experience through visual customization (color themes), auditory personalization (audio categories and alert chimes), and data portability (CSV export). This research covers four technical domains:

1. **CSS theming architecture** using custom properties and data attributes for multiple color schemes
2. **Browser-based CSV generation** with proper escaping and Blob/URL download pattern
3. **HTML5 Audio management** for multiple chime sounds and audio categories
4. **Firestore date range queries** for session data filtering

**Key architectural insight:** The existing codebase already uses `data-theme` and `data-mode` attributes with CSS custom properties for light/dark theming. Phase 5 extends this pattern by adding new theme values (e.g., `data-theme="ocean"`, `data-theme="forest"`) and storing the preference in localStorage. The audio system from Phase 1 provides a proven pattern (category switching, station navigation) that can be replicated for chime selection.

**Primary recommendation:** Define 4-6 premium themes as additional CSS rulesets using the existing custom property pattern, add 2-4 audio categories to the existing `AUDIO_STATIONS` object, create a chime selector UI mirroring the audio category pattern, and implement CSV export using native Blob/URL APIs with RFC 4180 escaping.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | Native | Theme color management | Already used, zero dependencies |
| `data-theme` attribute | HTML5 | Theme switching mechanism | Already implemented for light/dark |
| HTML5 Audio Element | Native | Chime sound playback | Simple API, Promise-based, works everywhere |
| Blob + URL.createObjectURL | Native | CSV file generation/download | Standard browser API, no dependencies |
| LocalStorage | Native | Theme/preference persistence | Already used for audio preferences |
| Firebase Firestore Timestamp | SDK built-in | Date range queries | Correct type for timestamp comparisons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `<dialog>` element | Native HTML | Theme/chime selector UI | Consistent with Phase 4 project dialogs |
| `<input type="date">` | Native HTML | Date range picker UI | Simple, accessible, native validation |
| Firestore `.where()` + `.orderBy()` | SDK built-in | Session filtering by date | Required for CSV export date ranges |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS custom properties | CSS-in-JS libraries | Custom properties are native, zero dependencies, already used |
| Native date inputs | Third-party date pickers | Native inputs work on all devices, accessible, no dependencies |
| Blob API for CSV | Third-party libraries (Papa Parse, export-to-csv) | Blob is native, CSV format is simple enough to hand-roll |
| HTML5 Audio | Web Audio API (AudioContext) | Web Audio API has autoplay policy issues, HTML5 Audio is simpler for short chimes |

**Installation:**
No new packages required. All functionality uses existing patterns and native browser APIs.

## Architecture Patterns

### Pattern 1: CSS Theme Architecture with Multiple Themes

**What:** Extend existing `data-theme` attribute pattern to support 4-6 color schemes beyond light/dark.

**Current structure:**
```css
/* index.html already has: */
html[data-theme="light"][data-mode="focus"] { --bg: #fdf6f4; --primary: #e74c3c; ... }
html[data-theme="dark"][data-mode="focus"] { --bg: #1a1215; --primary: #e74c3c; ... }
```

**Extend with premium themes:**
```css
/* Ocean theme */
html[data-theme="ocean"][data-mode="focus"] {
  --bg: #f0f8ff;
  --surface: #ffffff;
  --primary: #2980b9;
  --primary-hover: #1f618d;
  --text: #2c3e50;
  --text-secondary: #566573;
  --ring-track: #aed6f1;
  --border: #d6eaf8;
}

html[data-theme="ocean"][data-mode="break"] {
  --bg: #e8f8f5;
  --primary: #16a085;
  /* ... */
}

/* Forest theme */
html[data-theme="forest"][data-mode="focus"] {
  --bg: #f4f8f4;
  --primary: #27ae60;
  /* ... */
}

/* Sunset theme */
html[data-theme="sunset"][data-mode="focus"] {
  --bg: #fff5ee;
  --primary: #ff6b6b;
  /* ... */
}

/* Lavender theme */
html[data-theme="lavender"][data-mode="focus"] {
  --bg: #f8f5ff;
  --primary: #9b59b6;
  /* ... */
}

/* Charcoal theme (dark premium) */
html[data-theme="charcoal"][data-mode="focus"] {
  --bg: #1a1a1a;
  --primary: #ff7675;
  /* ... */
}
```

**JavaScript pattern:**
```javascript
// Extend existing theme toggle logic
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Theme selector UI
function showThemeSelector() {
  const themes = ['light', 'dark', 'ocean', 'forest', 'sunset', 'lavender', 'charcoal'];
  const premiumThemes = ['ocean', 'forest', 'sunset', 'lavender', 'charcoal'];

  // Check if user has premium
  if (!state.subscription?.isPremium) {
    // Show only light/dark, lock premium themes
  }

  // Render theme grid with preview cards
}
```

**Why this works:**
- Leverages existing architecture (zero breaking changes)
- CSS custom properties provide consistent theming across all components
- `data-mode` attribute still controls focus/break color shifts
- LocalStorage pattern already established for preferences

**Source:** [CSS Custom Properties and Theming | CSS-Tricks](https://css-tricks.com/css-custom-properties-theming/), [A mostly complete guide to theme switching in CSS and JS](https://medium.com/@cerutti.alexander/a-mostly-complete-guide-to-theme-switching-in-css-and-js-c4992d5fd0e2)

### Pattern 2: Audio Category Extension

**What:** Add 2-4 categories to existing `AUDIO_STATIONS` object from Phase 1.

**Current structure (from Phase 1):**
```javascript
const AUDIO_STATIONS = {
  ambient: [
    { name: 'Drone Zone', url: 'https://ice5.somafm.com/dronezone-256-mp3', genre: 'Ambient Drone' },
    // ... more stations
  ],
  binaural: [
    { name: 'Drone Zone (Focus)', url: '...', genre: 'Focus Enhancement' },
    // ... more stations
  ],
};

const AUDIO_CATEGORY_LABELS = {
  ambient: 'Ambient',
  binaural: 'Focus Beats',
};
```

**Extend with premium categories:**
```javascript
const AUDIO_STATIONS = {
  // Existing free categories
  ambient: [ /* ... */ ],
  binaural: [ /* ... */ ],

  // Premium categories
  lofi: [
    { name: 'Lush', url: 'https://ice1.somafm.com/lush-128-mp3', genre: 'Lo-fi Chill' },
    { name: 'Groove Salad', url: 'https://ice1.somafm.com/groovesalad-256-mp3', genre: 'Downtempo' },
  ],
  classical: [
    { name: 'Mission Control', url: 'https://ice1.somafm.com/missioncontrol-128-mp3', genre: 'Classical Space' },
    { name: 'Suburbs of Goa', url: 'https://ice1.somafm.com/suburbsofgoa-128-mp3', genre: 'World Classical' },
  ],
  nature: [
    { name: 'Drone Zone', url: 'https://ice5.somafm.com/dronezone-256-mp3', genre: 'Nature Ambient' },
  ],
};

const AUDIO_CATEGORY_LABELS = {
  ambient: 'Ambient',
  binaural: 'Focus Beats',
  lofi: 'Lo-fi Beats',      // Premium
  classical: 'Classical',    // Premium
  nature: 'Nature Sounds',   // Premium
};

// Lock premium categories behind subscription check
function switchAudioCategory(category) {
  const premiumCategories = ['lofi', 'classical', 'nature'];
  if (premiumCategories.includes(category) && !state.subscription?.isPremium) {
    showUpgradePrompt('Unlock premium audio categories');
    return;
  }
  // ... existing category switch logic
}
```

**Why this works:**
- Reuses existing audio panel UI and category switching logic
- Same visual pattern (category buttons, station navigation)
- Premium check at interaction time (no UI changes needed)

**Source:** Existing Phase 1 implementation verified in `index.html` lines 2463-2480

### Pattern 3: Chime Sound Management

**What:** Pre-load 5-6 chime sound files and play selected chime on timer completion.

**Implementation:**
```javascript
// Define chime options
const CHIME_SOUNDS = {
  default: { name: 'Classic Bell', file: 'sounds/chime-bell.mp3' },
  soft: { name: 'Soft Chime', file: 'sounds/chime-soft.mp3' },
  digital: { name: 'Digital Beep', file: 'sounds/chime-digital.mp3' },
  gong: { name: 'Meditation Gong', file: 'sounds/chime-gong.mp3' },     // Premium
  singing: { name: 'Singing Bowl', file: 'sounds/chime-bowl.mp3' },     // Premium
  crystal: { name: 'Crystal Chime', file: 'sounds/chime-crystal.mp3' }, // Premium
};

// Pre-load audio elements
const chimeAudioElements = {};
function preloadChimes() {
  for (const [key, chime] of Object.entries(CHIME_SOUNDS)) {
    const audio = new Audio(chime.file);
    audio.preload = 'auto';
    chimeAudioElements[key] = audio;
  }
}

// Play selected chime
function playChime() {
  const selectedChime = state.selectedChime || 'default';
  const audio = chimeAudioElements[selectedChime];

  if (audio) {
    audio.currentTime = 0; // Reset to start
    audio.play().catch(err => {
      console.warn('Chime autoplay blocked:', err);
      // Fallback: show notification without sound
    });
  }
}

// Call in existing timer completion logic
function onTimerComplete() {
  // ... existing completion logic
  if (state.soundEnabled) {
    playChime();
  }
  // ... notification, stats update, etc.
}

// Chime selector UI
function showChimeSelector() {
  const dialog = document.getElementById('chimeDialog');
  const container = dialog.querySelector('.chime-grid');

  container.innerHTML = '';
  for (const [key, chime] of Object.entries(CHIME_SOUNDS)) {
    const isPremium = ['gong', 'singing', 'crystal'].includes(key);
    const isLocked = isPremium && !state.subscription?.isPremium;

    const card = document.createElement('button');
    card.className = `chime-card ${key === state.selectedChime ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
    card.innerHTML = `
      <span class="chime-name">${chime.name}</span>
      ${isPremium ? '<span class="premium-badge">Premium</span>' : ''}
      <button class="chime-preview" onclick="previewChime('${key}')">Preview</button>
    `;

    card.addEventListener('click', () => {
      if (isLocked) {
        showUpgradePrompt('Unlock premium chimes');
        return;
      }
      selectChime(key);
    });

    container.appendChild(card);
  }

  dialog.showModal();
}

function previewChime(key) {
  const audio = chimeAudioElements[key];
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

function selectChime(key) {
  state.selectedChime = key;
  localStorage.setItem('selectedChime', key);
  updateChimeSelectorUI();
}
```

**Autoplay policy handling:**
- HTML5 Audio `.play()` returns a Promise
- If autoplay is blocked, catch the error and fail gracefully
- User interaction (timer start, settings click) counts as gesture for autoplay
- Since chime plays AFTER timer completes (user-initiated session), should pass autoplay policy

**Why this approach:**
- Simple Audio() objects, no Web Audio API complexity
- Pre-loading prevents delay on timer completion
- `currentTime = 0` allows same sound to replay immediately
- Promise-based error handling for autoplay policy

**Source:** [How to play a sound with JavaScript | Go Make Things](https://gomakethings.com/how-to-play-a-sound-with-javascript/), [Autoplay guide for media and Web Audio APIs - MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)

### Pattern 4: CSV Export with Date Range Filter

**What:** Generate CSV from Firestore session data with date range filtering.

**Firestore query pattern:**
```javascript
async function exportSessionsCSV(startDate, endDate) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  // Convert Date objects to Firestore Timestamps
  const startTimestamp = firebase.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = firebase.firestore.Timestamp.fromDate(endDate);

  // Query sessions subcollection with date range
  const sessionsRef = db.collection('users').doc(user.uid).collection('sessions');
  const query = sessionsRef
    .where('startedAt', '>=', startTimestamp)
    .where('startedAt', '<=', endTimestamp)
    .orderBy('startedAt', 'desc');

  const snapshot = await query.get();

  // Convert to CSV
  const sessions = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    sessions.push({
      date: data.startedAt.toDate().toISOString(),
      duration: data.duration,
      project: data.projectId ? getProjectName(data.projectId) : 'No Project',
      hourOfDay: data.hourOfDay,
      dayOfWeek: data.dayOfWeek,
    });
  });

  generateAndDownloadCSV(sessions);
}
```

**CSV generation with RFC 4180 escaping:**
```javascript
function escapeCSVField(field) {
  if (field == null) return '';

  const str = String(field);

  // If field contains comma, newline, or double quote, wrap in quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    // Escape existing quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function generateAndDownloadCSV(sessions) {
  // Define headers
  const headers = ['Date', 'Duration (min)', 'Project', 'Hour of Day', 'Day of Week'];

  // Build CSV rows
  const rows = [headers];
  sessions.forEach(session => {
    rows.push([
      escapeCSVField(session.date),
      escapeCSVField(session.duration),
      escapeCSVField(session.project),
      escapeCSVField(session.hourOfDay),
      escapeCSVField(session.dayOfWeek),
    ]);
  });

  // Join rows with newlines, fields with commas
  const csvContent = rows.map(row => row.join(',")).join('\n');

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `pomodoro-sessions-${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL object
  URL.revokeObjectURL(url);
}
```

**Date range UI pattern:**
```html
<dialog id="exportDialog">
  <h2>Export Sessions</h2>
  <form method="dialog">
    <label>
      Start Date
      <input type="date" id="exportStartDate" required>
    </label>
    <label>
      End Date
      <input type="date" id="exportEndDate" required>
    </label>
    <div class="dialog-actions">
      <button type="button" onclick="exportSessions()">Export CSV</button>
      <button type="button" onclick="closeExportDialog()">Cancel</button>
    </div>
  </form>
</dialog>
```

**Why this approach:**
- Native `<input type="date">` provides date picker UI on all platforms
- Firestore `.where()` with `>=` and `<=` is standard date range pattern
- RFC 4180 escaping handles all edge cases (commas, quotes, newlines)
- Blob + URL.createObjectURL is browser-standard download pattern
- No external dependencies

**Sources:**
- CSV escaping: [Comma-separated values - Wikipedia](https://en.wikipedia.org/wiki/Comma-separated_values), [How to escape commas in CSV](https://bobbyhadz.com/blog/how-to-escape-comma-in-csv)
- Firestore queries: [Firestore date range query discussion](https://github.com/firebase/firebase-js-sdk/discussions/7224)
- CSV download: [JavaScript export to CSV without library](https://writtenforcoders.com/blog/javascript-export-to-csv-without-using-a-library)

### Anti-Patterns to Avoid

- **Hand-rolling theme CSS without custom properties:** Leads to CSS duplication, hard to maintain
- **Loading all chime audio files on page load:** Wastes bandwidth, use lazy loading or pre-load on settings open
- **CSV generation without escaping:** Breaks when project names contain commas or quotes
- **Querying all sessions then filtering in JavaScript:** Wastes Firestore reads, filter at query level
- **Using separate `<audio>` tags in HTML:** Creates DOM bloat, use JavaScript Audio() objects instead

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing/formatting | Custom date string parser | `Date.toISOString()`, `Timestamp.fromDate()` | Edge cases (timezones, DST, leap years) |
| CSV escaping | Regex-based field wrapper | RFC 4180 escaping function (double quotes) | Nested quotes, newlines in fields break naive regex |
| Theme color generation | HSL color math for variants | Pre-defined color palettes | Color theory is hard, accessibility contrast ratios |
| Audio format conversion | Multi-format audio loading | Single MP3 format | Modern browsers support MP3 universally |

**Key insight:** CSV format seems simple but has subtle escaping rules. RFC 4180 standard handles all edge cases. Hand-rolled CSV generators often break on project names like: `"Project "Alpha", Phase 1"`.

## Common Pitfalls

### Pitfall 1: Theme Flash on Page Load
**What goes wrong:** User sees default theme briefly before saved theme loads from localStorage, causing visual flash.

**Why it happens:** CSS loads before JavaScript, localStorage read happens after DOM parsing.

**How to avoid:**
- Add inline `<script>` in `<head>` (before CSS) to read localStorage and set `data-theme` attribute immediately
- Critical theme restoration code runs synchronously before page render

**Warning signs:**
- Dark mode users report seeing white flash
- Theme attribute changes in DevTools timeline after initial paint

**Solution:**
```html
<head>
  <script>
    // Runs before CSS, before DOM, synchronously
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  </script>
  <style>
    /* Theme CSS here */
  </style>
</head>
```

**Source:** [The best light/dark mode theme toggle in JavaScript](https://whitep4nth3r.com/blog/best-light-dark-mode-theme-toggle-javascript/)

### Pitfall 2: Autoplay Policy Blocking Audio
**What goes wrong:** Chime doesn't play on timer completion, even though sound is enabled.

**Why it happens:** Browser autoplay policies require user gesture before audio playback. If chime plays without recent user interaction, it's blocked.

**How to avoid:**
- Timer completion counts as result of user gesture (starting timer)
- If blocked, fail gracefully with visual notification only
- Use `.play()` Promise rejection to detect blocked autoplay

**Warning signs:**
- Console errors: "play() failed because user didn't interact"
- Audio works in development but fails in production

**Solution:**
```javascript
audio.play().catch(err => {
  if (err.name === 'NotAllowedError') {
    console.warn('Autoplay blocked, showing visual notification only');
    showVisualNotification();
  }
});
```

**Source:** [Autoplay policy in Chrome](https://developer.chrome.com/blog/autoplay), [Autoplay guide - MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)

### Pitfall 3: CSV Excel Encoding Issues
**What goes wrong:** Excel shows garbled characters for non-ASCII text (emoji, accented characters) in exported CSV.

**Why it happens:** Excel expects CSV files to have UTF-8 BOM (Byte Order Mark) to correctly detect UTF-8 encoding. Without BOM, Excel defaults to legacy encoding.

**How to avoid:**
- Add UTF-8 BOM (`\uFEFF`) at the start of CSV content
- Ensures Excel opens file with correct encoding

**Warning signs:**
- Project names with emoji show as `???` in Excel
- Accented characters (café) render incorrectly

**Solution:**
```javascript
const csvContent = '\uFEFF' + rows.map(row => row.join(',')).join('\n');
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
```

**Source:** [CSV special characters in migrations](https://support.aodocs.com/hc/en-us/articles/5466301293083-Special-characters-in-CSV-files-for-migrations-from-scratch)

### Pitfall 4: Firestore Query Requires Index
**What goes wrong:** Date range query fails with "requires an index" error on first run.

**Why it happens:** Firestore composite queries (multiple `.where()` + `.orderBy()`) require indexes. The error message includes a link to create the index.

**How to avoid:**
- Click the error link to auto-create index in Firebase Console
- Or pre-create index before deploying feature
- Index creation takes 1-5 minutes

**Warning signs:**
- Query works in emulator but fails in production
- Error message: "The query requires an index"

**Solution:**
1. Run query in production (will fail)
2. Click the error link to create index
3. Wait for index build to complete
4. Query succeeds on next attempt

**Source:** [Firestore query data documentation](https://firebase.google.com/docs/firestore/query-data/queries)

### Pitfall 5: Theme Scope Collision with data-mode
**What goes wrong:** Premium theme colors don't update when timer switches between focus and break modes.

**Why it happens:** CSS specificity - existing `data-theme` + `data-mode` selectors might not cover new theme values.

**How to avoid:**
- Define CSS rules for ALL combinations: `html[data-theme="ocean"][data-mode="focus"]` AND `html[data-theme="ocean"][data-mode="break"]`
- Test theme switching during active timer (focus/break transitions)

**Warning signs:**
- Theme looks correct in focus mode but breaks in break mode
- Colors don't shift between focus/break like light/dark themes do

**Solution:**
```css
/* Define BOTH modes for each theme */
html[data-theme="ocean"][data-mode="focus"] { /* ... */ }
html[data-theme="ocean"][data-mode="break"] { /* ... */ }
html[data-theme="ocean"][data-mode="longbreak"] { /* ... */ }
```

**Source:** Existing implementation pattern in `index.html` lines 24-78

## Code Examples

Verified patterns from current codebase and official sources:

### Theme Persistence (from existing codebase)
```javascript
// Read theme on page load (existing pattern)
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// Update theme on user selection (existing pattern)
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}
```

### Firestore Timestamp Query (official Firebase docs)
```javascript
// Source: https://firebase.google.com/docs/firestore/query-data/queries
const startDate = firebase.firestore.Timestamp.fromDate(new Date('2026-01-01'));
const endDate = firebase.firestore.Timestamp.fromDate(new Date('2026-01-31'));

const sessionsRef = db.collection('users').doc(uid).collection('sessions');
const query = sessionsRef
  .where('startedAt', '>=', startDate)
  .where('startedAt', '<=', endDate)
  .orderBy('startedAt', 'desc')
  .limit(1000);

const snapshot = await query.get();
```

### CSV RFC 4180 Escaping
```javascript
// Source: RFC 4180 standard
function toCSV(data) {
  const escape = (field) => {
    if (field == null) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return data.map(row => row.map(escape).join(',')).join('\n');
}
```

### Audio Preload and Play
```javascript
// Pre-load audio
const audio = new Audio('chime.mp3');
audio.preload = 'auto';

// Play with autoplay policy handling
function playSound() {
  audio.currentTime = 0;
  audio.play().catch(err => {
    console.warn('Audio play blocked:', err.name);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate CSS files per theme | CSS custom properties with data attributes | ~2016 | Single CSS file, runtime theme switching |
| Server-side CSV generation | Client-side Blob + URL.createObjectURL | ~2015 | No server required, instant download |
| Flash/Java audio plugins | HTML5 Audio API | ~2011 | Native browser support, no plugins |
| `<select>` for date ranges | `<input type="date">` with native picker | ~2014 | Mobile-friendly, accessible, no libraries |
| Firestore `.get()` all then filter | `.where()` query filtering | Day 1 | Reduced reads, better performance |

**Deprecated/outdated:**
- **Sass color functions for theme variants:** CSS custom properties handle runtime theme switching better
- **jQuery-based CSV export plugins:** Native Blob API eliminates dependency
- **Web Audio API for simple sounds:** HTML5 Audio simpler for non-music use cases
- **Third-party date pickers (jQuery UI, Bootstrap Datepicker):** Native `<input type="date">` works on all modern browsers

## Open Questions

1. **Sound file hosting strategy**
   - What we know: Need 5-6 chime MP3 files, ~50-200KB each
   - What's unclear: Host on GitHub Pages (same domain) or use CDN?
   - Recommendation: Host in `/sounds/` folder on GitHub Pages for simplicity, same origin avoids CORS

2. **Theme preview in selector**
   - What we know: Users should see theme colors before selecting
   - What's unclear: Show live preview card or just color swatches?
   - Recommendation: Color swatches + theme name (faster to build, less cognitive load)

3. **CSV date range default values**
   - What we know: Users need start/end date inputs
   - What's unclear: Default to "last 30 days" or "all time"?
   - Recommendation: Default to current month (1st to today) - balances data volume and usefulness

4. **Firestore session query limits**
   - What we know: Date range queries work, but should we limit results?
   - What's unclear: Max sessions to export (1000? 10,000? unlimited?)
   - Recommendation: Set `.limit(10000)` on query to prevent massive CSV files, show warning if limit hit

5. **Theme availability for free users**
   - What we know: Light/Dark are free, 4-6 premium themes
   - What's unclear: Show locked themes in selector or hide completely?
   - Recommendation: Show locked themes with "Premium" badge (upsell opportunity, discoverability)

## Sources

### Primary (HIGH confidence)
- [CSS Custom Properties and Theming | CSS-Tricks](https://css-tricks.com/css-custom-properties-theming/) - Custom property patterns
- [Building a color scheme | web.dev](https://web.dev/articles/building/a-color-scheme) - Theme architecture
- [Autoplay guide for media and Web Audio APIs - MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) - Audio policies
- [Firestore query data - Firebase Docs](https://firebase.google.com/docs/firestore/query-data/queries) - Date range queries
- [Comma-separated values - Wikipedia](https://en.wikipedia.org/wiki/Comma-separated_values) - RFC 4180 CSV standard
- Existing codebase (`index.html` lines 24-78, 2463-2480) - Current patterns

### Secondary (MEDIUM confidence)
- [The best light/dark mode theme toggle in JavaScript](https://whitep4nth3r.com/blog/best-light-dark-mode-theme-toggle-javascript/) - Theme flash prevention
- [A mostly complete guide to theme switching](https://medium.com/@cerutti.alexander/a-mostly-complete-guide-to-theme-switching-in-css-and-js-c4992d5fd0e2) - data-attribute pattern
- [How to play a sound with JavaScript | Go Make Things](https://gomakethings.com/how-to-play-a-sound-with-javascript/) - Simple audio playback
- [JavaScript export to CSV without library](https://writtenforcoders.com/blog/javascript-export-to-csv-without-using-a-library) - Blob download pattern
- [How to escape commas in CSV](https://bobbyhadz.com/blog/how-to-escape-comma-in-csv) - CSV escaping rules
- [Firestore date range query discussion](https://github.com/firebase/firebase-js-sdk/discussions/7224) - Timestamp query examples

### Tertiary (LOW confidence - requires validation)
- Free sound libraries: [Pixabay](https://pixabay.com/sound-effects/search/chime/), [Mixkit](https://mixkit.co/free-sound-effects/notification/) - Need to verify licensing and quality
- [localStorage theme persistence guide](https://codyhouse.co/blog/post/store-theme-color-preferences-with-localstorage) - Pattern matches existing implementation

## Metadata

**Confidence breakdown:**
- CSS theming patterns: HIGH - Verified in existing codebase, well-documented pattern
- Audio management: HIGH - HTML5 Audio is mature API, existing streaming audio implementation provides reference
- CSV export: HIGH - RFC 4180 is standard, Blob API is native and well-supported
- Firestore queries: HIGH - Official Firebase docs, pattern matches Phase 4 implementation
- Sound file sourcing: LOW - Haven't verified specific files, need to test licensing and file sizes

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain, CSS/browser APIs change slowly)

**What might be missing:**
- Accessibility considerations for theme selector (keyboard nav, screen reader labels)
- Mobile UX for chime preview (haptic feedback instead of sound?)
- CSV file size limits in browser (tested with 10,000+ sessions?)
- Service worker cache invalidation for new sound files
- Theme transition animations (CSS transitions on custom property changes?)
