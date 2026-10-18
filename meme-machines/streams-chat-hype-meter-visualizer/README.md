# HypeMeter — Stream Hype Visualizer

Manually log hype moments while watching a stream. Tap the big **LOG HYPE!** button (or press `Ctrl+Shift+H` anywhere) whenever the moment hits — the gauge shows your live hype level, the sparkline charts the last 2 minutes, and the session log keeps every timestamp. Export it all as JSON.

> **Honest scope:** this extension is **not** connected to any stream chat or API. There is no live chat analysis and no network calls. You log the hype yourself — it's a fun manual tracker.

## Install (Chrome / Edge / Opera)

1. Unzip `streams-chat-hype-meter-visualizer.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

The `commands` API works in Firefox; the hotkey can be remapped under `about:addons` → gear icon → Manage Extension Shortcuts. The toolbar badge is supported.

## Usage

1. Click the HypeMeter toolbar icon.
2. (Optional) **Start session** to time your hype session.
3. Smash **LOG HYPE!** — or use `Ctrl+Shift+H` without opening the popup — during big moments.
4. Watch the gauge decay realistically between moments; each tap adds 25 points with a ~20s half-feel.
5. **Export JSON** downloads your session (timestamps, peak, count). **Clear** wipes the log.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Stores your hype timestamps, session, and peak on-device. |

No host permissions, no network access. The hotkey is declared via the `commands` manifest key (no permission needed).

## Publishing notes

- Manifest V3, no remote code, no data collection → straightforward Chrome Web Store / Edge Add-ons review.
- The honest "manual logging, not live chat analysis" labeling avoids misleading claims.
- Privacy policy can state: "No data is collected, stored remotely, or transmitted."

## Files

- `manifest.json` — MV3 manifest (action popup + background service worker + command)
- `popup.html` / `popup.css` / `popup.js` — 380px popup: gauge, sparkline, log, export
- `background.js` — hotkey handler + toolbar badge level
- `icons/` — generated PNG icons (16/48/128)
