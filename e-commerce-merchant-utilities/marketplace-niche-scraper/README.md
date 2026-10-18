# Marketplace Niche Scraper v1.0.0

Open any marketplace search or category page and hit **Scan page**:
extracts visible listings (title, price, rating) into a sortable table
(click any column header), with a niche summary (listing count, price
range, average rating) and one-click **CSV export**.

Best-effort, on-device extraction from what the page visibly renders —
scroll to load more listings, then scan again. Never bypasses logins.

## Try it
1. Unzip `marketplace-niche-scraper.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a marketplace search page → click the icon → **Scan page**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you scan). No storage, nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.
