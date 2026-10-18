# HeliumVoice — Pitch-Shifting Voice Recorder v1.0.0

A fun toy: record your voice with the mic, then play it back pitch-shifted —
helium-high, squeaky, or deep and slow. Recordings are stored on-device in
IndexedDB; nothing is ever uploaded.

## Features
- Record / Stop via an offscreen document (`USER_MEDIA` reason), so recording
  survives the popup closing; red `REC` toolbar badge while recording
- Pitch slider (0.50×–2.00×) + presets: Deep 🐘, Normal 🙂, Helium 🎈, Squeak 🐭
- Recordings list: play at the current pitch, download as `.webm`, delete
- Mic is only touched after your explicit click — never auto-records

## Honest scope
- Pitch is shifted with the Web Audio **`playbackRate`** trick: pitch and tempo
  change together — exactly like real helium speech. This is **not** a
  formant-preserving pitch shifter, and it does **not** process arbitrary media
  or system audio — only recordings you make inside this extension.
- Chrome/Edge only for the offscreen `USER_MEDIA` path.

## Install
- **Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
  enable **Developer mode** → **Load unpacked** → select this folder.
- On first record, allow microphone access when the browser prompts.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Remember your pitch setting |
| `offscreen` | Create the `USER_MEDIA` offscreen document that hosts recording |

(Microphone access itself is granted per-prompt by the browser; it is not a
manifest permission.)

## Publishing notes
- Manifest V3, no remote code, no analytics, no network calls at all.
- Store listing should describe it as a fun voice toy, not a voice changer for
  calls (it cannot affect other apps' audio).
