# SoundBoard — Floating Hotkey Player

A fun soundboard: 8 sounds **synthesized live with the Web Audio API** — zero audio files, zero network requests. Everything runs locally in your browser.

## Sounds (hotkeys 1–8)
Airhorn, Drum Hit, Laser, Pop, Applause, Siren, Whistle, Bell.

## Features
- 8-button grid with keyboard hotkeys while the popup is open
- Volume slider, persisted and shared with the floating player
- **Floating mini player**: drops a small draggable panel onto the current tab so sounds keep playing after the popup closes. Click the button again to remove it.

## Install (Chrome / Edge / Opera)
1. Unzip `soundboard-floating-hotkey-player.zip`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Install (Firefox)
Firefox supports MV3 but `chrome.scripting` page injection from a popup requires the active tab flow; the popup soundboard works, the floating player may need the page focused first. Load via `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Remembers the volume level between sessions |
| `activeTab` + `scripting` | Used **only** when you click "Toggle floating mini player", to place the mini player on the current tab. Never runs without your click. |

## Privacy
- No network calls, no analytics, no data collection
- The only stored value is your volume preference

## Publishing notes
- MV3, no remote code, no deprecated APIs — store-safe
- Screenshots: popup grid, floating mini player on a page
- Category: Entertainment / Fun
