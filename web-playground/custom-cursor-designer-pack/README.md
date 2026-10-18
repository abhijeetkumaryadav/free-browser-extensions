# CursorCraft — Custom Cursor Designer Pack v1.0.0

Pick a fun custom cursor, preview it, and apply it to the current tab with one click. Your choice is remembered per site. Restoring the default is always one click away.

## Install (load unpacked)

**Chrome / Edge / Opera**
1. Unzip `custom-cursor-designer-pack.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**: the popup UI loads, but `chrome.scripting` page injection is Chromium-only; Firefox is not supported for the apply feature.

## How to use
1. Click the toolbar icon.
2. Pick one of 8 bundled cursor styles (Neon Arrow, Glow Dot, Crosshair, Star, Diamond, Ring, I-Beam, Sparkle).
3. Hover the preview to test it live.
4. Click **Apply to this tab** — the cursor changes on the current tab only, and the choice is saved for that site.
5. Click **Restore default** any time to remove it.

## Permissions (all justified)
- `storage` — remembers your per-site cursor choice on-device.
- `activeTab` — applies the cursor only to the tab you clicked on, only when you click Apply.
- `scripting` — injects a single `<style>` element setting the cursor; removed entirely on Restore.

No network calls. No data leaves your device. All 8 cursors are bundled PNGs generated locally.

## Publishing notes
- MV3, no remote code, no deprecated APIs.
- The 32×32 PNG cursors use default top-left hotspots adjusted per style (dot/ring centered).
- Store reviewers: the extension only modifies pages on explicit user gesture and the effect is fully reversible.
