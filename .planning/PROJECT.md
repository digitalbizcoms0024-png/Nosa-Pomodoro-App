# Pomodoro Timer — Background Audio

## What This Is

A pomodoro timer PWA (pomodorotimer.vip) with background audio for focus sessions. Users can choose from curated SomaFM streaming stations across 2 categories (Ambient, Focus Beats) with an expandable controls panel. Music volume automatically ducks during timer chime alerts.

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
- ✓ Audio category selection (Ambient, Focus Beats) — v1.0
- ✓ Curated streaming stations per category (SomaFM) — v1.0
- ✓ Free streaming audio via HTML5 `<audio>` element — v1.0
- ✓ Minimal audio indicator that expands to full controls — v1.0
- ✓ Volume controls for background audio — v1.0
- ✓ Audio mute/unmute toggle — v1.0
- ✓ Audio preference persistence (category, station, volume, mute) — v1.0
- ✓ Station switching within categories (prev/next) — v1.0
- ✓ Volume ducking during timer chime alerts — v1.0

### Active

(None — next milestone requirements TBD)

### Out of Scope

- YouTube embeds — visible player requirement (200x200px min) is intrusive for a timer app
- Audio mixing/layering (e.g., ambient + rain simultaneously) — adds complexity, defer
- User-uploaded audio — moderation and storage concerns
- Spotify/Apple Music integration — requires OAuth, premium accounts, API costs
- Audio visualization/equalizer — not core to productivity value
- Offline audio playback — conflicts with streaming approach

## Context

- Single-file architecture: all HTML/CSS/JS in `index.html` (~3,449 lines)
- No build tools, no frameworks — vanilla JS only
- Web Audio API for timer chime sounds
- HTML5 Audio API with SomaFM streaming URLs
- App deployed on GitHub Pages (pomodorotimer.vip)
- Service worker excludes streaming domains from cache
- Shipped v1.0: background audio with 2 categories and volume ducking

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS only — no frameworks, no build tools
- **Single file**: All code stays in `index.html` (established pattern)
- **No dependencies**: Native HTML5 `<audio>` element — no external API scripts
- **Streaming only**: No audio file hosting — uses free streaming URLs (SomaFM, etc.)
- **CORS/Mixed content**: Stream URLs must be HTTPS and allow cross-origin playback

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Free streaming URLs (SomaFM etc.) | No visible player needed, multiple categories available, free | ✓ Good |
| Minimal + expandable UI | Keeps timer screen clean, audio is secondary to timer | ✓ Good |
| Separate volume controls | Timer alerts must be audible even with loud music | ✓ Good |
| Curated stations not single streams | Gives users choice within each category | ✓ Good |
| Reduced to 2 categories (Ambient, Focus Beats) | SomaFM lacks dedicated lofi/nature content | ✓ Good |
| Hidden `<audio>` element with custom JS controls | No native player chrome, full control over UI | ✓ Good |
| Duck to 20% with exponential easing | Natural sound perception, chime clearly audible | ✓ Good |
| Manual volume changes cancel ducking | Respects user intent over automation | ✓ Good |
| iOS Safari .catch() on all play() calls | Prevents NotAllowedError crashes | ✓ Good |

---
*Last updated: 2026-02-07 after v1.0 milestone*
