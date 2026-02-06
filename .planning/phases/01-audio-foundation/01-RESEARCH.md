# Phase 1: Audio Foundation - Research

**Researched:** 2026-02-06
**Domain:** YouTube IFrame Player API in Vanilla JS Single-File App
**Confidence:** HIGH

## Summary

Phase 1 establishes the technical foundation for YouTube-based background audio in the pomodoro timer. The core challenge is integrating the YouTube IFrame Player API into an existing vanilla JavaScript single-file app (~2700 lines) wrapped in an IIFE pattern, while maintaining the project's zero-dependency philosophy.

Key findings: (1) YouTube's API loads asynchronously via dynamic script injection and requires a global callback that must be explicitly attached to `window` when working inside IIFEs, (2) YouTube ToS requires embedded players be at least 200x200px and visible, (3) specific playerVars are critical for PWA mobile compatibility (`playsinline: 1`), and (4) service worker must exclude YouTube domains to prevent stale API caching.

**Primary recommendation:** Load YouTube API lazily on first audio enable, attach global callback via `window.onYouTubeIframeAPIReady`, place player in fixed position at bottom of viewport (200x200px minimum), and gate all playback behind user interaction to satisfy autoplay policies.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| YouTube IFrame Player API | Latest (CDN) | Audio streaming + playback control | Official Google API, zero npm deps, CDN-loaded (matches Firebase pattern in app) |
| Web Audio API | Native | Timer chimes/alerts | Already in use, no changes needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | — | — | No additional libraries needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| YouTube IFrame API | Spotify Web Playback SDK | Requires Premium subscription, OAuth flow, API costs |
| YouTube IFrame API | Self-hosted audio files | Hosting costs, copyright issues, storage limitations |
| YouTube IFrame API | SoundCloud Widget API | Smaller music library, less reliable for long-duration content |
| npm youtube-player wrapper | Direct API usage | Adds build dependency, defeats vanilla JS goal |

**Installation:**
```javascript
// Loaded dynamically at runtime (no npm install needed)
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, firstScriptTag);
```

## Architecture Patterns

### Recommended Project Structure (Within index.html IIFE)
```
<script>
  (() => {
    'use strict';

    // --- Existing sections ---
    // Constants, DOM refs, State, Storage, Timer functions...

    // --- NEW: YouTube Player Component (lines ~2200-2350) ---
    // YouTubePlayer wrapper class
    // API loading logic
    // Global callback bridge

    // --- NEW: Audio Manager (lines ~2350-2500) ---
    // AudioManager object
    // Timer integration hooks
    // Playlist management

    // --- NEW: Audio UI handlers (lines ~2500-2600) ---
    // Event listeners for audio controls
    // UI update functions

    // --- Existing: Init function ---
    // Add audio initialization if enabled

    init();
  })();
</script>
```

### Pattern 1: Global Callback Bridge (CRITICAL for IIFE)
**What:** YouTube API requires `onYouTubeIframeAPIReady` to exist on global `window` object, but app code lives in IIFE closure.

**When to use:** Required for any IIFE/module pattern integration with YouTube API.

**Example:**
```javascript
// INSIDE IIFE - bridge the callback to internal function
(() => {
  'use strict';

  let player = null;
  let apiReady = false;
  let initQueue = [];

  // Internal initialization function
  function initYouTubePlayer() {
    if (!apiReady) {
      initQueue.push(arguments);
      return;
    }
    // Create player once API is ready
    player = new YT.Player('youtube-player-container', {
      height: '200',
      width: '200',
      videoId: 'jfKfPfyJRdk',
      playerVars: {
        autoplay: 0,
        controls: 1,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        enablejsapi: 1
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  }

  // CRITICAL: Expose callback globally (must be on window)
  window.onYouTubeIframeAPIReady = function() {
    apiReady = true;
    // Process any queued initialization requests
    while (initQueue.length > 0) {
      initYouTubePlayer.apply(null, initQueue.shift());
    }
  };

  // Load API script (only when user enables audio)
  function loadYouTubeAPI() {
    if (window.YT || document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      return; // Already loaded
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }
})();
```

**Source:** [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference), [Working with the YouTube Player API](https://chromatichq.com/insights/working-youtube-player-api-iframe-embeds/)

### Pattern 2: Defensive State Checking
**What:** Always verify player state and API readiness before method calls.

**When to use:** Every interaction with YouTube player API.

**Example:**
```javascript
const YouTubePlayer = {
  player: null,
  ready: false,

  play() {
    if (!this.player || !this.ready) return;
    if (typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  },

  pause() {
    if (!this.player || !this.ready) return;
    if (typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  },

  setVolume(volume) {
    if (!this.player || !this.ready) return;
    if (typeof this.player.setVolume === 'function') {
      this.player.setVolume(Math.max(0, Math.min(100, volume)));
    }
  }
};
```

### Pattern 3: Minimal State Extension
**What:** Add only Phase 1-required state, not future phase features.

**When to use:** State object extension for Phase 1.

**Example:**
```javascript
const state = {
  // ... existing timer state ...
  audio: {
    enabled: false,          // User has enabled audio feature
    playing: false,          // Currently playing
    volume: 50,              // YouTube player volume (0-100)
    currentVideoId: null     // Currently loaded video
  }
};
```

**Note:** Phase 1 does NOT include: playlists, categories, shuffle, pauseOnBreak, separate alert volume. These come in later phases.

### Pattern 4: Timer Integration Hooks
**What:** Minimal one-line additions to existing timer functions.

**When to use:** Connecting audio to timer lifecycle.

**Example:**
```javascript
// EXISTING timer functions - add ONE line to each

function start() {
  if (state.status === 'running') return;
  // ... existing start logic ...
  state.status = 'running';
  state.intervalId = setInterval(tick, 250);

  AudioManager.onTimerStart(); // +1 line

  updateAll();
}

function pause() {
  if (state.status !== 'running') return;
  // ... existing pause logic ...
  state.status = 'paused';

  AudioManager.onTimerPause(); // +1 line

  updateAll();
}
```

**Total impact:** 4 one-line additions across `start()`, `pause()`, `complete()`, `reset()`.

### Anti-Patterns to Avoid
- **Hidden player (`display: none`):** Violates YouTube ToS, risks API key revocation
- **Calling API methods before ready:** Results in `YT is not defined` or `player.method is not a function`
- **Hardcoded global function:** `function onYouTubeIframeAPIReady()` won't be accessible inside IIFE closure
- **Caching YouTube API in service worker:** Leads to stale API bugs when Google updates
- **Autoplay without user interaction:** Violates mobile browser policies, silently fails

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video format detection | Custom codec/format parser | YouTube API's built-in handling | API handles all formats (video/audio, live streams, premieres) automatically |
| Retry logic for failed loads | Custom exponential backoff | YouTube API error events + `loadVideoById()` | API provides specific error codes (2, 5, 100, 101, 150) to handle different failure types |
| Player size calculations | Custom responsive logic | CSS with min/max constraints | YouTube enforces 200x200 minimum; better to design around constraint than fight it |
| Volume persistence | Custom state management | Leverage existing `localStorage` pattern | App already has `STORAGE_KEYS` constant and save/load functions |

**Key insight:** YouTube's API is more robust than it appears. Error codes are comprehensive, state changes are reliable, and the player handles edge cases (region restrictions, age gates, deleted videos) automatically through the `onError` event. Trust the API, handle its events properly.

## Common Pitfalls

### Pitfall 1: Global Callback Not Accessible in IIFE
**What goes wrong:** YouTube's API looks for `window.onYouTubeIframeAPIReady` to signal readiness. If app code is wrapped in an IIFE (like this app is), a function declaration inside the IIFE won't be accessible globally. Result: API loads but never signals ready, player never initializes.

**Why it happens:** Module patterns and IIFEs hide variables from global scope by design. YouTube's API predates modern module systems and requires a specific global function name.

**How to avoid:** Explicitly attach callback to window object:
```javascript
// WRONG (inside IIFE)
function onYouTubeIframeAPIReady() { /* never called */ }

// RIGHT (inside IIFE)
window.onYouTubeIframeAPIReady = function() { /* called by API */ };
```

**Warning signs:**
- YouTube API script loads (visible in Network tab) but player never appears
- Console shows no errors
- `window.YT` object exists but player container stays empty

**Source:** [Chromatic: Working with YouTube Player API](https://chromatichq.com/insights/working-youtube-player-api-iframe-embeds/)

### Pitfall 2: YouTube ToS Violation - Hidden Player
**What goes wrong:** YouTube's Terms of Service explicitly prohibit hiding the embedded player via CSS (`display: none`, `visibility: hidden`, or sizes below 200x200px). Violations can result in API access revocation, breaking the entire audio feature.

**Why it happens:** Developers want audio-only playback and try to hide the video player for cleaner UI. This is explicitly forbidden.

**How to avoid:**
- Design with a visible player from the start (minimum 200x200px per ToS)
- Embrace it as a UI feature (fixed position, compact but visible)
- Use 200x200 or 200x113 (16:9 minimum) sizing

**Warning signs:**
- Temptation to use `display: none` or `opacity: 0`
- Player sized below 200x200px
- Player positioned off-screen

**Source:** [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)

### Pitfall 3: Autoplay Policy Violations
**What goes wrong:** Mobile browsers (iOS Safari, Chrome mobile) block autoplay without user interaction. Setting `autoplay: 1` in playerVars fails silently on mobile, confusing users who expect music when timer starts.

**Why it happens:** Browser autoplay policies require a user gesture (click/tap) to start audio/video playback. Timer auto-starting (via `setInterval`) doesn't count as user interaction.

**How to avoid:**
- Set `autoplay: 0` in playerVars
- Only call `player.playVideo()` after a user interaction (Start button click)
- Gate audio playback behind timer start button (user gesture)

**Warning signs:**
- Audio works on desktop but fails on mobile
- No error messages in console
- Player shows paused state unexpectedly

**Source:** [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference), project research on autoplay policies

### Pitfall 4: Service Worker Caches YouTube API
**What goes wrong:** App's service worker caches all fetched resources, including YouTube's API script. When Google updates the API, the cached version becomes stale, causing cryptic player errors or method failures.

**Why it happens:** Generic service worker patterns cache all requests by default. YouTube's API is hosted on Google's CDN and updates without version numbers in the URL.

**How to avoid:**
```javascript
// In sw.js fetch handler
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Exclude YouTube from caching
  if (url.hostname.includes('youtube.com') || url.hostname.includes('googlevideo.com')) {
    e.respondWith(fetch(e.request)); // Always fetch fresh
    return;
  }

  // Normal cache-first strategy for app assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

**Warning signs:**
- API errors after deployment
- Player works in incognito mode but not regular browsing
- Hard refresh fixes issues temporarily

### Pitfall 5: Missing `playsinline: 1` on iOS
**What goes wrong:** Without `playsinline: 1` in playerVars, iOS Safari forces video playback into fullscreen mode, breaking the PWA experience. User gets kicked out of the app context into a native video player.

**Why it happens:** iOS defaults to fullscreen for video playback to improve UX on small screens. Must be explicitly disabled for inline playback.

**How to avoid:**
```javascript
playerVars: {
  playsinline: 1,  // REQUIRED for iOS inline playback
  // ... other settings
}
```

**Warning signs:**
- Player works on desktop and Android but not iOS
- iOS kicks into fullscreen native player
- PWA loses context when audio plays

**Source:** [YouTube Player Parameters](https://developers.google.com/youtube/player_parameters)

### Pitfall 6: Race Condition - API Not Ready
**What goes wrong:** Code tries to create player instance before YouTube API script finishes loading. Results in `YT is not defined` or `YT.Player is not a function` errors.

**Why it happens:** API loads asynchronously. Eager initialization code runs before the script downloads and parses.

**How to avoid:**
```javascript
let initQueue = [];
let apiReady = false;

window.onYouTubeIframeAPIReady = function() {
  apiReady = true;
  // Process queued requests
  while (initQueue.length > 0) {
    initYouTubePlayer.apply(null, initQueue.shift());
  }
};

function initYouTubePlayer() {
  if (!apiReady) {
    initQueue.push(arguments);
    return; // Will be called when ready
  }
  // Safe to create player now
  player = new YT.Player(/* ... */);
}
```

**Warning signs:**
- `YT is not defined` in console
- Works on slow connections, fails on fast connections (race condition)
- Player initializes inconsistently

## Code Examples

Verified patterns from official sources:

### Loading YouTube API (Official Pattern)
```javascript
// Source: https://developers.google.com/youtube/iframe_api_reference
// Load API script dynamically
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}
```

### Creating Player Instance (Official Pattern)
```javascript
// Source: https://developers.google.com/youtube/iframe_api_reference
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player-container-id', {
    height: '200',
    width: '200',
    videoId: 'VIDEO_ID_HERE',
    playerVars: {
      autoplay: 0,
      controls: 1,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      rel: 0,
      enablejsapi: 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
}

function onPlayerReady(event) {
  // Player is ready, safe to call methods
  // event.target is the player instance
}

function onPlayerStateChange(event) {
  // Player state changed
  // event.data: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
  if (event.data === YT.PlayerState.ENDED) {
    // Track ended, load next video
  }
}

function onPlayerError(event) {
  // Handle errors
  // event.data: 2 (invalid ID), 5 (HTML5 error), 100 (not found), 101/150 (embed blocked)
  console.error('YouTube player error:', event.data);
}
```

### Phase 1 Minimal State Extension
```javascript
// Add to existing state object
const state = {
  // ... existing timer state (mode, status, timeRemaining, etc.) ...
  audio: {
    enabled: false,          // Has user enabled audio?
    playing: false,          // Is audio currently playing?
    volume: 50,              // Volume (0-100)
    currentVideoId: null     // Currently loaded video ID
  }
};
```

### Phase 1 Storage Keys
```javascript
const STORAGE_KEYS = {
  settings: 'pomodoro-settings',
  stats: 'pomodoro-stats',
  theme: 'pomodoro-theme',
  tasks: 'pomodoro-tasks',
  audio: 'pomodoro-audio'  // NEW for Phase 1
};

function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.audio);
    if (raw) {
      const saved = JSON.parse(raw);
      state.audio.enabled = saved.enabled ?? false;
      state.audio.volume = saved.volume ?? 50;
    }
  } catch {}
}

function saveAudioSettings() {
  localStorage.setItem(STORAGE_KEYS.audio, JSON.stringify({
    enabled: state.audio.enabled,
    volume: state.audio.volume
  }));
}
```

### Service Worker YouTube Exclusion
```javascript
// In sw.js - modify fetch handler to exclude YouTube
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Exclude YouTube and Google Video domains
  if (url.hostname.includes('youtube.com') ||
      url.hostname.includes('youtube-nocookie.com') ||
      url.hostname.includes('googlevideo.com') ||
      url.hostname.includes('ytimg.com')) {
    // Always fetch fresh, never cache
    e.respondWith(fetch(e.request));
    return;
  }

  // Normal cache-first strategy for app assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

// Don't forget to bump CACHE_NAME when modifying sw.js
const CACHE_NAME = 'pomodoro-v34'; // Increment from v33
```

### HTML: Player Container Placement
```html
<!-- Place BEFORE closing </body> tag, AFTER main app content -->
<!-- Fixed position at bottom-right, visible per YouTube ToS -->
<div id="youtube-player-container" class="youtube-player-wrapper" style="
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: none;
  z-index: 100;
"></div>

<script>
  // YouTube player initialization code here
</script>
```

### CSS: Compact Visible Player Styles
```css
/* Add to <style> section */
.youtube-player-wrapper {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 200px;
  height: 200px;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  display: none; /* Hidden by default, shown when audio enabled */
  z-index: 100;
  transition: opacity 300ms ease;
}

.youtube-player-wrapper.visible {
  display: block;
}

/* Responsive: move to bottom-center on mobile */
@media (max-width: 480px) {
  .youtube-player-wrapper {
    bottom: 60px;
    right: 50%;
    transform: translateX(50%);
  }
}
```

## Phase 1 Specific Details

### Exact DOM Position for YouTube iframe
**Where:** Insert player container HTML just before the closing `</body>` tag (after line ~1570 in index.html, before Firebase scripts).

**Why this position:**
- After all app content (doesn't interfere with layout)
- Before Firebase scripts (loaded first during page parse)
- Fixed positioning removes it from document flow
- Last in DOM = easy to find, isolated from app structure changes

**Specific line location:**
```html
<!-- Line ~1410: End of app content -->
  </div>
</div>

<!-- NEW: YouTube Player Container (add here, line ~1415) -->
<div id="youtube-player-container"></div>

<!-- Line ~1420: Existing theme toggle button -->
<button class="theme-toggle-fixed" id="themeToggle">
```

### Concrete Test Video IDs (Long-Duration, Reliable)
Based on research, these video IDs are from well-established channels with long-duration content unlikely to be removed:

| Video ID | Channel | Description | Duration | Why Reliable |
|----------|---------|-------------|----------|--------------|
| `jfKfPfyJRdk` | Lofi Girl | Classic "lofi hip hop radio - beats to relax/study to" | 24/7 stream | Most famous lofi stream, 15M+ subscribers, iconic content |
| `5qap5aO4i9A` | Chillhop Music | Lofi hip hop mix | ~3 hours | Official Chillhop channel, 2.5M+ subscribers |
| `lTRiuFIWV54` | The Jazz Cafe | Smooth Jazz | ~2 hours | Long-running jazz channel |
| `DWcJFNfaw9c` | Quiet Quest | Study Music | ~4 hours | Popular study music channel |

**Recommendation for Phase 1:** Start with `jfKfPfyJRdk` (Lofi Girl) as the single default video. It's a 24/7 live stream, so it never ends, perfect for testing and initial implementation. Add more videos in Phase 2 (playlists).

**How to verify video IDs:**
```
https://www.youtube.com/watch?v=VIDEO_ID
Example: https://www.youtube.com/watch?v=jfKfPfyJRdk
```

### Critical playerVars for Phase 1
```javascript
playerVars: {
  autoplay: 0,         // MUST be 0 (user interaction required)
  controls: 1,         // Show controls (1) for user familiarity
  disablekb: 1,        // Disable keyboard shortcuts (app has own keyboard nav)
  fs: 0,               // Hide fullscreen button (fixed size player)
  modestbranding: 1,   // Minimal YouTube branding (deprecated but harmless)
  playsinline: 1,      // CRITICAL for iOS inline playback
  rel: 0,              // Show related videos from same channel only
  enablejsapi: 1       // Enable JavaScript API control
}
```

**Do NOT include in Phase 1:**
- `loop: 1` — Handled by onStateChange event (Phase 2: auto-next track)
- `playlist` — Playlist management is Phase 2
- `start`, `end` — Track segment playback is out of scope

### Service Worker Changes Required
**File:** `sw.js`

**Line 1 change:** Bump cache version
```javascript
const CACHE_NAME = 'pomodoro-v34'; // Change from v33 to v34
```

**Lines 20-24 change:** Modify fetch handler
```javascript
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // NEW: Exclude YouTube domains from caching
  if (url.hostname.includes('youtube.com') ||
      url.hostname.includes('youtube-nocookie.com') ||
      url.hostname.includes('googlevideo.com') ||
      url.hostname.includes('ytimg.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Existing cache-first strategy
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

### Minimal State Object for Phase 1 ONLY
```javascript
// Add to state object (line ~1666)
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
  tasks: [],

  // NEW: Audio state (Phase 1 minimal)
  audio: {
    enabled: false,          // User has enabled audio feature
    playing: false,          // Currently playing (mirrors YouTube player state)
    volume: 50,              // Volume 0-100
    currentVideoId: 'jfKfPfyJRdk'  // Default to Lofi Girl
  }
};
```

**Phase 1 does NOT include:**
- `category` — Added in Phase 2 (playlists)
- `currentTrackIndex` — Added in Phase 2 (playlists)
- `pauseOnBreak` — Added in Phase 3 (smart pause)
- `alertVolume` — Added in Phase 4 (volume ducking)
- `shuffle`, `repeat` — Out of scope

### Exact CSS for YouTube ToS Compliance
YouTube requires minimum 200x200px viewport. Here's the exact CSS for a compact, visible, compliant player:

```css
/* Add to <style> section (~line 100-1300) */

/* YouTube player container - MUST be visible per ToS */
.youtube-player-wrapper {
  position: fixed;
  bottom: 80px;           /* Above keyboard hint */
  right: 20px;
  width: 200px;           /* Minimum ToS size */
  height: 200px;          /* Minimum ToS size */
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  background: var(--surface);
  display: none;          /* Hidden until audio enabled */
  z-index: 100;
  transition: opacity var(--transition);
}

.youtube-player-wrapper.visible {
  display: block;
  opacity: 1;
}

.youtube-player-wrapper.hidden {
  opacity: 0;
  pointer-events: none;
}

/* Responsive: center on mobile */
@media (max-width: 480px) {
  .youtube-player-wrapper {
    bottom: 70px;
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 200px;
    height: 200px;
  }
}
```

**Important:** Do NOT use `display: none` on the wrapper when audio is enabled. Use `opacity: 0` if you need to hide it temporarily during transitions, but it must be rendered in the DOM with proper size for ToS compliance.

### IIFE Global Callback Pattern (Exact Implementation)
This is the exact pattern to handle YouTube's global callback requirement within the app's IIFE:

```javascript
// Inside existing IIFE (line ~1579)
(() => {
  'use strict';

  // --- Existing code: Constants, DOM refs, State, etc. ---

  // --- NEW: YouTube Player Management (add after state definition, ~line 1680) ---

  let youtubePlayer = null;
  let youtubeAPIReady = false;
  let youtubeInitQueue = [];

  // CRITICAL: Expose callback globally (must be on window)
  window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube IFrame API ready');
    youtubeAPIReady = true;

    // Process any queued initialization requests
    while (youtubeInitQueue.length > 0) {
      const initFn = youtubeInitQueue.shift();
      initFn();
    }
  };

  function loadYouTubeAPI() {
    // Check if already loaded
    if (window.YT || document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      if (window.YT && window.YT.Player) {
        youtubeAPIReady = true;
      }
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  function initYouTubePlayer() {
    if (!youtubeAPIReady) {
      // Queue initialization for when API is ready
      youtubeInitQueue.push(initYouTubePlayer);
      return;
    }

    if (youtubePlayer) {
      return; // Already initialized
    }

    youtubePlayer = new YT.Player('youtube-player-container', {
      height: '200',
      width: '200',
      videoId: state.audio.currentVideoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        enablejsapi: 1
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
  }

  function onPlayerReady(event) {
    console.log('YouTube player ready');
    // Set initial volume
    event.target.setVolume(state.audio.volume);
  }

  function onPlayerStateChange(event) {
    // Update state.audio.playing based on player state
    const isPlaying = event.data === YT.PlayerState.PLAYING;
    state.audio.playing = isPlaying;
  }

  function onPlayerError(event) {
    console.error('YouTube player error:', event.data);
    // Error codes: 2 (invalid ID), 5 (HTML5 error), 100 (not found), 101/150 (embed blocked)
    // Phase 1: Just log. Phase 2 will handle auto-skip
  }

  // --- Rest of existing code ---

  init();
})();
```

**Key points:**
1. `window.onYouTubeIframeAPIReady` MUST be assigned (not declared as function)
2. Use `youtubeInitQueue` array to handle calls before API loads
3. All player variables stay inside IIFE closure
4. Only the callback function is exposed globally

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `modestbranding` parameter | Parameter deprecated but harmless | 2024 | No visual effect, but safe to include for backwards compatibility |
| npm wrapper packages | Direct API usage via CDN | Ongoing | Modern apps prefer zero-dependency CDN loading over npm packages for simple integrations |
| Audio-only players (`<audio>` tag) | YouTube IFrame with visible player | Always enforced | YouTube ToS always required visible player, but enforcement increased |
| Global function declaration | `window.functionName = function()` | ES6 modules era | Modern module patterns require explicit window attachment |

**Deprecated/outdated:**
- `modestbranding: 1` — Parameter is deprecated (no longer has effect), but including it is harmless
- `theme` and `color` parameters — Removed by YouTube, no longer have any effect

## Open Questions

Things that couldn't be fully resolved:

1. **Exact behavior on iOS PWA background mode**
   - What we know: iOS may pause YouTube playback when app goes to background
   - What's unclear: Whether PWA installed to home screen behaves differently than Safari
   - Recommendation: Test on real iOS device in Phase 1, document behavior for users

2. **YouTube API rate limits**
   - What we know: API is free for embedded playback with visible player
   - What's unclear: Undocumented rate limits on player creation or API calls
   - Recommendation: Implement defensive rate limiting (max 1 API load per session)

3. **Video availability by region**
   - What we know: Some videos are region-restricted or blocked
   - What's unclear: Best strategy for fallback when video unavailable in user's region
   - Recommendation: Phase 1 shows error message, Phase 2 auto-skips to next track

## Sources

### Primary (HIGH confidence)
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference) - Official Google documentation
- [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) - ToS minimum size requirements
- [YouTube Player Parameters](https://developers.google.com/youtube/player_parameters) - playerVars configuration
- [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies) - ToS and usage policies

### Secondary (MEDIUM confidence)
- [Chromatic: Working with YouTube Player API](https://chromatichq.com/insights/working-youtube-player-api-iframe-embeds/) - IIFE global callback pattern
- [JavaScript IIFE: Complete Guide 2026](https://sarifulislam.com/blog/javascript-iife/) - IIFE patterns
- [The 34 Best Lofi YouTube Channels 2026 | Gridfiti](https://gridfiti.com/best-lofi-youtube-channels/) - Channel recommendations
- [Lofi Girl - Wikipedia](https://en.wikipedia.org/wiki/Lofi_Girl) - Channel reliability verification

### Tertiary (LOW confidence)
- WebSearch results on ambient music channels - Used for general ecosystem understanding only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Google API, well-documented, stable
- Architecture: HIGH - Patterns verified in official docs and existing codebase
- Pitfalls: HIGH - Verified through official docs and community sources
- Video IDs: MEDIUM - Based on popular channels but not officially endorsed
- iOS behavior: LOW - Requires real device testing

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - YouTube API is stable, low change frequency)
