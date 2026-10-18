# Tab Recorder — Internal Audio

Record the **current tab** as a WebM video, with the tab's internal audio,
straight from the extension popup. Everything is local: no servers, no
uploads, no accounts.

## Honest scope

- Records the **currently-active tab only** — not your whole screen, not
  other tabs.
- Nothing records until you click **Start recording**. The browser shows its
  own allow/deny capture prompt in the tab; a denial is reported, never
  silent.
- **Tab audio only.** Whether system sounds or microphone audio are captured
  depends on your browser and OS — the extension cannot force it.
- Output is WebM (VP9/VP8 + Opus where supported). Quality/format depend on
  your browser's MediaRecorder codecs.
- If you switch tabs mid-recording, the captured tab keeps recording.

## Usage

1. Open the tab you want to record.
2. Click the extension icon → **Start recording** (the popup closes so you
   can use the tab).
3. Toggle *Include tab audio* before starting if you want a silent capture.
4. When done, reopen the popup → **Stop**. The WebM downloads automatically
   and a summary (file, length, size) appears in the popup.

## How it works

- `popup.js` talks to the `background.js` service worker.
- The worker creates an **offscreen document** (`offscreen.html` /
  `offscreen.js`), which is the MV3-safe home for the live
  `chrome.tabCapture` MediaStream + MediaRecorder (a service worker cannot
  hold a stream, and the popup may close).
- On stop, the offscreen doc sends raw bytes to the worker, which saves the
  file with `chrome.downloads` and records a small metadata summary in
  `chrome.storage.local`.

## Permissions

| Permission   | Why                                              |
|--------------|--------------------------------------------------|
| `tabCapture` | Capture the active tab's video/audio on your click |
| `downloads`  | Save the finished WebM to your downloads          |
| `storage`    | Remember the last-recording summary               |

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup UI
- `background.js` — service worker: state, offscreen lifecycle, saving
- `offscreen.html` / `offscreen.js` — stream + MediaRecorder owner
- `icons/` — generated 16/48/128 PNG icons
- `README.md` — this file

## Compatibility

Chrome and Edge (MV3 + `chrome.offscreen` + `chrome.tabCapture`).
Not tested in a live browser — manifest, syntax, and packaging validated.
