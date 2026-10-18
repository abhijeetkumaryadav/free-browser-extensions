# Job Board Insight Overlay v1.0.0

On any job board search page you're viewing, **Scan page** extracts
visible job cards (title, company, location, salary when shown) into
a filterable list: keyword filters, green-dot highlighting for
listings new since your last scan, and one-click CSV export.
Best-effort extraction — layouts vary by board — and everything is
on-device.

## Try it
1. Unzip `job-board-insight-overlay.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a job search results page → click the icon → **Scan page**.

## Permissions
- `activeTab` + `scripting` — read the job board page only when you
  press Scan. Never runs in the background.
- `storage` — remembers which listings you've already seen (per board).

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. Edge: free. Firefox: free (sign the .zip via AMO).
- Listing disclosure: reads page content only on user action; no data leaves the device.
