# Roadmap: Pomodoro Timer — Background Audio

## Overview

This roadmap delivers background audio capabilities to the existing pomodoro timer PWA. In 2 phases, we'll integrate free streaming audio with curated categories, build controls that fit the minimal UI aesthetic, and polish the integration with volume ducking for alerts.

## Phases

- [ ] **Phase 1: Streaming Audio & Categories** - HTML5 audio with category selection and UI controls
- [ ] **Phase 2: Polish & Integration** - Volume ducking and refinements

## Phase Details

### Phase 1: Streaming Audio & Categories
**Goal**: Users can play free streaming audio during focus sessions with category selection and full playback controls
**Depends on**: Nothing (first phase)
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, CAT-01, CAT-02, CAT-03, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. User can play and pause background audio via HTML5 `<audio>` element
  2. User can choose from 4 audio categories (Lofi, Binaural Beats, Nature Sounds, Ambient)
  3. Each category contains curated streaming tracks (SomaFM, etc.)
  4. User can adjust volume and mute/unmute audio
  5. Audio controls appear as minimal indicator that expands to full controls
  6. Tracks auto-advance when one ends
  7. No visible video player — audio only
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Audio engine, station data, and service worker update
- [ ] 01-02-PLAN.md — Audio controls UI and app integration

### Phase 2: Polish & Integration
**Goal**: Audio integrates seamlessly with timer lifecycle and app theme
**Depends on**: Phase 1
**Requirements**: AUDIO-05
**Success Criteria** (what must be TRUE):
  1. Music volume automatically ducks during timer chime alerts
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during planning

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Streaming Audio & Categories | 0/2 | Not started | - |
| 2. Polish & Integration | 0/? | Not started | - |
