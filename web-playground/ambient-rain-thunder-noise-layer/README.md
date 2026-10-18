# RainScape — Ambient Rain & Thunder

A cozy ambient-sound generator. Rain, thunder rumbles and wind are **100%
synthesized in your browser with the Web Audio API** — there are no audio files,
no network requests, and nothing ever leaves your device.

## Features

- **Rain** — looped filtered noise shaped to sound like rainfall
- **Wind** — looped noise through a lowpass filter whose cutoff slowly "breathes"
  (gust cycle ~12 s)
- **Thunder** — distant rumbles: brown-noise bursts with slow attack and long decay,
  scheduled at random intervals; the slider controls frequency (~30 s apart at 1,
  ~5 s apart at 100, off at 0)
- Mix sliders: master, rain, wind, thunder — all live-updating while playing
- Sleep timer: 15 / 30 / 45 / 60 minutes with a live countdown
- Keeps playing with the popup closed via an offscreen document (`AUDIO_PLAYBACK`)
- State (playing, mix, sleep deadline) mirrored to `chrome.storage.local` so the
  popup always shows the truth

## Install

**Chrome / Edge / Opera** (offscreen documents are Chromium-only)
1. Unzip `ambient-rain-thunder-noise-layer.zip`
2. Open `chrome://extensions` (or `edge://extensions`, `opera://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox** — not supported: Firefox has no offscreen-document API, so background
audio cannot survive the popup closing.

## Permissions

| Permission | Why |
|---|---|
| `offscreen` | Runs the audio engine in an offscreen document so ambience continues with the popup closed |
| `storage` | Remembers your mix, playing state, and sleep-timer deadline |

No host permissions. No network calls. No data collection.

## How it works

1. Press **Play ambience** — the popup creates the offscreen document (once) and
   sends your mix + sleep-timer choice to the audio engine.
2. The engine builds an `AudioContext`: two looped noise sources (rain band-shaped
   with highpass+lowpass; wind lowpassed with an LFO on the cutoff) and a
   self-rescheduling thunder timer that synthesizes each rumble on the fly.
3. Moving sliders sends `rs-update`; everything crossfades with `setTargetAtTime`
   (no clicks/pops). The sleep timer is a plain `setTimeout` in the offscreen
   document that calls `stop()`.
4. Press **Stop** (or let the timer expire) — the context is closed and the
   offscreen document goes silent.

## Limitations

- Autoplay policies: starting playback requires your click (the Play button) —
  this is a feature, not a bug.
- Thunder timing is randomized by design; intervals are approximate.
- Very low thunder values may still surprise you. That's the point.

## Publishing notes

- MV3, `offscreen` + `storage` only, no remote code, no deprecated APIs.
- The store justification for the offscreen document is in the code
  (`justification: 'Play synthesized ambient rain/thunder/wind audio...'`).
- Screenshots: popup mid-play with the glowing status dot and a countdown visible.
