# Report Library — Salesforce Bookmark Manager v1.0.0

A tidy bookmark organizer for your Salesforce report links: save URLs with
names, folders, and notes; search; one-click open; CSV export.

> **Honest scope:** this is a bookmark organizer. It does NOT connect to
> Salesforce, uses no API, and never asks for credentials.

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`.

## Use
1. Click the extension icon.
2. Add a report: name + report URL + optional folder and notes.
3. Search or filter by folder, then **Open** (new tab), **Copy URL**, or **Delete**.
4. **Export CSV** downloads your whole catalog for sharing or backup.

## Permissions (all justified, minimal)
- `storage` — save your report catalog on-device.
- `clipboardWrite` — copy a report URL to your clipboard.

## Privacy
No network calls, no accounts, no analytics. Everything stays on your device.

## Publishing notes
- MV3, no deprecated APIs. No remote code.
- Listing category: Productivity. Disclose clearly in the description that it is
  not affiliated with or integrated into Salesforce.
