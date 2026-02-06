# Pitfalls Research: YouTube Audio in PWA

**Researched:** 2026-02-06

## Critical Pitfalls

### 1. Autoplay Policy Violations
**Problem:** Mobile browsers block autoplay without user interaction. `autoplay=1` fails silently.
**Prevention:** Gate playback behind timer start button click. User interaction satisfies browser policy.
**Phase:** Foundation — establish interaction-gated playback from day one.

### 2. YouTube ToS — Player Must Be Visible
**Problem:** YouTube prohibits hiding the player (`display:none`, 1px size). Violating = API key revocation.
**Prevention:** Design with compact but visible player (min ~200x200px). Embrace it as UI feature, not liability.
**Phase:** UI design — account for visible player from the start.

### 3. Web Audio API Conflicts
**Problem:** Timer chimes (Web Audio API) and YouTube audio compete. Volume levels clash, iOS audio session gets confused.
**Prevention:** Audio ducking — lower YouTube volume during chime, restore after. Keep separate volume controls.
**Phase:** Audio integration — implement ducking strategy explicitly.

### 4. API Loading Race Conditions
**Problem:** Calling `new YT.Player()` before API script finishes loading → `YT is not defined`.
**Prevention:** Always use `onYouTubeIframeAPIReady` callback. Queue init requests if API not ready.
**Phase:** Foundation — robust loading pattern first.

### 5. Service Worker Caches YouTube API
**Problem:** SW caches YouTube script, Google updates API, cached version breaks.
**Prevention:** Explicitly exclude `youtube.com` domains from SW fetch handler.
**Phase:** Foundation — SW setup must exclude YouTube resources.

### 6. Playlist Exhaustion / Unavailable Videos
**Problem:** Videos get deleted, copyright claimed, or region-restricted after app ships. Silent failures.
**Prevention:** Handle all error codes (2, 5, 100, 101, 150). Auto-skip to next track. Have fallback playlists. Loop playlists.
**Phase:** Resilience — comprehensive error handling.

## Moderate Pitfalls

### 7. Missing `playsinline: 1`
**Problem:** Without this playerVar, iOS forces fullscreen video playback, breaking PWA context.
**Prevention:** Always include `playsinline: 1` in playerVars config.

### 8. No Offline Graceful Degradation
**Problem:** PWA tries to load YouTube when offline, gets stuck or crashes.
**Prevention:** Check `navigator.onLine` before init. Disable audio UI when offline. Listen for online/offline events.

### 9. Volume State Not Persisted
**Problem:** User's preferred volume resets every session.
**Prevention:** Save to localStorage on change, restore on init.

### 10. Player Size Breaks Mobile Layout
**Problem:** YouTube's minimum player size constraints break responsive layouts.
**Prevention:** Design responsive layout with player size constraints in mind. Test at mobile breakpoints.

## Phase-Specific Warnings

| Phase | Watch For |
|-------|-----------|
| Foundation | Race conditions (Pitfall 4), SW caching (Pitfall 5) |
| UI Design | ToS visibility requirement (Pitfall 2), mobile sizing (Pitfall 10) |
| Audio Integration | Autoplay policy (Pitfall 1), audio conflicts (Pitfall 3) |
| Resilience | Error handling (Pitfall 6), offline degradation (Pitfall 8) |
