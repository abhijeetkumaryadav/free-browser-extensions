# Tab City — Tabs as 3D Skyscrapers

A playful browser extension that renders your current window's open tabs as a
pseudo-3D skyscraper city on a night-sky canvas.

**What it does**
- Queries your open tabs in the current window (`tabs` permission, read-only).
- Draws each tab as a skyscraper: **building height scales with the tab title
  length**, with deterministic lit windows per tab.
- **Hover** a building to see the tab title; **click** a building to switch to
  that tab (and focus the window).
- Refresh button re-renders the city.

**Honest scope:** purely cosmetic visualization. The only thing a click does is
activate the tab you chose. Nothing about tabs is modified, rearranged, or
closed, and nothing is sent anywhere.

**Privacy:** fully local. The `tabs` permission is used only to read the titles
and ids of tabs in the current window for rendering and click-to-focus.

## Development install
1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. **Load unpacked** → select this folder.
