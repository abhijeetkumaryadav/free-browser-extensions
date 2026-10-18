# Year-over-Year Growth Visualizer v1.0.0

Track any yearly metric — revenue, users, anything. Create multiple
named series, log year/value pairs, and get:

- **Values chart** — bars per year with YoY % labels
- **YoY % chart** — diverging growth bars around a zero axis
- **CAGR**, total growth, and **best / worst year** badges
- Data points list with per-year YoY badges; re-logging a year updates it

Everything is stored on-device; nothing leaves your browser.

## Try it
1. Unzip `year-over-year-growth-visualizer.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.
4. Click the icon, add years + values, watch the charts.

## Permissions
- `storage` — saves your series and data points locally.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee, MV3, minimal permissions.
- Edge Add-ons and Firefox: free accounts; Firefox requires add-on signing.
