# ZoomInfo Data Cleaner v1.0.0

Paste messy contact data (CSV or tab-separated, with a header row)
and get a clean, deduped CSV back. It normalizes:

- **Names** — proper title-casing (handles O'Brien, McDonald)
- **Phones** — digit normalization to `(555) 123-4567` / `+1 (…)` format
- **Companies** — whitespace cleanup, casing fix (keeps acronyms like IBM)
- **Emails** — lowercased and validated

Also **dedupes rows** (by email, or name+company), **flags incomplete
records** (missing name, email, or phone), and exports a clean CSV
(download or copy). Preview shows in/out/dupes/flagged counts.

**Privacy:** works on data *you paste* only — it never scrapes
ZoomInfo or any other service, and everything runs on-device.

## Try it
1. Unzip `zoominfo-data-cleaner.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.
4. Paste data, hit **Clean data**, download the CSV.

## Permissions
- `storage` — persists your last cleaned result and options on-device.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee, MV3, minimal permissions.
- Edge Add-ons and Firefox: free accounts; Firefox requires add-on signing.
