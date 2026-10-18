# Tab Audio Recorder — Capture This Tab's Audio

Records the **currently active tab's** audio into a downloadable WebM file, with
a live level meter and elapsed timer. Nothing runs until you press **Start
recording** — there is no background listening.

## Honest scope

- Records the current tab's audio — your recordings only.
- The tab must be **playing audio** when you start (the browser only hands out a
  capture stream for audible tabs).
- Recordings are saved only when you download them. Nothing is stored,
  transmitted, or uploaded — local only.
- MediaRecorder writes **audio/webm** (Opus when supported).

## Use

1. Open the tab with the audio you want.
2. Click the extension icon and press **Start recording**.
3. Watch the level meter; press **Stop** when done.
4. Press **Download WebM** to save the recording.

## Files

- `manifest.json` — MV3 manifest (`tabCapture`, `activeTab`, `storage`).
- `background.js` — mints a `chrome.tabCapture` stream id for the active tab.
- `popup.html` / `popup.css` / `popup.js` — popup UI, level meter (Web Audio
  analyser), MediaRecorder pipeline, blob download.
- `icons/` — generated PNG icons (16 / 48 / 128).

## Permissions

- `tabCapture` — capture the active tab's audio (explicitly user-initiated).
- `activeTab` — identify the tab to capture.
- `storage` — reserved for future settings (no data written today).
