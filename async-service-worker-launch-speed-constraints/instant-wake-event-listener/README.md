# WakeUp — Scheduled Tab Waker

Schedule a tab to wake: pick an open tab (or enter a URL) and a time. At that time the
extension activates the tab — or opens the URL in a new tab if it was closed — and shows
a notification.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox** — this build uses `chrome.alarms`/`chrome.notifications`/`chrome.tabs` under MV3;
a Firefox port would need the same manifest with no changes to logic. Not tested there yet.

**Opera** — load via `opera://extensions` the same way as Chrome.

## Permissions

- `storage` — saves your scheduled wakes on-device.
- `alarms` — fires wakes at the scheduled time, including after browser restarts.
- `notifications` — shows a "WakeUp" notification when a wake fires.
- `tabs` — reads open-tab titles for the picker and activates the tab when its wake fires.

## Publishing notes

- Manifest V3, no remote code, no network calls, all data stays on-device.
- Alarm granularity is about one minute; wakes may fire up to ~1 min after the chosen time.
- A wake cannot fire while the browser is fully quit (alarms need the browser running).
- Store listing category: Productivity. No privacy policy URL needed (no data collection).

## Honest scope

- Wakes fire on alarm granularity (~1 minute), not to the second.
- If the browser is closed at wake time, the wake fires on next startup.
- Tab activation requires the `tabs` permission; the extension never reads page content.
