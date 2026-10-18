# Hours Consistency Tracker — Store Hours Mismatch Notifier

Keep your store's opening hours consistent everywhere customers look. Log hours
manually per platform (Google, Yelp, Facebook, your website…), and the extension
flags any day where platforms disagree — with a 0–100 consistency score.

## What it does

- **Per-platform hours** — add unlimited platforms; set open/close times or
  "Closed" for each day of the week (24h format).
- **Mismatch detection** — days where platforms disagree are highlighted in the
  editor, listed in a warning banner with per-platform detail, and badged on the
  platform list.
- **Consistency score** — ring shows the % of days where all platforms agree.
- **Copy hours** — copy one platform's full week to another in two clicks.
- **Holiday overrides** — date-specific special hours or closures (Diwali,
  Christmas…), shown in date order.
- **Export** — download everything as JSON or CSV for records/invoicing.
- **100% manual & on-device** — no platform APIs, no credentials, no network.

## Install

1. Unzip `store-operating-hours-mismatch-notifier.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `manifest.json`.

## Permissions

- `storage` — saves your platforms, hours, and holiday overrides locally. Nothing else.

## Publishing notes

- Manifest V3, no remote code, no host permissions, no network calls.
- Uses `confirm()`/`prompt()` only for destructive or disambiguating actions.

## Limitations

- Hours are entered by hand — the extension cannot read your live listings.
- A platform with no open days is excluded from comparison (badge: "no hours").
- New platforms default to all-closed; untick "Closed" and set times to activate.
