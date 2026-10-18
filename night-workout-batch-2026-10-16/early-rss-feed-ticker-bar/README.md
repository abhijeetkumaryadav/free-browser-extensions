# RSS Ticker — Early Feed Reader

Your feeds, fetched on demand. Add RSS 2.0 / Atom feed URLs, see the latest
headlines in a scrolling ticker plus a dated list, click any headline to open
the article in a new tab.

## Honest scope

- **Fetches only the feeds you add.** The only network requests this extension
  ever makes are `fetch()` calls to your saved feed URLs (plus opening articles
  you click). No analytics, no background polling — refresh happens when you
  press the button or open the popup.
- Extension pages are exempt from CORS, so no broad host permissions are
  needed; `storage` is the only permission.
- Parses RSS 2.0 and Atom with a local DOMParser. Bad XML shows a friendly
  error instead of breaking.

## Use

1. Paste a feed URL (e.g. `https://example.com/feed.xml`) and press **Add**.
2. Press the refresh button to fetch all feeds.
3. Headlines appear in the ticker and the list below; click one to open it.
4. Remove a feed with the × on its chip.

## Files

- `manifest.json` — MV3 manifest (`storage` only).
- `popup.html` / `popup.css` / `popup.js` — popup UI, ticker animation,
  feed engine (RSS/Atom parsing, URL normalisation) between `// ENGINE-START` /
  `// ENGINE-END` markers — headless-tested with node (14/14).
- `icons/` — generated PNG icons (16 / 48 / 128).

## Permissions

- `storage` — saves your feed list locally. Nothing else.
