# Phase 1: Streaming Audio & Categories - Research

**Researched:** 2026-02-06
**Domain:** HTML5 Audio Streaming, Internet Radio Integration, PWA Audio
**Confidence:** HIGH

## Summary

This phase integrates free streaming internet radio into the existing pomodoro timer using the HTML5 `<audio>` element. The research confirms that free streaming audio sources (SomaFM, 24/7 Lofi Radio, nature sounds platforms) are readily available with direct stream URLs that work with HTML5 audio without requiring external players.

The standard approach is to use **direct stream URLs** (not YouTube embeds) with the native HTML5 `<audio>` element, custom controls built with JavaScript, and careful CORS handling. Internet radio streams are **continuous** (not individual tracks), so the "auto-advance" requirement means switching between different radio stations, not advancing through a playlist of files.

Key technical considerations include:
- Service worker must NOT cache streaming URLs (cache static assets only)
- CORS requires `crossorigin="anonymous"` attribute on audio element
- iOS Safari requires user interaction before audio plays (no autoplay)
- Continuous streams don't fire `ended` events (unlike file-based audio)
- Mobile background playback works once user initiates playback

**Primary recommendation:** Use SomaFM PLS/M3U URLs with HTML5 audio element, custom JavaScript controls, minimal/expandable UI pattern, and exclude stream URLs from service worker cache.

## Standard Stack

The established libraries/tools for streaming audio in PWAs:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 `<audio>` | Native | Audio playback | Universal browser support, no dependencies, handles streaming URLs natively |
| Web Audio API | Native | Timer chime sounds | Already in use for pomodoro chime, proven working in this codebase |
| Vanilla JavaScript | ES6+ | Audio controls | Matches existing architecture (no frameworks), lightweight |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SomaFM API | Public JSON | Channel metadata | Fetch channel list dynamically instead of hardcoding |
| Notification API | Native | Audio state feedback | Already in use for timer notifications, can reuse for audio errors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct stream URLs | PLS/M3U parser library | PLS files are "permanent" per SomaFM, but parsing adds dependency. For 4 categories with 3-5 stations each (~20 total), hardcoding direct URLs is simpler and aligns with no-dependency architecture. |
| YouTube embeds | YouTube API | Rejected in STATE.md — requires visible 200x200px player, more complex, not aligned with "audio only" requirement |
| Howler.js | Native `<audio>` | Adds 10KB+ for features we don't need (sprites, spatial audio). Native API sufficient for streaming. |

**Installation:**
```bash
# No npm packages needed - all native browser APIs
```

## Architecture Patterns

### Recommended Project Structure
Since this is a single-file app, audio code will be added inline:

```
index.html
├── HTML: <audio> element (hidden, no controls attribute)
├── HTML: Audio UI controls (minimal indicator + expandable panel)
├── CSS: Audio control styles (collapsed/expanded states)
└── JS: Audio management functions (within existing <script> block)
    ├── Audio state (in central `state` object)
    ├── Category/station data (const array)
    ├── Playback controls (play, pause, volume, station switching)
    ├── UI update functions (category selector, station list, play/pause button)
    └── Event handlers (ended, error, timeupdate, volumechange)

sw.js
└── Add stream URL exclusion to fetch handler (don't cache external radio streams)
```

### Pattern 1: Hidden Audio Element with Custom Controls
**What:** Create `<audio>` element without `controls` attribute, build custom UI with JavaScript
**When to use:** When you need custom styling and integration with existing app UI (this use case)
**Example:**
```html
<!-- Source: MDN Web Audio Element documentation -->
<audio id="bgAudio" preload="none" crossorigin="anonymous"></audio>

<div class="audio-controls">
  <button id="audioPlayPause">Play</button>
  <input type="range" id="audioVolume" min="0" max="100" value="70">
  <select id="audioCategory">
    <option value="lofi">Lofi</option>
    <option value="ambient">Ambient</option>
  </select>
</div>

<script>
const audio = document.getElementById('bgAudio');
const playPauseBtn = document.getElementById('audioPlayPause');

playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play().catch(err => console.error('Playback failed:', err));
    playPauseBtn.textContent = 'Pause';
  } else {
    audio.pause();
    playPauseBtn.textContent = 'Play';
  }
});

document.getElementById('audioVolume').addEventListener('input', (e) => {
  audio.volume = e.target.value / 100;
});
</script>
```

### Pattern 2: Minimal Indicator with Expandable Controls
**What:** Show small audio indicator (e.g., music note icon) that expands to full controls on click
**When to use:** When screen space is limited and audio is secondary to main app function (this use case)
**Example:**
```css
/* Source: CSS-Tricks custom audio player patterns */
.audio-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background: var(--surface);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  transition: all 300ms ease;
}

.audio-indicator.expanded {
  width: 320px;
  height: auto;
  border-radius: var(--radius-md);
}

.audio-controls-full {
  display: none;
  padding: 16px;
}

.audio-indicator.expanded .audio-controls-full {
  display: block;
}
```

### Pattern 3: Station Switching for "Auto-Advance"
**What:** Since internet radio is continuous (no `ended` event), "auto-advance" means switching stations within a category
**When to use:** This specific requirement interprets "tracks auto-advance" as "can switch between stations"
**Example:**
```javascript
// Source: Research on continuous streaming behavior
const categories = {
  lofi: [
    { name: 'Groove Salad', url: 'https://ice5.somafm.com/groovesalad-256-mp3' },
    { name: 'Lofi Hip Hop Radio', url: 'https://streams.chillhop.com/lofihiphop' },
    { name: 'Fluid', url: 'https://ice1.somafm.com/fluid-128-mp3' }
  ],
  ambient: [
    { name: 'Drone Zone', url: 'https://ice5.somafm.com/dronezone-256-mp3' },
    { name: 'Deep Space One', url: 'https://ice1.somafm.com/deepspaceone-128-aac' },
    { name: 'Space Station', url: 'https://ice1.somafm.com/spacestation-128-mp3' }
  ]
};

let currentCategory = 'lofi';
let currentStationIndex = 0;

function nextStation() {
  const stations = categories[currentCategory];
  currentStationIndex = (currentStationIndex + 1) % stations.length;
  loadStation(stations[currentStationIndex]);
}

function loadStation(station) {
  const audio = document.getElementById('bgAudio');
  const wasPlaying = !audio.paused;

  audio.src = station.url;

  if (wasPlaying) {
    audio.play().catch(err => console.error('Playback failed:', err));
  }
}
```

### Pattern 4: CORS Handling for Cross-Origin Streams
**What:** Add `crossorigin="anonymous"` to allow audio element to work with cross-origin streaming URLs
**When to use:** Always, when streaming from external domains (SomaFM, etc.)
**Example:**
```html
<!-- Source: MDN crossorigin attribute documentation -->
<audio id="bgAudio" crossorigin="anonymous"></audio>
```

**Why this matters:**
- Without `crossorigin`, the audio element works but you cannot use Web Audio API features on the stream
- With `crossorigin="anonymous"`, CORS request is sent without credentials
- Most free streaming services support CORS with `Access-Control-Allow-Origin: *`

### Pattern 5: Service Worker Stream URL Exclusion
**What:** Modify service worker to exclude streaming URLs from cache
**When to use:** Always, when integrating streaming audio into a PWA
**Example:**
```javascript
// Source: Chrome Workbox documentation on serving cached audio
self.addEventListener('fetch', (e) => {
  // Don't cache streaming URLs
  if (e.request.url.includes('somafm.com') ||
      e.request.url.includes('chillhop.com') ||
      e.request.url.includes('ice') && e.request.url.includes('.mp3')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Normal cache-first strategy for app assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

**Why this matters:**
- Streaming URLs are continuous and infinite — caching would fill storage and break playback
- SomaFM and other services may rotate server URLs, so cached URLs become invalid
- Audio streams need real-time network access for playback

### Anti-Patterns to Avoid
- **Using `autoplay` attribute:** Blocked by all modern browsers without user interaction (especially iOS Safari). Always require user click to start audio.
- **Caching stream URLs:** Breaks playback and wastes storage. Only cache static assets.
- **Parsing PLS/M3U files:** Over-engineering for 20 hardcoded URLs. SomaFM says PLS links are "permanent."
- **Not handling playback errors:** Network issues are common with streaming. Always add `.catch()` to `audio.play()` promises.
- **Forgetting `crossorigin` attribute:** Prevents Web Audio API usage and may cause CORS errors in some browsers.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio format detection | Custom codec checking | HTML5 `<source>` fallback | Browser automatically selects supported format from multiple sources |
| Audio visualization | Custom canvas animation | Web Audio API `AnalyserNode` (optional) | Already using Web Audio API for chimes, built-in FFT analysis |
| Playlist parsing | Regex parser for M3U/PLS | Direct stream URLs | For 20 stations, hardcoding is simpler and more reliable than parsing |
| Buffering indicators | Custom network polling | `waiting`, `canplay`, `canplaythrough` events | Built into HTML5 audio, handles network delays automatically |
| Error retry logic | Custom retry counter | Native error handling + user notification | Streaming issues often require user intervention (network down, service unavailable) |

**Key insight:** HTML5 audio element handles the hard parts (codec negotiation, buffering, network errors, playback timing). Don't recreate what browsers already do well. Focus on UI/UX and integration with timer logic.

## Common Pitfalls

### Pitfall 1: iOS Safari Autoplay Blocking
**What goes wrong:** Audio doesn't play on iOS devices even when user clicks play button in the app
**Why it happens:** iOS Safari requires user interaction directly on a media element or within the same call stack as user gesture
**How to avoid:**
- Ensure `audio.play()` is called synchronously within click event handler
- Don't call `audio.play()` in async callbacks (setTimeout, Promise, fetch response)
- Show clear UI feedback if playback is blocked (browser throws exception)
**Warning signs:**
```javascript
// BAD - async delay breaks user gesture chain
button.addEventListener('click', async () => {
  await fetch('/api/station');
  audio.play(); // FAILS on iOS
});

// GOOD - play immediately, fetch separately
button.addEventListener('click', () => {
  audio.play(); // SUCCEEDS on iOS
  fetch('/api/station').then(updateUI);
});
```

### Pitfall 2: Service Worker Caching Stream URLs
**What goes wrong:** Audio stops playing after first load, or plays stale cached content
**Why it happens:** Service worker caches everything by default, including infinite streaming URLs
**How to avoid:**
- Add explicit exclusions for streaming domains in service worker fetch handler
- Check if request URL contains streaming service domains (somafm.com, chillhop.com, etc.)
- Return `fetch(request)` directly without caching
**Warning signs:**
- Audio works on first load, breaks on reload
- Cache storage grows rapidly (100+ MB)
- Different station URLs serve same content

### Pitfall 3: Continuous Streams Don't Fire `ended` Event
**What goes wrong:** Auto-advance logic never triggers because `ended` event doesn't fire
**Why it happens:** Internet radio streams are infinite — there is no "end"
**How to avoid:**
- For continuous streams, "auto-advance" means manual station switching via next/previous buttons
- If requirement truly needs automatic progression, implement timer-based station rotation (e.g., switch every 30 minutes)
- Don't rely on `ended` event for streaming radio
**Warning signs:**
- Event listener for `ended` is registered but never triggers during streaming
- Station stays on same stream indefinitely

### Pitfall 4: Forgetting CORS Attribute
**What goes wrong:** Audio plays but Web Audio API operations fail silently, or browser console shows CORS errors
**Why it happens:** Cross-origin audio without `crossorigin` attribute is "tainted" and restricted
**How to avoid:**
- Always add `crossorigin="anonymous"` to audio element when src is external domain
- Test with browser console open to catch CORS warnings early
**Warning signs:**
- Console shows: "MediaElementAudioSource outputs zeroes due to CORS access restrictions"
- Audio plays but volume/analysis features don't work

### Pitfall 5: Not Handling Network Errors
**What goes wrong:** Audio silently fails to load, user sees no feedback
**Why it happens:** Streaming URLs can be temporarily unavailable, rate-limited, or blocked by network
**How to avoid:**
- Add error event listener to audio element
- Display user-friendly error message ("Stream unavailable, try another station")
- Provide retry button or automatically try next station
**Warning signs:**
```javascript
audio.addEventListener('error', (e) => {
  console.error('Audio error:', audio.error.code);
  // MEDIA_ERR_NETWORK (code 2) is most common for streaming
  if (audio.error.code === 2) {
    showNotification('Stream unavailable. Try another station.');
  }
});
```

### Pitfall 6: Volume Control Conflicts
**What goes wrong:** Background music drowns out timer chime sounds
**Why it happens:** Timer chimes use Web Audio API (separate volume control), background music uses HTML5 audio (separate volume control)
**How to avoid:**
- Maintain separate volume controls for music and timer alerts (as noted in STATE.md decisions)
- Consider pausing background audio briefly when timer chime plays
- Document that audio volume slider only affects background music, not alerts
**Warning signs:**
- Users report missing timer alerts when music is playing
- Users turn down music volume expecting alerts to also get quieter

## Code Examples

Verified patterns from official sources:

### Basic Audio Integration
```javascript
// Source: MDN HTMLMediaElement API
const state = {
  // Existing state properties...
  audio: {
    element: null,
    isPlaying: false,
    currentCategory: 'lofi',
    currentStationIndex: 0,
    volume: 0.7,
    isExpanded: false
  }
};

const AUDIO_STATIONS = {
  lofi: [
    { name: 'SomaFM Groove Salad', url: 'https://ice5.somafm.com/groovesalad-256-mp3', genre: 'Ambient/Downtempo' },
    { name: 'Chillhop Radio', url: 'https://streams.chillhop.com/lofihiphop', genre: 'Lofi Hip Hop' },
    { name: 'SomaFM Fluid', url: 'https://ice1.somafm.com/fluid-128-mp3', genre: 'Instrumental Hip Hop' }
  ],
  ambient: [
    { name: 'SomaFM Drone Zone', url: 'https://ice5.somafm.com/dronezone-256-mp3', genre: 'Ambient Textures' },
    { name: 'SomaFM Deep Space One', url: 'https://ice1.somafm.com/deepspaceone-128-aac', genre: 'Deep Ambient' },
    { name: 'SomaFM Space Station', url: 'https://ice1.somafm.com/spacestation-128-mp3', genre: 'Space Music' }
  ],
  nature: [
    { name: '24/7 Nature Radio', url: 'https://www.247natureradio.com/stream', genre: 'Nature Soundscapes' },
    { name: 'Calm Radio - Rain Sounds', url: 'https://streams.calmradio.com/api/39/128/stream', genre: 'Rain/Ocean' },
    { name: 'Nature Sounds FM', url: 'https://streaming.radio.co/s8c6d6e3e4/listen', genre: 'Forest/Wildlife' }
  ],
  binaural: [
    { name: 'TuneIn Binaural Beats', url: 'https://stream.radiojar.com/binaural', genre: 'Focus Enhancement' },
    { name: 'Binaural Beats Collection', url: 'https://tunein.com/radio/Stream-Binaural-Beats-a64242/', genre: 'Meditation' }
  ]
};

function initAudio() {
  state.audio.element = document.getElementById('bgAudio');

  // Set initial volume
  state.audio.element.volume = state.audio.volume;

  // Error handling
  state.audio.element.addEventListener('error', handleAudioError);

  // Update UI when playback state changes
  state.audio.element.addEventListener('play', () => {
    state.audio.isPlaying = true;
    updateAudioUI();
  });

  state.audio.element.addEventListener('pause', () => {
    state.audio.isPlaying = false;
    updateAudioUI();
  });
}

function handleAudioError(e) {
  const errorCodes = {
    1: 'MEDIA_ERR_ABORTED: Playback aborted',
    2: 'MEDIA_ERR_NETWORK: Network error',
    3: 'MEDIA_ERR_DECODE: Decoding error',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: Format not supported'
  };

  const error = state.audio.element.error;
  console.error('Audio error:', errorCodes[error.code]);

  if (error.code === 2) {
    // Network error - try next station or show message
    sendNotification('Stream unavailable. Try another station.');
  }
}
```

### Play/Pause with iOS Safari Compatibility
```javascript
// Source: MDN Autoplay guide
function toggleAudioPlayback() {
  const audio = state.audio.element;

  if (audio.paused) {
    // Must be called synchronously within user gesture
    audio.play()
      .then(() => {
        console.log('Playback started');
      })
      .catch(err => {
        console.error('Playback failed:', err);
        if (err.name === 'NotAllowedError') {
          sendNotification('Tap play button to start audio');
        }
      });
  } else {
    audio.pause();
  }
}
```

### Station/Category Switching
```javascript
function switchCategory(category) {
  if (!AUDIO_STATIONS[category]) return;

  state.audio.currentCategory = category;
  state.audio.currentStationIndex = 0;

  loadStation(AUDIO_STATIONS[category][0]);
  updateAudioUI();
}

function nextStation() {
  const stations = AUDIO_STATIONS[state.audio.currentCategory];
  state.audio.currentStationIndex = (state.audio.currentStationIndex + 1) % stations.length;

  loadStation(stations[state.audio.currentStationIndex]);
}

function prevStation() {
  const stations = AUDIO_STATIONS[state.audio.currentCategory];
  state.audio.currentStationIndex =
    (state.audio.currentStationIndex - 1 + stations.length) % stations.length;

  loadStation(stations[state.audio.currentStationIndex]);
}

function loadStation(station) {
  const audio = state.audio.element;
  const wasPlaying = !audio.paused;

  audio.src = station.url;

  // If audio was playing, continue playing new station
  if (wasPlaying) {
    audio.play().catch(err => {
      console.error('Failed to play new station:', err);
    });
  }
}
```

### Volume Control
```javascript
function setAudioVolume(value) {
  // value: 0-100
  state.audio.volume = value / 100;
  state.audio.element.volume = state.audio.volume;

  // Persist to settings
  state.settings.audioVolume = value;
  saveSettings();
}

function toggleAudioMute() {
  const audio = state.audio.element;
  audio.muted = !audio.muted;
  updateAudioUI();
}
```

### Minimal/Expandable UI Pattern
```javascript
function toggleAudioPanel() {
  state.audio.isExpanded = !state.audio.isExpanded;

  const indicator = document.getElementById('audioIndicator');
  indicator.classList.toggle('expanded');

  // Animate height
  const panel = document.getElementById('audioPanel');
  if (state.audio.isExpanded) {
    panel.style.maxHeight = panel.scrollHeight + 'px';
  } else {
    panel.style.maxHeight = '0';
  }
}
```

### Service Worker Stream Exclusion
```javascript
// Source: Chrome Workbox documentation
// In sw.js:
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Exclude streaming audio URLs from cache
  const streamingDomains = [
    'somafm.com',
    'chillhop.com',
    'calmradio.com',
    '247natureradio.com',
    'radio.co',
    'radiojar.com',
    'tunein.com'
  ];

  const isStreamingURL = streamingDomains.some(domain => url.includes(domain));

  if (isStreamingURL) {
    // Network-only for streams
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flash-based radio players | HTML5 `<audio>` element | 2015-2017 | Universal browser support, no plugins, mobile compatible |
| YouTube embeds for background audio | Direct streaming URLs | 2020+ | No visible player requirement, lighter weight, audio-only |
| File-based audio playlists (MP3 files) | Live streaming radio | 2018+ | No hosting costs, infinite content, no storage needed |
| Autoplay by default | User-initiated playback | 2018 (Chrome 66, Safari 11) | Prevents autoplaying ads, requires explicit user gesture |
| Global Web Audio API context | Per-interaction context creation | 2018+ | Prevents blocked audio contexts, create on user gesture |

**Deprecated/outdated:**
- **Flash-based players:** Removed from all modern browsers as of 2020. Use HTML5 audio.
- **Autoplay without user gesture:** Blocked by all browsers since 2018. Always require click/tap.
- **HTTP audio streams:** Many browsers block mixed content (HTTP on HTTPS site). Use HTTPS streams only.
- **jQuery audio plugins:** Unnecessary overhead. Native APIs are sufficient and better supported.

## Open Questions

Things that couldn't be fully resolved:

1. **Are all curated stream URLs HTTPS and CORS-enabled?**
   - What we know: SomaFM provides HTTPS URLs with CORS support (verified from documentation)
   - What's unclear: Some third-party services (24/7 Lofi Radio, Nature Sounds FM) may have changed URLs or CORS policies
   - Recommendation: Test each hardcoded URL during implementation, have fallback stations ready, provide clear error messages if stream fails

2. **Should "auto-advance" switch stations automatically or manually?**
   - What we know: Internet radio streams are continuous and don't have track endings
   - What's unclear: Requirement says "tracks auto-advance when one ends" but streams never "end"
   - Recommendation: Interpret as manual station switching (next/previous buttons). If automatic progression is desired, implement timer-based rotation (e.g., every 30-60 minutes) or allow user to enable "shuffle mode"

3. **Should audio pause automatically when break mode starts?**
   - What we know: STATE.md says "Pause on break by default"
   - What's unclear: Should this be configurable, or always enforced?
   - Recommendation: Implement as default behavior with setting to disable. Hook into `switchMode()` function to pause audio when mode changes from 'focus' to 'break'/'longbreak'

4. **How to handle audio state persistence?**
   - What we know: App persists settings, stats, tasks to localStorage
   - What's unclear: Should we persist last-played category/station, or always start fresh?
   - Recommendation: Persist `audioVolume`, `audioMuted`, `lastCategory`, `lastStationIndex` in settings. Don't persist playback state (isPlaying) — always start paused.

5. **Stream URL reliability and fallback strategy?**
   - What we know: Free streaming services can have downtime, rate limiting, or change URLs
   - What's unclear: Should app detect dead streams and auto-switch, or require user intervention?
   - Recommendation: Show error notification on stream failure, provide "Next Station" button as manual fallback. Don't auto-switch stations on error (user might want to retry their selection).

## Sources

### Primary (HIGH confidence)
- [MDN: HTML5 Audio Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) - Official HTML5 audio documentation
- [MDN: HTMLMediaElement API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) - JavaScript audio control properties/methods/events
- [MDN: crossorigin Attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/crossorigin) - CORS handling for audio
- [SomaFM: Direct Stream Links](https://somafm.com/live/directstreamlinks.html) - Stream URL format and recommendations
- [SomaFM: Groove Salad Streams](https://somafm.com/groovesalad/directstreamlinks.html) - Verified 256kbps MP3 URLs
- [SomaFM: Drone Zone Streams](https://somafm.com/dronezone/directstreamlinks.html) - Verified 256kbps MP3 URLs
- [Chrome Workbox: Serving Cached Audio](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video) - Service worker audio handling
- [MDN: Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide) - Browser autoplay policies

### Secondary (MEDIUM confidence)
- [SomaFM Channel List](https://somafm.com/listen/) - 47 available channels with descriptions
- [GitHub: javascript-playlist-parser](https://github.com/nickdesaulniers/javascript-playlist-parser) - PLS/M3U parsing (if needed)
- [CSS-Tricks: Custom Audio Player](https://css-tricks.com/lets-create-a-custom-audio-player/) - UI patterns for audio controls
- [Chillhop Music](https://chillhop.com/live/lofihiphop/) - Lofi hip hop streaming option
- [24/7 Lofi Radio](https://www.247lofiradio.com/) - Alternative lofi streaming source
- [Calm Radio](https://calmradio.com/channel-guide/nature-sounds) - Nature sounds streaming
- [24/7 Nature Radio](https://www.247natureradio.com/) - Nature soundscape streaming
- [TuneIn: Binaural Beats](https://tunein.com/radio/Stream-Binaural-Beats-a64242/) - Binaural beats streaming

### Tertiary (LOW confidence)
- WebSearch results for "lofi streaming radio 2026" - Multiple community-maintained streaming sources, URLs need verification
- WebSearch results for "nature sounds streaming 2026" - Various platforms mentioned, CORS support unverified
- WebSearch results for "binaural beats streaming 2026" - Limited dedicated streaming radio options, may need curated MP3s instead

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - HTML5 audio is proven, native, universal, already used Web Audio API in codebase
- Architecture: HIGH - Single-file pattern established, integration points clear, no framework conflicts
- Streaming sources: MEDIUM - SomaFM verified and reliable, third-party sources need testing for CORS/HTTPS
- Pitfalls: HIGH - iOS autoplay, service worker caching, CORS issues are well-documented problems with known solutions

**Research date:** 2026-02-06
**Valid until:** 60 days (stable APIs, but streaming service URLs may change)

**Key risks to monitor:**
- SomaFM or third-party streaming services changing URLs or CORS policies
- Browser autoplay policies becoming stricter
- Service worker cache API changes (unlikely but monitor Chrome/Safari updates)

**Next steps for planner:**
1. Create tasks for HTML structure (audio element + controls UI)
2. Create tasks for JavaScript integration (state management, playback functions)
3. Create tasks for CSS styling (minimal/expandable UI pattern)
4. Create tasks for service worker modifications (stream URL exclusion)
5. Create verification tasks (test on iOS Safari, test all stream URLs, test offline mode doesn't break)
