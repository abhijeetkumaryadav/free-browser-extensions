# Tab Audio Equalizer

A 5-band graphic equalizer that tunes the audio of the current browser tab using the Web Audio API — no external software needed.

## What it does

- **5 EQ bands** — 60 Hz, 230 Hz, 910 Hz, 3.6 kHz, 14 kHz, each adjustable from −12 dB to +12 dB
- **Presets** — Flat, Bass boost, Vocal clarity, Treble cut
- **Master toggle** — bypass EQ instantly (audio routes straight to output)
- **Per-site memory** — your settings are remembered for each website you visit
- **Auto-hooks** — new audio/video elements added by the page (playlists, ads with sound) are picked up automatically

## Honest scope

- Works only on audio that passes through the page's `<audio>`/`<video>` elements. **Some DRM or protected streams won't be affected** — that is a platform limit, not a bug.
- EQ is cosmetic audio tuning; it cannot fix corrupted or extremely low-quality sources.
- 100% local. Nothing is recorded, stored, or sent anywhere. Per-site EQ settings stay in `chrome.storage.local`.

## Permissions

- `storage` — remember per-site EQ settings
- `activeTab` — apply EQ to the current tab only
- `scripting` — inject the EQ content script on click

## Files

`manifest.json` (MV3) · `popup.html/css/js` · `content.js` (Web Audio graph, message handler, MutationObserver) · `README.md` · `icons/`
