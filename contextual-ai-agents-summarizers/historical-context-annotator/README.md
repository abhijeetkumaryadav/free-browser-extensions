# Historical Context Annotator v1.0.0

On any page, hit **Scan page** to extract the years and dates it
mentions (standalone years like 1947, and full dates like
“March 15, 1947”) into a vertical timeline with the surrounding
sentence for context. Add your own note to any year — notes are
saved per page on this device.

Extraction is best-effort from page text and labeled as such; it is
not a historical fact-checker.

## Try it
1. Unzip `historical-context-annotator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open an article, click the icon, **Scan page**, add notes.

## Permissions
- `activeTab` + `scripting` — read the text of the page you scan (only when you click).
- `storage` — your per-page notes, on-device only.

## Publishing notes
- No network access, no data leaves the device.
- Chrome Web Store: $5 one-time developer registration fee.
- Firefox: self-distribute signed via AMO (free).
