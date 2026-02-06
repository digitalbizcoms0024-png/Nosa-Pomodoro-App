# Roadmap: Pomodoro Timer — Background Audio

## Overview

This roadmap delivers background audio capabilities to the existing pomodoro timer PWA. In 3 phases, we'll integrate YouTube-based audio streaming with curated playlists, build controls that fit the minimal UI aesthetic, and polish the integration with smart timer sync and volume ducking for alerts.

## Phases

- [ ] **Phase 1: Audio Foundation** - YouTube API integration and basic playback
- [ ] **Phase 2: Categories & Controls** - Category selection and UI controls
- [ ] **Phase 3: Polish & Integration** - Volume ducking, theme integration, and persistence

## Phase Details

### Phase 1: Audio Foundation
**Goal**: Users can play YouTube-based background audio during focus sessions
**Depends on**: Nothing (first phase)
**Requirements**: AUDIO-01, AUDIO-04
**Success Criteria** (what must be TRUE):
  1. User can play and pause background audio
  2. YouTube player is visible on screen (compact, ToS compliant)
  3. Audio continues playing during focus sessions
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — YouTube player integration with play/pause and visible player

### Phase 2: Categories & Controls
**Goal**: Users can select from curated playlists and control playback
**Depends on**: Phase 1
**Requirements**: AUDIO-02, AUDIO-03, CAT-01, CAT-02, CAT-03, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. User can choose from 4 audio categories (Lofi, Binaural Beats, Nature Sounds, Ambient)
  2. Each category contains 3-5 curated YouTube tracks
  3. User can adjust volume and mute/unmute audio
  4. Audio controls appear as minimal indicator that expands to full controls
  5. Tracks auto-advance when one ends
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during planning

### Phase 3: Polish & Integration
**Goal**: Audio integrates seamlessly with timer lifecycle and app theme
**Depends on**: Phase 2
**Requirements**: AUDIO-05
**Success Criteria** (what must be TRUE):
  1. Music volume automatically ducks during timer chime alerts
  2. Audio controls match light/dark theme
  3. Last played category persists across sessions
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during planning

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Foundation | 0/? | Not started | - |
| 2. Categories & Controls | 0/? | Not started | - |
| 3. Polish & Integration | 0/? | Not started | - |
