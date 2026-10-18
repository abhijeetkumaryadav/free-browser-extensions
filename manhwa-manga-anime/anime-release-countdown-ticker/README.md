# HypeDrop — Anime Release Countdowns (v1.0.0)

Track upcoming anime releases with live ticking countdowns, a toolbar badge
showing the nearest release, and a notification when a release goes live.

**Honest scope:** dates are entered by you (any timezone, interpreted in your
local time). There is no live release database, no accounts, and nothing is
synced or sent anywhere — everything lives in `chrome.storage.local` on this
device.

## Features

- Add a title + release date/time; countdowns tick live (days / hrs / min / sec)
- Toolbar badge shows nearest upcoming release (`3d`, `6h`, `12m`)
- Notification when a release time passes
- Edit and delete entries; released items sink to the bottom
- Completion state persists across browser restarts (alarms reconcile on startup)

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → enable *Developer mode* →
*Load unpacked* → select the folder.

**Firefox:** MV3 is supported, but `chrome.action` badge text, `chrome.alarms`
and `notifications` behave slightly differently; sideload via
`about:debugging#/runtime/this-firefox` → *Load Temporary Add-on*.

**Opera:** enable Developer mode on `opera://extensions` → *Load unpacked*.

## Permissions (why each is needed)

| Permission      | Why                                                    |
|-----------------|--------------------------------------------------------|
| `storage`       | Persist your countdowns locally. No sync, no servers.  |
| `alarms`        | Per-minute check for passed releases; fires the notification. |
| `notifications` | The "Release day!" alert when a countdown reaches zero.|

## Publishing notes

- No remote code, no external requests, no data collection → minimal privacy
  disclosure needed ("does not collect or transmit any user data").
- Notification icon uses the bundled 128px icon; no action buttons, so no
  extra permissions are required.
