# Pomodoro Timer — Monetization

## What This Is

A pomodoro timer PWA (pomodorotimer.vip) with background audio, now adding a premium subscription model. Stripe-powered payments with 3 tiers ($2/month, $15/year, $47 lifetime), 7-day free trial, and 11 premium features including Projects, Smart Insights, Focus Forecast, automation rules, and more. Backend powered by Firebase Cloud Functions.

## Core Value

A seamless upgrade path from free to premium that feels valuable — users should hit the trial wall wanting to pay, not feeling nickeled.

## Current Milestone: v2.0 Monetization

**Goal:** Add Stripe-powered subscription payments with premium feature gating and 11 premium features.

**Target features:**
- Stripe integration (3 pricing tiers + 7-day free trial)
- Feature gating framework with backend verification
- Projects (project-based task organization)
- Smart Insights (best focus times, productivity score)
- Focus Forecast (predict next week's output)
- Project analytics (time per project, trends)
- Yearly productivity report
- CSV + PDF export
- Todoist import
- Webhook triggers after focus sessions
- Automation rules (if-this-then-that)
- Custom themes + focus sounds
- No ads ever (premium guarantee)

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

- [ ] Stripe payment integration (monthly/yearly/lifetime tiers)
- [ ] 7-day free trial with expiry gating
- [ ] Firebase Cloud Functions for Stripe webhooks and subscription verification
- [ ] Feature gating framework (premium vs free)
- [ ] Project-based task organization
- [ ] Smart Insights (best focus times, productivity score)
- [ ] Focus Forecast (predict next week's output based on history)
- [ ] Project analytics (time per project, trends)
- [ ] Yearly productivity report
- [ ] CSV + PDF report export
- [ ] Todoist task import
- [ ] Webhook triggers after completed focus sessions
- [ ] Automation rules (simple if-this-then-that logic)
- [ ] Custom themes + focus sounds
- [ ] Ad-free guarantee for premium users

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
- Firebase Auth (Google Sign-In) and Firestore already integrated
- Firestore stores user stats at `users/{uid}` — will extend for subscription data
- v2.0 introduces backend (Firebase Cloud Functions) for Stripe webhook handling

## Constraints

- **Frontend tech stack**: Vanilla HTML/CSS/JS only — no frameworks, no build tools
- **Single file**: All frontend code stays in `index.html` (established pattern)
- **Backend**: Firebase Cloud Functions (Node.js) — keeps ecosystem unified
- **Payments**: Stripe only — Checkout for payment flow, webhooks for verification
- **Security**: Subscription status verified server-side, cached client-side
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
| Firebase Cloud Functions for backend | Unified ecosystem with existing Firebase Auth/Firestore | — Pending |
| Stripe for payments | Industry standard, good docs, handles PCI compliance | — Pending |
| 3 pricing tiers ($2/mo, $15/yr, $47 lifetime) | Covers all buyer types, lifetime creates urgency | — Pending |
| 7-day free trial | Low friction entry, enough time to experience premium value | — Pending |

---
*Last updated: 2026-02-07 after v2.0 milestone start*
