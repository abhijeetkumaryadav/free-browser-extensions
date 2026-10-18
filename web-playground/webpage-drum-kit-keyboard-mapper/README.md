# BeatPad — Keyboard Drum Kit

A pocket drum kit in your browser toolbar. Eight velocity pads mapped to keys **A–K** — kick, snare, hi-hat, three toms, crash, and clap — plus a one-click demo beat.

**Every sound is synthesized live with the Web Audio API.** No audio files, no network calls, nothing leaves your device. Just a fun toy.

## Features
- 8 drum pads (click or press A S D F G H J K)
- Kick, snare, hi-hat, 3 toms, crash, clap — all synthesized (oscillator + filtered noise recipes)
- Volume slider (persisted)
- Demo beat button (120 BPM rock groove) + stop

## Install (Chrome / Edge / Opera)
1. Unzip `webpage-drum-kit-keyboard-mapper.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose `manifest.json` (note: `chrome.storage.local` works via the polyfill-free `chrome` namespace in Firefox).

## Permissions
- `storage` — remembers your volume setting. That's it. No host permissions, no network, no content scripts.

## Publishing notes
- MV3, no remote code, no bundled audio, zero network traffic — should pass store review cleanly.
- Not tested in a live browser beyond syntax/manifest validation; please tap the pads before publishing.
