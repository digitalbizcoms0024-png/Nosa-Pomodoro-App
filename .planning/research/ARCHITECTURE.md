# Architecture Research: YouTube Audio in Vanilla JS SPA

**Researched:** 2026-02-06

## Component Architecture

Three new components added to existing single-file structure:

### 1. YouTubePlayer (API wrapper)
- Thin wrapper around `YT.Player` instance
- Only component that touches YouTube API directly
- Handles: init, play, pause, stop, loadVideo, setVolume, destroy
- Defensive state checks before all operations

### 2. AudioManager (business logic)
- Orchestrates audio behavior and timer integration
- Manages playlists, categories, track switching
- Lifecycle hooks: `onTimerStart(mode)`, `onTimerPause()`, `onTimerComplete(mode)`
- Delegates to YouTubePlayer for actual playback

### 3. Audio UI (presentation)
- Minimal indicator on main screen, expands to full controls
- Event handlers wire to AudioManager methods
- Updates DOM based on state.audio changes

## State Extensions

```javascript
const state = {
  // ... existing timer state ...
  audio: {
    enabled: false,
    playing: false,
    category: 'lofi',
    currentTrackIndex: 0,
    volume: 50,
    alertVolume: 80,
    pauseOnBreak: true
  }
};
```

## Timer Integration (Minimal Impact)

| Function | Addition | Lines |
|----------|----------|-------|
| `start()` | `AudioManager.onTimerStart(state.mode)` | +1 |
| `pause()` | `AudioManager.onTimerPause()` | +1 |
| `complete()` | `AudioManager.onTimerComplete(state.mode)` | +1 |
| `reset()` | `AudioManager.onTimerPause()` | +1 |

**Total: 4 one-line additions to existing functions.**

## Data Flow

### Timer Start → Audio Play
```
User clicks Start → start() → AudioManager.onTimerStart('focus')
  → check pauseOnBreak setting
  → check audio.enabled
  → YouTubePlayer.play()
```

### Track Ends → Next Track
```
YouTube fires ENDED event → onPlayerStateChange
  → AudioManager.nextTrack()
  → increment currentTrackIndex (wrap)
  → YouTubePlayer.loadVideoById(nextId)
```

### Timer Complete → Mode Switch
```
complete() → AudioManager.onTimerComplete('focus')
  → next mode is 'break'
  → if pauseOnBreak: YouTubePlayer.pause()
```

## Key Architecture Decisions

1. **Lazy load YouTube API** — only when user enables audio (saves ~500KB initial load)
2. **Single player instance** — reuse for all tracks (prevent memory leaks)
3. **Event-driven integration** — timer calls AudioManager hooks, not direct YT API calls
4. **Separate persistence** — audio prefs in own localStorage key (`pomodoro-audio`)
5. **Player must be visible** — YouTube ToS requires it; design compact but visible player

## Build Order

1. YouTubePlayer component + API loading
2. State extensions + AudioManager core
3. Audio UI (HTML/CSS) + event handlers
4. Timer lifecycle hooks (connect to existing code)
5. Category/playlist management
6. Polish (fade, shuffle, persistence)

## Service Worker Update

Exclude YouTube from caching, bump CACHE_NAME version.
