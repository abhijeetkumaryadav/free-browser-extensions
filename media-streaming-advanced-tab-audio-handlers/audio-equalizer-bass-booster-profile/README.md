# BassLab — Tab Audio Equalizer

Route the current tab's audio through a 5-band WebAudio equalizer with
presets (Bass Boost, Vocal, Treble, Flat), per-band ±12 dB sliders, and a
one-click bypass.

## How it works

1. Click **Enable EQ on this tab** in the popup (this click is the user
   gesture Chrome requires for `tabCapture`).
2. Chrome shows its tab-audio capture prompt — accept it.
3. The tab's audio is routed: `tabCapture stream → 5 biquad filters → speakers`.
4. Adjust bands/presets live. **Disable** tears the graph down and restores the
   tab's original audio path.

The audio graph lives in an **offscreen document** (`AUDIO_PLAYBACK` reason),
which is the MV3-approved way to process captured audio. The stream is
processed live — nothing is recorded, stored, or uploaded.

## EQ bands

| Band | Type | Frequency |
|---|---|---|
| 60 Hz | lowshelf | sub-bass |
| 230 Hz | peaking | low-mids |
| 910 Hz | peaking | presence |
| 3.6 kHz | peaking | brilliance |
| 14 kHz | highshelf | air |

## Install (developer mode)

**Chrome / Edge**
1. Unzip `audio-equalizer-bass-booster-profile.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox / Opera** — `tabCapture` EQ routing is Chromium-only; the popup
explains this on unsupported browsers.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `tabCapture` | Capture the current tab's audio stream — only after you click Enable |
| `offscreen` | Host the WebAudio graph (MV3 requirement for audio processing) |
| `activeTab` | Identify the tab to capture when you click Enable |
| `storage` | Remember your band gains, preset, and bypass state on-device |

No host permissions, no network calls. All processing is on-device.

## Honest limitations

- **One tab at a time** — enabling on a second tab replaces the first.
- **DRM-protected audio** (e.g. some Netflix/Spotify web players) may refuse
  capture or produce silence — a platform restriction.
- **Silent tabs** capture silence; play something first for best results.
- The extension cannot change the tab's volume beyond the EQ curve — use the
  site/player volume for loudness.
- Firefox does not expose `chrome.tabCapture` to extensions, so this is
  Chromium-only (Chrome/Edge/Opera/Brave).

## Publishing notes

- Manifest V3, no deprecated APIs, no remote code.
- `tabCapture` triggers an install-time permission warning — disclose in the
  store listing that capture starts only on explicit user click, per tab.
- Store category: "Accessibility" or "Utilities".
