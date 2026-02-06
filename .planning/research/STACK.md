# Stack Research: YouTube Audio Integration

**Researched:** 2026-02-06

## Recommended Stack

| Technology | Purpose | Why |
|------------|---------|-----|
| YouTube IFrame Player API | Audio streaming + playback control | Official Google API, zero deps, CDN-loaded (matches Firebase pattern) |
| Web Audio API (existing) | Timer chimes/alerts | Already in use, no changes needed |

**Total new dependencies: ZERO** — one CDN script loaded dynamically.

## YouTube IFrame API Key Patterns

### Loading (async, non-blocking)
```javascript
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, firstScriptTag);

// Global callback — must be window-accessible
function onYouTubeIframeAPIReady() { /* init player */ }
```

### Player Creation
```javascript
player = new YT.Player('container-id', {
  height: '200', width: '300',   // Must be visible per YouTube ToS
  videoId: 'VIDEO_ID',
  playerVars: {
    autoplay: 0, controls: 1, disablekb: 1, fs: 0,
    modestbranding: 1, playsinline: 1, rel: 0, enablejsapi: 1
  },
  events: { onReady, onStateChange, onError }
});
```

### Key Methods
- `player.playVideo()` / `pauseVideo()` / `stopVideo()`
- `player.loadVideoById(videoId)` — switch tracks
- `player.setVolume(0-100)` / `getVolume()`
- `player.getPlayerState()` — returns -1/0/1/2/3/5

### Player States
`-1` unstarted, `0` ended, `1` playing, `2` paused, `3` buffering, `5` cued

### Error Codes
`2` invalid ID, `5` HTML5 error, `100` not found, `101/150` embed blocked

## Coexistence with Web Audio API

No conflicts. YouTube uses separate audio context. Manage volumes independently:
- Background music: `player.setVolume()` (40-60% default)
- Timer chimes: Web Audio API gain nodes (80-100%)
- Implement audio ducking: lower YouTube volume during chime playback

## Service Worker Strategy

- **DO NOT cache** YouTube API script or embed resources
- Exclude `youtube.com` and `youtube-nocookie.com` from SW fetch handler
- Audio feature gracefully disabled when offline; timer continues working

## Mobile/PWA Critical Settings

- `playsinline: 1` — **required** for iOS PWA (prevents fullscreen takeover)
- First play must follow user interaction (autoplay policy)
- Background playback varies by OS (works on Android, may pause on iOS)

## What NOT to Use

| Alternative | Why Not |
|-------------|---------|
| YouTube Data API v3 | For metadata/search, not playback |
| Spotify Web Playback SDK | Requires Premium, OAuth, API costs |
| Self-hosted audio files | Hosting costs, copyright issues |
| npm youtube-player wrapper | Adds build dependency, defeats vanilla JS goal |
