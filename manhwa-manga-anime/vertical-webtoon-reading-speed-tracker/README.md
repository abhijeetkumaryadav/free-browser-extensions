# StripStats — Webtoon Reading Speed Tracker v1.0.0

Track your vertical-scroll reading speed with live panels/min and words/min estimates.

## Features
- **Start/Stop tracking** on any page (user-initiated, per tab)
- **Live HUD**: floating on-page chip showing panels/min, panels read, and elapsed time — toggleable, closable
- **Panels/min**: counts large images scrolled fully past the viewport top (rolling 60-second window)
- **Words/min**: panels/min × your words-per-panel setting (default 25, adjustable)
- **Tunable detection**: panel minimum height setting for different sites
- **Session history**: past sessions with date, site, panels, duration — persisted on-device, clearable
- Non-destructive: the content script only observes scroll and adds one removable HUD element; it never modifies page content

## Honest scope
- "Panels" are heuristically detected as large images — on text-heavy or canvas-based readers the count is an approximation
- Words/min is an estimate (panels/min × words per panel), not a measurement of actual words read
- Tracking runs only while the tab is open; closing the tab ends the session

## Install
1. Unzip `vertical-webtoon-reading-speed-tracker.zip`
2. Open `chrome://extensions` (Edge: `edge://extensions`)
3. Enable **Developer mode**
4. **Load unpacked** → select the unzipped folder

## Permissions
- `storage` — settings + session history on-device
- `activeTab` + `scripting` — inject the tracker into the current tab only when you press Start

## Publishing notes
- MV3, on-demand injection, minimal permissions — safe for all stores
- Firefox: compatible (scripting + activeTab supported)
