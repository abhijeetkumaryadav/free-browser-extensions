# History Price Logger v1.0.0

**Log price** on any product page: detects the title and price, then
tracks it over time. See a sparkline chart, low/average/high stats,
and badges like "New all-time low" or "12% below average". All
tracked products listed with % change since first log.

## Try it
1. Unzip `history-price-logger.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any product page → **Log price** → come back later and log again.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you log),
  `storage` (history on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.
