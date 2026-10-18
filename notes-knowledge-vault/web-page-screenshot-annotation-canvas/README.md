# SnapMark — Screenshot Annotation Canvas v1.0.0

Capture the visible tab, annotate the screenshot, download it as PNG. Click **Capture visible tab** in the popup — the full-page annotation editor opens in a new tab with your screenshot loaded.

## Annotation tools

| Tool | What it does |
|---|---|
| **Pen** | Freehand drawing (`V`/`P`) |
| **Arrow** | Line with arrowhead, drag to aim (`A`) |
| **Rectangle** | Drag to draw a box (`R`) |
| **Text** | Click to place a label — type, Enter to commit (`T`) |
| **Blur** | Drag a region to pixelate it — great for redacting (`B`) |
| **Crop** | Drag a region to crop the canvas to it (`C`) |

Extras: 6 color swatches, line-width slider (also scales text size), undo (`Ctrl/Cmd+Z`, 40-step history), clear-all (restores the pristine screenshot), and one-click **Download PNG**.

## How it works

1. Popup click grants `activeTab`, so `chrome.tabs.captureVisibleTab()` captures the tab you're viewing.
2. The PNG data URL is passed to the editor via `chrome.storage.session` and removed immediately after loading — screenshots never persist in extension storage.
3. All annotation math runs on-device on a `<canvas>`; shapes preview live while dragging; the download is a blob URL — no `downloads` permission needed.

## Install

**Chrome / Edge**
1. Unzip `web-page-screenshot-annotation-canvas.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox** (source install)
1. Unzip the package.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
   - Note: `chrome.storage.session` needs Firefox 139+; on older versions the handoff between popup and editor would need a fallback.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Lets `captureVisibleTab()` capture the tab you explicitly clicked the popup on. No broad host access. |
| `storage` | Only `chrome.storage.session` — a transient handoff of the screenshot data URL between popup and editor; cleared immediately and never persisted to disk by the extension. |

## Notes & limits

- Capture is user-initiated only (one click per screenshot).
- Cannot capture `chrome://`, `edge://`, or Web Store pages (browser restriction) — the popup shows a friendly error.
- Text labels get a subtle dark outline so they stay readable on any background.
- Cropping resets the undo history (dimensions change).
- Not tested in a live browser beyond packaging; validation covered manifest parsing, JS syntax, icon generation and ZIP structure.

## Publishing notes

- MV3 only, no deprecated APIs, no remote code, no network calls.
- The capture flow is fully user-initiated, which matches store expectations for `activeTab`-based screenshot tools.
- Listing assets needed: 128px icon (included), screenshots of the editor, short + full description.
