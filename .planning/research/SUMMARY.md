# Research Summary: Background Audio for Pomodoro Timer

**Synthesized:** 2026-02-06

## Key Findings

### Stack
- **YouTube IFrame Player API** — zero new dependencies, CDN-loaded (matches Firebase pattern)
- Coexists with existing Web Audio API for timer chimes (separate audio contexts)
- `playsinline: 1` critical for iOS PWA

### Table Stakes
- Play/pause, volume, category selection, mute, visual indicator, separate alert volume
- Your planned 4 categories (Lofi, Binaural, Nature, Ambient) with 3-5 tracks each is well-scoped

### Differentiator
- **Smart timer sync** (auto-play on focus, pause on break) is your competitive advantage
- Apps like Tide do this but most productivity audio apps don't integrate with timer lifecycle

### Watch Out For
1. **YouTube ToS requires visible player** — cannot hide it; design compact but visible
2. **Mobile autoplay blocked** — must gate behind user interaction (timer start button)
3. **Audio ducking needed** — lower YouTube during timer chimes to prevent audio clash
4. **Race conditions** — use `onYouTubeIframeAPIReady` callback, don't assume API is loaded
5. **Videos can disappear** — robust error handling + auto-skip + fallback playlists

## Architecture Summary

- **YouTubePlayer** — thin wrapper around YT.Player API (only component touching YouTube)
- **AudioManager** — business logic layer with timer lifecycle hooks
- **Audio UI** — minimal indicator expanding to full controls
- **Timer impact:** 4 one-line additions to existing start/pause/complete/reset functions

## Build Order Recommendation

1. **Foundation:** YouTube API loading + player component + state extensions
2. **Core Audio:** AudioManager + category selection + play/pause/volume
3. **Timer Integration:** Lifecycle hooks + smart sync + pause on break
4. **UI:** Minimal indicator + expandable panel + theme integration
5. **Polish:** Persistence, error handling, fade transitions, service worker update

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube ToS violation (hidden player) | API key revoked | Design visible compact player |
| Mobile autoplay fails | Silent sessions | Gate behind user click |
| Videos become unavailable | Broken playlists | Error handling + auto-skip |
| SW caches stale YT API | Features break | Exclude YouTube from cache |
| iOS PWA background pause | Music stops when minimized | Accept limitation, document it |
