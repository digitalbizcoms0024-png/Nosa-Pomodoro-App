---
plan: 001
type: execute
wave: 1
depends_on: []
files_modified: [index.html, sw.js]
autonomous: true

must_haves:
  truths:
    - "Lo-fi, Classical, and Nature premium audio categories play streams that match their category labels"
    - "Upgrade prompt modal shows all 3 pricing tiers: monthly ($2/mo), yearly ($15/yr), and lifetime ($47)"
    - "Stats icon is visible when user is logged out and shows a sign-in prompt when clicked"
  artifacts:
    - path: "index.html"
      provides: "All 3 fixes in the single-file app"
    - path: "sw.js"
      provides: "Updated cache version to bust stale cached HTML"
  key_links:
    - from: "AUDIO_STATIONS object"
      to: "audio player"
      via: "selectStation()"
      pattern: "lofi.*url|classical.*url|nature.*url"
    - from: "#upgrade-prompt dialog HTML"
      to: "showUpgradePrompt()"
      via: "dialog.showModal()"
      pattern: "upgrade-tier"
    - from: "statsBtn click handler"
      to: "openStatsDialog() or sign-in prompt"
      via: "addEventListener"
      pattern: "statsBtn.*addEventListener"
---

<objective>
Fix 3 UAT gaps found during Phase 5 testing: (1) replace poorly-matched SomaFM streams for Lo-fi, Classical, and Nature premium audio categories, (2) add the missing monthly $2/mo tier to the upgrade prompt modal, and (3) make stats/export icons visible when logged out with a sign-in prompt on click.

Purpose: Close UAT gaps so Phase 5 can pass acceptance testing.
Output: Updated index.html with all 3 fixes, bumped sw.js cache version.
</objective>

<execution_context>
@/Users/user/.claude/get-shit-done/workflows/execute-plan.md
@/Users/user/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@index.html
@sw.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix premium audio streams and upgrade prompt</name>
  <files>index.html</files>
  <action>
  Two changes in index.html:

  **1. Replace audio streams (~line 2866-2878)**

  Replace the `lofi`, `classical`, and `nature` entries in the `AUDIO_STATIONS` object:

  ```js
  lofi: [
    { name: 'Fluid', url: 'https://ice1.somafm.com/fluid-128-mp3', genre: 'Lo-fi Hip Hop' },
    { name: 'Beat Blender', url: 'https://ice1.somafm.com/beatblender-128-mp3', genre: 'Chill Beats' },
    { name: 'Groove Salad Classic', url: 'https://ice1.somafm.com/gsclassic-128-mp3', genre: 'Downtempo' },
  ],
  classical: [
    { name: 'Synphaera', url: 'https://ice1.somafm.com/synphaera-128-mp3', genre: 'Ambient Symphonic' },
    { name: 'n5MD Radio', url: 'https://ice1.somafm.com/n5md-128-mp3', genre: 'Ambient/Post-Rock' },
  ],
  nature: [
    { name: 'Drone Zone', url: 'https://ice5.somafm.com/dronezone-256-mp3', genre: 'Meditative Drone' },
    { name: 'Deep Space One', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', genre: 'Deep Ambient' },
  ],
  ```

  Rationale: SomaFM has no true classical or nature channels. For Lo-fi, Fluid is the best match (instrumental hip-hop/future soul). For Classical, Synphaera (symphonic ambient) and n5MD (post-rock) are the closest to classical-adjacent instrumental. For Nature, keep the existing ambient choices but remove Fluid (moved to Lo-fi). Also remove the duplicate Drone Zone that was in the lofi array (via Lush) and the Indie Pop Rocks station which doesn't fit Lo-fi at all. Groove Salad Classic replaces the regular Groove Salad for a more retro chill vibe.

  Also update the AUDIO_CATEGORY_LABELS for clarity if the existing labels are misleading:
  - Change `classical: 'Classical'` to `classical: 'Orchestral'` so users don't expect Mozart
  - Change `nature: 'Nature'` to `nature: 'Soundscapes'` so users don't expect bird sounds

  **2. Add monthly tier to upgrade prompt (~line 2529-2539)**

  Replace the `<div class="upgrade-comparison">` block (currently showing only Yearly and Lifetime) with a 3-column grid showing Monthly, Yearly, and Lifetime:

  ```html
  <div class="upgrade-comparison">
    <div class="upgrade-tier">
      <h4>Monthly</h4>
      <div class="upgrade-price"><strong>$2</strong>/mo</div>
      <div class="upgrade-savings">Try it out</div>
    </div>
    <div class="upgrade-tier">
      <h4>Yearly</h4>
      <div class="upgrade-price"><strong>$15</strong>/yr</div>
      <div class="upgrade-savings">Save 37%</div>
    </div>
    <div class="upgrade-tier">
      <h4>Lifetime</h4>
      <div class="upgrade-price"><strong>$47</strong> once</div>
      <div class="upgrade-savings">Best Value</div>
    </div>
  </div>
  ```

  Update the CSS for `.upgrade-comparison` (~line 1861) to change `grid-template-columns: 1fr 1fr` to `grid-template-columns: 1fr 1fr 1fr` (3 columns for 3 tiers).

  Also update the "Premium Yearly" label in the `<h4>` to just "Yearly" and "Lifetime" stays "Lifetime". Keep the labels short since the upgrade prompt is compact.
  </action>
  <verify>
  Open index.html in browser. Verify:
  1. Check the AUDIO_STATIONS JS object has updated streams for lofi, classical, nature
  2. Search for "upgrade-comparison" and confirm 3 upgrade-tier divs exist
  3. Search for "grid-template-columns: 1fr 1fr 1fr" in the upgrade-comparison CSS
  </verify>
  <done>
  - Lo-fi category shows Fluid, Beat Blender, and Groove Salad Classic streams
  - Classical (now "Orchestral") shows Synphaera and n5MD
  - Nature (now "Soundscapes") shows Drone Zone and Deep Space One
  - Upgrade prompt displays 3 tiers: Monthly $2/mo, Yearly $15/yr, Lifetime $47
  </done>
</task>

<task type="auto">
  <name>Task 2: Make stats icon visible when logged out with sign-in prompt</name>
  <files>index.html</files>
  <action>
  Two changes to make stats accessible when logged out:

  **1. Remove the `hidden` class from statsBtn in HTML (~line 2163)**

  Change:
  ```html
  <button class="icon-btn hidden" id="statsBtn" aria-label="Stats" data-tooltip="Stats">
  ```
  To:
  ```html
  <button class="icon-btn" id="statsBtn" aria-label="Stats" data-tooltip="Stats">
  ```

  **2. Update `updateAuthUI()` function (~line 3909)**

  Remove the line that hides the stats button when logged out:
  ```js
  statsBtn.classList.toggle('hidden', !loggedIn);
  ```
  Delete this line entirely. The stats button should always be visible.

  **3. Update `openStatsDialog()` function (~line 3891)**

  Wrap the existing logic with a logged-in check. If the user is NOT logged in, instead of opening the stats dialog, show an informational dialog or reuse the auth prompt pattern:

  ```js
  function openStatsDialog() {
    if (!state.user) {
      // Show sign-in prompt for stats
      const msg = document.createElement('dialog');
      msg.className = 'quick-dialog';
      msg.innerHTML = `
        <div class="dialog-body" style="text-align: center; padding: 24px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; margin-bottom: 12px;">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <h3 style="margin-bottom: 8px;">Sign in to view stats</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.875rem;">Track your focus sessions, streaks, and weekly trends by signing in with Google.</p>
          <div class="dialog-actions" style="justify-content: center;">
            <button class="btn btn-ghost" id="statsPromptClose">Close</button>
            <button class="btn btn-primary" id="statsPromptSignIn">Sign In</button>
          </div>
        </div>
      `;
      document.body.appendChild(msg);
      msg.showModal();
      msg.querySelector('#statsPromptClose').addEventListener('click', () => { msg.close(); msg.remove(); });
      msg.querySelector('#statsPromptSignIn').addEventListener('click', () => { msg.close(); msg.remove(); signInWithGoogle(); });
      msg.addEventListener('click', (e) => { if (e.target === msg) { msg.close(); msg.remove(); } });
      return;
    }
    updateStats();
    statsDialog.showModal();
    statsBtn.classList.add('active');
  }
  ```

  This approach creates a temporary dialog element (no permanent HTML needed) that prompts sign-in. It reuses the existing `signInWithGoogle()` function. The dialog self-destructs on close.

  Also add minimal CSS for `.quick-dialog` near the other dialog styles:
  ```css
  .quick-dialog {
    max-width: 340px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    padding: 0;
  }
  .quick-dialog::backdrop {
    background: rgba(0,0,0,0.5);
  }
  ```
  </action>
  <verify>
  In the browser:
  1. Log out (or open in incognito). Confirm the stats bar chart icon is visible in the header.
  2. Click the stats icon. Confirm a dialog appears saying "Sign in to view stats" with a Sign In button.
  3. Click "Close" on the prompt - dialog should dismiss.
  4. Log in. Click the stats icon. Confirm the normal stats dialog opens with charts.
  </verify>
  <done>
  - Stats icon is always visible in the header regardless of auth state
  - Clicking stats when logged out shows a "Sign in to view stats" prompt with sign-in button
  - Clicking stats when logged in opens the normal stats dialog as before
  - The sign-in button in the prompt triggers Google sign-in
  </done>
</task>

<task type="auto">
  <name>Task 3: Bump service worker cache version</name>
  <files>sw.js</files>
  <action>
  Open sw.js, find the `CACHE_NAME` constant (typically at the top), and increment the version number by 1.

  For example, if current is `const CACHE_NAME = 'pomodoro-v12';`, change to `const CACHE_NAME = 'pomodoro-v13';`.

  This ensures users get the updated index.html with all 3 fixes instead of seeing the stale cached version.
  </action>
  <verify>
  Read sw.js and confirm CACHE_NAME has been incremented.
  </verify>
  <done>Service worker cache version bumped so deployed changes reach users.</done>
</task>

</tasks>

<verification>
Open index.html in a browser and verify all 3 gaps are closed:
1. Premium audio: Click Lo-fi, Orchestral, and Soundscapes categories. Streams should play and match their labels.
2. Upgrade prompt: Trigger the upgrade prompt by clicking a premium feature while not premium. Confirm all 3 tiers (Monthly $2/mo, Yearly $15/yr, Lifetime $47) are shown.
3. Stats when logged out: While not signed in, confirm the stats icon is visible. Click it and confirm a "Sign in to view stats" prompt appears.
</verification>

<success_criteria>
- All 3 premium audio categories have appropriate SomaFM streams
- Upgrade prompt shows 3 pricing tiers instead of 2
- Stats icon visible and functional (with sign-in prompt) when logged out
- Service worker cache bumped for deployment
</success_criteria>

<output>
After completion, create `.planning/quick/001-fix-uat-gaps-audio-streams-monthly-plan/001-SUMMARY.md`
</output>
