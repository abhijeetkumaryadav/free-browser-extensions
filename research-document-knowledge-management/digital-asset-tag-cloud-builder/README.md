# TagCloud — Bookmark Tag Explorer v1.0.0

Save links with tags, explore them in an interactive tag cloud, filter by tag, search your collection, and export/import it as JSON. 100% on-device — nothing ever leaves your browser.

## Features

- **Add links** with a title, URL, and comma-separated tags (deduped, normalized)
- **Interactive tag cloud** — tag size scales with frequency; click a tag to filter
- **Live search** across titles, URLs, and tags
- **Links tab** — full collection, jump to any link, delete individual links
- **Export / Import** — one-click JSON backup and restore (dedupes by URL)
- Only `http(s)` URLs are accepted — no `javascript:` or exotic schemes

## Install

1. Unzip `digital-asset-tag-cloud-builder.zip` anywhere.
2. Open `chrome://extensions` (Edge: `edge://extensions`; Firefox: `about:debugging#/runtime/this-firefox`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the toolbar icon and click it to open TagCloud.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persists your saved links and tags in `chrome.storage.local` on-device. No network access, no tracking. |

No host permissions, no content scripts, no background page. The extension cannot see your browsing.

## Privacy

All data is stored locally in `chrome.storage.local`. No analytics, no network requests, no accounts.

## Publishing notes

- Manifest V3, works in Chrome/Edge; Firefox-compatible (`browser.storage.local` via the `chrome` namespace works in Firefox).
- Suggested store category: Productivity.
- No remote code, no obfuscation — review-friendly.

## Limitations

- Cloud shows up to all tags; results list caps at 50 per filter (full list in the Links tab).
- Maximum 12 tags per link; tag names capped at 40 characters.
