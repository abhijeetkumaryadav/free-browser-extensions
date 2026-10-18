# LinkSentry — Broken Link Checker for Live CMS

On-demand broken-link scanner for the page you're editing or reviewing. Click **Scan this page** and LinkSentry checks every link on the tab, then reports broken, redirected, slow, and unverifiable URLs with their locations — and exports the findings.

## What it checks

- **Broken** — HTTP 4xx/5xx responses or links that time out (15s per link).
- **Redirect** — links that resolve through a redirect chain (shows the final URL).
- **Slow** — working links that take longer than 3 seconds to respond.
- **Unverified** — links the browser could not check (bot protection, WAF, or network blocks).

## Honest scope

- **Bot-protected links are marked Unverified — never counted as broken.** Some sites block automated HEAD requests; LinkSentry does not guess.
- Checks run on demand from your own browser, rate-limited to **4 concurrent requests** with a small pause between batches, so you won't hammer anyone's server.
- Same-origin links are checked first (most reliable, most relevant for CMS editors); cross-origin checks rely on the `<all_urls>` host permission, which is required for this extension to do its job.
- Same-page fragment links (`#section`) and non-web schemes (`mailto:`, `tel:`, `javascript:`) are skipped.

## How it works

1. Content script collects unique `http(s)` links with their link text and a CSS-path location.
2. The popup runs `HEAD` requests (falling back to ranged `GET` when a server rejects `HEAD`), records status, redirect chains, and response time.
3. Findings render worst-first with filter chips, per-link **Reveal on page** (scrolls to and flashes the link), and **JSON/CSV export**.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your last scan report locally |
| `activeTab` | Scans only the tab you click on |
| `scripting` | Injects the on-demand link collector |
| `<all_urls>` host | Required to check link targets across origins |

## Privacy

100% local. No analytics, no accounts, no remote servers. Your last scan report stays in `chrome.storage.local` on your device.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — scanner UI and check engine
- `content.js` — on-demand link collector + reveal helper
- `icons/` — generated PNG icons (16/48/128)
