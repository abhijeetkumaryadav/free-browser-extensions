# Launch Countdown — Your Rocket Launches

A personal launch tracker: add rocket launches you care about, see a live
countdown to the next liftoff, and get a notification 10 minutes before.

## What it does

- Add launches with mission name, date/time, rocket, and launch site
- Live 1-second countdown to the next upcoming launch
- Upcoming and past launch lists with delete
- Optional "notify 10 minutes before liftoff" per launch (background alarm + notification)
- Everything stored in `chrome.storage.local`

## What it is NOT

**Your entries only — not a live launch schedule.** There is no feed, no
spaceflight API, and no network access at all. You enter the launches you
want to track; the extension just counts down to them.

## Permissions

- `storage` — save your launches
- `alarms` — schedule the liftoff notification
- `notifications` — show the 10-minute warning

No data ever leaves the browser.
