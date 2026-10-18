# FocusSync — Cross-Tab Focus Mode v1.0.0

One toggle pauses playing media across all your tabs. Turn it off and
FocusSync resumes exactly the media *it* paused — anything you paused yourself
stays paused. Fully cooperative and reversible; nothing leaves your device.

## How it works

- A lightweight content script runs on regular web pages (`http://`/`https://`).
- The popup writes a single shared flag to `chrome.storage.local`; every tab's
  content script reacts to it.
- While focus is on, the script pauses any playing `<video>`/`<audio>` and
  catches newly started media (autoplay, SPA navigation) via `play` events
  and a `MutationObserver`.
- Only media paused by FocusSync is resumed when you toggle focus off.
- Per-tab pause reports live in `chrome.storage.session` (per browser session
  only) so the popup can show "tabs affected / media paused" without any
  `tabs` permission.

## Install

- **Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
  enable Developer mode → **Load unpacked** → select the unzipped folder.
- **Firefox:** open `about:debugging#/runtime/this-firefox` → **Load Temporary
  Add-on** → choose any file in the folder. (Content-script behavior is the
  same; MV3 is supported in Firefox 109+.)
- **Opera:** unzip → `opera://extensions` → Developer mode → **Load unpacked**.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Shared focus flag (`local`) + per-tab pause reports (`session`, expires with the browser session) |
| Content script on `http://*/*`, `https://*/*` | Required to reach and pause media in your other tabs — the core feature. No page content is read, stored, or transmitted. |

No network access. No analytics. No remote code.

## Publishing notes

- Chrome Web Store: single-purpose description ("pauses media across tabs for
  focus"), no remote code, minimal permissions — standard review path.
- Firefox Add-ons: MV3 compatible; the `chrome.storage.session` API is
  supported (falls back gracefully if unavailable).
- The icon set (16/48/128 PNG) is included.
