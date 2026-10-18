# OrigamiFold — Page Prank

A harmless, fully reversible prank: on your click, every visible element on the page folds away with a staggered 3D origami (rotateX) collapse. Hit **Unfold everything** (or the floating chip on the page) and the page is restored exactly as it was — every style is applied inline and removed afterward. Nothing is modified, deleted, or sent anywhere. Clearly labeled a joke.

## Install (Chrome / Edge)

1. Unzip `strict-page-element-origami-folder.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`.

## Permissions

- `storage` — reserved for future settings (currently unused; kept minimal).
- `activeTab` — access the current tab **only when you click** Fold/Unfold.
- `scripting` — inject the fold script into the active tab on your click.

No host permissions, no background page, no network calls. The script only runs when you press the button, and it cannot run on `chrome://` pages.

## Publishing notes

- MV3, user-gesture-only injection, fully reversible DOM changes — store-safe.
- The effect is cosmetic and clearly framed as a prank in the popup copy.
