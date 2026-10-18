# Gravity Sandbox — Page Physics Toy

A harmless, user-triggered visual toy for Chrome/Edge/Firefox/Opera (Manifest V3).

**What it does:** on your explicit click, up to 60 visible page blocks are
replaced by absolutely-positioned clones that tumble with playful gravity
physics. A gravity slider and bounciness slider shape the chaos.

**Honest scope:**
- Visual toy only — nothing about the physics is realistic or useful.
- The real page DOM is **never modified**; only clones in an overlay layer fall.
- One click on "Restore page" removes every trace.
- Runs only on the tab you click, only when you click.
- 100% local, no network, no accounts.

**Files:** `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`,
icons, this README. Permissions: `storage` (settings), `activeTab` + `scripting`
(inject the toy on click only).
