# Research Journey Mapper

A Chrome/Edge/Firefox/Opera (MV3) browser extension that maps your research
progress as a visual timeline of milestones you log yourself.

## What it does

- **Log milestones** with a type (question asked, source found, draft written,
  decision made, note), title, date, and details
- **Visual timeline** with color-coded nodes and a connecting line
- **Filter** the timeline by milestone type
- **Delete** individual milestones
- **Export** the full journey as a Markdown summary (`.md` download)

## Honest scope

- This shows **only the milestones you log** — it does **not** read, scan, or
  infer anything from your browsing history.
- 100% local: milestones are stored in your browser (`chrome.storage.local`).
  Nothing is sent anywhere.

## Permissions

- `storage` — persists your milestones.
- `downloads` — saves the exported Markdown summary.

## Privacy

No network requests. No analytics. No data leaves the browser.
