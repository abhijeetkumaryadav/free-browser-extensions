# Directory CSV Exporter v1.0.0

On any directory or listing page you're viewing (team pages,
business directories), **Scan this page** extracts names, roles,
emails, and phone numbers from person cards, `mailto:` / `tel:`
links, and nearby text into a reviewable table. Remove bad rows,
then **Export CSV** or copy all emails. Best-effort extraction —
always review before exporting. All on-device.

## Try it
1. Unzip `directory-csv-exporter.zip`.
2. `chrome://extensions` (Edge: `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Open a team/directory page → click the icon → **Scan this page**.

## Permissions
- `activeTab` — scan only the page you explicitly scan.
- `scripting` — run the extractor on that page.
- `storage` — remember your last scan between popup opens.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration.
- Single-purpose, minimal permissions, no data leaves the device.
