# Network Payload Ticker

Live per-tab tally of network bytes in/out with a per-host breakdown.

## Honest scope

- **Counts bytes only** — it tallies request and response sizes via the `webRequest` API.
- Response sizes come from the `Content-Length` response header. Where a server hides that header (chunked encoding, some CDNs), the response is counted as **unknown size** — the popup shows how many responses were unknown.
- Request sizes are estimated from the method, URL, and any request body bytes.
- The tally is per-tab and session-scoped: it **resets when the background worker sleeps** or the tab closes. Use **Reset** in the popup to clear a tab's tally manually.
- It never reads request or response bodies — only sizes.

## Use

1. Browse normally; the worker tallies traffic per tab in the background.
2. Click the extension icon to see live totals (refreshes every second) and the per-host breakdown for the active tab.

## Permissions

- `webRequest` + `<all_urls>` host permission — to observe request/response sizes on any tab. Nothing is modified or blocked.
- `tabs` — to identify the active tab for the popup.
- `storage` — reserved for future settings; not used for telemetry.

No network calls, no analytics, no remote code. 100% local.
