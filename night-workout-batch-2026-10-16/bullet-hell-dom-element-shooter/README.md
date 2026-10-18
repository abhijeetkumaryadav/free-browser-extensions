# Bullet Hell — DOM Element Shooter

A harmless mini game overlay for Chrome/Edge/Firefox/Opera (Manifest V3).

**What it does:** on your explicit click, a full-viewport `<canvas>` overlay
starts a bullet-hell mini game: your ship follows the mouse, click to shoot,
dodge falling enemy blocks styled like DOM elements. Score, 3 lives, three
difficulty levels, persistent high score.

**Honest scope:**
- The game lives entirely on a separate canvas layer — the page's DOM is
  never modified, inspected, or affected. Closing removes every trace.
- User-triggered only; runs only in the tab you start it on.
- 100% local, no network, no accounts.

**Files:** `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`,
icons, this README. Permissions: `storage` (difficulty + high score),
`activeTab` + `scripting` (start/stop the overlay on click only).
