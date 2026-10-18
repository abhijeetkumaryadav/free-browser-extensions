# WobblePage — Shaky Element Glitcher

A harmless prank extension. Toggle it on and the current page's elements start
shaking and wobbling with a pure-CSS animation. Turn it off (or hit "Restore page
now") and the page goes back to normal instantly — nothing is ever permanently
modified.

## Features

- One-click wobble toggle for the current tab
- Intensity slider (1 = gentle tremor, 10 = full chaos)
- Target selector: Everything / Images / Text / Buttons
- Restore button that instantly removes all effects
- Settings persist per browser (not per page — you re-trigger per tab, it's a prank)

## Install

1. Unzip `css-shaky-element-glitcher.zip` anywhere.
2. Open `chrome://extensions` (Chrome), `edge://extensions` (Edge), or
   `about:addons` → ⚙ → "Install Add-on From File" (Firefox).
3. Enable **Developer mode** (Chrome/Edge), click **Load unpacked**, and pick the
   unzipped folder.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remembers your intensity/target settings |
| `activeTab` | Runs only on the tab you click it on, and only when you toggle |
| `scripting` | Injects the wobble CSS into the current page on your explicit gesture |

No network calls. No data collection. The wobble is injected CSS only — the
page's DOM and content are never altered.

## Publishing notes

- Chrome Web Store: fine under "entertainment"; the listing should say it's a
  joke and reversible.
- Firefox (AMO): same; no remote code, self-contained.
- Clearly label it a prank in the store description so users aren't surprised.
