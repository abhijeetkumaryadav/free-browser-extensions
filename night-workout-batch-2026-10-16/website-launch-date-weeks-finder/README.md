# Site Age Tracker — Launch Date Weeks Finder

A personal site-age tracker. Record launch dates **you** collected for domains,
and see each site's age in weeks + remaining days (plus total days).

## What it does

- Add a domain + the launch date you recorded (date picker, past dates only).
- Each entry shows: **N weeks + M days** since launch, launch date, and total days.
- Search across tracked domains; newest launches first.
- Delete entries anytime. Everything is stored locally in `chrome.storage.local`.

## What it does NOT do (honest scope)

- **Cannot discover real launch dates.** There is no browser API or public data
  source that reliably reveals when a website launched. Every date in this
  extension is one you typed in yourself — it is a tracker, not a finder.

## Permissions

- `storage` — saves your recorded launch dates on this machine. Nothing else.

## Privacy

100% local. No network calls, no analytics, no remote libraries.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.
