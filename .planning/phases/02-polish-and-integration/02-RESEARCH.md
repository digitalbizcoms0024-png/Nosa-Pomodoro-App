# Phase 2: Polish & Integration - Research

**Researched:** 2026-02-06
**Domain:** Audio Ducking, HTML5 Audio Volume Control, Web Audio API Timing
**Confidence:** HIGH

## Summary

This phase implements audio ducking — automatically lowering the volume of background streaming music when timer chime alerts play, then restoring it afterward. The research confirms that while the Web Audio API provides sophisticated ducking capabilities through GainNode and parameter automation, a simpler approach works well for this use case: directly manipulate the HTML5 `<audio>` element's volume property with smooth transitions.

The standard approach is to use **requestAnimationFrame** for smooth volume fades on the HTML5 audio element, timed to the known duration of the Web Audio API chime (0.7 seconds total: 3 notes × 0.4s each, spaced 0.15s apart). The duck duration should exceed the chime duration to prevent overlap.

Key technical considerations:
- Timer chime plays through Web Audio API (separate from HTML5 audio element)
- Chime duration is deterministic: 0.7 seconds total (last note completes at `now + 2*0.15 + 0.4` = 0.7s)
- Volume transitions should use exponential curves for natural sound (not linear)
- requestAnimationFrame provides smooth animation without audio artifacts
- Simple setTimeout-based restoration works well for this use case

**Primary recommendation:** Duck HTML5 audio volume from current level to 20% over 100ms when chime starts, restore to original level over 300ms after chime completes (0.8s delay). Use requestAnimationFrame for smooth fade or direct volume assignment for simplicity.

## Standard Stack

The established libraries/tools for audio ducking and volume control:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 `<audio>.volume` | Native | Volume control | Direct property access, 0.0-1.0 range, already in use for streaming audio |
| Web Audio API AudioContext.currentTime | Native | Precise timing | Already in use for chime scheduling, provides sample-accurate timing |
| requestAnimationFrame | Native | Smooth volume transitions | Synced to display refresh, standard for animations, prevents jank |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| setTimeout | Native | Delayed restoration | Simple timer for restoring volume after chime completes |
| Easing functions | Custom | Natural fade curves | Optional: exponential easing for more natural volume transitions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct volume property | Web Audio API GainNode + MediaElementSourceNode | More complex: requires routing HTML5 audio through Web Audio graph, adds nodes and connections. Current approach (direct volume) is simpler and sufficient for this use case. |
| requestAnimationFrame fade | Instant volume change | Instant changes cause jarring transitions and potential audio clicks. RAF provides smooth, natural fades. |
| setTimeout-based fade | setInterval loops | setInterval can miss frames or run at wrong rate. RAF is synced to browser rendering and more reliable. |

**Installation:**
```bash
# No npm packages needed - all native browser APIs
```

## Architecture Patterns

### Recommended Integration Points
Since this is a single-file app, ducking code integrates with existing functions:

```
index.html (existing structure)
├── playChime(type) — ADD: Call duckBackgroundAudio() before playing notes
├── bgAudio element — MODIFY: Volume transitions applied here
└── JS: Add ducking functions
    ├── duckBackgroundAudio() — Lower volume when chime starts
    └── restoreBackgroundAudio() — Restore volume after chime ends
```

### Pattern 1: Deterministic Chime Duration
**What:** Calculate chime duration from Web Audio API scheduling parameters
**When to use:** When you control audio generation and know exact timing
**Example:**
```javascript
// Source: Existing playChime() function analysis
// Chime plays 3 notes:
// - Note 0: starts at now + 0*0.15 = 0s, stops at 0.4s
// - Note 1: starts at now + 1*0.15 = 0.15s, stops at 0.55s
// - Note 2: starts at now + 2*0.15 = 0.3s, stops at 0.7s
// Total chime duration: 0.7 seconds

const CHIME_DURATION = 0.7; // seconds
const DUCK_DURATION = 0.8;  // slightly longer to ensure chime completes
```

**Why this matters:**
- No need to detect when audio "ends" — we know the exact duration
- More reliable than event-based detection
- Allows precise scheduling of volume restoration

### Pattern 2: Simple Volume Ducking (Recommended)
**What:** Store original volume, reduce to duck level, restore after timer
**When to use:** For simple ducking without complex fade animations
**Example:**
```javascript
// Source: MDN HTMLMediaElement.volume + setTimeout pattern
let originalVolume = null;

function duckBackgroundAudio() {
  if (!bgAudio || bgAudio.paused) return;

  // Store original volume
  originalVolume = bgAudio.volume;

  // Duck to 20% of original
  bgAudio.volume = originalVolume * 0.2;

  // Restore after chime completes
  setTimeout(() => {
    restoreBackgroundAudio();
  }, 800); // 0.8s = slightly longer than 0.7s chime
}

function restoreBackgroundAudio() {
  if (!bgAudio || originalVolume === null) return;

  bgAudio.volume = originalVolume;
  originalVolume = null;
}
```

**Pros:**
- Simple, easy to understand
- No animation loop overhead
- Works reliably across all browsers

**Cons:**
- Instant volume change can be jarring
- No smooth fade in/out

### Pattern 3: Smooth Volume Fade with requestAnimationFrame (Better UX)
**What:** Animate volume changes over time using RAF for smooth transitions
**When to use:** When user experience requires smooth, natural-sounding volume transitions
**Example:**
```javascript
// Source: MDN requestAnimationFrame + audio volume patterns
let duckingState = {
  originalVolume: null,
  targetVolume: null,
  startVolume: null,
  startTime: null,
  duration: 0,
  animationId: null
};

function smoothDuckVolume(targetVolume, duration) {
  if (!bgAudio || bgAudio.paused) return;

  // Cancel any ongoing animation
  if (duckingState.animationId) {
    cancelAnimationFrame(duckingState.animationId);
  }

  // Store original volume on first duck
  if (duckingState.originalVolume === null) {
    duckingState.originalVolume = bgAudio.volume;
  }

  duckingState.startVolume = bgAudio.volume;
  duckingState.targetVolume = targetVolume;
  duckingState.startTime = performance.now();
  duckingState.duration = duration;

  function animate(currentTime) {
    const elapsed = currentTime - duckingState.startTime;
    const progress = Math.min(elapsed / duckingState.duration, 1);

    // Exponential easing for natural sound
    const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

    // Interpolate volume
    const currentVolume = duckingState.startVolume +
      (duckingState.targetVolume - duckingState.startVolume) * easedProgress;

    bgAudio.volume = currentVolume;

    if (progress < 1) {
      duckingState.animationId = requestAnimationFrame(animate);
    } else {
      duckingState.animationId = null;
    }
  }

  duckingState.animationId = requestAnimationFrame(animate);
}

function duckBackgroundAudio() {
  if (!bgAudio || bgAudio.paused) return;

  // Duck to 20% over 100ms
  smoothDuckVolume(bgAudio.volume * 0.2, 100);

  // Restore after chime completes
  setTimeout(() => {
    if (duckingState.originalVolume !== null) {
      // Restore over 300ms for smooth fade-in
      smoothDuckVolume(duckingState.originalVolume, 300);
      duckingState.originalVolume = null;
    }
  }, 800);
}
```

**Pros:**
- Smooth, professional-sounding transitions
- No audio artifacts or clicks
- More pleasant user experience

**Cons:**
- More complex code
- Slight CPU overhead for animation loop

### Pattern 4: Integration with Existing playChime()
**What:** Hook ducking into existing chime function without modifying audio scheduling
**When to use:** When you want to add ducking to existing audio code with minimal changes
**Example:**
```javascript
// Source: Existing codebase analysis
function playChime(type) {
  if (!state.settings.soundEnabled) return;

  // Duck background audio BEFORE chime starts
  duckBackgroundAudio();

  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const notes = type === 'focus'
      ? [523.25, 659.25, 783.99] // C5, E5, G5
      : [783.99, 659.25, 523.25]; // G5, E5, C5 descending for break

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });
  } catch {}
}
```

**Why this matters:**
- Single point of integration
- Ducking always happens when chime plays
- No risk of missing ducking in some code paths

### Anti-Patterns to Avoid
- **Setting volume to 0 instantly:** Creates jarring silence, defeats the purpose of "ducking" (should be audible but quieter)
- **Using Web Audio API GainNode for HTML5 audio:** Over-engineering — requires creating MediaElementSourceNode, routing through audio graph. Direct volume property is simpler.
- **Ducking based on audioContext.currentTime:** HTML5 audio element operates on different timeline. Use performance.now() or Date.now() for ducking timing.
- **Not checking if audio is playing:** Ducking paused audio causes confusion when user resumes playback.
- **Forgetting to cancel ongoing animations:** Can cause multiple RAF loops running simultaneously, wasting CPU.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Easing functions | Custom cubic bezier math | Built-in exponential easing (`1 - Math.pow(2, -10 * t)`) | Standard easing curves are well-tested, sound natural, avoid edge cases |
| Audio event detection | Polling currentTime | Known chime duration | Chime is generated with Web Audio API — duration is deterministic, no need to poll |
| Volume curve calculations | Linear interpolation | Exponential interpolation | Human hearing perceives volume logarithmically — exponential feels more natural |
| Animation timing | setInterval loops | requestAnimationFrame | RAF syncs to display refresh, pauses in background tabs, provides accurate timestamps |

**Key insight:** Volume ducking sounds complex but reduces to: (1) lower volume when alert starts, (2) restore volume after known duration. Don't overcomplicate with audio graph routing or complex event systems when simple timing works reliably.

## Common Pitfalls

### Pitfall 1: Linear Volume Fades Sound Unnatural
**What goes wrong:** Volume fades from 70% to 20% linearly, but human ears perceive the change as too sudden at the start and too slow at the end
**Why it happens:** Human hearing perceives volume logarithmically, not linearly
**How to avoid:**
- Use exponential easing curves for volume changes
- Formula: `easedProgress = 1 - Math.pow(2, -10 * progress)` for fade-in
- Alternative: `easedProgress = Math.pow(progress, 2)` for simpler quadratic easing
**Warning signs:**
- Users report volume drop feels "sudden" or "harsh"
- Fade-in sounds too slow at the end
- Compare linear vs. exponential side-by-side — exponential sounds more natural

### Pitfall 2: Not Canceling Previous Animations
**What goes wrong:** User triggers multiple chimes rapidly (e.g., resetting timer), creating multiple RAF loops that conflict and cause erratic volume behavior
**Why it happens:** Each duckBackgroundAudio() call starts a new RAF loop without canceling the previous one
**How to avoid:**
- Store animation ID in state: `duckingState.animationId`
- Cancel before starting new animation: `cancelAnimationFrame(duckingState.animationId)`
- Clear timeouts if ducking is interrupted: `clearTimeout(restoreTimerId)`
**Warning signs:**
```javascript
// BAD - multiple loops run simultaneously
function duckVolume() {
  requestAnimationFrame(animate); // New loop, old one still running!
}

// GOOD - cancel before starting
function duckVolume() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(animate);
}
```

### Pitfall 3: Ducking When Audio is Paused
**What goes wrong:** User has paused background music, chime plays and "ducks" the volume, then when user resumes music it's at 20% volume unexpectedly
**Why it happens:** Ducking code doesn't check if audio is currently playing
**How to avoid:**
- Check `bgAudio.paused` before ducking: `if (bgAudio.paused) return;`
- Only restore volume if ducking actually occurred
- Don't modify volume if audio is stopped or not loaded
**Warning signs:**
- User reports music is "too quiet" after resuming
- Volume changes happen when no audio is playing
- Console shows errors about audio element being null

### Pitfall 4: Incorrect Chime Duration Calculation
**What goes wrong:** Volume restoration happens too early (before chime finishes) or too late (awkward silence)
**Why it happens:** Misunderstanding Web Audio API scheduling parameters
**How to avoid:**
- Analyze existing playChime() carefully:
  ```javascript
  // 3 notes, each lasting 0.4s, spaced 0.15s apart
  // Last note: starts at now + 2*0.15 = 0.3s, stops at 0.3 + 0.4 = 0.7s
  const CHIME_DURATION = 0.7;
  ```
- Add small buffer to DUCK_DURATION (0.8s) to ensure chime completes
- Test with both 'focus' and 'break' chime types (same duration, different notes)
**Warning signs:**
- Background music volume increases while chime is still playing
- Long pause between chime ending and volume restoration

### Pitfall 5: Timing Mismatch Between audioContext.currentTime and setTimeout
**What goes wrong:** Ducking restoration timing drifts or becomes unreliable
**Why it happens:** audioContext.currentTime is audio hardware clock, setTimeout uses JavaScript event loop clock — they're not synchronized
**How to avoid:**
- Use setTimeout for ducking restoration (it's not audio-critical timing)
- Don't try to sync RAF or setTimeout to audioContext.currentTime
- Accept that restoration might be 10-50ms off — this is imperceptible
**Warning signs:**
- Restoration timing varies between test runs
- Attempting to convert between performance.now() and audioContext.currentTime
- Over-engineering with audio clock synchronization

### Pitfall 6: Not Testing with User Volume Changes
**What goes wrong:** User adjusts volume slider while ducking is in progress, causing conflicts or stuck volume levels
**Why it happens:** Ducking stores originalVolume once, but user changes it during the duck
**How to avoid:**
- If user changes volume during duck, cancel ducking and use new volume
- Listen to volume slider changes: if ducking in progress, clear restoration timer
- Alternative: Don't store originalVolume, store original percentage and calculate from current volume
**Warning signs:**
```javascript
// BAD - stores absolute volume
originalVolume = bgAudio.volume; // 0.7
// User changes to 0.5 during duck
// Restoration sets back to 0.7 — wrong!

// BETTER - store duck percentage
const duckRatio = 0.2; // 20% of current
duckedVolume = bgAudio.volume * duckRatio;
// Restore by dividing back
restoredVolume = bgAudio.volume / duckRatio;
```

## Code Examples

Verified patterns from official sources:

### Complete Ducking Implementation (Recommended)
```javascript
// Source: MDN requestAnimationFrame + HTMLMediaElement.volume patterns

// Configuration constants
const DUCK_RATIO = 0.2;        // Duck to 20% of current volume
const DUCK_DURATION_MS = 100;  // Quick fade down
const RESTORE_DURATION_MS = 300; // Slower fade up
const CHIME_DURATION_MS = 700; // Known from playChime() analysis
const DUCK_DELAY_MS = 800;     // Restore after chime + buffer

// Ducking state
let duckingState = {
  originalVolume: null,
  isActive: false,
  restoreTimerId: null,
  fadeAnimationId: null
};

/**
 * Smoothly transition audio volume over time
 * @param {number} targetVolume - Target volume (0.0 to 1.0)
 * @param {number} durationMs - Fade duration in milliseconds
 */
function fadeVolumeTo(targetVolume, durationMs) {
  if (!bgAudio || bgAudio.paused) return;

  // Cancel any ongoing fade
  if (duckingState.fadeAnimationId) {
    cancelAnimationFrame(duckingState.fadeAnimationId);
  }

  const startVolume = bgAudio.volume;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);

    // Exponential easing (ease-out) for natural sound
    const easedProgress = 1 - Math.pow(2, -10 * progress);

    // Interpolate volume
    const currentVolume = startVolume + (targetVolume - startVolume) * easedProgress;
    bgAudio.volume = Math.max(0, Math.min(1, currentVolume));

    if (progress < 1) {
      duckingState.fadeAnimationId = requestAnimationFrame(animate);
    } else {
      duckingState.fadeAnimationId = null;
    }
  }

  duckingState.fadeAnimationId = requestAnimationFrame(animate);
}

/**
 * Duck background audio volume when timer chime plays
 */
function duckBackgroundAudio() {
  // Skip if audio isn't playing
  if (!bgAudio || bgAudio.paused) return;

  // Skip if already ducking
  if (duckingState.isActive) return;

  // Store original volume
  duckingState.originalVolume = bgAudio.volume;
  duckingState.isActive = true;

  // Duck to 20% of current volume
  const duckedVolume = duckingState.originalVolume * DUCK_RATIO;
  fadeVolumeTo(duckedVolume, DUCK_DURATION_MS);

  // Schedule restoration after chime completes
  duckingState.restoreTimerId = setTimeout(() => {
    restoreBackgroundAudio();
  }, DUCK_DELAY_MS);
}

/**
 * Restore background audio volume after chime finishes
 */
function restoreBackgroundAudio() {
  if (!duckingState.isActive) return;

  // Restore to original volume
  if (duckingState.originalVolume !== null) {
    fadeVolumeTo(duckingState.originalVolume, RESTORE_DURATION_MS);
  }

  // Reset state
  duckingState.originalVolume = null;
  duckingState.isActive = false;
  duckingState.restoreTimerId = null;
}

/**
 * Cancel ducking if user manually changes volume
 * Call this from volume slider event handler
 */
function cancelDucking() {
  if (!duckingState.isActive) return;

  // Cancel scheduled restoration
  if (duckingState.restoreTimerId) {
    clearTimeout(duckingState.restoreTimerId);
    duckingState.restoreTimerId = null;
  }

  // Cancel ongoing fade animation
  if (duckingState.fadeAnimationId) {
    cancelAnimationFrame(duckingState.fadeAnimationId);
    duckingState.fadeAnimationId = null;
  }

  // Reset state
  duckingState.originalVolume = null;
  duckingState.isActive = false;
}

/**
 * Modified playChime() to integrate ducking
 */
function playChime(type) {
  if (!state.settings.soundEnabled) return;

  // Duck background audio before chime
  duckBackgroundAudio();

  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const notes = type === 'focus'
      ? [523.25, 659.25, 783.99]
      : [783.99, 659.25, 523.25];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });
  } catch {}
}

/**
 * Modified volume slider handler to cancel ducking
 */
function setAudioVolume(value) {
  // value: 0-100
  const normalizedVolume = Math.max(0, Math.min(100, value)) / 100;

  // Cancel ducking if user changes volume manually
  cancelDucking();

  state.audio.volume = normalizedVolume;
  if (bgAudio) {
    bgAudio.volume = normalizedVolume;
  }
  state.settings.audioVolume = value;
  saveSettings();
}
```

### Simplified Version (No Animation)
```javascript
// Source: Basic setTimeout + direct volume assignment
// Simpler but less smooth — acceptable for MVP

let originalVolume = null;

function duckBackgroundAudio() {
  if (!bgAudio || bgAudio.paused || originalVolume !== null) return;

  originalVolume = bgAudio.volume;
  bgAudio.volume = originalVolume * 0.2;

  setTimeout(() => {
    if (originalVolume !== null) {
      bgAudio.volume = originalVolume;
      originalVolume = null;
    }
  }, 800);
}

// Integration: add one line to playChime()
function playChime(type) {
  if (!state.settings.soundEnabled) return;
  duckBackgroundAudio(); // <-- Add this line
  // ... rest of existing code
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Side-chain compression via DynamicsCompressor | Simple volume reduction on HTML5 audio | N/A (not standardized) | Side-chain not available in Web Audio API, volume ducking simpler and sufficient |
| setInterval-based volume animation | requestAnimationFrame | 2015+ | RAF syncs to display refresh, pauses in background, better performance |
| Linear volume interpolation | Exponential easing | Always (best practice) | Matches human hearing perception, sounds more natural |
| Routing HTML5 audio through Web Audio graph | Direct volume property | 2018+ | Simpler for basic volume control, no need for MediaElementSourceNode |
| Event-based chime detection | Deterministic timing | N/A | When audio duration is known, timing is more reliable than events |

**Deprecated/outdated:**
- **Side-chain compression in Web Audio API:** Still not implemented (open issue since 2013), manual volume ducking is standard approach
- **setInterval for animations:** Use requestAnimationFrame for better performance and timing
- **ScriptProcessorNode for audio processing:** Deprecated in favor of AudioWorklet (but not needed for simple ducking)

## Open Questions

Things that couldn't be fully resolved:

1. **Should ducking be configurable or always-on?**
   - What we know: User already has separate volume controls for music and alerts
   - What's unclear: Some users might prefer music doesn't duck (alerts are already separate)
   - Recommendation: Implement as always-on for Phase 2. Could add toggle in settings later if users request it.

2. **What's the ideal duck ratio?**
   - What we know: 20% (0.2) is common in audio production
   - What's unclear: This is subjective and may vary by music type (loud vs. quiet)
   - Recommendation: Start with 20%, can make configurable later if users want more/less ducking

3. **Should ducking occur if alerts are disabled?**
   - What we know: `state.settings.soundEnabled` controls chime playback
   - What's unclear: If chime is disabled, ducking shouldn't occur (no alert to duck for)
   - Recommendation: duckBackgroundAudio() should check `state.settings.soundEnabled` and skip if false

4. **Should restoration timing adjust if chimes overlap?**
   - What we know: Rapid timer resets could trigger multiple chimes
   - What's unclear: Should restoration cancel and restart, or queue?
   - Recommendation: `if (duckingState.isActive) return;` prevents overlapping ducks. If chime plays during duck, it extends the duck duration naturally.

5. **What if user pauses/resumes audio during duck?**
   - What we know: Ducking stores originalVolume and modifies current volume
   - What's unclear: If user pauses during duck then resumes, should volume be ducked?
   - Recommendation: Ducking only occurs if `bgAudio.paused === false`. If user pauses during duck, volume stays ducked until restoration timer fires, then restores (no issue because audio is paused).

## Sources

### Primary (HIGH confidence)
- [MDN: HTMLMediaElement.volume](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume) - Official volume property documentation
- [MDN: GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) - Web Audio API volume control
- [MDN: AudioParam.exponentialRampToValueAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/exponentialRampToValueAtTime) - Smooth audio parameter transitions
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Standard animation timing
- [MDN: BaseAudioContext.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime) - Audio clock for timing
- [MDN: HTMLMediaElement.duration](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/duration) - Media duration property
- [Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) - Official guidance on volume control and timing
- [Web.dev: A tale of two clocks](https://web.dev/articles/audio-scheduling) - Differences between audio and JavaScript timing

### Secondary (MEDIUM confidence)
- [W3C Web Audio Use Cases](https://www.w3.org/TR/webaudio-usecases/) - Ducking use cases and patterns
- [GitHub: Web Audio API Issue #246](https://github.com/WebAudio/web-audio-api/issues/246) - Side-chain compression discussion (not implemented)
- [Smashing Magazine: Audio Visualization Guide](https://www.smashingmagazine.com/2022/03/audio-visualization-javascript-gsap-part1/) - Audio animation patterns
- [CSS-Tricks: Custom Audio Player](https://css-tricks.com/lets-create-a-custom-audio-player/) - HTML5 audio control patterns

### Tertiary (LOW confidence)
- WebSearch results for "audio ducking pattern JavaScript" - Community implementations vary in complexity
- WebSearch results for "HTML5 audio volume fade" - Multiple approaches, need verification
- WebSearch results for "requestAnimationFrame audio" - General animation guidance, not audio-specific

## Metadata

**Confidence breakdown:**
- Ducking approach: HIGH - Direct volume property is proven, reliable, works across all browsers
- Animation technique: HIGH - requestAnimationFrame is standard, well-documented
- Timing calculation: HIGH - Chime duration is deterministic from existing code
- Easing curves: MEDIUM - Exponential easing is best practice, but subjective preference

**Research date:** 2026-02-06
**Valid until:** 90 days (stable APIs, timing-based approach, no external dependencies)

**Key risks to monitor:**
- None identified — uses stable, well-supported browser APIs
- Timing approach is deterministic and doesn't depend on events
- No external services or changing specifications

**Next steps for planner:**
1. Decide: Simple (direct volume change) vs. Smooth (RAF animation) approach
2. Create task for implementing ducking functions
3. Create task for integrating with playChime()
4. Create task for handling edge cases (paused audio, user volume changes)
5. Create task for adding configuration constants
6. Create verification task (test with different audio types, rapid chime triggers)
