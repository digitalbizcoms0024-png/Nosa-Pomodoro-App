# Requirements: Pomodoro Timer — Background Audio

**Defined:** 2026-02-06
**Core Value:** Background audio that helps users stay focused during pomodoro sessions, with zero friction to start.

## v1 Requirements

### Audio Playback

- [ ] **AUDIO-01**: User can play/pause background audio
- [ ] **AUDIO-02**: User can adjust background music volume
- [ ] **AUDIO-03**: User can mute/unmute background audio
- [ ] **AUDIO-04**: YouTube player visible on screen (compact, ToS compliant)
- [ ] **AUDIO-05**: Music volume ducks automatically during timer chime alerts

### Categories

- [ ] **CAT-01**: User can select from 4 audio categories (Lofi, Binaural Beats, Nature Sounds, Ambient)
- [ ] **CAT-02**: Each category has 3-5 curated YouTube tracks
- [ ] **CAT-03**: Tracks auto-advance to next when one ends

### UI

- [ ] **UI-01**: Audio controls appear as minimal indicator on main screen
- [ ] **UI-02**: Audio indicator expands to full controls on interaction

## v2 Requirements

### Timer Integration

- **SYNC-01**: Audio auto-plays when focus timer starts
- **SYNC-02**: Audio auto-pauses when break begins
- **SYNC-03**: User can configure break audio behavior (keep playing vs pause)
- **SYNC-04**: Separate volume slider for timer alerts vs music

### Enhanced Playback

- **PLAY-01**: Next/previous track buttons
- **PLAY-02**: Remember last played category and track across sessions
- **PLAY-03**: Per-category volume memory
- **PLAY-04**: Fade in/out transitions on play/pause
- **PLAY-05**: Shuffle within category

### Enhanced UI

- **EUI-01**: Audio panel matches light/dark theme and focus/break mode colors
- **EUI-02**: Now-playing indicator shows track title

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-hosted audio files | Streaming from YouTube keeps app lightweight |
| Audio mixing/layering | High complexity with YouTube embeds |
| User-uploaded audio | Moderation and legal concerns |
| Spotify/Apple Music integration | Requires OAuth, premium accounts, API costs |
| Audio visualizer | Not core to productivity value |
| Offline audio playback | Conflicts with streaming approach |
| Complex equalizer | Overwhelming for a focus app |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | TBD | Pending |
| AUDIO-02 | TBD | Pending |
| AUDIO-03 | TBD | Pending |
| AUDIO-04 | TBD | Pending |
| AUDIO-05 | TBD | Pending |
| CAT-01 | TBD | Pending |
| CAT-02 | TBD | Pending |
| CAT-03 | TBD | Pending |
| UI-01 | TBD | Pending |
| UI-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after initial definition*
