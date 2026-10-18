# SparkleTrail — Cursor Particle Trail

A fun overlay extension. While enabled on a tab, a colorful particle trail
follows your cursor across any page — rendered in a shadow-DOM canvas overlay
so page styles are never affected. Toggle it off and the page is instantly
untouched.

## Features

- Per-tab toggle (each tab opts in individually)
- 4 color themes: Rainbow, Ocean, Fire, Gold
- Particle size slider (2–14px) and density slider (1–10 per move event)
- Performance-friendly: single `requestAnimationFrame` loop, particles capped
  at 300, drag + decay physics, passive event listeners
- Clean teardown: disabling removes the overlay, cancels the animation frame,
  and detaches all listeners

## Install

1. Unzip `mouse-cursor-trail-particles.zip` anywhere.
2. Open `chrome://extensions` (Chrome), `edge://extensions` (Edge), or
   `about:addons` → ⚙ → "Install Add-on From File" (Firefox).
3. Enable **Developer mode** (Chrome/Edge), click **Load unpacked**, and pick the
   unzipped folder.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remembers your theme/size/density settings |
| `activeTab` | Runs only on the tab you enable it on, and only on your click |
| `scripting` | Injects the trail overlay into the current page on your explicit gesture |

No network calls. No data collection. The overlay is `pointer-events: none`
and never intercepts clicks.

## Publishing notes

- Chrome Web Store: fine under "fun/entertainment".
- Firefox (AMO): same; no remote code, self-contained, no eval.
- Cannot run on `chrome://` pages or the Web Store — a browser limitation,
  handled gracefully (toggle simply has no effect there).
