# Feature Research: Background Audio in Productivity Apps

**Researched:** 2026-02-06
**Reference apps:** Noisli, Brain.fm, Tide, Focus@Will, Forest

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Play/Pause controls | Low | Universal expectation |
| Volume control | Low | Separate from system volume |
| Category selection (3-4 types) | Low | Lofi, binaural, nature, ambient |
| Visual playback indicator | Low | Icon/animation showing audio state |
| Mute toggle | Low | Quick silence without losing position |
| Separate timer alert volume | Medium | Chimes must be audible over music |
| Audio persists when navigating app | Medium | Uninterrupted playback expected |

## Differentiators

| Feature | Value | Complexity |
|---------|-------|-----------|
| Smart timer sync (auto-play/pause) | Your key differentiator — hands-free workflow | Low |
| Multiple tracks per category | Variety prevents repetition (you planned 3-5) | Medium |
| Fade in/out transitions | Professional feel, reduces jarring stops | Medium |
| Per-category volume memory | Prevents volume shock when switching | Low |
| Shuffle within category | Prevents predictability | Low |
| Remember last category | Convenience on return visits | Low |

## Anti-Features (Do NOT Build)

| Anti-Feature | Why Avoid |
|-------------|-----------|
| Auto-play on page load | Violates browser policies, bad UX |
| Complex equalizer | Overwhelming for a focus app |
| Extensive music library | Scope creep, curation burden |
| Audio mixing/layering | Very complex with YouTube, adds cognitive load |
| Social features (sharing, likes) | Distracts from productivity |
| User-uploaded audio | Moderation nightmare, legal issues |
| Music discovery feed | Turns focus app into music app |
| Lyrics/song info display | Distraction from focus |
| Audio visualizer | Eye candy, doesn't improve focus |

## Feature Dependencies

```
Core Foundation:
├── Play/Pause (required for everything)
├── Volume control (required)
└── Category selection (required)

Smart Integration:
├── Timer sync → requires Play/Pause + timer hooks
├── Separate alert volume → requires dual audio management
└── Background playback → browser API dependent

Polish:
├── Fade transitions → requires Web Audio API
├── Shuffle → requires playlist management
└── Category memory → requires localStorage
```

## MVP Recommendation

**Phase 1 — Core Audio:** Play/pause, volume, categories, mute, visual indicator
**Phase 2 — Timer Integration:** Smart sync, pause on break, expandable UI
**Phase 3 — Polish:** Fade transitions, shuffle, remember preferences

**Defer:** Cross-fade, preloading, sleep timer, custom playlists, visualizer
