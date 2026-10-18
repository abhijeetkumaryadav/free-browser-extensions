# Data Broker Opt-Out Scanner — v1.0.0

A personal opt-out checklist tracker: a curated directory of 16 major data brokers with links to their official opt-out pages, per-broker status tracking (Not started → Submitted → Confirmed), progress stats, and follow-up reminders.

**Honest scope:** this is a tracker, not an automated remover. Opt-outs are submitted manually by you on each broker's official page. The extension never scrapes broker sites and never sends your data anywhere.

## Features
- 16 pre-loaded brokers (Spokeo, BeenVerified, Whitepages, Intelius, TruthFinder, …) with official opt-out URLs
- One-click status cycling, per-broker 30-day follow-up reminders
- Daily alarm checks for due reminders and fires a notification
- Add / edit / delete custom brokers, search filter, progress bar + stats
- Everything stored in `chrome.storage.local` — fully on-device

## Install
**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions (justified)
- `storage` — persist your broker list, statuses, and reminders
- `alarms` — daily check for due follow-up reminders
- `notifications` — notify you when a follow-up is due

No host permissions. No network calls except the opt-out pages you choose to open. No data leaves your device.

## Publishing notes
- MV3, no remote code, no deprecated APIs
- Clearly labeled as a manual tracker in the description and listing copy — do not claim automated removal
