# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pomodoro Timer PWA — a single-page productivity app deployed to GitHub Pages at pomodorotimer.vip. The entire application lives in one `index.html` file (~2200 lines) containing inline CSS, HTML, and JavaScript. There is no build system, bundler, or framework.

## Development

There is no build step, test suite, or linter. To develop:
- Edit `index.html` directly (it contains all CSS, markup, and JS)
- Open `index.html` in a browser, or serve locally: `npx serve .`
- Deploy by pushing to `main` (GitHub Pages)

When making changes to the service worker (`sw.js`), bump the `CACHE_NAME` version string (currently `pomodoro-v9`).

## Architecture

### Single-file structure
All application code is in `index.html`:
- **Lines 11–1287**: `<style>` block — all CSS with CSS custom properties for theming
- **Lines 1288–1289**: `<script>` tag opening, Firebase SDK imports (loaded from CDN)
- **Lines 1290–2211**: IIFE containing all application JavaScript

Supporting files: `sw.js` (service worker, 25 lines), `manifest.json` (PWA manifest), `CNAME` (custom domain).

### State management
A single global `state` object (line ~1360) holds all app state. No framework or reactive system — UI updates are done by calling `updateAll()` or individual `update*()` functions that directly manipulate the DOM.

Key state shape:
```
state.mode        → 'focus' | 'break' | 'longbreak'
state.status      → 'idle' | 'running' | 'paused'
state.timeRemaining, state.totalTime, state.endTime
state.settings    → durations, autoStart, soundEnabled
state.stats       → totalPomodoros, dailyCounts{}, dailyMinutes{}, bestStreak
state.user        → Firebase Auth user (or null)
```

### Timer engine
Uses `setInterval(tick, 250)` with timestamp-based countdown (`endTime - Date.now()`). This approach handles tab-backgrounding correctly. The `complete()` function handles mode transitions: focus → break (or long break after `longBreakInterval` sessions) → focus.

### Theming
Four theme variants via CSS attribute selectors on `<html>`: `data-theme="light|dark"` × `data-mode="focus|break|longbreak"`. CSS custom properties (`--bg`, `--surface`, `--primary`, etc.) change per combination. Theme transitions use 600ms ease.

### Firebase integration
Firebase Auth (Google OAuth popup) and Firestore for cloud sync and leaderboard. Config is embedded in the HTML. Key Firestore collection: `users/{uid}` with fields for totalMinutes, totalSessions, dailyCounts, dailyMinutes, bestStreak.

Sync strategy: on sign-in, local stats merge additively with cloud stats, then cloud data is pulled back. On each focus session completion, Firestore is updated directly.

### Persistence
- **LocalStorage keys**: `pomodoro-settings`, `pomodoro-stats`, `pomodoro-theme`
- **Firestore**: synced when authenticated

### Navigation
Modal-based: Settings, Stats, and Leaderboard each open as `<dialog>` elements. Header has icon buttons for theme toggle, stats, leaderboard, settings, and user auth.

### Code organization within the IIFE
The JS follows a consistent section pattern marked by `// --- Section ---` comments:
- Constants & DOM refs → Default settings & State → Storage (load/save) → Helpers → Sound (Web Audio API) → Notifications → UI update functions → Timer engine (tick/start/pause/reset/complete) → Event listeners → Firebase auth/sync → Init

## Git Workflow

- `main` branch deploys to GitHub Pages
- `dev` branch for development
- PRs from `dev` → `main`

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
