# LicenseLens — Regional Licensing Compliance Verifier v1.0.0

A compliance assistant that keeps your licences organised: a curated directory of
official licensing authorities, step-by-step compliance checklists with progress
tracking per licence, renewal reminders, and notes.

## What it does
- **Directory** — searchable, filterable list of official licensing authority links
  grouped by region and category (business, food & beverage, media, healthcare,
  finance, data & privacy).
- **My Licenses** — track licences with an 8-step compliance checklist, progress
  bars, issue/expiry dates and notes. Everything is stored on-device.
- **Reminders** — notifications 30, 7 and 1 day before a licence expires
  (checked daily via `chrome.alarms`).

Clearly labelled as a directory + checklist assistant; it does not verify legal
compliance itself — always confirm requirements with the official authority.

## Install (Chrome / Edge)
1. Unzip `regional-licensing-compliance-verifier.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
   (Note: `chrome.alarms`/`notifications` map to the `browser.*` namespace; the
   reminder worker targets Chromium-based browsers primarily.)

## Permissions — why each is needed
| Permission | Justification |
|---|---|
| `storage` | Stores your tracked licences, checklist progress and notes on-device. |
| `alarms` | Runs the daily renewal-expiry check. |
| `notifications` | Shows renewal reminders. Nothing else triggers notifications. |

No network requests are made by the extension itself; authority links only open
when you click them. No data leaves the device.

## Publishing notes
- Manifest V3, no remote code, no analytics.
- Privacy disclosure: "No data collected — all licence data stays on-device."
- Screenshots: show the Directory, a license card with checklist progress, and
  the Reminders tab.
