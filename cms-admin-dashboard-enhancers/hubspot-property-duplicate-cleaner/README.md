# Property Dedupe Planner

**Slug:** `hubspot-property-duplicate-cleaner` · **Version:** 1.0.0 · **Manifest V3**

An offline planner that finds near-duplicate CRM property names using Levenshtein-based fuzzy matching, groups them, lets you mark keep / merge / delete decisions per property, and exports a merge-plan CSV.

> **Honest scope:** This is an offline planning tool. It does **not** connect to HubSpot (or any CRM) and never requests API credentials. You paste property names in; decisions and exports stay on your device.

## Features

- Paste one property per line, or paste CSV (first column is used)
- Adjustable similarity threshold (50–100%, default 80%) with live re-grouping
- Single-linkage clustering: groups like `First Name`, `firstname`, `First name`
- Per-property decision buttons: **Keep** / **Merge** / **Delete**
- Min-similarity badge per group so you can judge group quality
- Export merge plan as CSV (copy to clipboard or download `.csv`)
- Remembers your last pasted input locally

## Install (developer mode)

**Chrome / Edge:**
1. Unzip the release ZIP.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
1. Unzip the release ZIP.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
3. Select `manifest.json` inside the unzipped folder. (Temporary installs are removed on browser restart.)

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remembers your last pasted input between popup sessions. |
| `clipboardWrite` | Lets the "Copy plan CSV" button write to your clipboard. |

No host permissions, no network calls, no remote code.

## Privacy

All matching, grouping, and export logic runs locally in the popup. Nothing is sent anywhere. The only persisted data is your last pasted input in `chrome.storage.local`.

## Publishing notes

- MV3, no deprecated APIs.
- No remote code execution; safe for Chrome Web Store / Edge Add-ons / Firefox AMO review.
- Store listing: describe as an offline CRM data-cleanup planner; avoid implying HubSpot integration.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI, styling, fuzzy-matching engine
- `icons/` — generated 16/48/128 PNG icons
- `hubspot-property-duplicate-cleaner.zip` — packaged release
