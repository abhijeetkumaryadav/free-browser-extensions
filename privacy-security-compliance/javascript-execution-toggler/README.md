# JavaScript Execution Toggler v1.0.0

Toggle JavaScript per site with one click. Per-site allow/block rules, a global default, and easy reset — all reversible.

## What it does

- **Current site** — shows whether JavaScript is allowed or blocked for the active tab's origin; one click toggles it (takes effect on reload).
- **Global default** — set the default JavaScript behavior for all sites; per-site rules override it.
- **Site rules** — lists every per-site rule you've created, with one-click delete; **Reset all rules** clears everything back to the browser default.
- Rules are stored on-device in `chrome.storage.local`; the extension keeps a mirror of its own rules because the API cannot enumerate them.

## Install

**Chrome / Edge**
1. Unzip `javascript-execution-toggler.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Unzip the package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
3. Note: the `contentSettings` API is Chromium-first; if your Firefox build doesn't expose it, the popup shows a friendly notice instead of failing.

**Opera** — same as Chrome via `opera://extensions`.

## Permissions (and why)

| Permission | Why |
|---|---|
| `contentSettings` | Required to read and change the per-site JavaScript content setting. |
| `storage` | Remembers your site rules and global default on-device. |
| `activeTab` | Lets the popup read the current tab's URL to show and toggle its rule. |

No network requests are ever made. No data leaves your device.

## Publishing notes

- MV3 only; no deprecated APIs.
- `contentSettings` is a Chromium API — on the Chrome Web Store no extra justification is needed beyond the listing description; for Firefox, the graceful-degradation notice covers unsupported builds.
- Screenshots: popup showing current-site toggle and the site-rules list.
