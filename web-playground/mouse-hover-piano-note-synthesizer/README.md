# HoverPiano — Mouse Hover Note Synthesizer

Turn any web page into a playful instrument. While enabled on a tab, hovering over
elements plays piano-ish notes synthesized live with the Web Audio API. Pitch is
mapped to the element's vertical position — the top of the page plays high notes.

**This is a toy. It is clearly labeled "just for fun" in the UI.**

## Features

- Per-tab enable/disable toggle (state persists per tab)
- Volume slider (live)
- Three note scales: Pentatonic, Major, Chromatic
- Throttled note triggering (~80 ms) so fast mouse movement stays musical
- Subtle violet outline flash on the element that "sang" (non-destructive, removed after 140 ms)
- Piano-ish voice: triangle + octave sine through a lowpass filter with a pluck-like envelope

## Install

**Chrome / Edge / Opera**
1. Unzip `mouse-hover-piano-note-synthesizer.zip`
2. Open `chrome://extensions` (or `edge://extensions`, `opera://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox** — this build targets Chromium MV3. Porting needs `browser.scripting`
equivalents and the offscreen model is N/A (this extension has no offscreen page).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers volume, scale, and which tabs have HoverPiano enabled |
| `activeTab` | Lets the popup inject the hover synth into the tab you clicked the icon on |
| `scripting` | Injects `hover.js` on demand (only when you press the toggle — never automatically) |

No host permissions. No network calls. No data collection of any kind.
All audio is synthesized locally with the Web Audio API — no audio files, no downloads.

## How it works

1. Click the toolbar icon on any normal web page and flip the toggle.
2. `hover.js` is injected once into the tab (idempotent) and armed via message.
3. `mouseover` events (throttled) map the element's vertical center to a note in the
   selected scale; a short synth voice plays it.
4. Disabling sends `hp-disable`; the listener goes quiet. No page content is ever modified
   (the outline flash is inline-style only and always restored).

## Limitations

- Cannot run on restricted pages (`chrome://`, `edge://`, Chrome Web Store, `about:`).
- AudioContext requires a user gesture in some cases — the toggle click counts.
- Sound plays from the tab; muting the tab mutes HoverPiano.

## Publishing notes

- MV3, no remote code, no deprecated APIs.
- Store listing should keep the "just for fun / novelty toy" framing.
- Screenshots: popup with the toggle on; a page with the violet outline flash visible.
