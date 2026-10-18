# SitemapForge — Visual Sitemap Builder

Build and edit a `sitemap.xml` visually instead of hand-writing XML.

## What it does

- **Load from URL** — paste a sitemap.xml URL. It's fetched in the active tab's page context, so it works for the same site you're currently browsing (cross-origin is blocked by the browser's CORS rules — by design).
- **Paste XML** — paste raw sitemap.xml content and it gets parsed into the tree.
- **Build from this page's links** — collects all same-origin links from the active tab into a starter sitemap.
- **Tree view** — URLs grouped by top-level path, collapsible groups.
- **Edit per URL** — priority (0.0–1.0) and changefreq dropdowns, remove URLs, add new ones.
- **Export** — downloads a valid `sitemap.xml` (`urlset` + sitemap.org namespace).
- Your project persists in `chrome.storage.local` between sessions.

## Honest scope

- 100% client-side. Nothing is uploaded, submitted, or sent anywhere.
- URL fetching only works same-origin (browser CORS). If a remote URL fails, paste the XML instead.
- Link collection is same-origin links only; duplicates and fragments are cleaned automatically.

## Permissions

- `storage` — save your sitemap project locally.
- `activeTab` + `scripting` — read links / fetch the sitemap from the current page, only when you click.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `icons/`, `README.md`
