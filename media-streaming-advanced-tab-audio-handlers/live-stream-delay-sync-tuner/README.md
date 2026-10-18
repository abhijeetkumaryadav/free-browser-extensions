# Stream Delay Sync Tuner v1.0.0

Bluetooth-audio-style lip-sync fixer: route the current tab's audio through an adjustable 0–500 ms WebAudio delay so you can compensate for laggy audio.

## What it does

- **Enable sync on this tab** captures the tab's audio (via `chrome.tabCapture` + an offscreen WebAudio engine) and plays it back delayed by your chosen amount.
- Slider (0–500 ms) + presets; delay changes apply **live** without restarting.
- **Bypass** button stops the engine and restores the tab's native audio.
- Your delay setting is persisted on-device.

## Honest scope

- This adds delay to the tab's audio **output** — it cannot change a stream's broadcast delay or make a late video early. If video lags behind audio, no extension can fix that side; this tool covers the common case where audio needs to be held back to match video.
- One tab at a time. The tab shows a muted speaker icon while sync is active (its direct output is muted to prevent echo); the delayed audio plays through the extension.

## Install

**Chrome / Edge**
1. Unzip `live-stream-delay-sync-tuner.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
3. Note: `chrome.tabCapture.getMediaStreamId` + offscreen documents are Chromium-first APIs; Firefox support is best-effort.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Operate on the tab you enable sync for |
| `tabCapture` | Capture the current tab's audio stream (no video) |
| `offscreen` | Host the WebAudio delay graph (service workers have no AudioContext) |
| `storage` | Persist your delay setting on-device |

No network calls. Audio is processed locally and never recorded, stored, or transmitted.

## Publishing notes

- Manifest V3, no deprecated APIs.
- The offscreen document is created on demand with reason `USER_MEDIA` and torn down when you disable sync or close the tab.
- No remote code, no analytics — store-review friendly.
