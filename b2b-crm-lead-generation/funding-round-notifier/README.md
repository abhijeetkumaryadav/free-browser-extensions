# Funding Round Notifier v1.0.0

Track startups you're watching: save companies with notes and a
follow-up date — the extension fires a local notification on that
date via `chrome.alarms`. Log announced funding rounds (stage,
amount, date) per company and view them on a vertical timeline.
All data stays on-device; nothing is scraped from the web.

## Try it
1. Unzip `funding-round-notifier.zip`.
2. Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json`.
   (Note: `chrome.alarms` reminders work in Chrome/Edge; Firefox supports alarms with its own timing granularity.)
3. Click the icon → watch a company with a follow-up date → log rounds as they're announced.

## Publishing notes
- Permissions: `storage` (watchlist + rounds, on-device), `alarms`
  (follow-up reminders), `notifications` (showing the reminder).
  No network access, no data collection.
- Chrome Web Store: $5 one-time dev fee. Edge Add-ons and Firefox signing are free.
