# BoostLab — Tab Volume Booster & Compressor

Boost any tab's volume up to 300% with a built-in mastering-style compressor to
tame peaks. One click per tab; one-click disable restores the tab's original
audio path.

## Install

**Chrome / Edge (Chromium)**
1. Unzip `stream-volume-boost-compressor.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox / Opera:** not supported — `chrome.tabCapture` is a Chromium-only API.
The extension will install but the Enable button will report that capture is
unavailable.

## How to use

1. Open a tab playing audio/video and click the BoostLab toolbar icon.
2. Click **Enable on this tab**. The tab is muted natively so the processed
   stream does not double up with the original; the capture stream keeps flowing.
3. Drag the **Boost** slider (100–300%) or pick a preset. Above ~150% a
   clipping warning appears — the compressor tames peaks, but extreme boosts
   can still distort.
4. **Bypass processing** passes the tab audio through untouched (useful for
   A/B comparison).
5. **Disable** tears everything down, unmutes the tab, and closes the audio
   engine. If the tab is closed, BoostLab cleans up automatically.

## Permissions — why each is needed

| Permission | Why |
|---|---|
| `tabCapture` | Capture the current tab's audio stream (core feature; user-initiated per tab). |
| `offscreen` | Host the WebAudio graph (`AudioContext` cannot run in a service worker). |
| `storage` | Persist boost level, bypass state, and enabled-tab bookkeeping. |
| `activeTab` | Identify the tab the user clicked Enable on. |
| `tabs` | Mute/unmute the tab while boosted (avoids doubled audio) and detect tab close for cleanup. |

No host permissions. No network calls. Audio is processed live in memory —
never recorded, stored, or transmitted.

## Honest scope & limits

- One tab at a time; enabling on a second tab moves the boost there.
- Chromium only (`tabCapture` does not exist in Firefox).
- Cannot run on `chrome://`, Web Store, or other restricted pages.
- DRM-protected players may refuse capture (browser-enforced).
- Slight processing latency (~tens of ms) is inherent to the WebAudio round-trip.

## Publishing notes

- Chrome Web Store: single-purpose, minimal justified permissions. Declare in
  the privacy tab that audio is processed on-device and never collected.
- No remote code, no analytics, no external requests — review-friendly.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI + controller
- `background.js` — service worker: command routing, tab mute, cleanup
- `offscreen.html` / `offscreen.js` — offscreen audio engine (Gain + Compressor)
- `icons/` — generated PNG icons (16/48/128)
