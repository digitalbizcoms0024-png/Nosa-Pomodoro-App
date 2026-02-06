# Technology Stack

**Analysis Date:** 2026-02-06

## Languages

**Primary:**
- HTML5 - Markup and application structure (`index.html`)
- CSS3 - Styling with custom properties and animations (`<style>` in `index.html`)
- JavaScript (Vanilla ES6+) - Application logic and interactions (no build transpilation)

## Runtime

**Environment:**
- Browser (modern, supporting ES6+, Service Workers, Web Notifications API)
- Service Worker API for offline support

**Package Manager:**
- None - zero dependencies, no package.json
- Assets loaded directly from CDN and embedded

## Frameworks

**Core:**
- None - vanilla HTML/CSS/JavaScript

**PWA Support:**
- Service Workers (native browser API) - Offline caching via `sw.js`
- Web App Manifest - `manifest.json` for installability

**External Libraries:**
- Firebase SDK (Compatibility version 10.14.1)
  - `firebase-app-compat.js` - Core Firebase functionality
  - `firebase-auth-compat.js` - User authentication
  - `firebase-firestore-compat.js` - Cloud database (v10.14.1)

## Key Dependencies

**Critical:**
- Firebase Web SDK (v10.14.1) - User authentication and data persistence
  - Location: Loaded via CDN from `https://www.gstatic.com/firebasejs/`
  - Used for: Authentication, Firestore database, user data sync

**Browser APIs (Native):**
- Web Notifications API - Timer completion notifications
- localStorage - Local persistent storage for settings, stats, tasks, theme
- Web Audio API - Sound playback for timer events
- SVG & Canvas - Progress ring visualization

## Configuration

**Environment:**
- Firebase configuration embedded in `index.html` (lines 1564-1572)
  - apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId
  - No build-time environment variable separation
  - Configuration is hardcoded (not recommended for production secrets)

**Build:**
- No build system - files served directly
- Service Worker cache version defined in `sw.js` (CACHE_NAME = 'pomodoro-v33')
- Version bumping is manual - increment CACHE_NAME on changes

## Platform Requirements

**Development:**
- Text editor or IDE for HTML/CSS/JS
- Web browser with DevTools for testing
- No build tools, Node.js, or npm required
- Service worker support in browser for offline functionality

**Production:**
- Deployment: GitHub Pages with custom domain (pomodorotimer.vip via CNAME)
- Firebase project active and configured
- HTTPS required for Service Workers and Notifications API

---

*Stack analysis: 2026-02-06*
