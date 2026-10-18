# ClipVault — Clipboard History Manager

Save clipboard snapshots **only when you ask**, then search, pin, and re-copy them.

## Features
- **Capture clipboard** — reads the clipboard only when you click the button (explicit user gesture).
- History with live search, per-entry timestamps, pin/unpin, delete.
- Click any entry to copy it back to the clipboard.
- **Auto-expire** — entries older than 1 / 7 / 30 days are removed automatically (pinned entries are immune).
- Clear-all with confirmation; hard cap of 200 entries and 20k chars per entry.

## Privacy
- Everything is stored in `chrome.storage.local` — **nothing leaves your device, ever.**
- No background clipboard monitoring: the extension cannot see your clipboard unless you press Capture.
- Data is stored unencrypted in the browser profile (same as any extension storage). Do not store passwords or secrets you wouldn't keep in plain text.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Persist entries, pins, and the expiry setting locally. |
| `clipboardRead` | Read the clipboard when you click "Capture clipboard" (user gesture only). |
| `clipboardWrite` | Copy an entry back to the clipboard when you click it. |

## Install (development)
**Chrome / Edge:** `chrome://extensions` → Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Publishing notes
- Manifest V3, no remote code, no analytics.
- Privacy policy must disclose clipboard access and that data stays on-device.
