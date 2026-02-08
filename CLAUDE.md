# Pomodoro Timer

## Project Overview
A pomodoro timer PWA hosted at pomodorotimer.vip. Single-page app built with vanilla HTML/CSS/JS — no build tools, no frameworks, no dependencies.

## Architecture
- **Single file app**: All HTML, CSS, and JS live in `index.html` (~2700 lines)
- **Service worker**: `sw.js` handles offline caching (bump `CACHE_NAME` version on changes)
- **PWA manifest**: `manifest.json` for installability
- **Hosting**: GitHub Pages with custom domain (`CNAME`)

## Tech Stack
- Vanilla HTML/CSS/JavaScript — no frameworks or transpilation
- CSS custom properties for theming (light/dark, focus/break modes)
- SVG progress ring for timer visualization
- Service worker for offline support

## Git Workflow
- `main` branch: production (deployed via GitHub Pages)
- `dev` branch: active development
- Commit style: conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `style:`)

## Key Features
- Focus / Break / Long Break timer modes
- Configurable durations and daily goals
- SVG progress ring with clockwise animation (white elapsed indicator over colored ring)
- Task list
- Stats tracking
- Light/dark theme support
- Notification support

## Development Notes
- No build step — edit files directly and test in browser
- When modifying the app, remember to bump the service worker cache version in `sw.js`
- The progress ring animation uses `stroke-dasharray` / `stroke-dashoffset` on SVG circles
- Theme is controlled via `data-theme` and `data-mode` attributes on `<html>`

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
