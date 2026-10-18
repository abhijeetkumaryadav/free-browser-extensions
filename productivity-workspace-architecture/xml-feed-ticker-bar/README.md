# XML Feed Ticker Bar

A quiet RSS/Atom reader for your toolbar. Add feed URLs, get refreshed headlines with unread badges and a toolbar count. Per-feed mute, graceful error display for dead feeds, refresh every 15 minutes.

## Install

**Chrome / Edge**
1. Unzip `xml-feed-ticker-bar.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json`.
   (Firefox alarms have a 1-minute minimum; the 15-minute schedule works fine.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Keep your feed list and cached items on-device. |
| `alarms` | Refresh feeds every 15 minutes. |
| `host_permissions: <all_urls>` | Fetch the RSS/Atom URLs **you** add — feed hosts aren't known in advance, so this is required. No other site is ever contacted, and nothing leaves your device. |

## Notes

- Parses RSS 2.0 and Atom. Anything else shows a clear "Not a valid XML feed" error on that feed.
- Muted feeds are skipped on refresh but kept in the list.
- Clicking a headline marks it read and opens the article in a new tab.
- Caps stored items at 200 to keep storage small.

## Publishing

- Chrome Web Store: $5 one-time developer registration, MV3 — ready. Be ready to justify `<all_urls>` in review (feed URLs are user-supplied).
- Edge Add-ons: free account — ready.
- Firefox: requires Mozilla signing; consider narrowing host permissions if reviewers ask.
