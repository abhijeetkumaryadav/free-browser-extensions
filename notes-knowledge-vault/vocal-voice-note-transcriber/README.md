# VocalNote — Voice Note Transcriber

Record voice notes with your microphone and get live transcripts. Recordings keep going even if you close the popup.

## Features
- **Record / Stop / Discard** — mic is accessed only when you press Record (browser permission prompt).
- Recording runs in an offscreen document, so it **survives the popup closing**; a red `REC` badge shows on the toolbar icon.
- **Live transcription** (toggleable) via the browser's built-in Web Speech API.
- Notes list with playback, duration, editable transcripts, search, delete, clear-all.
- Export any note as `.txt` (title + date + transcript) or download the raw `.webm` audio.
- Audio stored as blobs in IndexedDB — **recordings never leave your device.**

## Honest scope
- **Live transcription works in Chrome/Edge** (Chromium's Web Speech API). It needs network access because Chrome's speech service processes audio online. Turn the toggle off to record offline-only.
- In Firefox, recording works but live transcription is unavailable (no Web Speech recognition API) — transcripts can be typed in manually.
- The mic cannot be accessed without your explicit permission each session (browser security).

## Permissions
| Permission | Why |
|---|---|
| `storage` | Persist the transcription on/off preference. |
| `offscreen` | Run the recorder in an offscreen document (`USER_MEDIA`) so recording continues after the popup closes. |

Microphone access itself is granted by you via the browser prompt, not by a manifest permission.

## Install (development)
**Chrome / Edge:** `chrome://extensions` → Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json` (offscreen documents are Chromium-only; recording falls back to in-popup).
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Publishing notes
- Manifest V3, no remote code, no analytics, no servers.
- Privacy policy must disclose: microphone use, on-device audio storage, and that live transcription in Chrome may send audio to the browser vendor's speech service.
