# XML Sitemap Product Extractor v1.0.0

Pull every URL out of a site's sitemap — **Fetch this site's
sitemap** reads it from the page you're on (same-origin only, via
robots.txt then `/sitemap.xml`, following sitemap indexes), or paste
raw sitemap XML to parse locally. A product-URL heuristic filter
(toggleable) narrows results to product-like pages; one-click CSV
export (`url,lastmod`) downloads the full list.

Privacy by design: only same-origin requests are ever made — no
arbitrary cross-origin fetching — and pasted XML never leaves your
device.

## Try it
1. Unzip `xml-sitemap-product-extractor.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select folder.
3. Open any site, click the icon → **Fetch this site's sitemap** → Export CSV.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.

## Permissions
- `activeTab` + `scripting` — inject a one-shot reader into the tab you clicked on, to fetch that site's own sitemap. No broad host access.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee, MV3, minimal permissions declared.
- No remote servers, no analytics, no tracking.
