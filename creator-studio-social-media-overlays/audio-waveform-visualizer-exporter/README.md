# Waveform Visualizer & Exporter — v1.0.0

Drop in an audio file to see a beautiful zoomable waveform, play it with a live
playhead, and export the waveform as a PNG image.

## Features
- **Drag & drop / browse** for any audio file (MP3, WAV, OGG, M4A…)
- **Zoomable waveform** — slider (1×–40×), mouse-wheel zoom, drag to scroll
- **Playback** with a live white playhead and played-region dimming
- **Click to seek** anywhere on the waveform
- **PNG export** — custom wave color, background color (or transparent),
  custom dimensions (320–4000 px wide)
- 100% client-side — the file never leaves your device

## Install
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** and select the folder.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`.

## Permissions
**None.** The extension requests zero permissions. Audio is decoded with the
WebAudio API and the PNG is exported via an in-page download link.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration, MV3, privacy tab can
  state "no data collected".
- Edge Add-ons: free account, same package works.
- Firefox: free account, requires AMO signing; the EyeDropper-free code path is
  fully cross-browser (no `EyeDropper` used here).

## Notes
- Decoding happens in the popup; very long files may take a few seconds.
- Popup closes stop playback state visuals — reopening keeps the loaded file
  only for the session (nothing is persisted).
