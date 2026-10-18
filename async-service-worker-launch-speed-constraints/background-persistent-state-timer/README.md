# EverTimer — Persistent Background Timer v1.0.0

Countdowns and stopwatches that survive browser restarts, with named timers,
completion notifications, and a live toolbar badge.

## What it does

- **Countdowns**: name + minutes (quick presets 5/10/25/60), live remaining
  time, progress bar, pause/resume/reset/delete.
- **Stopwatches**: count up with pause/resume/reset.
- **Persistent**: all state lives in `chrome.storage.local`. Close the browser
  mid-timer and it resumes correctly on next launch — countdowns that elapsed
  while closed complete with a notification.
- **Completion notifications**: a system notification when a countdown ends.
- **Badge**: the toolbar badge shows the shortest-running countdown
  (e.g. `4m`, `2h`).
- **Live popup**: times tick every second while the popup is open; resyncs
  with the service worker every 15 s.

## Honest scope

- While the browser is backgrounded, Chrome coalesces alarm ticks to roughly
  one per minute. A countdown's *completion* alarm fires close to on time,
  but the badge display only refreshes to ~1-minute granularity in the
  background.
- Timers are stored on this device only.

## Install

1. Unzip, then open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode**, click **Load unpacked**, select this folder.
3. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on
   (`alarms`/`notifications`/`storage` are supported in Firefox MV3).

## Permissions — why each is needed

| Permission | Why |
|---|---|
| `storage` | Persist timer state across restarts. |
| `alarms` | Fire completion alarms while backgrounded; survive service worker sleep. |
| `notifications` | Notify when a countdown completes. |

## Privacy

Everything runs on-device. No analytics, no network calls, no data leaves the browser.

## Publishing notes

- Chrome Web Store / Edge Add-ons: single-purpose (timers), minimal justified
  permissions, no remote code. Notification permission is core to the feature.
