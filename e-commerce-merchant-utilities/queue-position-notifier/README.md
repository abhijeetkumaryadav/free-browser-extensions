# Queue Position Notifier v1.0.0

**Drop/launch notifier.** Save any product page with a go-live time;
the extension rings a system notification the moment it's time to
check the page, sets an amber badge on the icon, and takes you to
the page when you click the notification. Live countdowns for every
upcoming reminder.

## Try it
1. Unzip `queue-position-notifier.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open a product page → set a reminder a few minutes out → watch the notification fire.

## Permissions
- `storage` — reminders live on-device, nothing leaves the browser.
- `alarms` — fires each reminder at its scheduled time (MV3-safe; no polling).
- `notifications` — shows the drop-time alert.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. Edge: free. Firefox: free,
  `chrome.alarms`/`chrome.notifications` are supported in Firefox MV3.
- No remote code, no network calls, no analytics.
