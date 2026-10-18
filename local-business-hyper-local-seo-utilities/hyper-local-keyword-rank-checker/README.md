# Hyper-Local Keyword Rank Tracker v1.0.0

Manually log keyword rankings per location over time: trend charts (lower is
better), movement badges (▲/▼ vs previous check), best/latest stats, and CSV
export. 100% on-device.

**Important honesty note:** this extension NEVER scrapes Google or any search
engine — automated rank scraping violates search engines' terms and gets IPs
blocked. You check rankings yourself (logged out, in your target location)
and log the positions here; the extension turns your logs into trends.

## Install (unpacked, development)

**Chrome / Edge**
1. Unzip `hyper-local-keyword-rank-checker.zip` (keep the folder).
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** → select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
3. Note: temporary add-ons unload when Firefox closes.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Store your keywords and logged positions on-device |

No host permissions, no network calls. CSV export downloads via a blob URL —
no `downloads` permission needed.

## Features

- Track keyword + location pairs (e.g. "emergency plumber" / "Austin, TX")
- Log position entries: date, position, ranking URL, notes
- Per-keyword trend chart with inverted axis (position #1 at top)
- Movement badges vs previous check, best-position stat
- Two-step confirm on keyword delete; per-entry delete
- One-click CSV export of all data

## Publishing notes

- MV3 only, no deprecated APIs.
- Privacy: no data collection; the store privacy disclosure can state that no
  user data is collected or transmitted.
- Suggested store category: Productivity.
