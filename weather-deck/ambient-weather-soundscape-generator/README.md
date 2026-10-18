# Ambience — Weather Soundscape Generator

A relaxation tool with **four 100% locally synthesized weather ambiences** — no audio files, no network, no streaming:

- **Rain** — filtered white noise + faint high-frequency hiss
- **Thunder** — deep brown-noise rumble with random distant swells every 5–14 s
- **Wind** — slowed noise through a bandpass filter, with slow LFO gusts on loudness and tone
- **Fireplace** — warm low bed + randomly scheduled crackle pops (short filtered noise bursts with fast decay)

Each sound has its own **play/pause toggle and volume slider** — mix any combination. Volumes persist in `chrome.storage.local`.

## How playback works

- **Chrome / Edge / Opera:** audio runs in an MV3 **offscreen document** (`AUDIO_PLAYBACK` reason), so your mix keeps playing after the popup closes. Use the ⏹ button to stop everything.
- **Firefox:** the offscreen API doesn't exist there, so the synth engine runs inside the popup — sound plays while the popup is open. (Noted in the popup itself.)

Everything is generated with the Web Audio API at runtime. There is literally no audio data in this extension.

## Install

**Chrome / Edge / Opera**
1. Download/unzip this folder.
2. Go to `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select this folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`. (Popup-local playback as described above.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember each sound's volume slider between sessions. |
| `offscreen` | Keep audio playing after the popup closes (Chromium only). |

No host permissions. No network calls of any kind.

## Publishing notes

- No remote code, no remote assets, no analytics — fully self-contained.
- The offscreen document justification ("play user-selected ambient sounds") is declared in code for reviewer clarity.
- Honest scope: synthesized approximations for relaxation, not recordings.
