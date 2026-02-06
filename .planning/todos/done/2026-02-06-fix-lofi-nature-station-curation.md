---
created: 2026-02-06T04:20
title: Fix lofi and nature category station curation
area: audio
files:
  - index.html:1950-1972
---

## Problem

The lofi and nature categories don't contain music that matches their labels:

**Lofi category** — None of these are actually lofi music:
- Groove Salad = Ambient/Downtempo (chill but not lofi)
- Fluid = Instrumental Hip Hop (closest but SomaFM's version is more experimental)
- Illinois Street Lounge = Classic Lounge/Exotica (completely wrong genre)
- Lush = Electronica (not lofi)

**Nature category** — Neither station plays nature sounds:
- Fluid (Organic) = Same Fluid stream relabeled, still instrumental hip hop
- Suburbs of Goa = Organic Trance (electronic music, not nature)

The root issue is that SomaFM doesn't have true lofi or nature sound stations. The original plan acknowledged this limitation for nature ("SomaFM has limited nature content") but the workaround of relabeling unrelated stations is misleading to users.

## Solution

Options to consider:
1. **Find better free streaming sources** — Look for free HTTPS streams with CORS support that actually serve lofi beats and nature sounds (rain, ocean, forest). May need to expand beyond SomaFM.
2. **Rename categories to match content** — e.g., "Lofi" → "Chill" or "Downtempo", "Nature" → "Organic" — honest but less appealing.
3. **Remove misleading categories** — Drop nature, keep only categories SomaFM serves well (ambient, electronic/chill). Reduce to 2-3 categories.
4. **Mix sources** — Use SomaFM for ambient/electronic, find a nature sounds stream elsewhere.

Need to verify CORS support for any non-SomaFM sources before committing to option 1 or 4.
