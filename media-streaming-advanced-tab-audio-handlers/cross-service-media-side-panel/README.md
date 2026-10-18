# Stagehand — Cross-Service Media Side Panel v1.0.0

One side panel to rule your media: every tab currently playing audio appears with
its title and favicon, and you can play/pause, mute/unmute, seek ±10s, or jump
straight to that tab — without hunting through windows.

## What it does
- **Side panel** lists all tabs currently producing sound (auto-refreshes).
- Per-tab controls: **play/pause**, **mute/unmute**, **−10s / +10s seek**, **jump to tab**.
- Playback position shown when the page exposes it.
- Clicking the toolbar icon opens the side panel directly (Chromium).

Controls only ever run on tabs you explicitly tap. Page probing is read-only
unless you press a control.

## Install (Chrome / Edge 114+)
1. Unzip `cross-service-media-side-panel.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Click the toolbar icon — the side panel opens.

## Install (Firefox)
Firefox MV3 does not yet support the `sidePanel` API; the popup explains this.
Core tab-query logic targets Chromium-based browsers.

## Permissions — why each is needed
| Permission | Justification |
|---|---|
| `tabs` | Read titles/favicons/mute state of audible tabs; activate a tab on "jump". |
| `storage` | Reserved for future preferences (currently unused). |
| `scripting` | Inject the tiny play/pause/seek probe into a tab only when you press a control. |
| `sidePanel` | Renders the media controller side panel. |
| `http://*/*`, `https://*/*` (host) | Required so `scripting` can reach the media element in any background tab you control. Never used for reading page content or exfiltration. |

No network requests. No data leaves the device.

## Publishing notes
- Manifest V3, no remote code, no analytics.
- Privacy disclosure: "No data collected — tab info is read locally and never transmitted."
- Screenshots: side panel with 2–3 media tabs, controls row, empty state.
