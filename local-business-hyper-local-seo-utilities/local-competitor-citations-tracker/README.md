# Citation Tracker — Local Competitor NAP Monitor v1.0.0

Track **NAP (Name, Address, Phone) citation consistency** for your business and competitors across local directories. Log how each business is listed on each directory, get a consistency score, flag mismatches, and track fixes — all manually entered, all on-device.

## What it does

- **Businesses tab** — add your business and competitors with their canonical (correct) name, address, and phone.
- **Log listing tab** — record how a business appears on a directory (Google Business Profile, Yelp, Bing Places, … or any custom directory you type in). Blank fields are skipped in scoring.
- **Report tab** — per-business consistency score ring, per-directory field badges (✓ match / ✕ mismatch / – not entered), "Mark fixed" tracking, and CSV/JSON export.

Scoring normalizes phones to digits and names/addresses to case/punctuation-insensitive text, so `"(555) 123-4567"` matches `"5551234567"`.

**Honest scope:** this is a manual tracker. It never scrapes directories, never fetches listings, and never sends data anywhere.

## Install

**Chrome / Edge**
1. Unzip `local-competitor-citations-tracker.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder. (Temporary installs reset on browser restart.)

**Opera**
1. Open `opera://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select the unzipped folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your businesses and listings on this device only. |
| `clipboardWrite` | Copy the JSON export to your clipboard. |

No host permissions, no network access.

## Publishing notes

- MV3 only, no deprecated APIs.
- Privacy policy can state: collects nothing, transmits nothing; all data stays in local extension storage.
- Screenshots: show Businesses tab, Log listing tab, and the Report ring.
