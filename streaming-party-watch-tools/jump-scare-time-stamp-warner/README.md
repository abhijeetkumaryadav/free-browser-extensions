# ScareWarn — Jump Scare Timestamp Warner

Add your own jump-scare timestamps (mm:ss or hh:mm:ss) per title, then press
**Start watching**: while a video plays, a warning banner appears 5 seconds
before each timestamp, with your note. Honest scope: **there is no scare
database** — every timestamp is entered by you and stored on-device.

## Features

- **Per-title timestamp lists** — add/delete titles, each with its own stamps
- **5-second advance banner** — fixed overlay with your note, auto-hides,
  dismissible; re-arms if you seek back
- **Live while playing** — only polls while the video is actually playing
- **One-click stop** — banner and polling removed completely

## Install

**Chrome / Edge**
1. Unzip the release archive.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Note: `chrome.scripting` APIs used here are Chromium-first; Firefox support
   is best-effort.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your titles and timestamps on-device |
| `activeTab` | Watch the video on the tab you are viewing, only when you press Start |
| `scripting` | Inject the timestamp watcher into the active tab on demand |

No network requests. No data leaves your device. Cannot run on `chrome://`,
`edge://`, or Web Store pages (browser restriction).

## Notes & honest scope

- Timestamps are **yours**: no database, no auto-detection, no sharing.
- Targets the largest visible `<video>` on the page.
- Watching stops if the tab is closed or you press Stop.

## Publishing notes

- Manifest V3, no remote code, minimal permissions — store-friendly.
- Listing assets needed: 128px icon (included), screenshots, short + full
  description, privacy disclosure ("no data collected").
