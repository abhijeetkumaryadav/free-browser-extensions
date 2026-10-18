# Tab Audio Muter v1.0.0

See which tabs are making sound and control them in one click.

## Features
- Live list of all tabs currently playing audio, with favicons and titles
- One-click mute/unmute per tab
- **Mute all sounding** and **Mute all except this tab** bulk actions
- Optional **auto-mute background tabs** rule: new background tabs that start playing sound are silenced automatically (the active tab is never touched)

## Install (Chrome / Edge)
1. Unzip `unlocked-tab-audio-muter.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

## Install (Firefox)
1. Unzip the package
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and choose `manifest.json`
   (temporary add-ons unload on browser restart)

## Permissions
| Permission | Why it's needed |
|---|---|
| `tabs` | List open tabs and read their `audible` / `mutedInfo` state; mute or unmute via `chrome.tabs.update` |
| `storage` | Persist the auto-mute preference only |

No host permissions, no network access, no analytics. Everything runs on-device.

## Publishing notes
- Manifest V3, no deprecated APIs
- Minimal, justified permissions — store-review friendly
- Icons: generated 16/48/128 PNGs included
