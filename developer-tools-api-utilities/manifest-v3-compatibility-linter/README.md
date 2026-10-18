# MV3 Compatibility Linter v1.0.0

Paste any Chrome extension `manifest.json` (v2 or v3) and get an
on-device audit: **18 rules** covering manifest_version, background
scripts → service_worker, browser_action/page_action → action,
webRequestBlocking, remotely-hosted code, old
web_accessible_resources / CSP formats, deprecated keys, and more.
Each finding shows **severity** (error / warning / info) plus a
suggested **fix**, and you get an overall **readiness score 0–100**
with a grade. Includes a one-click sample MV2 manifest and a
copy-as-markdown report. Nothing leaves your machine.

## Try it
1. Unzip `manifest-v3-compatibility-linter.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, paste a manifest, hit **Lint manifest**.

## Permissions
- `storage` — remembers the last pasted manifest between opens. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee. Declare `storage` as user data stored locally.
- Edge Add-ons and Firefox (MV3-compatible) accept the same package.
