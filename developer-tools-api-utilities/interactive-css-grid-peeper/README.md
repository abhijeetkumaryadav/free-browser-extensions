# Interactive CSS Grid Peeper v1.0.0

Scan any page for CSS grid containers. The popup lists each one with
its selector, column/row track counts, gap, and item count — click a
row to flash-highlight that container on the page. **Show grid lines**
draws a numbered, non-destructive overlay on every grid container
(line numbers for both axes), which re-positions on scroll/resize.

## Try it
1. Unzip `interactive-css-grid-peeper.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any site with CSS grids (e.g. a news homepage) → Scan page → Show grid lines.

## Publishing notes
- Permissions: `activeTab` + `scripting` (only injects into the tab you
  click on). No storage, no network, nothing uploaded. Overlay is
  pointer-events-none and fully removed on toggle-off.
- Chrome Web Store: $5 one-time dev fee. Edge/Firefox: free accounts.
