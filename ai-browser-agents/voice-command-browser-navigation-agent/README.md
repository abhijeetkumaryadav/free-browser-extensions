# VoiceNav — Voice Browser Navigation

Control your browser by voice. Press and hold the button, say a command, release — the action runs. Commands: **new tab, close tab, go back, go forward, reload, scroll down, scroll up, zoom in, zoom out, open history, open bookmarks, open downloads**.

## Privacy
- The mic activates **only while the button is held** — nothing is recorded otherwise.
- Speech recognition uses the browser's built-in Web Speech API (Chrome/Edge only, needs network for Google's speech service). Commands are executed locally; no data is sent anywhere by this extension itself.

## Install
- Chrome / Edge: unzip, open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, select this folder.
- Firefox: this extension uses Chrome-only speech recognition; it will load but voice input is unavailable.
- Opera: Chromium-based; works with Chrome's speech service.

## Permissions
- `tabs` — read active tab, create/close/go back/forward/reload, adjust zoom.
- `storage` — reserved for future settings; not used in v1.0.0.
- `http(s)` host access — needed to inject the smooth-scroll script into normal web pages only (restricted pages are skipped gracefully).

## Publishing notes
- MV3, no remote code. Microphone use is explicit (press-and-hold) with a clear listening indicator — required for store policy compliance.
