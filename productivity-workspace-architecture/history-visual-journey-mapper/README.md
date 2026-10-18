# History Visual Journey Mapper v1.0.0

See today's browsing as a visual vertical timeline, grouped by site: each
domain gets a node with its favicon, visit count, and an estimated time
spent (calculated on-device from gaps between visits, capped at 30 minutes
per gap). Click any visit to reopen it. Stats header shows sites visited,
total visits, and estimated total time. Includes a "Clear today's history"
button.

All history data stays on your device — nothing is uploaded or synced.

## Try it
1. Unzip `history-visual-journey-mapper.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select folder.
3. Click the toolbar icon to see today's journey.

## Permissions
- `history` — reads today's browsing history to build the timeline.
  Core feature; nothing leaves the device.
- `storage` — reserved for future preferences (currently minimal use).

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. The `history` permission is
  sensitive — the listing must clearly explain the on-device-only timeline.
- Edge Add-ons: free. Firefox: `history` permission is supported in MV3.
