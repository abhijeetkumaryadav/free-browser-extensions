# Page Gravity Sandbox

Turn any web page into a physics playground. One click and the page's elements
detach, fall, bounce off the bottom of the viewport and pile up — a tiny local
physics engine running entirely in the page. **Fully reversible:** every
element's original style is saved and restored, so nothing is ever destroyed.

## How to use

1. Load the extension (chrome://extensions → Developer mode → Load unpacked).
2. Open any web page and click the extension icon.
3. Tune **Gravity strength**, then hit **Start gravity**.
4. Hit **Restore page** any time to put everything back exactly as it was.

## Honest scope

- This is a **toy**. Bodies bounce off the viewport floor and walls; there is no
  inter-body collision or stacking simulation — elements overlap as they settle.
- Elements are pinned with `position: fixed` at their current spot and animated
  with CSS transforms; the DOM itself is never modified or destroyed.
- Runs only when you click Start (injected via `chrome.scripting`); nothing runs
  in the background.

## Permissions

- `activeTab` + `scripting` — inject the physics script into the current tab on demand.
- `storage` — remember your gravity slider setting.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
- `content.js` — physics engine + element pin/restore logic
- `icons/` — generated PNG icons (16/48/128)
