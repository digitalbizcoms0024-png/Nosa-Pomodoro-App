# Pomodoro Timer — Background Audio

## What This Is

A pomodoro timer PWA (pomodorotimer.vip) adding background audio for focus sessions. Users can choose from curated playlists of lofi hip hop, binaural beats, nature sounds, and ambient music — streamed from YouTube — that syncs with the timer automatically.

## Core Value

Background audio that helps users stay focused during pomodoro sessions, with zero friction to start and smart timer integration.

## Requirements

### Validated

- ✓ Focus/Break/Long Break timer with configurable durations — existing
- ✓ SVG progress ring with clockwise animation — existing
- ✓ Task list for focus sessions — existing
- ✓ Stats tracking (daily/weekly, streaks, session counts) — existing
- ✓ Firebase auth with Google Sign-In — existing
- ✓ Firestore leaderboard with cross-device sync — existing
- ✓ Light/dark theme with per-mode color schemes — existing
- ✓ PWA with offline support via service worker — existing
- ✓ Desktop notifications on timer completion — existing
- ✓ Keyboard shortcuts (Space, R, Esc) — existing
- ✓ Configurable daily goals with unit selection — existing

### Active

- [ ] Audio category selection (Lofi, Binaural Beats, Nature, Ambient)
- [ ] Curated playlists per category (3-5 tracks each)
- [ ] YouTube-based audio streaming
- [ ] Minimal audio indicator on main screen that expands to full controls
- [ ] Separate volume controls for background audio vs timer alerts
- [ ] Smart timer sync: auto-play on focus start, pause on break
- [ ] User can override break pause behavior
- [ ] Audio preference persistence (last played category/track)
- [ ] Track switching within a playlist

### Out of Scope

- Self-hosted audio files — streaming from YouTube keeps app lightweight
- Audio mixing/layering (e.g., lofi + rain simultaneously) — adds complexity, defer
- User-uploaded audio — moderation and storage concerns
- Spotify/Apple Music integration — requires OAuth, premium accounts, API costs
- Audio visualization/equalizer — not core to productivity value
- Offline audio playback — conflicts with streaming approach

## Context

- Single-file architecture: all HTML/CSS/JS in `index.html` (~2700 lines)
- No build tools, no frameworks — vanilla JS only
- Already uses Web Audio API for timer chime sounds
- YouTube IFrame API will be the primary integration point
- App deployed on GitHub Pages (pomodorotimer.vip)
- Firebase SDK already loaded from CDN — pattern exists for external script loading

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS only — no frameworks, no build tools
- **Single file**: All code stays in `index.html` (established pattern)
- **No dependencies**: YouTube IFrame API loaded from CDN (same pattern as Firebase)
- **Streaming only**: No audio file hosting — keeps deployment on GitHub Pages simple
- **YouTube ToS**: Must use official IFrame API, video player must be visible (can be small/minimal)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| YouTube embeds for audio | Free, huge library, no hosting costs, curated content | — Pending |
| Minimal + expandable UI | Keeps timer screen clean, audio is secondary to timer | — Pending |
| Pause on break by default | Breaks should feel distinct from focus sessions | — Pending |
| Separate volume controls | Timer alerts must be audible even with loud music | — Pending |
| Curated playlists not single streams | Gives users choice within each category | — Pending |

---
*Last updated: 2026-02-06 after initialization*
