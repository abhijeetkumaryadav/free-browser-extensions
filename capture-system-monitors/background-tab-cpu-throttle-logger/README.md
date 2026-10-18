# TabState Log — Background Tab Monitor

A background-tab **state logger**: watches your tabs' observable lifecycle
states (active, audible, discarded, created, removed) over time with
timestamps, and exports the log as JSON or TXT.

## Honest scope

- **Per-tab CPU usage is not exposed to extensions.** No extension can measure
  how much CPU a tab uses or whether the browser throttled it. This tool logs
  the states the `chrome.tabs` API *does* expose — it cannot measure CPU or
  throttling, and it never claims to.
- States shown: ACTIVE, AUDIBLE (playing sound), DISCARDED (unloaded by the
  browser to save memory), IDLE.
- The log keeps the latest 500 events, all stored locally on your device.

## Install (developer mode)

1. Download and unzip `background-tab-cpu-throttle-logger.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

Chrome / Edge / Opera recommended. Firefox supports MV3 service workers and
the `tabs` API used here; behavior should carry over but is best-effort.

## Usage

1. Click the TabState Log toolbar icon.
2. **Tabs right now** lists every open tab with its current state badges.
3. **Event log** shows timestamped state changes as they happen (the service
   worker records them in the background).
4. Export the log with **JSON** / **TXT**, or **Clear** it.

## Permissions

- `tabs` — read tab titles and states, and receive tab lifecycle events.
- `storage` — keep the event log locally (latest 500 events).

No network requests. No data leaves your device.

## Publishing notes

- Manifest V3, service-worker background, no deprecated APIs.
- Store reviewers: the description and popup both state plainly that CPU is
  not measured — this avoids "misleading functionality" flags.
